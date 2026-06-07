<?php
/**
 * AJAX Handler
 *
 * Handles AJAX requests from the React dashboard for:
 * - Executing validated SQL queries (with or without AI generation).
 * - Fetching schema context for the AI prompt.
 * - Saving/loading query history.
 *
 * @package SILC_WooInsight_AI
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once SILC_WIA_PATH . 'includes/class-sql-validator.php';
require_once SILC_WIA_PATH . 'includes/class-woo-schema.php';

/**
 * AJAX handler class.
 */
class SILC_WIA_Ajax {

	/**
	 * Nonce action.
	 */
	const NONCE_ACTION = 'silc_wia_ajax';

	/**
	 * Initialize AJAX hooks.
	 */
	public static function init(): void {
		add_action( 'wp_ajax_silc_wia_execute_query', array( __CLASS__, 'handle_execute_query' ) );
		add_action( 'wp_ajax_silc_wia_get_schema', array( __CLASS__, 'handle_get_schema' ) );
		add_action( 'wp_ajax_silc_wia_get_tables', array( __CLASS__, 'handle_get_tables' ) );
		add_action( 'wp_ajax_silc_wia_save_history', array( __CLASS__, 'handle_save_history' ) );
		add_action( 'wp_ajax_silc_wia_get_history', array( __CLASS__, 'handle_get_history' ) );
		add_action( 'wp_ajax_silc_wia_clear_history', array( __CLASS__, 'handle_clear_history' ) );
		add_action( 'wp_ajax_silc_wia_validate_sql', array( __CLASS__, 'handle_validate_sql' ) );
		add_action( 'wp_ajax_silc_wia_generate_sql', array( __CLASS__, 'handle_generate_sql' ) );
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
	 * Handle: Execute a validated SQL query.
	 *
	 * Accepts raw SQL (already validated client-side or AI-generated).
	 * Server re-validates before execution.
	 */
	public static function handle_execute_query(): void {
		if ( ! self::verify() ) {
			return;
		}

		$sql = isset( $_POST['sql'] ) ? wp_unslash( $_POST['sql'] ) : '';
		$sql = trim( $sql );

		if ( empty( $sql ) ) {
			wp_send_json_error( array( 'message' => __( 'No SQL query provided.', 'silc-wooinsight-ai' ) ) );
			return;
		}

		// Validate the SQL on the server side (defense in depth).
		$validation = SILC_WIA_SQL_Validator::validate( $sql );
		if ( ! $validation['valid'] ) {
			wp_send_json_error( array(
				'message' => $validation['error'],
				'sql'     => $validation['sql'],
			) );
			return;
		}

		// Execute.
		$result = SILC_WIA_SQL_Validator::execute( $validation['sql'] );

		if ( ! $result['success'] ) {
			wp_send_json_error( array(
				'message' => sprintf(
					/* translators: %s: database error */
					__( 'Query error: %s', 'silc-wooinsight-ai' ),
					$result['error']
				),
				'sql'     => $validation['sql'],
			) );
			return;
		}

		wp_send_json_success( array(
			'data'    => $result['data'],
			'sql'     => $validation['sql'],
			'time_ms' => $result['time_ms'],
			'rows'    => $result['rows'] ?? count( $result['data'] ),
		) );
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

	/**
	 * Handle: Get simplified table list for dropdowns.
	 */
	public static function handle_get_tables(): void {
		if ( ! self::verify() ) {
			return;
		}

		global $wpdb;
		$prefix     = $wpdb->prefix;
		$tables     = array();
		$all_tables = $wpdb->get_results( "SHOW TABLES LIKE '{$prefix}%'", ARRAY_N );

		foreach ( $all_tables as $row ) {
			$tables[] = $row[0];
		}

		wp_send_json_success( array(
			'tables'  => $tables,
			'prefix'  => $prefix,
		) );
	}

	/**
	 * Handle: Save a query to history.
	 */
	public static function handle_save_history(): void {
		if ( ! self::verify() ) {
			return;
		}

		$question = isset( $_POST['question'] ) ? sanitize_text_field( wp_unslash( $_POST['question'] ) ) : '';
		$sql      = isset( $_POST['sql'] ) ? sanitize_textarea_field( wp_unslash( $_POST['sql'] ) ) : '';
		$label    = isset( $_POST['label'] ) ? sanitize_text_field( wp_unslash( $_POST['label'] ) ) : '';

		if ( empty( $sql ) ) {
			wp_send_json_error( array( 'message' => __( 'No SQL to save.', 'silc-wooinsight-ai' ) ) );
			return;
		}

		$history   = get_option( 'silc_wia_query_history', array() );
		$history[] = array(
			'id'       => uniqid( 'q_' ),
			'question' => $question,
			'sql'      => $sql,
			'label'    => $label,
			'time'     => current_time( 'mysql' ),
		);

		// Keep last 50 entries.
		if ( count( $history ) > 50 ) {
			$history = array_slice( $history, -50 );
		}

		update_option( 'silc_wia_query_history', $history );

		wp_send_json_success( array(
			'message' => __( 'Query saved to history.', 'silc-wooinsight-ai' ),
			'history' => array_reverse( $history ),
		) );
	}

	/**
	 * Handle: Get query history.
	 */
	public static function handle_get_history(): void {
		if ( ! self::verify() ) {
			return;
		}

		$history = get_option( 'silc_wia_query_history', array() );

		wp_send_json_success( array(
			'history' => array_reverse( $history ),
		) );
	}

	/**
	 * Handle: Clear query history.
	 */
	public static function handle_clear_history(): void {
		if ( ! self::verify() ) {
			return;
		}

		delete_option( 'silc_wia_query_history' );

		wp_send_json_success( array(
			'message' => __( 'History cleared.', 'silc-wooinsight-ai' ),
		) );
	}

	/**
	 * Handle: Validate SQL without executing it.
	 */
	public static function handle_validate_sql(): void {
		if ( ! self::verify() ) {
			return;
		}

		$sql = isset( $_POST['sql'] ) ? wp_unslash( $_POST['sql'] ) : '';
		$sql = trim( $sql );

		if ( empty( $sql ) ) {
			wp_send_json_error( array( 'message' => __( 'No SQL provided.', 'silc-wooinsight-ai' ) ) );
			return;
		}

		$validation = SILC_WIA_SQL_Validator::validate( $sql );

		wp_send_json_success( array(
			'valid' => $validation['valid'],
			'sql'   => $validation['sql'],
			'error' => $validation['error'],
		) );
	}

	/**
	 * Handle: Generate SQL from natural language using the configured API.
	 */
	public static function handle_generate_sql(): void {
		if ( ! self::verify() ) {
			return;
		}

		$question = isset( $_POST['question'] ) ? sanitize_text_field( wp_unslash( $_POST['question'] ) ) : '';
		$question = trim( $question );

		if ( empty( $question ) ) {
			wp_send_json_error( array( 'message' => __( 'No question provided.', 'silc-wooinsight-ai' ) ) );
			return;
		}

		// Get schema context.
		$schema_context = SILC_WIA_Woo_Schema::get_schema_context();

		// Call the API.
		require_once SILC_WIA_PATH . 'includes/class-api.php';
		$result = SILC_WIA_API::generate_sql( $question, $schema_context );

		if ( $result['success'] ) {
			wp_send_json_success( array(
				'sql'      => $result['sql'],
				'question' => $question,
			) );
		} else {
			wp_send_json_error( array(
				'message'  => $result['error'],
				'question' => $question,
			) );
		}
	}
}
