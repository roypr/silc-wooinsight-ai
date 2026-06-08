<?php
/**
 * WooCommerce Database Schema Mapping
 *
 * Provides a comprehensive map of WooCommerce database tables, columns,
 * relationships, post types, and meta keys. Used for AI prompt context
 * and SQL validation (whitelisting).
 *
 * @package SILC_WooInsight_AI
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * WooCommerce schema class.
 */
class SILC_WIA_Woo_Schema {

	/**
	 * Get the WordPress table prefix.
	 *
	 * @return string
	 */
	public static function prefix(): string {
		global $wpdb;
		return $wpdb->prefix;
	}

	// ----------------------------------------------------------------------- //
	//  CORE TABLES
	// ----------------------------------------------------------------------- //

	/**
	 * HPOS-specific table names (not present in legacy mode).
	 *
	 * @return array
	 */
	private static function get_hpos_table_names(): array {
		return array(
			'wc_orders',
			'wc_order_addresses',
			'wc_order_operational_data',
			'wc_orders_meta',
		);
	}

	/**
	 * Detect whether WooCommerce HPOS is the active order storage backend.
	 *
	 * @return bool
	 */
	public static function is_hpos_enabled(): bool {
		if ( ! class_exists( '\Automattic\WooCommerce\Utilities\OrderUtil' ) ) {
			return false;
		}
		try {
			return \Automattic\WooCommerce\Utilities\OrderUtil::custom_orders_table_usage_is_enabled();
		} catch ( \Exception $e ) {
			return false;
		}
	}

	/**
	 * Get table names relevant for the active order storage backend.
	 *
	 * In HPOS mode, includes HPOS-specific tables. In legacy mode, excludes them
	 * so the AI only sees tables that actually exist and are authoritative.
	 *
	 * @return array
	 */
	public static function get_active_table_names(): array {
		if ( self::is_hpos_enabled() ) {
			return self::get_table_names();
		}
		return array_values( array_diff( self::get_table_names(), self::get_hpos_table_names() ) );
	}

	/**
	 * Get all known WooCommerce table names (without prefix).
	 *
	 * @return array
	 */
	public static function get_table_names(): array {
		return array(
			// Orders (HPOS / traditional).
			'wc_orders',
			'wc_order_addresses',
			'wc_order_operational_data',
			'wc_orders_meta',
			// Legacy postmeta-based orders container.
			'posts',
			'postmeta',
			// Product data.
			'wc_product_meta_lookup',
			'term_relationships',
			'term_taxonomy',
			'terms',
			'termmeta',
			// Analytics.
			'wc_order_stats',
			'wc_order_product_lookup',
			'wc_order_tax_lookup',
			'wc_order_coupon_lookup',
			'wc_customer_lookup',
			'wc_category_lookup',
			// Other WC tables.
			'wc_download_log',
			'wc_tax_rate_classes',
			'wc_reserved_stock',
			'wc_rate_limits',
			'wc_webhooks',
			'wc_product_download_directories',
			// Users / customers.
			'users',
			'usermeta',
		);
	}

