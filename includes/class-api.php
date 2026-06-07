<?php
/**
 * OpenAI-Compatible API Client
 *
 * Handles communication with any OpenAI-compatible API endpoint
 * (OpenAI, Azure, Ollama, LocalAI, vLLM, etc.) for SQL generation.
 *
 * @package SILC_WooInsight_AI
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * API client class.
 */
class SILC_WIA_API {

	/**
	 * Default settings.
	 */
	const DEFAULT_API_URL     = 'https://api.openai.com/v1';
	const DEFAULT_MODEL       = 'gpt-4o-mini';
	const DEFAULT_MAX_TOKENS  = 500;
	const DEFAULT_TEMPERATURE = 0.2;

	/**
	 * Get API settings.
	 *
	 * @return array
	 */
	public static function get_settings(): array {
		$defaults = array(
			'api_url'     => self::DEFAULT_API_URL,
			'api_key'     => '',
			'model'       => self::DEFAULT_MODEL,
			'max_tokens'  => self::DEFAULT_MAX_TOKENS,
			'temperature' => self::DEFAULT_TEMPERATURE,
		);

		$saved = get_option( 'silc_wia_api_settings', array() );

		if ( ! is_array( $saved ) ) {
			$saved = array();
		}

		return wp_parse_args( $saved, $defaults );
	}

	/**
	 * Generate SQL from a natural language question using the configured API.
	 *
	 * @param string $question      The user's natural language question.
	 * @param string $schema_context The database schema context for the prompt.
	 * @return array{success: bool, sql: string, error: string}
	 */
	public static function generate_sql( string $question, string $schema_context ): array {
		$settings = self::get_settings();

		if ( empty( $settings['api_key'] ) ) {
			return array(
				'success' => false,
				'sql'     => '',
				'error'   => __( 'API key is not configured. Please go to Settings and add your API key.', 'silc-wooinsight-ai' ),
			);
		}

		$api_url = untrailingslashit( $settings['api_url'] );

		// Build the chat completion prompt.
		$system_prompt = self::build_system_prompt();
		$user_prompt   = self::build_user_prompt( $question, $schema_context );

		$body = array(
			'model'       => $settings['model'],
			'messages'    => array(
				array( 'role' => 'system', 'content' => $system_prompt ),
				array( 'role' => 'user',   'content' => $user_prompt ),
			),
			'max_tokens'  => (int) $settings['max_tokens'],
			'temperature' => (float) $settings['temperature'],
		);

		$response = wp_remote_post(
			$api_url . '/chat/completions',
			array(
				'timeout'   => 600,
				'headers'   => array(
					'Authorization' => 'Bearer ' . $settings['api_key'],
					'Content-Type'  => 'application/json',
				),
				'body'      => wp_json_encode( $body ),
			)
		);

		if ( is_wp_error( $response ) ) {
			return array(
				'success' => false,
				'sql'     => '',
				'error'   => sprintf(
					/* translators: %s: error message */
					__( 'API request failed: %s', 'silc-wooinsight-ai' ),
					$response->get_error_message()
				),
			);
		}

		$status_code = wp_remote_retrieve_response_code( $response );
		$body_raw    = wp_remote_retrieve_body( $response );
		$data        = json_decode( $body_raw, true );

		if ( $status_code !== 200 ) {
			$error_msg = isset( $data['error']['message'] ) ? $data['error']['message'] : sprintf(
				/* translators: %d: HTTP status code */
				__( 'API returned HTTP %d', 'silc-wooinsight-ai' ),
				$status_code
			);
			return array(
				'success' => false,
				'sql'     => '',
				'error'   => $error_msg,
			);
		}

		// Extract the response text.
		$content = '';
		if ( isset( $data['choices'][0]['message']['content'] ) ) {
			$content = $data['choices'][0]['message']['content'];
		}

		if ( empty( $content ) ) {
			return array(
				'success' => false,
				'sql'     => '',
				'error'   => __( 'API returned an empty response.', 'silc-wooinsight-ai' ),
			);
		}

		// Parse the SQL from the response.
		$sql = self::extract_sql( $content );

		if ( empty( $sql ) ) {
			return array(
				'success' => false,
				'sql'     => '',
				'error'   => __( 'Could not extract SQL from the API response.', 'silc-wooinsight-ai' ),
			);
		}

		return array(
			'success' => true,
			'sql'     => $sql,
			'error'   => '',
		);
	}

