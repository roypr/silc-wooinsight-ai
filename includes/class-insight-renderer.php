<?php
/**
 * Insight Renderer
 *
 * HPOS-aware admin link generation, data normalization, and formatting
 * for chart, list, and answer insight output types.
 *
 * @package SILC_WooInsight_AI
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Insight Renderer class.
 */
class SILC_WIA_Insight_Renderer {

	/**
	 * Prepare chart data by validating and completing the Chart.js config.
	 *
	 * Supports three modes in order of priority:
	 * 1. AI pre-computed labels/datasets → return as-is (legacy)
	 * 2. AI transform config → reshape flat SQL rows into multi-dataset Chart.js format
	 * 3. Fallback → auto-build from raw rows using heuristics
	 *
	/**
	 * Prepare chart data by validating and completing the Chart.js config.
	 *
	 * The AI provides a "transform" config describing how to reshape flat SQL
	 * result rows into Chart.js multi-dataset format. The AI never provides
	 * actual data values — it only knows the schema.
	 *
	 * If no transform is provided, auto-builds from actual SQL data using heuristics.
	 *
		// Ensure we have labels and datasets.
		if ( empty( $data ) ) {
			return array(
				'chart_type' => $config['chart_type'] ?? 'bar',
				'title'      => $config['title'] ?? '',
				'labels'     => array(),
				'datasets'   => array(),
				'empty'      => true,
			);
		}
		// AI only knows the schema, never actual row data. It provides a "transform" config
		// telling the server how to reshape flat SQL results into Chart.js format.
		// If no transform is provided, fall through to auto-build from the real data.

		// Priority 2: Transform config — reshape flat SQL rows into multi-dataset Chart.js format.
		if ( ! empty( $config['transform'] ) ) {
			$transformed = self::transform_chart_data( $data, $config );
			if ( null !== $transformed ) {
				return $transformed;
			}
		}

		// Priority 3: Fallback — auto-build chart from raw rows using heuristics.
		return self::auto_build_chart( $data, $config );
	}

	/**
	/**
	 * Transform flat SQL result rows into Chart.js multi-dataset format
	 * using a config-driven transform definition from the AI.
	 *
	 * The transform tells PHP how to reshape data, avoiding the need for
	 *
	 * Supported transform types:
	 *
	 * --- group_split ---
	 * Splits rows by a "group_by" column to create separate datasets.
	 * Ideal for time-series comparisons: "monthly revenue per year".
	 *
	 * Input rows (flat):
	 *   year | month | revenue
	 *   2022 | 1     | 5000
	 *   2022 | 2     | 4800
	 *   2023 | 1     | 6200
	 *   2023 | 2     | 5900
	 *
	 * Transform config:
	 *   {
	 *     "type": "group_split",
	 *     "group_by": "year",
	 *     "x_axis": "month",
	 *     "value_column": "revenue",
	 *     "x_labels": ["Jan","Feb","Mar",...]
	 *   }
	 *
	 * Output datasets:
	 *   [
	 *     { label: "2022", data: [5000, 4800] },
	 *     { label: "2023", data: [6200, 5900] }
	 *   ]
	 *
	 * --- columns_to_datasets ---
	 * Treats each numeric column as a separate dataset, using a label column
	 * for x-axis. Ideal for: "total sales, refunds, and net revenue by month".
	 *
	 * Transform config:
	 *   {
	 *     "type": "columns_to_datasets",
	 *     "label_column": "month",
	 *     "value_columns": ["total_sales", "refunds", "net_revenue"]
	 *   }
	 *
	 * @param array $data   Flat SQL result rows.
	 * @param array $config Chart config containing the transform definition.
	 * @return array|null Chart.js config array, or null if transform failed.
	 */
	public static function transform_chart_data( array $data, array $config ): ?array {
		$transform = $config['transform'];
		$type      = $transform['type'] ?? '';

		if ( 'group_split' === $type ) {
			return self::transform_group_split( $data, $config, $transform );
		}

		if ( 'columns_to_datasets' === $type ) {
			return self::transform_columns_to_datasets( $data, $config, $transform );
		}

		return null;
	}