	/**
	 * Get detailed schema for WooCommerce-relevant tables.
	 *
	 * When $active_only is true, only tables relevant to the active order
	 * storage backend are returned (HPOS tables excluded in legacy mode).
	 *
	 * @param bool $active_only Whether to return only the active backend's schemas.
	 * @return array<string, array>  Table name (without prefix) => columns.
	 */
	public static function get_table_schemas( bool $active_only = false ): array {
		$schemas = array(
			// ---- ORDERS (HPOS) ---- //
			'wc_orders' => array(
				'id',
				'status',
				'type',
				'currency',
				'date_created_gmt',
				'date_updated_gmt',
				'parent_order_id',
				'customer_id',
				'billing_email',
				'total_amount',
				'total_tax_amount',
				'total_shipping_amount',
				'total_discount_amount',
				'total_fee_amount',
				'total_refunded_amount',
				'payment_method',
				'payment_method_title',
				'transaction_id',
				'customer_ip_address',
				'customer_user_agent',
				'created_via',
				'customer_note',
				'order_key',
				'discount_tax_amount',
				'shipping_tax_amount',
				'prices_include_tax',
				'order_version',
				'recorded_sales',
				'recorded_coupon_usage_counts',
				'date_paid_gmt',
				'date_completed_gmt',
				'shipping_total',
				'coupon_total',
			),
			'wc_order_addresses' => array(
				'id',
				'order_id',
				'address_type',
				'first_name',
				'last_name',
				'company',
				'address_1',
				'address_2',
				'city',
				'state',
				'postcode',
				'country',
				'email',
				'phone',
			),
			'wc_order_operational_data' => array(
				'id',
				'order_id',
				'created_via',
				'woocommerce_version',
				'prices_include_tax',
				'coupon_usages_are_counted',
				'download_permission_granted',
				'cart_hash',
				'new_order_email_sent',
				'order_key',
				'order_stock_reduced',
				'date_paid_gmt',
				'date_completed_gmt',
				'shipping_tax_amount',
				'shipping_total_amount',
				'discount_tax_amount',
				'discount_total_amount',
			),
			'wc_orders_meta' => array(
				'id',
				'order_id',
				'meta_key',
				'meta_value',
			),

			// ---- WP CORE (for traditional orders / products) ---- //
			'posts' => array(
				'ID',
				'post_author',
				'post_date',
				'post_date_gmt',
				'post_content',
				'post_title',
				'post_excerpt',
				'post_status',
				'comment_status',
				'ping_status',
				'post_password',
				'post_name',
				'to_ping',
				'pinged',
				'post_modified',
				'post_modified_gmt',
				'post_content_filtered',
				'post_parent',
				'guid',
				'menu_order',
				'post_type',
				'post_mime_type',
				'comment_count',
			),
			'postmeta' => array(
				'meta_id',
				'post_id',
				'meta_key',
				'meta_value',
			),

			// ---- PRODUCT META LOOKUP ---- //
			'wc_product_meta_lookup' => array(
				'product_id',
				'sku',
				'global_unique_id',
				'virtual',
				'downloadable',
				'min_price',
				'max_price',
				'onsale',
				'stock_quantity',
				'stock_status',
				'rating_count',
				'average_rating',
				'total_sales',
				'tax_status',
				'tax_class',
			),

			// ---- TAXONOMY ---- //
			'terms' => array(
				'term_id',
				'name',
				'slug',
				'term_group',
			),
			'term_taxonomy' => array(
				'term_taxonomy_id',
				'term_id',
				'taxonomy',
				'description',
				'parent',
				'count',
			),
			'term_relationships' => array(
				'object_id',
				'term_taxonomy_id',
				'term_order',
			),
			'termmeta' => array(
				'meta_id',
				'term_id',
				'meta_key',
				'meta_value',
			),

			// ---- ANALYTICS TABLES ---- //
			'wc_order_stats' => array(
				'order_id',
				'parent_id',
				'date_created',
				'date_created_gmt',
				'date_paid',
				'date_completed',
				'num_items_sold',
				'total_sales',
				'tax_total',
				'shipping_total',
				'net_total',
				'returning_customer',
				'status',
				'customer_id',
			),
			'wc_order_product_lookup' => array(
				'order_item_id',
				'order_id',
				'product_id',
				'variation_id',
				'customer_id',
				'date_created',
				'product_qty',
				'product_net_revenue',
				'product_gross_revenue',
				'coupon_amount',
				'tax_amount',
				'shipping_amount',
				'product_name',
				'product_type',
			),
			'wc_order_tax_lookup' => array(
				'order_id',
				'tax_rate_id',
				'date_created',
				'shipping_tax',
				'order_tax',
				'total_tax',
			),
			'wc_order_coupon_lookup' => array(
				'order_id',
				'coupon_id',
				'date_created',
				'discount_amount',
			),
			'wc_customer_lookup' => array(
				'customer_id',
				'user_id',
				'username',
				'first_name',
				'last_name',
				'email',
				'city',
				'state',
				'postcode',
				'country',
				'date_last_active',
				'date_registered',
				'country',
				'postcode',
				'city',
				'state',
			),

			// ---- USERS ---- //
			'users' => array(
				'ID',
				'user_login',
				'user_pass',
				'user_nicename',
				'user_email',
				'user_url',
				'user_registered',
				'user_activation_key',
				'user_status',
				'display_name',
				'spam',
				'deleted',
			),
			'usermeta' => array(
				'umeta_id',
				'user_id',
				'meta_key',
				'meta_value',
			),
		);

		if ( $active_only && ! self::is_hpos_enabled() ) {
			foreach ( self::get_hpos_table_names() as $hpos_table ) {
				unset( $schemas[ $hpos_table ] );
			}
		}

		return $schemas;
	}

