<?php
/**
 * AJAX Handler
 *
 * Handles AJAX requests from the React dashboard for insight generation
 * and schema retrieval.
 *
 * @package SILC_WooInsight_AI
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once SILC_WIA_PATH . 'includes/class-woo-schema.php';

/**
 * AJAX handler class.
 */
class SILC_WIA_Ajax {

	/**
	 * Nonce action.
	 *
	 * @var string
	 */
	const NONCE_ACTION = 'silc-wia-nonce';

	/**
	 * Register all AJAX handlers.
	 */
	public static function init(): void {
		// Schema endpoint (used by insight pipeline).
		add_action( 'wp_ajax_silc_wia_get_schema', array( __CLASS__, 'handle_get_schema' ) );
		// Insight endpoints.
		add_action( 'wp_ajax_silc_wia_generate_insight', array( __CLASS__, 'handle_generate_insight' ) );
		add_action( 'wp_ajax_silc_wia_get_insight_history', array( __CLASS__, 'handle_get_insight_history' ) );
		add_action( 'wp_ajax_silc_wia_clear_insight_history', array( __CLASS__, 'handle_clear_insight_history' ) );
		// Execute a stored SQL query without re-invoking AI.
		add_action( 'wp_ajax_silc_wia_execute_sql', array( __CLASS__, 'handle_execute_sql' ) );
	}
	/**
	 * Verify nonce and user capabilities.
	 */
	private static function verify(): bool {
		if ( ! check_ajax_referer( self::NONCE_ACTION, 'nonce', false ) ) {
			wp_send_json_error( array( 'message' => __( 'Security check failed.', 'silc-wooinsight-ai' ) ) );
			return false;
		}

		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			wp_send_json_error( array( 'message' => __( 'Insufficient permissions.', 'silc-wooinsight-ai' ) ) );
			return false;
		}