	/**
	 * Transform flat data using the "group_split" strategy.
	 *
	 * Groups rows by a column value (e.g. year), creating one dataset per group.
	 *
	 * @param array $data      Flat SQL result rows.
	 * @param array $config    Original chart config.
	 * @param array $transform The transform definition.
	 * @return array Chart.js config.
	 */
	private static function transform_group_split( array $data, array $config, array $transform ): array {
		$group_by     = $transform['group_by'] ?? '';
		$x_axis       = $transform['x_axis'] ?? '';
		$value_column = $transform['value_column'] ?? '';
		$x_labels     = $transform['x_labels'] ?? array();

		if ( empty( $group_by ) || empty( $x_axis ) || empty( $value_column ) ) {
			return self::auto_build_chart( $data, $config );
		}

		// Group rows by the group_by column value.
		$groups = array();
		$all_x  = array();

		foreach ( $data as $row ) {
			$group_key = (string) ( $row[ $group_by ] ?? '' );
			$x_value   = (string) ( $row[ $x_axis ] ?? '' );

			if ( '' === $group_key || '' === $x_value ) {
				continue;
			}

			if ( ! isset( $groups[ $group_key ] ) ) {
				$groups[ $group_key ] = array();
			}
			$groups[ $group_key ][ $x_value ] = isset( $row[ $value_column ] ) ? floatval( $row[ $value_column ] ) : 0;
			$all_x[ $x_value ] = true;
		}

		if ( empty( $groups ) || empty( $all_x ) ) {
			return self::auto_build_chart( $data, $config );
		}

		// Build sorted x-axis labels.
		if ( ! empty( $x_labels ) ) {
			// Use AI-provided labels (e.g. month names).
			$labels = $x_labels;
		} else {
			// Auto-sort numerically or alphabetically.
			$labels = array_keys( $all_x );
			if ( ctype_digit( implode( '', $labels ) ) ) {
				sort( $labels, SORT_NUMERIC );
			} else {
				sort( $labels, SORT_STRING );
			}
		}

		// Build datasets, one per group.
		$datasets = array();
		$idx      = 0;

		// Sort group keys for consistent output.
		$group_keys = array_keys( $groups );
		if ( ctype_digit( implode( '', $group_keys ) ) ) {
			sort( $group_keys, SORT_NUMERIC );
		} else {
			sort( $group_keys, SORT_STRING );
		}

		foreach ( $group_keys as $group_key ) {
			$group_data = $groups[ $group_key ];
			$values     = array();

			foreach ( $labels as $label ) {
				$values[] = $group_data[ $label ] ?? 0;
			}

			$datasets[] = array(
				'label'           => (string) $group_key,
				'data'            => $values,
				'backgroundColor' => self::get_chart_color( $idx ),
				'borderColor'     => self::get_chart_color( $idx ),
				'borderWidth'     => 1,
				'fill'            => false,
				'tension'         => 0.1,
			);

			$idx++;
		}

		return array(
			'chart_type' => $config['chart_type'] ?? 'line',
			'title'      => $config['title'] ?? '',
			'labels'     => $labels,
			'datasets'   => $datasets,
			'x_label'    => $config['x_label'] ?? $x_axis,
			'y_label'    => $config['y_label'] ?? $value_column,
		);
	}