	/**
	 * Build the system-level prompt for SQL generation.
	 *
	 * @return string
	 */
	private static function build_system_prompt(): string {
		return 'You are a SQL expert for WooCommerce on WordPress. '
			. 'Your task is to convert natural language questions into valid MySQL SELECT queries. '
			. 'Follow these rules strictly:'
			. "\n1. ONLY output the SQL query, nothing else."
			. "\n2. The SQL must be a single SELECT statement only."
			. "\n3. Use the table prefix provided in the schema context."
			. "\n4. Use proper MySQL syntax."
			. "\n5. Do NOT add any markdown formatting, code fences, or explanations."
			. "\n6. Do NOT include semicolons at the end."
			. "\n7. If you cannot answer, output: -- unable to generate query";
	}

	/**
	 * Build the user prompt containing schema context and question.
	 *
	 * @param string $question       The user's question.
	 * @param string $schema_context Database schema context.
	 * @return string
	 */
	private static function build_user_prompt( string $question, string $schema_context ): string {
		$prompt = 'Here is the WooCommerce database schema (table prefix included):'
			. "\n\n" . $schema_context
			. "\n\nUser question: " . $question
			. "\n\nGenerate ONLY the SQL query:";

		return $prompt;
	}

	/**
	 * Extract SQL from the API response text, stripping markdown fences.
	 *
	 * @param string $text The raw response text.
	 * @return string The extracted SQL, or empty string.
	 */
	private static function extract_sql( string $text ): string {
		// Remove markdown code fences (```sql ... ``` or ``` ... ```).
		$text = preg_replace( '/```(?:sql)?\s*\n?/i', '', $text );

		// Trim whitespace.
		$text = trim( $text );

		// Find the first SELECT statement.
		$pos = stripos( $text, 'SELECT' );
		if ( false === $pos ) {
			// Check for comment-based "unable to generate" indicator.
			if ( strpos( $text, '-- unable' ) !== false ) {
				return '';
			}
			return '';
		}

		$sql = substr( $text, $pos );

		// Remove trailing semicolons.
		$sql = rtrim( $sql, "; \t\n\r\0\x0B" );

		return trim( $sql );
	}

	/**
	 * Test the API connection with a simple request.
	 *
	 * @return array{success: bool, message: string}
	 */
	public static function test_connection(): array {
		$settings = self::get_settings();

		if ( empty( $settings['api_key'] ) ) {
			return array(
				'success' => false,
				'message' => __( 'No API key configured.', 'silc-wooinsight-ai' ),
			);
		}

		$api_url = untrailingslashit( $settings['api_url'] );

		$response = wp_remote_post(
			$api_url . '/chat/completions',
			array(
				'timeout'   => 30,
				'headers'   => array(
					'Authorization' => 'Bearer ' . $settings['api_key'],
					'Content-Type'  => 'application/json',
				),
				'body'      => wp_json_encode( array(
					'model'    => $settings['model'],
					'messages' => array(
						array( 'role' => 'user', 'content' => 'Say "ok" and nothing else.' ),
					),
					'max_tokens' => 10,
				) ),
			)
		);
		
		if ( is_wp_error( $response ) ) {
			return array(
				'success' => false,
				'message' => $response->get_error_message(),
			);
		}

		$status_code = wp_remote_retrieve_response_code( $response );
		if ( $status_code !== 200 ) {
			$body  = json_decode( wp_remote_retrieve_body( $response ), true );
			$error = isset( $body['error']['message'] ) ? $body['error']['message'] : "HTTP $status_code";
			return array(
				'success' => false,
				'message' => $error,
			);
		}

		return array(
			'success' => true,
			'message' => __( 'Connection successful!', 'silc-wooinsight-ai' ),
		);
	}
}
