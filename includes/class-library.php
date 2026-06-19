<?php
/**
 * Insight Library
 *
 * Provides a collection of pre-built, ready-to-execute insight items.
 * Each item has the same JSON format the AI would return — sql, type,
 * chart_config, list_config, answer_text, title — so it works without
 * an active AI API connection.
 *
 * All SQL queries use only tables and columns verified against the
 * actual WooCommerce schema. Compatible with both HPOS and legacy modes.
 *
 * @package SILC_WooInsight_AI
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Library class.
 */
class SILC_WIA_Library {

	/**
	 * Get the full library of pre-built insight items.
	 *
	 * Each item contains:
	 *   id           — unique identifier
	 *   question     — natural language description (searchable)
	 *   sql          — the SQL SELECT query (with {prefix} placeholder)
	 *   type         — chart | list | answer
	 *   title        — short display title
	 *   chart_config — (chart type only) Chart.js transform config
	 *   list_config  — (list type only) column/link config
	 *   answer_text  — (answer type only) template with {{column}} placeholders
	 *
	 * @return array
	 */
	public static function get_library(): array {
		global $wpdb;
		$p = $wpdb->prefix;

		$items = array(

			// ================================================================
			// CHARTS & TRENDS (10 items)
			// ================================================================

			array(
				'id'       => 'lib_001',
				'question' => 'Best selling products by revenue this month',
				'sql'      => self::sql(
					"SELECT p.post_title AS product, SUM(opl.product_gross_revenue) AS revenue
					FROM {prefix}wc_order_product_lookup opl
					JOIN {prefix}wc_order_stats os ON os.order_id = opl.order_id
					JOIN {prefix}posts p ON p.ID = opl.product_id
					WHERE os.date_created >= DATE_FORMAT(NOW(), '%Y-%m-01')
					  AND os.status IN ('wc-completed','wc-processing')
					GROUP BY opl.product_id, p.post_title
					ORDER BY revenue DESC
					LIMIT 15"
				),
				'type'     => 'chart',
				'title'    => 'Best Selling Products This Month',
				'chart_config' => array(
					'chart_type' => 'bar',
					'title'      => 'Best Selling Products by Revenue — This Month',
					'transform'  => array(
						'type'         => 'columns_to_datasets',
						'label_column' => 'product',
						'value_columns' => array( 'revenue' ),
					),
				),
			),

			array(
				'id'       => 'lib_002',
				'question' => 'Monthly revenue trend this year',
				'sql'      => self::sql(
					"SELECT DATE_FORMAT(date_created, '%Y-%m') AS month,
					       SUM(total_sales) - SUM(tax_total) AS revenue
					FROM {prefix}wc_order_stats
					WHERE date_created >= DATE_FORMAT(NOW(), '%Y-01-01')
					  AND status IN ('wc-completed','wc-processing')
					GROUP BY DATE_FORMAT(date_created, '%Y-%m')
					ORDER BY month ASC"
				),
				'type'     => 'chart',
				'title'    => 'Monthly Revenue Trend',
				'chart_config' => array(
					'chart_type' => 'line',
					'title'      => 'Monthly Revenue — This Year',
					'transform'  => array(
						'type'         => 'columns_to_datasets',
						'label_column' => 'month',
						'value_columns' => array( 'revenue' ),
					),
				),
			),

			array(
				'id'       => 'lib_003',
				'question' => 'Order status distribution',
				'sql'      => self::sql(
					"SELECT status, COUNT(*) AS count
					FROM {prefix}wc_order_stats
					WHERE date_created >= DATE_SUB(NOW(), INTERVAL 30 DAY)
					GROUP BY status
					ORDER BY count DESC"
				),
				'type'     => 'chart',
				'title'    => 'Order Status Distribution',
				'chart_config' => array(
					'chart_type' => 'doughnut',
					'title'      => 'Order Status Distribution (Last 30 Days)',
					'transform'  => array(
						'type'         => 'columns_to_datasets',
						'label_column' => 'status',
						'value_columns' => array( 'count' ),
					),
				),
			),

			array(
				'id'       => 'lib_004',
				'question' => 'Sales by product category',
				'sql'      => self::sql(
					"SELECT t.name AS category, SUM(opl.product_gross_revenue) AS revenue
					FROM {prefix}wc_order_product_lookup opl
					JOIN {prefix}wc_order_stats os ON os.order_id = opl.order_id
					JOIN {prefix}term_relationships tr ON tr.object_id = opl.product_id
					JOIN {prefix}term_taxonomy tt ON tt.term_taxonomy_id = tr.term_taxonomy_id AND tt.taxonomy = 'product_cat'
					JOIN {prefix}terms t ON t.term_id = tt.term_id
					WHERE os.date_created >= DATE_SUB(NOW(), INTERVAL 30 DAY)
					  AND os.status IN ('wc-completed','wc-processing')
					GROUP BY t.term_id, t.name
					ORDER BY revenue DESC
					LIMIT 10"
				),
				'type'     => 'chart',
				'title'    => 'Sales by Product Category',
				'chart_config' => array(
					'chart_type' => 'bar',
					'title'      => 'Sales by Category (Last 30 Days)',
					'transform'  => array(
						'type'         => 'columns_to_datasets',
						'label_column' => 'category',
						'value_columns' => array( 'revenue' ),
					),
				),
			),

			array(
				'id'       => 'lib_005',
				'question' => 'Daily orders for the past 7 days',
				'sql'      => self::sql(
					"SELECT DATE(date_created) AS day, COUNT(*) AS orders
					FROM {prefix}wc_order_stats
					WHERE date_created >= DATE_SUB(NOW(), INTERVAL 7 DAY)
					GROUP BY DATE(date_created)
					ORDER BY day ASC"
				),
				'type'     => 'chart',
				'title'    => 'Daily Orders (7 Days)',
				'chart_config' => array(
					'chart_type' => 'bar',
					'title'      => 'Daily Orders — Past 7 Days',
					'transform'  => array(
						'type'         => 'columns_to_datasets',
						'label_column' => 'day',
						'value_columns' => array( 'orders' ),
					),
				),
			),

			array(
				'id'       => 'lib_006',
				'question' => 'Top 5 products by quantity sold',
				'sql'      => self::sql(
					"SELECT p.post_title AS product, SUM(opl.product_qty) AS qty_sold
					FROM {prefix}wc_order_product_lookup opl
					JOIN {prefix}wc_order_stats os ON os.order_id = opl.order_id
					JOIN {prefix}posts p ON p.ID = opl.product_id
					WHERE os.date_created >= DATE_FORMAT(NOW(), '%Y-%m-01')
					  AND os.status IN ('wc-completed','wc-processing')
					GROUP BY opl.product_id, p.post_title
					ORDER BY qty_sold DESC
					LIMIT 5"
				),
				'type'     => 'chart',
				'title'    => 'Top 5 Products by Quantity',
				'chart_config' => array(
					'chart_type' => 'horizontalBar',
					'title'      => 'Top 5 Products by Quantity Sold — This Month',
					'transform'  => array(
						'type'         => 'columns_to_datasets',
						'label_column' => 'product',
						'value_columns' => array( 'qty_sold' ),
					),
				),
			),

			array(
				'id'       => 'lib_007',
				'question' => 'Daily revenue for the past 30 days',
				'sql'      => self::sql(
					"SELECT DATE(date_created) AS day,
					       SUM(total_sales) - SUM(tax_total) AS revenue
					FROM {prefix}wc_order_stats
					WHERE date_created >= DATE_SUB(NOW(), INTERVAL 30 DAY)
					  AND status IN ('wc-completed','wc-processing')
					GROUP BY DATE(date_created)
					ORDER BY day ASC"
				),
				'type'     => 'chart',
				'title'    => 'Daily Revenue (30 Days)',
				'chart_config' => array(
					'chart_type' => 'line',
					'title'      => 'Daily Revenue — Past 30 Days',
					'transform'  => array(
						'type'         => 'columns_to_datasets',
						'label_column' => 'day',
						'value_columns' => array( 'revenue' ),
					),
				),
			),

			array(
				'id'       => 'lib_008',
				'question' => 'Compare this month vs last month revenue',
				'sql'      => self::sql(
					"SELECT
					  CASE
					    WHEN date_created >= DATE_FORMAT(NOW(), '%Y-%m-01') THEN 'This Month'
					    ELSE 'Last Month'
					  END AS period,
					  SUM(total_sales) - SUM(tax_total) AS revenue
					FROM {prefix}wc_order_stats
					WHERE date_created >= DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 1 MONTH), '%Y-%m-01')
					  AND status IN ('wc-completed','wc-processing')
					GROUP BY period
					ORDER BY period DESC"
				),
				'type'     => 'chart',
				'title'    => 'This Month vs Last Month',
				'chart_config' => array(
					'chart_type' => 'bar',
					'title'      => 'Revenue — This Month vs Last Month',
					'transform'  => array(
						'type'         => 'columns_to_datasets',
						'label_column' => 'period',
						'value_columns' => array( 'revenue' ),
					),
				),
			),