		return true;
	}

	/**
	 * Handle: Get the full database schema context for AI prompt.
	 */
	public static function handle_get_schema(): void {
		if ( ! self::verify() ) {
			return;
		}

		$context = SILC_WIA_Woo_Schema::get_schema_context();

		wp_send_json_success( array(
			'schema'  => SILC_WIA_Woo_Schema::get_table_schemas(),
			'context' => $context,
			'prefix'  => SILC_WIA_Woo_Schema::prefix(),
			'tables'  => SILC_WIA_Woo_Schema::get_table_names(),
			'meta_keys' => SILC_WIA_Woo_Schema::get_meta_keys(),
		) );
	}

	// ----------------------------------------------------------------------- //
	//  INSIGHT ENDPOINTS
	// ----------------------------------------------------------------------- //

	/**
	/**
	 * Handle: Generate a full insight (AI → SQL → execute → render).
	 *
	 * POST params: question (string)
	 * Response: { success, data: { type, chart_config, list_data, answer_text, ... } }
	 */
	public static function handle_generate_insight(): void {
		if ( ! self::verify() ) {
			return;
		}

		$question = isset( $_POST['question'] ) ? sanitize_text_field( wp_unslash( $_POST['question'] ) ) : '';
		$question = trim( $question );

		if ( empty( $question ) ) {
			wp_send_json_error( array( 'message' => __( 'No question provided.', 'silc-wooinsight-ai' ) ) );
			return;
		}

		require_once SILC_WIA_PATH . 'includes/class-insights.php';

		$insight = SILC_WIA_Insights::generate_insight( $question );

		if ( ! $insight['success'] ) {
			wp_send_json_error( array(
				'message'  => $insight['error'] ?? __( 'Failed to generate insight.', 'silc-wooinsight-ai' ),
				'question' => $question,
			) );
			return;
		}

		// Save to insight history with full result data and AI-generated title.
		$title = ! empty( $insight['title'] ) ? $insight['title'] : self::derive_title( $question, $insight );

		$history    = get_option( 'silc_wia_insight_history', array() );
		$history[]  = array(
			'id'            => uniqid( 'i_' ),
			'question'      => $question,
			'title'         => $title,
			'type'          => $insight['type'],
			'sql'           => $insight['sql'] ?? '',
			'sql_time_ms'   => $insight['sql_time_ms'] ?? 0,
			'rows_returned' => $insight['rows_returned'] ?? 0,
			'columns'       => $insight['columns'] ?? array(),
			'time'          => current_time( 'mysql' ),
			// Full result data for instant replay from history.
			'chart_config'  => $insight['chart_config'] ?? null,
			'list_data'     => $insight['list_data'] ?? null,
			'list_config'   => $insight['list_config'] ?? null,
			'answer_text'   => $insight['answer_text'] ?? null,
			'answer_value'  => $insight['answer_value'] ?? null,
			'answer_label'  => $insight['answer_label'] ?? null,
			'empty'         => $insight['empty'] ?? null,
			'empty_message' => $insight['empty_message'] ?? null,
		);
		// Keep max 10 latest entries.
		if ( count( $history ) > 10 ) {
			$history = array_slice( $history, -10 );
		}
		update_option( 'silc_wia_insight_history', $history );

		// Include title in response.
		$insight['title'] = $title;

		wp_send_json_success( $insight );
	}

	/**
	 * Derive a display title from the question or insight data.
	 *
	 * @param string $question The original question.
	 * @param array  $insight  The generated insight data.
	 * @return string
	 */
	private static function derive_title( string $question, array $insight ): string {
		// Use chart title if available.
		if ( ! empty( $insight['chart_config']['title'] ) ) {
			return $insight['chart_config']['title'];
		}
		// Use answer_text prefix (first ~50 chars) for answer type.
		if ( ! empty( $insight['answer_text'] ) ) {
			$short = substr( $insight['answer_text'], 0, 50 );
			return rtrim( $short, ' .' ) . ( strlen( $insight['answer_text'] ) > 50 ? '...' : '' );
		}
		// Fallback: use first 60 chars of the question.
		return mb_substr( $question, 0, 60 ) . ( mb_strlen( $question ) > 60 ? '...' : '' );
	}

	/**
	 * Handle: Regenerate an insight from a previous question (re-runs full pipeline).
	 *
	 * POST params: question (string)
	 * Response: Same as handle_generate_insight.
	 */
	public static function handle_regen_insight(): void {
		if ( ! self::verify() ) {
			return;
		}

		$question = isset( $_POST['question'] ) ? sanitize_text_field( wp_unslash( $_POST['question'] ) ) : '';
		$question = trim( $question );

		if ( empty( $question ) ) {
			wp_send_json_error( array( 'message' => __( 'No question provided.', 'silc-wooinsight-ai' ) ) );
			return;
		}

		require_once SILC_WIA_PATH . 'includes/class-insights.php';

		$insight = SILC_WIA_Insights::generate_insight( $question );

		if ( ! $insight['success'] ) {
			wp_send_json_error( array(
				'message'  => $insight['error'] ?? __( 'Failed to regenerate insight.', 'silc-wooinsight-ai' ),
				'question' => $question,
			) );
			return;
		}

		// Update the existing history entry if found, or append a new one.
		$title   = ! empty( $insight['title'] ) ? $insight['title'] : self::derive_title( $question, $insight );
		$history = get_option( 'silc_wia_insight_history', array() );

		// Look for an existing entry with the same question and update it.
		$found = false;
		foreach ( $history as &$entry ) {
			if ( $entry['question'] === $question ) {
				$entry['title']         = $title;
				$entry['type']          = $insight['type'];
				$entry['sql']           = $insight['sql'] ?? '';
				$entry['sql_time_ms']   = $insight['sql_time_ms'] ?? 0;
				$entry['rows_returned'] = $insight['rows_returned'] ?? 0;
				$entry['columns']       = $insight['columns'] ?? array();
				$entry['time']          = current_time( 'mysql' );
				$entry['chart_config']  = $insight['chart_config'] ?? null;
				$entry['list_data']     = $insight['list_data'] ?? null;
				$entry['list_config']   = $insight['list_config'] ?? null;
				$entry['answer_text']   = $insight['answer_text'] ?? null;
				$entry['answer_value']  = $insight['answer_value'] ?? null;
				$entry['answer_label']  = $insight['answer_label'] ?? null;
				$entry['empty']         = $insight['empty'] ?? null;
				$entry['empty_message'] = $insight['empty_message'] ?? null;
				$found = true;
				break;
			}
		}
		unset( $entry );

		if ( ! $found ) {
			$history[] = array(
				'id'            => uniqid( 'i_' ),
				'question'      => $question,
				'title'         => $title,
				'type'          => $insight['type'],
				'sql'           => $insight['sql'] ?? '',
				'sql_time_ms'   => $insight['sql_time_ms'] ?? 0,
				'rows_returned' => $insight['rows_returned'] ?? 0,
				'columns'       => $insight['columns'] ?? array(),
				'time'          => current_time( 'mysql' ),
				'chart_config'  => $insight['chart_config'] ?? null,
				'list_data'     => $insight['list_data'] ?? null,
				'list_config'   => $insight['list_config'] ?? null,
				'answer_text'   => $insight['answer_text'] ?? null,
				'answer_value'  => $insight['answer_value'] ?? null,
				'answer_label'  => $insight['answer_label'] ?? null,
				'empty'         => $insight['empty'] ?? null,
				'empty_message' => $insight['empty_message'] ?? null,
			);
		}

		// Keep max 10 latest entries.
		if ( count( $history ) > 10 ) {
			$history = array_slice( $history, -10 );
		}
		update_option( 'silc_wia_insight_history', $history );

		$insight['title'] = $title;
		wp_send_json_success( $insight );
	}

	/**
	 * Handle: Get insight history.
	 */
	public static function handle_get_insight_history(): void {
		if ( ! self::verify() ) {
			return;
		}

		$history = get_option( 'silc_wia_insight_history', array() );

		wp_send_json_success( array(
			'history' => array_reverse( $history ),
		) );
	}

	/**
	 * Handle: Clear insight history.
	 */
	public static function handle_clear_insight_history(): void {
		if ( ! self::verify() ) {
			return;
		}

		delete_option( 'silc_wia_insight_history' );

		wp_send_json_success( array(
			'message' => __( 'Insight history cleared.', 'silc-wooinsight-ai' ),
		) );
	}

	/**
	 * Handle: Re-execute a stored SQL query without calling AI.
	 *
	 * POST params: sql, type, chart_config (JSON), list_config (JSON), answer_text
	 * Response: Same structure as handle_generate_insight.
	 */
	public static function handle_execute_sql(): void {
		if ( ! self::verify() ) {
			return;
		}

		$sql = isset( $_POST['sql'] ) ? wp_unslash( $_POST['sql'] ) : '';
		$sql = trim( $sql );

		if ( empty( $sql ) ) {
			wp_send_json_error( array( 'message' => __( 'No SQL query provided.', 'silc-wooinsight-ai' ) ) );
			return;
		}

		$type = isset( $_POST['type'] ) ? sanitize_text_field( wp_unslash( $_POST['type'] ) ) : 'answer';

		$insight_data = array();

		$chart_config = isset( $_POST['chart_config'] ) ? wp_unslash( $_POST['chart_config'] ) : '';
		if ( ! empty( $chart_config ) ) {
			$insight_data['chart_config'] = json_decode( $chart_config, true );
		}

		$list_config = isset( $_POST['list_config'] ) ? wp_unslash( $_POST['list_config'] ) : '';
		if ( ! empty( $list_config ) ) {
			$insight_data['list_config'] = json_decode( $list_config, true );
		}

		$answer_text = isset( $_POST['answer_text'] ) ? sanitize_text_field( wp_unslash( $_POST['answer_text'] ) ) : '';
		if ( ! empty( $answer_text ) ) {
			$insight_data['answer_text'] = $answer_text;
		}

		$title = isset( $_POST['title'] ) ? sanitize_text_field( wp_unslash( $_POST['title'] ) ) : '';
		if ( ! empty( $title ) ) {
			$insight_data['title'] = $title;
		}

		require_once SILC_WIA_PATH . 'includes/class-insights.php';

		$result = SILC_WIA_Insights::re_execute_sql( $sql, $type, $insight_data );

		if ( ! $result['success'] ) {
			wp_send_json_error( array(
				'message' => $result['error'] ?? __( 'Failed to execute SQL.', 'silc-wooinsight-ai' ),
				'sql'     => $sql,
			) );
			return;
		}

		// Ensure title is present in the response.
		if ( empty( $result['title'] ) && ! empty( $title ) ) {
			$result['title'] = $title;
		}

		wp_send_json_success( $result );
	}
}
