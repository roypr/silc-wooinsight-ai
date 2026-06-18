<?php
/**
 * Insights Engine
 *
 * Orchestrates the full insight pipeline:
 * 1. Calls AI to generate structured JSON (SQL + type + config)
 * 2. Parses the JSON response with fallback chain
 * 3. Executes the SQL via the validator + wpdb
 * 4. Classifies results and renders via the Insight Renderer
 *
 * @package SILC_WooInsight_AI
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once SILC_WIA_PATH . 'includes/class-api.php';
require_once SILC_WIA_PATH . 'includes/class-insight-renderer.php';
require_once SILC_WIA_PATH . 'includes/class-sql-validator.php';
require_once SILC_WIA_PATH . 'includes/class-woo-schema.php';

/**
 * Insights class.
 */
class SILC_WIA_Insights {

	/**
	 * Default cache TTL in seconds (1 hour).
	 * Overridden by the 'cache_ttl' setting if configured.
	 */
	const CACHE_TTL = 3600;

	/**
	 * Generate an insight from a natural language question.
	 *
	 * Full pipeline: AI → Parse JSON → Validate → Execute → Render.
	 *
	 * @param string $question The user's question.
	 * @return array The complete insight response.
	 */
	public static function generate_insight( string $question ): array {
		// Check cache first.
		$cache_key = 'silc_wia_insight_' . md5( $question );
		$cached    = get_transient( $cache_key );
		if ( false !== $cached ) {
			return $cached;
		}

		// Get schema context.
		$schema_context = SILC_WIA_Woo_Schema::get_schema_context();

		// Step 1: Call AI to generate structured insight JSON.
		$ai_result = SILC_WIA_API::generate_insight( $question, $schema_context );

		if ( ! $ai_result['success'] ) {
			$response = array(
				'success' => false,
				'error'   => $ai_result['error'],
				'type'    => 'error',
			);
			return $response;
		}

		$insight_data = $ai_result['insight'];
		$sql          = $insight_data['sql'] ?? '';
		$type         = $insight_data['type'] ?? 'answer';

		// Step 2: Validate SQL.
		$validation = SILC_WIA_SQL_Validator::validate( $sql );
		if ( ! $validation['valid'] ) {
			$response = array(
				'success' => false,
				'error'   => $validation['error'],
				'type'    => 'error',
				'sql'     => $sql,
			);
			return $response;
		}

		// Step 3: Execute SQL.
		$execution = SILC_WIA_SQL_Validator::execute( $validation['sql'] );

		if ( ! $execution['success'] ) {
			$response = array(
				'success' => false,
				'error'   => sprintf(
					/* translators: %s: database error */
					__( 'Query error: %s', 'silc-wooinsight-ai' ),
					$execution['error']
				),
				'type' => 'error',
				'sql'  => $validation['sql'],
			);
			return $response;
		}

		$data       = $execution['data'] ?? array();
		$columns    = ! empty( $data ) ? array_keys( $data[0] ) : array();
		$sql_time   = $execution['time_ms'] ?? 0;
		$rows_count = $execution['rows'] ?? count( $data );

		// Step 4: If AI type is invalid or data is empty, use fallback classification.
		if ( empty( $data ) ) {
			$response = self::build_empty_response( $question, $validation['sql'], $type, $sql_time );
			return $response;
		}

		if ( ! in_array( $type, array( 'chart', 'list', 'answer' ), true ) ) {
			$fallback    = self::classify_result( $data, $columns );
			$type        = $fallback['type'];
			$insight_data = array_merge( $insight_data, $fallback['config'] );
		}

		// Step 5: Render based on type.
		$response = self::render_by_type( $data, $insight_data, $type, $question );

		$response['sql']        = $validation['sql'];
		$response['sql_time_ms'] = $sql_time;
		$response['rows_returned'] = $rows_count;
		$response['columns']    = $columns;
		$response['question']   = $question;

		// Cache the result using the configured TTL (falls back to CACHE_TTL constant).
		$cache_ttl = SILC_WIA_API::get_cache_ttl();
		if ( $cache_ttl > 0 ) {
			set_transient( $cache_key, $response, $cache_ttl );
		}

		return $response;
	}