	/**
	 * Transform flat data using the "columns_to_datasets" strategy.
	 *
	 * Treats each numeric column as a separate dataset, using a label column
	 * for x-axis. Ideal for multi-metric comparisons like "sales and refunds per month".
	 *
	 * @param array $data      Flat SQL result rows.
	 * @param array $config    Original chart config.
	 * @param array $transform The transform definition.
	 * @return array Chart.js config.
	 */
	private static function transform_columns_to_datasets( array $data, array $config, array $transform ): array {
		$label_column  = $transform['label_column'] ?? '';
		$value_columns = $transform['value_columns'] ?? array();

		if ( empty( $label_column ) || empty( $value_columns ) ) {
			return self::auto_build_chart( $data, $config );
		}

		// Build labels from the label column.
		$labels = array();
		$values = array();

		// Initialize value arrays.
		foreach ( $value_columns as $vc ) {
			$values[ $vc ] = array();
		}

		foreach ( $data as $row ) {
			$label_val = (string) ( $row[ $label_column ] ?? '' );
			if ( '' === $label_val ) {
				continue;
			}
			$labels[] = $label_val;

			foreach ( $value_columns as $vc ) {
				$values[ $vc ][] = isset( $row[ $vc ] ) ? floatval( $row[ $vc ] ) : 0;
			}
		}

		if ( empty( $labels ) ) {
			return self::auto_build_chart( $data, $config );
		}

		// Build datasets.
		$datasets = array();
		foreach ( $value_columns as $idx => $vc ) {
			$datasets[] = array(
				'label'           => $vc,
				'data'            => $values[ $vc ],
				'backgroundColor' => self::get_chart_color( $idx ),
				'borderColor'     => self::get_chart_color( $idx ),
				'borderWidth'     => 1,
			);
		}

		return array(
			'chart_type' => $config['chart_type'] ?? 'bar',
			'title'      => $config['title'] ?? '',
			'labels'     => $labels,
			'datasets'   => $datasets,
			'x_label'    => $config['x_label'] ?? $label_column,
			'y_label'    => $config['y_label'] ?? '',
		);
	}

	/**
	 * Auto-build chart data from raw query results when AI config is incomplete.
	 *
	 * @param array $data   Raw result rows.
	 * @param array $config Partial chart config.
	 * @return array Complete chart data.
	 */
	private static function auto_build_chart( array $data, array $config ): array {
		if ( empty( $data ) || empty( $data[0] ) ) {
			return $config;
		}

		$columns = array_keys( $data[0] );
		$labels  = array();
		$values  = array();
		$title   = $config['title'] ?? '';

		// Try to find a label column (string/text column) and a numeric column.
		$label_col  = null;
		$value_cols = array();

		foreach ( $columns as $col ) {
			$sample = $data[0][ $col ] ?? '';
			if ( is_numeric( $sample ) || is_float( $sample ) ) {
				$value_cols[] = $col;
			} elseif ( null === $label_col && ! is_numeric( $sample ) ) {
				$label_col = $col;
			}
		}

		// If we have a label + at least one value column, build datasets.
		if ( $label_col && ! empty( $value_cols ) ) {
			$labels   = array_map( function ( $row ) use ( $label_col ) {
				return (string) ( $row[ $label_col ] ?? '' );
			}, $data );

			if ( empty( $title ) ) {
				$title = implode( ' by ', $value_cols ) . ' by ' . $label_col;
			}

			$datasets = array();
			foreach ( $value_cols as $index => $vc ) {
				$datasets[] = array(
					'label'           => $vc,
					'data'            => array_map( function ( $row ) use ( $vc ) {
						return is_numeric( $row[ $vc ] ?? '' ) ? floatval( $row[ $vc ] ) : 0;
					}, $data ),
					'backgroundColor' => self::get_chart_color( $index ),
				);
			}

			return array(
				'chart_type' => $config['chart_type'] ?? 'bar',
				'title'      => $title,
				'labels'     => $labels,
				'datasets'   => $datasets,
				'x_label'    => $config['x_label'] ?? $label_col,
				'y_label'    => $config['y_label'] ?? ( implode( ', ', $value_cols ) ),
			);
		}

		// Fallback: use first column as labels, second as values.
		if ( count( $columns ) >= 2 ) {
			$labels = array_map( function ( $row ) use ( $columns ) {
				return (string) ( $row[ $columns[0] ] ?? '' );
			}, $data );

			$datasets = array();
			for ( $i = 1; $i < count( $columns ); $i++ ) {
				$datasets[] = array(
					'label'           => $columns[ $i ],
					'data'            => array_map( function ( $row ) use ( $columns, $i ) {
						return is_numeric( $row[ $columns[ $i ] ] ?? '' ) ? floatval( $row[ $columns[ $i ] ] ) : 0;
					}, $data ),
					'backgroundColor' => self::get_chart_color( $i - 1 ),
				);
			}

			return array(
				'chart_type' => $config['chart_type'] ?? 'bar',
				'title'      => $title ?: ( implode( ' vs ', $columns ) ),
				'labels'     => $labels,
				'datasets'   => $datasets,
			);
		}

		// One column only — treat as answer, not chart.
		return array(
			'chart_type' => 'bar',
			'title'      => $title ?: 'Data',
			'labels'     => array(),
			'datasets'   => array(),
		);
	}

