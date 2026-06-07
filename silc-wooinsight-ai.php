<?php
/**
 * Plugin Name: SILC WooInsight AI
 * Plugin URI:  https://silc.com/plugins/wooinsight-ai
 * Description: Natural language to SQL query tool for WooCommerce. Uses any OpenAI-compatible API (BYOK) to convert plain English questions into SQL queries against WooCommerce data.
 * Version:     1.0.0
 * Author:      SILC
 * Text Domain: silc-wooinsight-ai
 * Domain Path: /languages
 * Requires PHP: 7.4
 * Requires at least: 6.0
 * WC requires at least: 8.0
 * License:     GPL v2 or later
 *
 * @package SILC_WooInsight_AI
 */

// Guard against direct access.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// Plugin constants.
define( 'SILC_WIA_VERSION', '1.0.0' );
define( 'SILC_WIA_PATH', plugin_dir_path( __FILE__ ) );
define( 'SILC_WIA_URL', plugin_dir_url( __FILE__ ) );
define( 'SILC_WIA_BASENAME', plugin_basename( __FILE__ ) );

/**
 * Initialize the plugin after WooCommerce is loaded.
 */
add_action( 'plugins_loaded', function () {
	// Ensure WooCommerce is active.
	if ( ! class_exists( 'WooCommerce' ) ) {
		add_action( 'admin_notices', function () {
			$message = __( 'SILC WooInsight AI requires WooCommerce to be installed and activated.', 'silc-wooinsight-ai' );
			printf( '<div class="notice notice-warning"><p>%s</p></div>', esc_html( $message ) );
		} );
		return;
	}

	// Load required files.
	require_once SILC_WIA_PATH . 'includes/class-woo-schema.php';
	require_once SILC_WIA_PATH . 'includes/class-api.php';
	require_once SILC_WIA_PATH . 'includes/class-admin.php';
	require_once SILC_WIA_PATH . 'includes/class-ajax.php';

	// Initialize.
	SILC_WIA_Admin::init();
	SILC_WIA_Ajax::init();
} );

/**
 * Activation hook.
 */
register_activation_hook( __FILE__, function () {
	if ( version_compare( PHP_VERSION, '7.4', '<' ) ) {
		deactivate_plugins( plugin_basename( __FILE__ ) );
		wp_die( esc_html__( 'SILC WooInsight AI requires PHP 7.4 or higher.', 'silc-wooinsight-ai' ) );
	}

	if ( ! class_exists( 'WooCommerce' ) ) {
		deactivate_plugins( plugin_basename( __FILE__ ) );
		wp_die( esc_html__( 'SILC WooInsight AI requires WooCommerce to be installed.', 'silc-wooinsight-ai' ) );
	}
} );

/**
 * Deactivation hook - cleanup.
 */
register_deactivation_hook( __FILE__, function () {
	delete_option( 'silc_wia_query_history' );
} );

/**
 * Add settings link on the plugins page.
 */
add_filter( 'plugin_action_links_' . SILC_WIA_BASENAME, function ( $links ) {
	$settings_link = sprintf(
		'<a href="%s">%s</a>',
		esc_url( admin_url( 'admin.php?page=silc-wooinsight-ai-settings' ) ),
		esc_html__( 'AI Settings', 'silc-wooinsight-ai' )
	);
	array_unshift( $links, $settings_link );

	$dashboard_link = sprintf(
		'<a href="%s">%s</a>',
		esc_url( admin_url( 'admin.php?page=silc-wooinsight-ai' ) ),
		esc_html__( 'Dashboard', 'silc-wooinsight-ai' )
	);
	array_unshift( $links, $dashboard_link );

	return $links;
} );