	/**
	 * Build a response for empty results.
	 *
	 * @param string $question The original question.
	 * @param string $sql      The SQL executed.
	 * @param string $type     The intended output type.
	 * @param float  $sql_time Query execution time.
	 * @return array
	 */
	private static function build_empty_response( string $question, string $sql, string $type, float $sql_time ): array {
		$empty_message = __( 'No results found.', 'silc-wooinsight-ai' );

		if ( preg_match( '/last\s+(week|month|year|7\s*days|30\s*days)/i', $question ) ) {
			$empty_message = __( 'No data found for the specified period.', 'silc-wooinsight-ai' );
		} elseif ( preg_match( '/pending|cancelled|refunded|failed/i', $question ) ) {
			$empty_message = __( 'No orders found with that status.', 'silc-wooinsight-ai' );
		}

		return array(
			'success'      => true,
			'type'         => $type,
			'sql'          => $sql,
			'sql_time_ms'  => $sql_time,
			'rows_returned' => 0,
			'empty'        => true,
			'empty_message' => $empty_message,
			'question'     => $question,
			'columns'      => array(),
		);
	}

	/**
	 * Render insight data by type using the appropriate renderer method.
	 *
	 * @param array  $data         Raw result rows.
	 * @param array  $insight_data The parsed AI insight data.
	 * @param string $type         The output type (chart, list, answer).
	 * @param string $question     The original question.
	 * @return array
	 */
	private static function render_by_type( array $data, array $insight_data, string $type, string $question ): array {
		$response = array(
			'success' => true,
			'type'    => $type,
			'title'   => $insight_data['title'] ?? '',
		);

		switch ( $type ) {
			case 'chart':
				$chart_config        = $insight_data['chart_config'] ?? array();
				$response['chart_config'] = SILC_WIA_Insight_Renderer::prepare_chart_data( $data, $chart_config );
				$response['list_data']    = null;
				$response['answer_text']  = null;
				break;

			case 'list':
				$list_config = $insight_data['list_config'] ?? array();
				$link_map    = $list_config['link_columns'] ?? array();
				$response['list_data']    = SILC_WIA_Insight_Renderer::prepare_list_data( $data, $link_map );
				$response['list_config']  = array(
					'title_column'    => $list_config['title_column'] ?? ( ! empty( $data[0] ) ? array_keys( $data[0] )[0] : '' ),
					'display_columns' => $list_config['display_columns'] ?? ( ! empty( $data[0] ) ? array_keys( $data[0] ) : array() ),
				);
				$response['chart_config'] = null;
				$response['answer_text']  = null;
				break;

			case 'answer':
			default:
				$answer_text           = $insight_data['answer_text'] ?? '';
				$answer_data           = SILC_WIA_Insight_Renderer::prepare_answer_data( $data, $question );
				$response['answer_text'] = $answer_text ?: $answer_data['formatted'];
				$response['answer_value'] = $answer_data['value'];
				$response['answer_label'] = $answer_data['label'];
				$response['chart_config'] = null;
				$response['list_data']    = null;
				break;
		}

		return $response;
	}

	/**
	 * Heuristic fallback classification when AI JSON is invalid.
	 *
	 * Analyzes the columns and data to determine the best output type.
	 *
	 * @param array $data    Raw result rows.
	 * @param array $columns Column names.
	 * @return array{type: string, config: array}
	 */
	public static function classify_result( array $data, array $columns ): array {
		$type         = 'answer';
		$column_names = array_map( 'strtolower', $columns );

		// Count numeric columns and find a label column.
		$numeric_cols = 0;
		$label_col    = null;

		foreach ( $columns as $col ) {
			if ( self::is_numeric_column( $col, $data ) ) {
				$numeric_cols++;
			}
			if ( in_array( strtolower( $col ), array( 'name', 'label', 'date', 'month', 'category', 'product_name', 'customer_name' ), true ) ) {
				$label_col = $col;
			}
		}

		$row_count = count( $data );

		// Heuristic: Many rows + label + numeric col → chart.
		if ( $row_count > 2 && $label_col && $numeric_cols >= 1 ) {
			$type = 'chart';
		}
		// Heuristic: Has ID columns + more than 1 row → list.
		elseif ( self::has_id_columns( $columns ) && $row_count > 1 ) {
			$type = 'list';
		}
		// Heuristic: Single row with few numeric values → answer.
		elseif ( 1 === $row_count && $numeric_cols <= 2 ) {
			$type = 'answer';
		}
		// Heuristic: Many rows with no clear label → list.
		elseif ( $row_count > 5 ) {
			$type = 'list';
		}

		return array(
			'type'   => $type,
			'config' => self::build_fallback_config( $type, $data, $columns ),
		);
	}