			array(
				'id'       => 'lib_009',
				'question' => 'Weekly revenue for the past 4 weeks',
				'sql'      => self::sql(
					"SELECT DATE_FORMAT(
					    DATE_SUB(date_created, INTERVAL WEEKDAY(date_created) DAY), '%Y-%m-%d'
					  ) AS week_start,
					  SUM(total_sales) - SUM(tax_total) AS revenue
					FROM {prefix}wc_order_stats
					WHERE date_created >= DATE_SUB(NOW(), INTERVAL 4 WEEK)
					  AND status IN ('wc-completed','wc-processing')
					GROUP BY YEARWEEK(date_created,1)
					ORDER BY YEARWEEK(date_created,1) ASC"
				),
				'type'     => 'chart',
				'title'    => 'Weekly Revenue (4 Weeks)',
				'chart_config' => array(
					'chart_type' => 'bar',
					'title'      => 'Revenue — Past 4 Weeks',
					'transform'  => array(
						'type'         => 'columns_to_datasets',
						'label_column' => 'week_start',
						'value_columns' => array( 'revenue' ),
					),
				),
			),

			array(
				'id'       => 'lib_010',
				'question' => 'Revenue by day of week',
				'sql'      => self::sql(
					"SELECT DAYNAME(date_created) AS weekday,
					       SUM(total_sales) - SUM(tax_total) AS revenue
					FROM {prefix}wc_order_stats
					WHERE date_created >= DATE_SUB(NOW(), INTERVAL 90 DAY)
					  AND status IN ('wc-completed','wc-processing')
					GROUP BY DAYOFWEEK(date_created), DAYNAME(date_created)
					ORDER BY DAYOFWEEK(date_created) ASC"
				),
				'type'     => 'chart',
				'title'    => 'Revenue by Day of Week',
				'chart_config' => array(
					'chart_type' => 'bar',
					'title'      => 'Revenue by Day of Week (Last 90 Days)',
					'transform'  => array(
						'type'         => 'columns_to_datasets',
						'label_column' => 'weekday',
						'value_columns' => array( 'revenue' ),
					),
				),
			),

			// ================================================================
			// LISTS & DETAILS (12 items)
			// ================================================================

			array(
				'id'       => 'lib_011',
				'question' => 'Top 10 customers by total spending',
				'sql'      => self::sql(
					"SELECT u.display_name AS customer, u.user_email AS email,
					       SUM(os.total_sales) AS total_spent,
					       COUNT(DISTINCT os.order_id) AS orders,
					       u.ID AS user_id
					FROM {prefix}wc_order_stats os
					JOIN {prefix}users u ON u.ID = os.customer_id
					WHERE os.status IN ('wc-completed','wc-processing')
					  AND os.customer_id > 0
					GROUP BY os.customer_id, u.ID, u.display_name, u.user_email
					ORDER BY total_spent DESC
					LIMIT 10"
				),
				'type'     => 'list',
				'title'    => 'Top 10 Customers by Spending',
				'list_config' => array(
					'title_column'    => 'customer',
					'display_columns' => array( 'customer', 'email', 'total_spent', 'orders' ),
					'link_columns'    => array( 'user_id' => 'user' ),
					'value_formats'   => array( 'total_spent' => 'currency' ),
				),
			),

			array(
				'id'       => 'lib_012',
				'question' => 'Recent orders with totals',
				'sql'      => self::sql(
					"SELECT os.order_id, os.date_created, os.status,
					       os.total_sales, os.net_total
					FROM {prefix}wc_order_stats os
					ORDER BY os.date_created DESC
					LIMIT 20"
				),
				'type'     => 'list',
				'title'    => 'Recent Orders',
				'list_config' => array(
					'title_column'    => 'order_id',
					'display_columns' => array( 'order_id', 'date_created', 'status', 'total_sales' ),
					'link_columns'    => array( 'order_id' => 'order' ),
					'value_formats'   => array( 'total_sales' => 'currency', 'net_total' => 'currency' ),
				),
			),

			array(
				'id'       => 'lib_013',
				'question' => 'Products low in stock',
				'sql'      => self::sql(
					"SELECT p.ID AS product_id, p.post_title AS product,
					       pml.stock_quantity, pml.stock_status
					FROM {prefix}wc_product_meta_lookup pml
					JOIN {prefix}posts p ON p.ID = pml.product_id
					WHERE p.post_status = 'publish'
					  AND pml.stock_quantity <= 5
					  AND pml.stock_quantity > 0
					ORDER BY pml.stock_quantity ASC
					LIMIT 20"
				),
				'type'     => 'list',
				'title'    => 'Low Stock Products',
				'list_config' => array(
					'title_column'    => 'product',
					'display_columns' => array( 'product', 'stock_quantity', 'stock_status' ),
					'link_columns'    => array( 'product_id' => 'product' ),
					'value_formats'   => array( 'stock_quantity' => 'number' ),
				),
			),

			array(
				'id'       => 'lib_014',
				'question' => 'Pending orders',
				'sql'      => self::sql(
					"SELECT os.order_id, os.date_created, os.total_sales
					FROM {prefix}wc_order_stats os
					WHERE os.status = 'wc-pending'
					ORDER BY os.date_created DESC
					LIMIT 20"
				),
				'type'     => 'list',
				'title'    => 'Pending Orders',
				'list_config' => array(
					'title_column'    => 'order_id',
					'display_columns' => array( 'order_id', 'date_created', 'total_sales' ),
					'link_columns'    => array( 'order_id' => 'order' ),
					'value_formats'   => array( 'total_sales' => 'currency' ),
				),
			),

			array(
				'id'       => 'lib_015',
				'question' => 'Out of stock products',
				'sql'      => self::sql(
					"SELECT p.ID AS product_id, p.post_title AS product,
					       pml.stock_status
					FROM {prefix}wc_product_meta_lookup pml
					JOIN {prefix}posts p ON p.ID = pml.product_id
					WHERE p.post_status = 'publish'
					  AND pml.stock_status = 'outofstock'
					ORDER BY p.post_title ASC
					LIMIT 20"
				),
				'type'     => 'list',
				'title'    => 'Out of Stock Products',
				'list_config' => array(
					'title_column'    => 'product',
					'display_columns' => array( 'product', 'stock_status' ),
					'link_columns'    => array( 'product_id' => 'product' ),
				),
			),

			array(
				'id'       => 'lib_016',
				'question' => 'Orders on hold',
				'sql'      => self::sql(
					"SELECT os.order_id, os.date_created, os.total_sales
					FROM {prefix}wc_order_stats os
					WHERE os.status = 'wc-on-hold'
					ORDER BY os.date_created DESC
					LIMIT 20"
				),
				'type'     => 'list',
				'title'    => 'Orders On Hold',
				'list_config' => array(
					'title_column'    => 'order_id',
					'display_columns' => array( 'order_id', 'date_created', 'total_sales' ),
					'link_columns'    => array( 'order_id' => 'order' ),
					'value_formats'   => array( 'total_sales' => 'currency' ),
				),
			),

			array(
				'id'       => 'lib_017',
				'question' => 'Best selling categories',
				'sql'      => self::sql(
					"SELECT t.name AS category, COUNT(DISTINCT opl.order_id) AS orders,
					       SUM(opl.product_qty) AS items_sold
					FROM {prefix}wc_order_product_lookup opl
					JOIN {prefix}term_relationships tr ON tr.object_id = opl.product_id
					JOIN {prefix}term_taxonomy tt ON tt.term_taxonomy_id = tr.term_taxonomy_id AND tt.taxonomy = 'product_cat'
					JOIN {prefix}terms t ON t.term_id = tt.term_id
					GROUP BY t.term_id, t.name
					ORDER BY items_sold DESC
					LIMIT 15"
				),
				'type'     => 'list',
				'title'    => 'Best Selling Categories',
				'list_config' => array(
					'title_column'    => 'category',
					'display_columns' => array( 'category', 'orders', 'items_sold' ),
					'value_formats'   => array( 'orders' => 'number', 'items_sold' => 'number' ),
				),
			),

			array(
				'id'       => 'lib_018',
				'question' => 'Orders using coupons',
				'sql'      => self::sql(
					"SELECT os.order_id, os.date_created, os.total_sales,
					       SUM(opl.coupon_amount) AS coupon_discount
					FROM {prefix}wc_order_stats os
					JOIN {prefix}wc_order_product_lookup opl ON opl.order_id = os.order_id
					WHERE opl.coupon_amount > 0
					GROUP BY os.order_id, os.date_created, os.total_sales
					ORDER BY os.date_created DESC
					LIMIT 20"
				),
				'type'     => 'list',
				'title'    => 'Orders with Coupons',
				'list_config' => array(
					'title_column'    => 'order_id',
					'display_columns' => array( 'order_id', 'date_created', 'total_sales', 'coupon_discount' ),
					'link_columns'    => array( 'order_id' => 'order' ),
					'value_formats'   => array( 'total_sales' => 'currency', 'coupon_discount' => 'currency' ),
				),
			),

			array(
				'id'       => 'lib_019',
				'question' => 'Latest customers by registration date',
				'sql'      => self::sql(
					"SELECT u.ID AS user_id, u.display_name, u.user_email,
					       u.user_registered
					FROM {prefix}users u
					ORDER BY u.user_registered DESC
					LIMIT 20"
				),
				'type'     => 'list',
				'title'    => 'Latest Customers',
				'list_config' => array(
					'title_column'    => 'display_name',
					'display_columns' => array( 'display_name', 'user_email', 'user_registered' ),
					'link_columns'    => array( 'user_id' => 'user' ),
				),
			),

			array(
				'id'       => 'lib_020',
				'question' => 'Products never purchased',
				'sql'      => self::sql(
					"SELECT p.ID AS product_id, p.post_title AS product, p.post_date
					FROM {prefix}posts p
					LEFT JOIN {prefix}wc_order_product_lookup opl ON opl.product_id = p.ID
					WHERE p.post_type = 'product'
					  AND p.post_status = 'publish'
					  AND opl.product_id IS NULL
					ORDER BY p.post_date DESC
					LIMIT 20"
				),
				'type'     => 'list',
				'title'    => 'Products Never Purchased',
				'list_config' => array(
					'title_column'    => 'product',
					'display_columns' => array( 'product', 'post_date' ),
					'link_columns'    => array( 'product_id' => 'product' ),
				),
			),

			array(
				'id'       => 'lib_021',
				'question' => 'Top products by average rating',
				'sql'      => self::sql(
					"SELECT p.ID AS product_id, p.post_title AS product,
					       pml.average_rating, pml.rating_count
					FROM {prefix}wc_product_meta_lookup pml
					JOIN {prefix}posts p ON p.ID = pml.product_id
					WHERE p.post_status = 'publish'
					  AND pml.average_rating > 0
					ORDER BY pml.average_rating DESC, pml.rating_count DESC
					LIMIT 15"
				),
				'type'     => 'list',
				'title'    => 'Top Rated Products',
				'list_config' => array(
					'title_column'    => 'product',
					'display_columns' => array( 'product', 'average_rating', 'rating_count' ),
					'link_columns'    => array( 'product_id' => 'product' ),
					'value_formats'   => array( 'average_rating' => 'number', 'rating_count' => 'number' ),
				),
			),

			array(
				'id'       => 'lib_022',
				'question' => 'Refunded orders',
				'sql'      => self::sql(
					"SELECT os.order_id, os.date_created, os.total_sales
					FROM {prefix}wc_order_stats os
					WHERE os.status = 'wc-refunded'
					ORDER BY os.date_created DESC
					LIMIT 20"
				),
				'type'     => 'list',
				'title'    => 'Refunded Orders',
				'list_config' => array(
					'title_column'    => 'order_id',
					'display_columns' => array( 'order_id', 'date_created', 'total_sales' ),
					'link_columns'    => array( 'order_id' => 'order' ),
					'value_formats'   => array( 'total_sales' => 'currency' ),
				),
			),

			// ================================================================
			// QUICK ANSWERS (8 items)
			// ================================================================

			array(
				'id'       => 'lib_023',
				'question' => 'Total revenue this month',
				'sql'      => self::sql(
					"SELECT SUM(total_sales) - SUM(tax_total) AS total_revenue
					FROM {prefix}wc_order_stats
					WHERE date_created >= DATE_FORMAT(NOW(), '%Y-%m-01')
					  AND status IN ('wc-completed','wc-processing')"
				),
				'type'     => 'answer',
				'title'    => 'Revenue This Month',
				'answer_text' => 'Total revenue this month: {{total_revenue}}',
			),

			array(
				'id'       => 'lib_024',
				'question' => 'Total revenue yesterday',
				'sql'      => self::sql(
					"SELECT SUM(total_sales) - SUM(tax_total) AS total_revenue
					FROM {prefix}wc_order_stats
					WHERE DATE(date_created) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
					  AND status IN ('wc-completed','wc-processing')"
				),
				'type'     => 'answer',
				'title'    => 'Revenue Yesterday',
				'answer_text' => 'Total revenue yesterday: {{total_revenue}}',
			),

			array(
				'id'       => 'lib_025',
				'question' => 'Total orders this month',
				'sql'      => self::sql(
					"SELECT COUNT(*) AS total_orders
					FROM {prefix}wc_order_stats
					WHERE date_created >= DATE_FORMAT(NOW(), '%Y-%m-01')"
				),
				'type'     => 'answer',
				'title'    => 'Orders This Month',
				'answer_text' => 'Total orders this month: {{total_orders}}',
			),

			array(
				'id'       => 'lib_026',
				'question' => 'Average order value',
				'sql'      => self::sql(
					"SELECT ROUND(AVG(total_sales), 2) AS avg_order_value
					FROM {prefix}wc_order_stats
					WHERE date_created >= DATE_SUB(NOW(), INTERVAL 30 DAY)
					  AND status IN ('wc-completed','wc-processing')"
				),
				'type'     => 'answer',
				'title'    => 'Average Order Value',
				'answer_text' => 'Average order value (last 30 days): {{avg_order_value}}',
			),

			array(
				'id'       => 'lib_027',
				'question' => 'How many products do I have?',
				'sql'      => self::sql(
					"SELECT COUNT(*) AS product_count
					FROM {prefix}posts
					WHERE post_type = 'product'
					  AND post_status = 'publish'"
				),
				'type'     => 'answer',
				'title'    => 'Product Count',
				'answer_text' => 'Total published products: {{product_count}}',
			),

			array(
				'id'       => 'lib_028',
				'question' => 'Total customers count',
				'sql'      => self::sql(
					"SELECT COUNT(*) AS customer_count
					FROM {prefix}wc_customer_lookup"
				),
				'type'     => 'answer',
				'title'    => 'Customer Count',
				'answer_text' => 'Total customers: {{customer_count}}',
			),

			array(
				'id'       => 'lib_029',
				'question' => 'Total revenue this year',
				'sql'      => self::sql(
					"SELECT SUM(total_sales) - SUM(tax_total) AS total_revenue
					FROM {prefix}wc_order_stats
					WHERE date_created >= DATE_FORMAT(NOW(), '%Y-01-01')
					  AND status IN ('wc-completed','wc-processing')"
				),
				'type'     => 'answer',
				'title'    => 'Revenue This Year',
				'answer_text' => 'Total revenue this year: {{total_revenue}}',
			),

			array(
				'id'       => 'lib_030',
				'question' => 'Total tax collected this month',
				'sql'      => self::sql(
					"SELECT SUM(tax_total) AS total_tax
					FROM {prefix}wc_order_stats
					WHERE date_created >= DATE_FORMAT(NOW(), '%Y-%m-01')
					  AND status IN ('wc-completed','wc-processing')"
				),
				'type'     => 'answer',
				'title'    => 'Tax Collected This Month',
				'answer_text' => 'Total tax collected this month: {{total_tax}}',
			),

		);

		return $items;
	}

	/**
	 * Replace {prefix} placeholder with the actual WordPress table prefix.
	 *
	 * @param string $sql SQL with {prefix} placeholder.
	 * @return string SQL with real prefix.
	 */
	public static function sql( string $sql ): string {
		global $wpdb;
		return str_replace( '{prefix}', $wpdb->prefix, trim( $sql ) );
	}

	/**
	 * Get library items ready for JS consumption.
	 *
	 * @return array
	 */
	public static function get_library_for_js(): array {
		return self::get_library();
	}
}
