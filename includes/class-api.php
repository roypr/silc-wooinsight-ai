<?php
/**
 * OpenAI-Compatible API Client
 *
 * Handles communication with any OpenAI-compatible API endpoint
 * (OpenAI, Azure, Ollama, LocalAI, vLLM, etc.) for SQL generation.
 *
 * Supports both standard instruct models and reasoning models (o1, o3,
 * DeepSeek-R1, etc.) with appropriate parameter handling for each.
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
	 * Max tokens for insight generation (JSON output needs more).
	 */
	const INSIGHT_MAX_TOKENS = 1500;

	/**
	 * Max tokens for reasoning models (need extra budget for reasoning content).
	 */
	const REASONING_MAX_TOKENS = 4000;

	/**
	 * Patterns that identify reasoning models.
	 */
	const REASONING_MODEL_PATTERNS = array(
		'/^o1-/i',
		'/^o3-/i',
		'/deepseek-reasoner/i',
		'/deepseek-r1/i',
		'/claude-3-opus/i',
		'/gemini-2\.0-flash-thinking/i',
	);

	// ----------------------------------------------------------------------- //
	//  SETTINGS
	// ----------------------------------------------------------------------- //

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
	 * Check if the configured model is a reasoning model.
	 *
	 * Reasoning models (o1, o3, DeepSeek-R1, etc.) require different
	 * parameter handling:
	 * - No temperature parameter
	 * - Higher max_tokens budget (reasoning content consumes tokens)
	 * - System prompts handled differently
	 *
	 * @param string $model Model name.
	 * @return bool
	 */
	public static function is_reasoning_model( string $model ): bool {
		foreach ( self::REASONING_MODEL_PATTERNS as $pattern ) {
			if ( preg_match( $pattern, $model ) ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Get appropriate max_tokens for a model.
	 *
	 * Reasoning models need a larger budget because they output reasoning
	 * content before the final visible answer. The visible output plus
	 * reasoning must fit within max_tokens.
	 *
	 * @param string $model      Model name.
	 * @param int    $base_tokens Base token limit for instruct models.
	 * @return int
	 */
	public static function get_effective_max_tokens( string $model, int $base_tokens ): int {
		if ( self::is_reasoning_model( $model ) ) {
			return max( $base_tokens, self::REASONING_MAX_TOKENS );
		}
		return $base_tokens;
	}

	/**
	 * Extract the assistant message content from an API response,
	 * including reasoning_content if present.
	 *
	 * @param array $data Decoded API response.
	 * @return string The visible content text.
	 */
	private static function extract_content( array $data ): string {
		if ( isset( $data['choices'][0]['message']['content'] ) && is_string( $data['choices'][0]['message']['content'] ) ) {
			return $data['choices'][0]['message']['content'];
		}
		return '';
	}

	/**
	 * Build the full assistant message (including reasoning content) for retry.
	 *
	 * For reasoning models, the API may include a `reasoning_content` field
	 * alongside `content`. When retrying, we need to send both back so the
	 * model has full context of its previous response.
	 *
	 * @param array $data Decoded API response from the first attempt.
	 * @return array Assistant message.
	 */
	private static function build_assistant_retry_message( array $data ): array {
		$message = array(
			'role'    => 'assistant',
			'content' => self::extract_content( $data ),
		);

		// Include reasoning_content if the API returned it (reasoning models).
		if ( isset( $data['choices'][0]['message']['reasoning_content'] ) ) {
			$message['reasoning_content'] = $data['choices'][0]['message']['reasoning_content'];
		}

		return $message;
	}

	// ----------------------------------------------------------------------- //
	//  BODY BUILDER
	// ----------------------------------------------------------------------- //

	/**
	 * Build the request body for a chat completion call.
	 *
	 * Automatically adjusts parameters for reasoning vs instruct models.
	 *
	 * @param string $model         Model name.
	 * @param array  $messages      Message array.
	 * @param int    $max_tokens    Max tokens for output.
	 * @param float  $temperature   Temperature (ignored for reasoning models).
	 * @return array
	 */
	private static function build_request_body( string $model, array $messages, int $max_tokens, float $temperature = 0.2 ): array {
		$body = array(
			'model'    => $model,
			'messages' => $messages,
		);

		// Reasoning models use max_completion_tokens instead of max_tokens.
		if ( self::is_reasoning_model( $model ) ) {
			// OpenAI reasoning models use max_completion_tokens.
			// Some API providers still accept max_tokens.
			$effective_max = self::get_effective_max_tokens( $model, $max_tokens );
			$body['max_completion_tokens'] = $effective_max;
		} else {
			$body['max_tokens']  = $max_tokens;
			$body['temperature'] = $temperature;
		}

		return $body;
	}

	/**
	 * Send a chat completion request and return the parsed response.
	 *
	 * @param array $body Request body.
	 * @return array{success: bool, data: array|null, error: string}
	 */
	private static function send_request( array $body ): array {
		$settings = self::get_settings();

		if ( empty( $settings['api_key'] ) ) {
			return array(
				'success' => false,
				'data'    => null,
				'error'   => __( 'API key is not configured. Please go to Settings and add your API key.', 'silc-wooinsight-ai' ),
			);
		}

		$api_url = untrailingslashit( $settings['api_url'] );

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
				'data'    => null,
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
				'data'    => null,
				'error'   => $error_msg,
			);
		}

		return array(
			'success' => true,
			'data'    => $data,
			'error'   => '',
		);
	}

	// ----------------------------------------------------------------------- //
	//  SQL GENERATION
	// ----------------------------------------------------------------------- //

	/**
	 * Generate SQL from a natural language question using the configured API.
	 *
	 * Uses get_schema_context() from Woo_Schema for the schema context,
	 * same as generate_insight(), ensuring a single source of truth.
	 *
	 * @param string $question       The user's natural language question.
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

		// Build the chat completion prompt.
		$system_prompt = self::build_system_prompt();
		$user_prompt   = self::build_user_prompt( $question, $schema_context );

		$model      = $settings['model'];
		$is_reason  = self::is_reasoning_model( $model );
		$max_tokens = self::get_effective_max_tokens( $model, (int) $settings['max_tokens'] );

		if ( $is_reason ) {
			// Reasoning models don't support system role; fold system prompt into user.
			$messages = array(
				array( 'role' => 'user', 'content' => $system_prompt . "\n\n" . $user_prompt ),
			);
		} else {
			$messages = array(
				array( 'role' => 'system', 'content' => $system_prompt ),
				array( 'role' => 'user',   'content' => $user_prompt ),
			);
		}

		$body = self::build_request_body( $model, $messages, $max_tokens, (float) $settings['temperature'] );

		$result = self::send_request( $body );
		if ( ! $result['success'] ) {
			return array(
				'success' => false,
				'sql'     => '',
				'error'   => $result['error'],
			);
		}

		$content = self::extract_content( $result['data'] );

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
		return 'Here is the WooCommerce database schema (table prefix included):'
			. "\n\n" . $schema_context
			. "\n\nUser question: " . $question
			. "\n\nGenerate ONLY the SQL query:";
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

	// ----------------------------------------------------------------------- //
	//  INSIGHT GENERATION (v2.0)
	// ----------------------------------------------------------------------- //

	/**
	 * Generate a structured insight from a natural language question.
	 *
	 * Uses a dedicated prompt that asks the AI to return valid JSON with
	 * fields: sql, type, chart_config, list_config, answer_text.
	 *
	 * Uses get_schema_context() from Woo_Schema (same as generate_sql()).
	 *
	 * @param string $question       The user's natural language question.
	 * @param string $schema_context The database schema context for the prompt.
	 * @return array{success: bool, insight: array|null, error: string}
	 */
	public static function generate_insight( string $question, string $schema_context ): array {
		$settings = self::get_settings();

		if ( empty( $settings['api_key'] ) ) {
			return array(
				'success' => false,
				'insight' => null,
				'error'   => __( 'API key is not configured. Please go to Settings and add your API key.', 'silc-wooinsight-ai' ),
			);
		}

		// Build prompts.
		$system_prompt = self::build_insight_system_prompt();
		$user_prompt   = self::build_insight_user_prompt( $question, $schema_context );

		$model      = $settings['model'];
		$is_reason  = self::is_reasoning_model( $model );
		$max_tokens = self::get_effective_max_tokens( $model, self::INSIGHT_MAX_TOKENS );

		if ( $is_reason ) {
			// Reasoning models: fold system into user message.
			$messages = array(
				array( 'role' => 'user', 'content' => $system_prompt . "\n\n" . $user_prompt ),
			);
		} else {
			$messages = array(
				array( 'role' => 'system', 'content' => $system_prompt ),
				array( 'role' => 'user',   'content' => $user_prompt ),
			);
		}

		$body = self::build_request_body( $model, $messages, $max_tokens, 0.2 );

		// Debug logging.
		error_log( '[SILC_WIA] Insight Request - Model: ' . $model . ', Reasoning: ' . ( $is_reason ? 'yes' : 'no' ) );

		$result = self::send_request( $body );
		if ( ! $result['success'] ) {
			return array(
				'success' => false,
				'insight' => null,
				'error'   => $result['error'],
			);
		}

		$content = self::extract_content( $result['data'] );
		error_log( '[SILC_WIA] Insight Response: ' . substr( $content, 0, 500 ) );

		if ( empty( $content ) ) {
			return array(
				'success' => false,
				'insight' => null,
				'error'   => __( 'API returned an empty response.', 'silc-wooinsight-ai' ),
			);
		}

		// Parse the JSON with multi-strategy fallback.
		$insight = self::parse_insight_json( $content );

		if ( null === $insight ) {
			// Retry: send the previous assistant response back as context,
			// including reasoning_content if the API returned it.
			$retry_body            = $body;
			$assistant_msg         = self::build_assistant_retry_message( $result['data'] );
			$retry_body['messages'][] = $assistant_msg;
			$retry_body['messages'][] = array(
				'role'    => 'user',
				'content' => 'Your previous response was not valid JSON. Return ONLY valid JSON with no markdown, no explanation, just the JSON object.',
			);

			$retry = self::send_request( $retry_body );
			if ( $retry['success'] ) {
				$retry_content = self::extract_content( $retry['data'] );
				if ( ! empty( $retry_content ) ) {
					$insight = self::parse_insight_json( $retry_content );
				}
			}
		}

		if ( null === $insight ) {
			return array(
				'success' => false,
				'insight' => null,
				'error'   => __( 'Could not parse insight JSON from the API response.', 'silc-wooinsight-ai' ),
			);
		}

		return array(
			'success' => true,
			'insight' => $insight,
			'error'   => '',
		);
	}

	/**
	 * Build the system prompt for insight generation (structured JSON output).
	 *
	 * @return string
	 */
	private static function build_insight_system_prompt(): string {
		return 'You are a WooCommerce data analyst. Given a database schema and a user question, '
			. 'you must return ONLY valid JSON (no other text, no markdown) with this structure:'
			. "\n\n"
			. '{'
			. "\n  \"sql\": \"The SQL SELECT query to execute\","
			. "\n  \"type\": \"chart\" | \"list\" | \"answer\","
			. "\n  \"chart_config\": {"
			. "\n    \"chart_type\": \"bar\" | \"line\" | \"pie\" | \"horizontalBar\" | \"doughnut\","
			. "\n    \"title\": \"Chart title\","
			. "\n    \"labels\": [\"array of label strings\"],"
			. "\n    \"datasets\": ["
			. "\n      {"
			. "\n        \"label\": \"Dataset label\","
			. "\n        \"data\": [numeric values],"
			. "\n        \"backgroundColor\": [\"optional color array\"]"
			. "\n      }"
			. "\n    ],"
			. "\n    \"x_label\": \"X-axis label (optional)\","
			. "\n    \"y_label\": \"Y-axis label (optional)\""
			. "\n  },"
			. "\n  \"answer_text\": \"Human-readable answer text, e.g. 'Total orders last week: 247'\","
			. "\n  \"list_config\": {"
			. "\n    \"title_column\": \"Column name to use as the primary display text\","
			. "\n    \"link_columns\": {"
			. "\n      \"column_name\": \"link_type\""
			. "\n    },"
			. "\n    \"display_columns\": [\"col1\", \"col2\"],"
			. "\n    \"value_formats\": {"
			. "\n      \"total_sales\": \"currency\","
			. "\n      \"order_total\": \"currency\","
			. "\n      \"count\": \"number\""
			. "\n    }"
			. "\n  }"
			. "\n}"
			. "\n\nRULES:"
			. "\n- type=\"chart\" when question asks for comparison, trend, distribution, or visualization"
			. "\n- type=\"list\" when question asks for \"list\", \"show me\", \"who are\", \"which customers\", \"pending orders\", \"top products\""
			. "\n- type=\"answer\" when question asks for count, total, average, or a single numeric answer"
			. "\n- For chart type, pre-compute labels and datasets in chart_config (do NOT return raw data)"
			. "\n- For list type, include link_columns mapping so the UI can generate admin links"
			. "\n\nLINK COLUMN MAPPING RULES (CRITICAL):"
			. "\n- Column \"order_id\" → link_type \"order\""
			. "\n- Column \"parent_order_id\" → link_type \"order\""
			. "\n- Column \"product_id\" → link_type \"product\""
			. "\n- Column \"variation_id\" → link_type \"product\""
			. "\n- Column \"customer_id\" → link_type \"user\""
			. "\n- Column \"user_id\" → link_type \"user\""
			. "\n- Column \"coupon_id\" → link_type \"coupon\""
			. "\n- Column \"order_item_id\" → link_type \"order_item\""
			. "\n\n- For answer type, provide a complete sentence in answer_text"
			. "\n- Use COALESCE for potentially NULL numeric values"
			. "\n- Always use proper date functions for time-based queries"
			. "\n- Format currency values as plain numbers (frontend will add currency symbol)";
	}

	/**
	 * Build the user prompt for insight generation.
	 *
	 * @param string $question       The user's question.
	 * @param string $schema_context Database schema context.
	 * @return string
	 */
	private static function build_insight_user_prompt( string $question, string $schema_context ): string {
		return 'Here is the WooCommerce database schema (table prefix included):'
			. "\n\n" . $schema_context
			. "\n\nUser question: " . $question
			. "\n\nReturn ONLY valid JSON with the SQL query, output type, and configuration as specified.";
	}

	/**
	 * Parse insight JSON from the API response with multi-strategy fallback.
	 *
	 * Strategy chain:
	 * 1. Direct JSON decode
	 * 2. Strip markdown fences, then decode
	 * 3. Regex extraction of JSON block
	 *
	 * @param string $raw_response The raw API response text.
	 * @return array|null Parsed insight data or null on failure.
	 */
	public static function parse_insight_json( string $raw_response ): ?array {
		// Strategy 1: Direct JSON decode.
		$data = json_decode( $raw_response, true );
		if ( self::is_valid_insight_json( $data ) ) {
			return $data;
		}

		// Strategy 2: Strip markdown code fences and decode.
		$cleaned = preg_replace( '/```(?:json)?\s*\n?/i', '', $raw_response );
		$data    = json_decode( trim( $cleaned ), true );
		if ( self::is_valid_insight_json( $data ) ) {
			return $data;
		}

		// Strategy 3: Regex extract JSON block.
		preg_match( '/\{.*\}/s', $raw_response, $matches );
		if ( ! empty( $matches[0] ) ) {
			$data = json_decode( $matches[0], true );
			if ( self::is_valid_insight_json( $data ) ) {
				return $data;
			}
		}

		return null;
	}

	/**
	 * Validate that parsed insight data has the required fields.
	 *
	 * @param mixed $data The parsed data to validate.
	 * @return bool True if valid.
	 */
	private static function is_valid_insight_json( $data ): bool {
		if ( ! is_array( $data ) || ! isset( $data['sql'], $data['type'] ) ) {
			return false;
		}
		if ( ! in_array( $data['type'], array( 'chart', 'list', 'answer' ), true ) ) {
			return false;
		}
		return true;
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

		$api_url  = untrailingslashit( $settings['api_url'] );
		$model    = $settings['model'];
		$is_reason = self::is_reasoning_model( $model );

		$body = array(
			'model'    => $model,
			'messages' => array(
				array( 'role' => 'user', 'content' => 'Say "ok" and nothing else.' ),
			),
		);

		if ( $is_reason ) {
			$body['max_completion_tokens'] = 20;
		} else {
			$body['max_tokens'] = 10;
		}

		$response = wp_remote_post(
			$api_url . '/chat/completions',
			array(
				'timeout'   => 30,
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
				'message' => $response->get_error_message(),
			);
		}

		$status_code = wp_remote_retrieve_response_code( $response );
		if ( $status_code !== 200 ) {
			$response_body = json_decode( wp_remote_retrieve_body( $response ), true );
			$error = isset( $response_body['error']['message'] ) ? $response_body['error']['message'] : "HTTP $status_code";
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