	/**
	 * Prepare list data by injecting admin links and formatting values.
	 *
	 * @param array $data     Raw result rows.
	 * @param array $link_map Column => link_type mapping from AI config.
	 * @return array List data with links.
	 */
	public static function prepare_list_data( array $data, array $link_map = array() ): array {
		if ( empty( $data ) ) {
			return array();
		}

		$processed = array();

		foreach ( $data as $row ) {
			$item = $row;

			// Generate HPOS-aware admin links.
			if ( ! empty( $link_map ) ) {
				$item['_links'] = self::get_admin_links( $row, $link_map );
			} else {
				// Auto-detect link columns.
				$auto_links = self::auto_detect_links( $row );
				if ( ! empty( $auto_links ) ) {
					$item['_links'] = $auto_links;
				}
			}

			$processed[] = $item;
		}

		return $processed;
	}

	/**
	 * Prepare answer data by formatting the single value.
	 *
	 * @param array  $data      Raw result rows (expects 1 row).
	 * @param string $question  The original user question (for context detection).
	 * @return array Formatted answer.
	 */
	public static function prepare_answer_data( array $data, string $question = '' ): array {
		if ( empty( $data ) || empty( $data[0] ) ) {
			return self::get_empty_answer( $question );
		}

		$row    = $data[0];
		$keys   = array_keys( $row );
		$value  = reset( $row ); // First column value.
		$label  = $keys[0] ?? 'result';

		// Detect currency columns.
		$is_currency = self::is_currency_question( $question, $keys );
		$is_count    = self::is_count_question( $question );

		if ( $is_currency && is_numeric( $value ) ) {
			$currency = function_exists( 'get_woocommerce_currency_symbol' )
				? get_woocommerce_currency_symbol()
				: '$';
			$formatted = $currency . number_format( (float) $value, 2 );
		} elseif ( $is_count && is_numeric( $value ) ) {
			$formatted = number_format( (int) $value );
		} else {
			$formatted = (string) $value;
		}

		return array(
			'label'     => $label,
			'value'     => $formatted,
			'formatted' => ucfirst( str_replace( '_', ' ', $label ) ) . ': ' . $formatted,
			'raw'       => $value,
		);
	}

	/**
	 * Get a contextual empty-results message based on the question.
	 *
	 * @param string $question The original user question.
	 * @return array Empty answer data.
	 */
	private static function get_empty_answer( string $question ): array {
		$message = __( 'No results found.', 'silc-wooinsight-ai' );

		if ( preg_match( '/last\s+(week|month|year|7\s*days|30\s*days)/i', $question ) ) {
			$message = __( 'No data found for the specified period.', 'silc-wooinsight-ai' );
		} elseif ( preg_match( '/pending|cancelled|refunded|failed/i', $question ) ) {
			$message = __( 'No orders found with that status.', 'silc-wooinsight-ai' );
		}

		return array(
			'label'     => __( 'No data', 'silc-wooinsight-ai' ),
			'value'     => '0',
			'formatted' => $message,
			'raw'       => null,
			'empty'     => true,
		);
	}