	// ----------------------------------------------------------------------- //
	//  POST TYPES
	// ----------------------------------------------------------------------- //

	/**
	 * Get WooCommerce post type mappings.
	 *
	 * When $active_only is true, excludes the legacy 'shop_order' post type
	 * when HPOS is active, since orders are no longer stored as posts.
	 *
	 * @param bool $active_only Whether to return only the active backend's post types.
	 * @return array<string, string>  post_type => description
	 */
	public static function get_post_types( bool $active_only = false ): array {
		$types = array(
			'product'          => __( 'Simple or variable product', 'silc-wooinsight-ai' ),
			'product_variation' => __( 'Product variation', 'silc-wooinsight-ai' ),
			'shop_order'       => __( 'Order (legacy post type)', 'silc-wooinsight-ai' ),
			'shop_order_refund' => __( 'Order refund', 'silc-wooinsight-ai' ),
			'shop_coupon'      => __( 'Coupon / discount code', 'silc-wooinsight-ai' ),
			'shop_subscription' => __( 'WooCommerce subscription', 'silc-wooinsight-ai' ),
		);

		if ( $active_only && self::is_hpos_enabled() ) {
			unset( $types['shop_order'] );
		}

		return $types;
	}

	// ----------------------------------------------------------------------- //
	//  PRODUCT TYPES
	// ----------------------------------------------------------------------- //

	/**
	 * Get WooCommerce product type slugs.
	 *
	 * @return array<string, string>
	 */
	public static function get_product_types(): array {
		return array(
			'simple'   => __( 'Simple physical or digital product', 'silc-wooinsight-ai' ),
			'grouped'  => __( 'Grouped product (collection of simples)', 'silc-wooinsight-ai' ),
			'external' => __( 'External / affiliate product', 'silc-wooinsight-ai' ),
			'variable' => __( 'Variable product (has variations)', 'silc-wooinsight-ai' ),
		);
	}

	// ----------------------------------------------------------------------- //
	//  IMPORTANT META KEYS
	// ----------------------------------------------------------------------- //