	/**
	 * Check if a column appears to be numeric based on sample data.
	 *
	 * @param string $col  Column name.
	 * @param array  $data Sample data rows.
	 * @return bool
	 */
	private static function is_numeric_column( string $col, array $data ): bool {
		foreach ( $data as $row ) {
			if ( isset( $row[ $col ] ) && is_numeric( $row[ $col ] ) ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Check if columns contain ID-type columns appropriate for link generation.
	 *
	 * @param array $columns Column names.
	 * @return bool
	 */
	private static function has_id_columns( array $columns ): bool {
		$id_patterns = array( 'order_id', 'product_id', 'user_id', 'customer_id', 'coupon_id', 'parent_order_id' );
		foreach ( $columns as $col ) {
			if ( in_array( $col, $id_patterns, true ) ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Build a fallback config for a given type when AI data is unavailable.
	 *
	 * @param string $type    The output type.
	 * @param array  $data    Raw result rows.
	 * @param array  $columns Column names.
	 * @return array Config data.
	 */
	private static function build_fallback_config( string $type, array $data, array $columns ): array {
		$config = array();

		switch ( $type ) {
			case 'chart':
				$config['chart_config'] = array(
					'chart_type' => 'bar',
					'title'      => __( 'Results', 'silc-wooinsight-ai' ),
					'labels'     => array(),
					'datasets'   => array(),
				);
				break;

			case 'list':
				$link_columns = array();
				foreach ( $columns as $col ) {
					if ( 'order_id' === $col ) {
						$link_columns[ $col ] = 'order';
					} elseif ( 'product_id' === $col ) {
						$link_columns[ $col ] = 'product';
					} elseif ( 'user_id' === $col || 'customer_id' === $col ) {
						$link_columns[ $col ] = 'user';
					} elseif ( 'coupon_id' === $col ) {
						$link_columns[ $col ] = 'coupon';
					}
				}
				$config['list_config'] = array(
					'title_column'    => $columns[0] ?? '',
					'display_columns' => $columns,
					'link_columns'    => $link_columns,
				);
				break;

			case 'answer':
			default:
				$config['answer_text'] = '';
				break;
		}

		return $config;
		return $config;
	}

	/**
	 * Re-execute a stored SQL query using the original insight config.
	 * No AI call — just re-runs the SQL and re-renders with the same formatting.
	 *
	 * @param string $sql          The SQL to execute.
	 * @param string $type         The result type (chart, list, answer).
	 * @param array  $insight_data Stored insight config (chart_config, list_config, answer_text, etc.).
	 * @return array The complete insight response.
	 */
	public static function re_execute_sql( string $sql, string $type, array $insight_data ): array {
		// Validate SQL.
		$validation = SILC_WIA_SQL_Validator::validate( $sql );
		if ( ! $validation['valid'] ) {
			return array(
				'success' => false,
				'error'   => $validation['error'],
				'type'    => 'error',
				'sql'     => $sql,
			);
		}

		// Execute SQL.
		$execution = SILC_WIA_SQL_Validator::execute( $validation['sql'] );
		if ( ! $execution['success'] ) {
			return array(
				'success' => false,
				'error'   => sprintf(
					/* translators: %s: database error */
					__( 'Query error: %s', 'silc-wooinsight-ai' ),
					$execution['error']
				),
				'type' => 'error',
				'sql'  => $validation['sql'],
			);
		}

		$data       = $execution['data'] ?? array();
		$columns    = ! empty( $data ) ? array_keys( $data[0] ) : array();
		$sql_time   = $execution['time_ms'] ?? 0;
		$rows_count = $execution['rows'] ?? count( $data );

		// If empty data, return empty response.
		if ( empty( $data ) ) {
			return array(
				'success'       => true,
				'type'          => $type,
				'sql'           => $validation['sql'],
				'sql_time_ms'   => $sql_time,
				'rows_returned' => 0,
				'empty'         => true,
				'empty_message' => __( 'No results found.', 'silc-wooinsight-ai' ),
				'columns'       => array(),
				'chart_config'  => null,
				'list_data'     => null,
				'list_config'   => null,
				'answer_text'   => null,
				'answer_value'  => null,
				'answer_label'  => null,
			);
		}

		// Render using stored config.
		$response = self::render_by_type( $data, $insight_data, $type, '' );

		$response['sql']           = $validation['sql'];
		$response['sql_time_ms']   = $sql_time;
		$response['rows_returned'] = $rows_count;
		$response['columns']       = $columns;
		$response['question']      = '';

		return $response;
	}
}