	/**
	 * Generate admin links for a row based on a link column map.
	 *
	 * @param array $row      The data row.
	 * @param array $link_map Column => link_type mapping.
	 * @return array Associative array of { column_name => url }.
	 */
	private static function get_admin_links( array $row, array $link_map ): array {
		$links = array();

		foreach ( $link_map as $column => $type ) {
			if ( ! isset( $row[ $column ] ) ) {
				continue;
			}

			$id = intval( $row[ $column ] );
			if ( $id <= 0 ) {
				continue;
			}

			switch ( $type ) {
				case 'order':
					$links[ $column ] = self::get_order_edit_url( $id );
					break;
				case 'product':
					$links[ $column ] = admin_url( 'post.php?post=' . $id . '&action=edit' );
					break;
				case 'user':
					$links[ $column ] = admin_url( 'user-edit.php?user_id=' . $id );
					break;
				case 'coupon':
					$links[ $column ] = admin_url( 'post.php?post=' . $id . '&action=edit' );
					break;
				case 'order_item':
					// Order items link to parent order.
					$parent_order_id = isset( $row['order_id'] ) ? intval( $row['order_id'] ) : 0;
					if ( $parent_order_id > 0 ) {
						$links[ $column ] = self::get_order_edit_url( $parent_order_id );
					}
					break;
			}
		}

		return $links;
	}

	/**
	 * Auto-detect link columns from a data row.
	 *
	 * @param array $row A single data row.
	 * @return array Link map.
	 */
	private static function auto_detect_links( array $row ): array {
		$links    = array();
		$patterns = array(
			'order_id'          => 'order',
			'parent_order_id'   => 'order',
			'product_id'        => 'product',
			'variation_id'      => 'product',
			'customer_id'       => 'user',
			'user_id'           => 'user',
			'coupon_id'         => 'coupon',
			'order_item_id'     => 'order_item',
		);

		foreach ( $patterns as $col => $type ) {
			if ( isset( $row[ $col ] ) && ! empty( $row[ $col ] ) ) {
				$links[ $col ] = $type;
			}
		}

		return self::get_admin_links( $row, $links );
	}

	/**
	 * Get the order edit URL, HPOS-aware.
	 *
	 * Uses WooCommerce HPOS detection to generate the correct URL pattern:
	 * - HPOS mode: admin.php?page=wc-orders&action=edit&id={id}
	 * - Legacy mode: post.php?post={id}&action=edit
	 *
	 * @param int $order_id The order ID.
	 * @return string The admin edit URL.
	 */
	public static function get_order_edit_url( int $order_id ): string {
		if ( class_exists( '\Automattic\WooCommerce\Utilities\OrderUtil' ) &&
			 \Automattic\WooCommerce\Utilities\OrderUtil::custom_orders_table_usage_is_enabled() ) {
			return admin_url( 'admin.php?page=wc-orders&action=edit&id=' . $order_id );
		}
		return admin_url( 'post.php?post=' . $order_id . '&action=edit' );
	}

	/**
	 * Check if a question is asking about currency/revenue values.
	 *
	 * @param string $question The user question.
	 * @param array  $columns  The result column names.
	 * @return bool
	 */
	private static function is_currency_question( string $question, array $columns ): bool {
		$currency_keywords = array( 'revenue', 'sales', 'total', 'amount', 'earnings', 'income', 'value', 'price', 'cost' );
		foreach ( $currency_keywords as $kw ) {
			if ( stripos( $question, $kw ) !== false ) {
				return true;
			}
		}
		foreach ( $columns as $col ) {
			if ( preg_match( '/total|amount|price|revenue|sales|cost|fee|shipping|tax|discount/i', $col ) ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Check if a question is asking about counts.
	 *
	 * @param string $question The user question.
	 * @return bool
	 */
	private static function is_count_question( string $question ): bool {
		return (bool) preg_match(
			'/count|how\s+many|number\s+of|total\s+orders|customers|products/i',
			$question
		);
	}

	/**
	 * Get a chart color by index.
	 *
	 * @param int $index Color index.
	 * @return string Hex color.
	 */
	private static function get_chart_color( int $index ): string {
		$colors = array(
			'#2271b1', '#2c8a4a', '#d63638', '#826eb4',
			'#f0a849', '#72aee6', '#46b450', '#ffb900',
			'#c9356e', '#00a0d2',
		);
		return $colors[ $index % count( $colors ) ];
	}
}