	/**
	 * Key WooCommerce meta keys with descriptions.
	 *
	 * @return array<string, string>
	 */
	public static function get_meta_keys(): array {
		return array(
			// Product meta.
			'_price'              => __( 'Current product price', 'silc-wooinsight-ai' ),
			'_regular_price'      => __( 'Regular product price', 'silc-wooinsight-ai' ),
			'_sale_price'         => __( 'Sale price', 'silc-wooinsight-ai' ),
			'_sku'                => __( 'Stock keeping unit', 'silc-wooinsight-ai' ),
			'_stock'              => __( 'Stock quantity', 'silc-wooinsight-ai' ),
			'_stock_status'       => __( 'Stock status (instock/outofstock)', 'silc-wooinsight-ai' ),
			'_manage_stock'       => __( 'Whether stock is managed', 'silc-wooinsight-ai' ),
			'_weight'             => __( 'Product weight', 'silc-wooinsight-ai' ),
			'_length'             => __( 'Product length', 'silc-wooinsight-ai' ),
			'_width'              => __( 'Product width', 'silc-wooinsight-ai' ),
			'_height'             => __( 'Product height', 'silc-wooinsight-ai' ),
			'_tax_status'         => __( 'Tax status', 'silc-wooinsight-ai' ),
			'_tax_class'          => __( 'Tax class', 'silc-wooinsight-ai' ),
			'_featured'           => __( 'Featured product flag', 'silc-wooinsight-ai' ),
			'_visibility'         => __( 'Catalog visibility', 'silc-wooinsight-ai' ),
			'_thumbnail_id'       => __( 'Featured image attachment ID', 'silc-wooinsight-ai' ),
			'_product_attributes' => __( 'Serialized product attributes', 'silc-wooinsight-ai' ),
			'_product_version'    => __( 'Product version', 'silc-wooinsight-ai' ),
			'_virtual'            => __( 'Virtual product flag', 'silc-wooinsight-ai' ),
			'_downloadable'       => __( 'Downloadable product flag', 'silc-wooinsight-ai' ),
			'_download_limit'     => __( 'Download limit', 'silc-wooinsight-ai' ),
			'_download_expiry'    => __( 'Download expiry days', 'silc-wooinsight-ai' ),
			'_sale_price_dates_from' => __( 'Sale start date', 'silc-wooinsight-ai' ),
			'_sale_price_dates_to'   => __( 'Sale end date', 'silc-wooinsight-ai' ),
			'_wc_average_rating'  => __( 'Average rating', 'silc-wooinsight-ai' ),
			'_wc_rating_count'    => __( 'Rating count', 'silc-wooinsight-ai' ),
			'_wc_review_count'    => __( 'Review count', 'silc-wooinsight-ai' ),

			// Order meta.
			'_order_total'        => __( 'Order total', 'silc-wooinsight-ai' ),
			'_order_tax'          => __( 'Order tax total', 'silc-wooinsight-ai' ),
			'_order_shipping'     => __( 'Order shipping total', 'silc-wooinsight-ai' ),
			'_order_discount'     => __( 'Order discount total', 'silc-wooinsight-ai' ),
			'_order_currency'     => __( 'Order currency', 'silc-wooinsight-ai' ),
			'_payment_method'     => __( 'Payment method slug', 'silc-wooinsight-ai' ),
			'_payment_method_title' => __( 'Payment method title', 'silc-wooinsight-ai' ),
			'_customer_user'      => __( 'Customer user ID', 'silc-wooinsight-ai' ),
			'_billing_first_name' => __( 'Billing first name', 'silc-wooinsight-ai' ),
			'_billing_last_name'  => __( 'Billing last name', 'silc-wooinsight-ai' ),
			'_billing_company'    => __( 'Billing company', 'silc-wooinsight-ai' ),
			'_billing_address_1'  => __( 'Billing address line 1', 'silc-wooinsight-ai' ),
			'_billing_address_2'  => __( 'Billing address line 2', 'silc-wooinsight-ai' ),
			'_billing_city'       => __( 'Billing city', 'silc-wooinsight-ai' ),
			'_billing_state'      => __( 'Billing state', 'silc-wooinsight-ai' ),
			'_billing_postcode'   => __( 'Billing postcode', 'silc-wooinsight-ai' ),
			'_billing_country'    => __( 'Billing country', 'silc-wooinsight-ai' ),
			'_billing_email'      => __( 'Billing email', 'silc-wooinsight-ai' ),
			'_billing_phone'      => __( 'Billing phone', 'silc-wooinsight-ai' ),
			'_shipping_first_name' => __( 'Shipping first name', 'silc-wooinsight-ai' ),
			'_shipping_last_name'  => __( 'Shipping last name', 'silc-wooinsight-ai' ),
			'_shipping_company'    => __( 'Shipping company', 'silc-wooinsight-ai' ),
			'_shipping_address_1'  => __( 'Shipping address line 1', 'silc-wooinsight-ai' ),
			'_shipping_address_2'  => __( 'Shipping address line 2', 'silc-wooinsight-ai' ),
			'_shipping_city'       => __( 'Shipping city', 'silc-wooinsight-ai' ),
			'_shipping_state'      => __( 'Shipping state', 'silc-wooinsight-ai' ),
			'_shipping_postcode'   => __( 'Shipping postcode', 'silc-wooinsight-ai' ),
			'_shipping_country'    => __( 'Shipping country', 'silc-wooinsight-ai' ),

			// Coupon meta.
			'discount_type'       => __( 'Coupon discount type', 'silc-wooinsight-ai' ),
			'coupon_amount'       => __( 'Coupon amount', 'silc-wooinsight-ai' ),
			'minimum_amount'      => __( 'Coupon minimum spend', 'silc-wooinsight-ai' ),
			'maximum_amount'      => __( 'Coupon maximum spend', 'silc-wooinsight-ai' ),
			'usage_count'         => __( 'Coupon usage count', 'silc-wooinsight-ai' ),
			'individual_use'      => __( 'Individual use flag', 'silc-wooinsight-ai' ),
			'free_shipping'       => __( 'Free shipping flag', 'silc-wooinsight-ai' ),
			'expiry_date'         => __( 'Coupon expiry date', 'silc-wooinsight-ai' ),
			'usage_limit'         => __( 'Coupon usage limit', 'silc-wooinsight-ai' ),
			'usage_limit_per_user' => __( 'Coupon usage limit per user', 'silc-wooinsight-ai' ),
		);
	}

	// ----------------------------------------------------------------------- //
	//  ORDER STATUSES
	// ----------------------------------------------------------------------- //

	/**
	 * WooCommerce order statuses.
	 *
	 * @return array<string, string>
	 */
	public static function get_order_statuses(): array {
		return array(
			'wc-pending'    => __( 'Pending payment', 'silc-wooinsight-ai' ),
			'wc-processing' => __( 'Processing', 'silc-wooinsight-ai' ),
			'wc-on-hold'    => __( 'On hold', 'silc-wooinsight-ai' ),
			'wc-completed'  => __( 'Completed', 'silc-wooinsight-ai' ),
			'wc-cancelled'  => __( 'Cancelled', 'silc-wooinsight-ai' ),
			'wc-refunded'   => __( 'Refunded', 'silc-wooinsight-ai' ),
			'wc-failed'     => __( 'Failed', 'silc-wooinsight-ai' ),
			'wc-checkout-draft' => __( 'Draft / abandoned', 'silc-wooinsight-ai' ),
		);
	}

	// ----------------------------------------------------------------------- //
	//  TAXONOMIES
	// ----------------------------------------------------------------------- //

	/**
	 * WooCommerce taxonomies.
	 *
	 * @return array<string, string>
	 */
	public static function get_taxonomies(): array {
		return array(
			'product_cat' => __( 'Product category', 'silc-wooinsight-ai' ),
			'product_tag' => __( 'Product tag', 'silc-wooinsight-ai' ),
			'product_type' => __( 'Product type', 'silc-wooinsight-ai' ),
			'product_visibility' => __( 'Product visibility', 'silc-wooinsight-ai' ),
			'product_brand' => __( 'Product brand (if WooCommerce Brands active)', 'silc-wooinsight-ai' ),
		);
	}

	// ----------------------------------------------------------------------- //
	//  UTILITY HELPERS
	// ----------------------------------------------------------------------- //

	/**
	 * Build a schema context string for the AI prompt, scoped to the active
	 * order storage backend (HPOS or legacy). This prevents the AI from seeing
	 * tables and rules that don't apply to the current site.
	 *
	 * @return string
	 */
	public static function get_schema_context(): string {
		$prefix  = self::prefix();
		$is_hpos = self::is_hpos_enabled();
		$lines   = array();
		$lines[] = 'Database table prefix: "' . $prefix . '"';
		$lines[] = '';
		$lines[] = '=== TABLES AND COLUMNS ===';

		foreach ( self::get_table_schemas( true ) as $table => $cols ) {
			$lines[] = $prefix . $table . ' ( ' . implode( ', ', $cols ) . ' )';
		}

		$lines[] = '';
		$lines[] = '=== WOOCOMMERCE POST TYPES ===';
		foreach ( self::get_post_types( true ) as $pt => $desc ) {
			$lines[] = "- {$pt}: {$desc}";
		}

		$lines[] = '';
		$lines[] = '=== PRODUCT TYPES (stored in wp_term_relationships + wp_term_taxonomy with taxonomy "product_type") ===';
		foreach ( self::get_product_types() as $pt => $desc ) {
			$lines[] = "- {$pt}: {$desc}";
		}

		$lines[] = '';
		$lines[] = '=== IMPORTANT META KEYS (stored in wp_postmeta, can be joined via post_id) ===';
		foreach ( self::get_meta_keys() as $key => $desc ) {
			$lines[] = "- '{$key}': {$desc}";
		}

		$lines[] = '';
		$lines[] = '=== ORDER STATUSES ===';
		foreach ( self::get_order_statuses() as $status => $label ) {
			$lines[] = "- {$status}: {$label}";
		}

		$lines[] = '';
		$lines[] = '=== TAXONOMIES ===';
		foreach ( self::get_taxonomies() as $tax => $desc ) {
			$lines[] = "- {$tax}: {$desc}";
		}

		$lines[] = '';
		$lines[] = '=== RELATIONSHIPS ===';

		if ( $is_hpos ) {
			$lines[] = '- Products (post_type="product") are stored in wp_posts. Their meta is in wp_postmeta.';
			$lines[] = '- Orders are stored in wp_wc_orders. Addresses in wp_wc_order_addresses, operational data in wp_wc_order_operational_data.';
			$lines[] = '- Order metadata is in wp_wc_orders_meta.';
			$lines[] = '- Order line items are in wp_woocommerce_order_items and wp_woocommerce_order_itemmeta.';
			$lines[] = '- Order analytics use wp_wc_order_stats, wp_wc_order_product_lookup, wp_wc_order_tax_lookup, wp_wc_order_coupon_lookup.';
			$lines[] = '- Product-category mapping is through wp_term_relationships + wp_term_taxonomy (taxonomy="product_cat").';
			$lines[] = '- Product meta lookup is in wp_wc_product_meta_lookup (fast aggregated product data).';
			$lines[] = '- Customer data is in wp_wc_customer_lookup (for analytics).';
			$lines[] = '- Users table stores registered customers (wp_users).';
		} else {
			$lines[] = '- Products (post_type="product") are stored in wp_posts. Their meta is in wp_postmeta.';
			$lines[] = '- Orders (post_type="shop_order") are stored in wp_posts. Their meta is in wp_postmeta.';
			$lines[] = '- Legacy order items are stored in wp_woocommerce_order_items and wp_woocommerce_order_itemmeta.';
			$lines[] = '- Product-category mapping is through wp_term_relationships + wp_term_taxonomy (taxonomy="product_cat").';
			$lines[] = '- Product meta lookup is in wp_wc_product_meta_lookup (fast aggregated product data).';
			$lines[] = '- Customer data is in wp_wc_customer_lookup (for analytics).';
			$lines[] = '- Users table stores registered customers (wp_users).';
		}

		$lines[] = '';
		$lines[] = '=== RULES ===';
		$lines[] = '- Always use the table prefix in queries.';
		if ( $is_hpos ) {
			$lines[] = '- Use aliases to keep queries readable (e.g., FROM wp_wc_orders AS o).';
			$lines[] = '- For orders, filter by o.type = "shop_order".';
		} else {
			$lines[] = '- Use aliases to keep queries readable (e.g., FROM wp_posts AS p).';
			$lines[] = '- For orders, filter by p.post_type = "shop_order".';
		}
		$lines[] = '- For products, filter by p.post_type = "product".';
		$lines[] = '- Order status column value is "wc-pending", "wc-processing", "wc-completed" etc.';
		$lines[] = '- Use COALESCE for meta values that may be NULL.';
		$lines[] = '- When joining postmeta, use LEFT JOIN since meta may not exist.';
		$lines[] = '- Use aggregate functions (COUNT, SUM, AVG) for reports.';
		$lines[] = '- Use GROUP BY when aggregating with non-aggregated columns.';
		$lines[] = '- ORDER BY and LIMIT are recommended for top-N queries.';
		$lines[] = '- Use DATE() function for date comparisons.';
		$lines[] = '- For date ranges, compare against date_created_gmt or post_date.';
		$lines[] = '- Prefer wp_wc_order_stats for high-level order analytics.';

		return implode( "\n", $lines );
	}

	/**
	 * Get the prompt template sent to the AI model.
	 *
	 * @param string $user_question The user's natural language question.
	 * @return string
	 */
	public static function build_prompt( string $user_question ): string {
		$schema = self::get_schema_context();

		return <<<PROMPT
You are a WooCommerce SQL expert. Given a database schema below, convert the user's question into a valid MySQL query.

{$schema}

USER QUESTION: {$user_question}

Generate ONLY the SQL query, no explanations, no markdown formatting. The query must be a single SELECT statement. Use the table prefix as provided.
PROMPT;
	}
}
