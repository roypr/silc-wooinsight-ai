<?php
/**
 * Admin Page & Assets
 *
 * Registers the admin menu page and enqueues the React dashboard
 * along with WordPress dependencies (@wordpress/element, @wordpress/components, etc.).
 *
 * @package SILC_WooInsight_AI
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Admin class.
 */
class SILC_WIA_Admin {

	/**
	 * Page hook suffix.
	 *
	 * @var string
	 */
	private static $page_hook = '';

	/**
	 * Initialize admin hooks.
	 */
	public static function init(): void {
		add_action( 'admin_menu', array( __CLASS__, 'add_menu_page' ) );
		add_action( 'admin_enqueue_scripts', array( __CLASS__, 'enqueue_assets' ) );
	}

	/**
	 * Register admin menu page under WooCommerce.
	 */
	public static function add_menu_page(): void {
		self::$page_hook = add_submenu_page(
			'woocommerce',
			__( 'WooInsight AI', 'silc-wooinsight-ai' ),
			__( 'WooInsight AI', 'silc-wooinsight-ai' ),
			'manage_woocommerce',
			'silc-wooinsight-ai',
			array( __CLASS__, 'render_page' )
		);
	}

	/**
	 * Render the admin page container.
	 */
	public static function render_page(): void {
		?>
		<div class="wrap silc-wia-wrap">
			<h1><?php echo esc_html__( 'SILC WooInsight AI', 'silc-wooinsight-ai' ); ?></h1>
			<div id="silc-wia-dashboard"></div>
		</div>
		<?php
	}

	/**
	 * Enqueue scripts and styles.
	 *
	 * @param string $hook Current admin page hook.
	 */
	public static function enqueue_assets( string $hook ): void {
		if ( $hook !== self::$page_hook ) {
			return;
		}

		// Use WordPress built-in React (via @wordpress/element) and components.
		wp_enqueue_script( 'wp-element' );
		wp_enqueue_script( 'wp-components' );
		wp_enqueue_script( 'wp-i18n' );
		wp_enqueue_script( 'wp-api-fetch' );
		wp_enqueue_script( 'wp-hooks' );
		wp_enqueue_script( 'wp-html-entities' );

		// Enqueue WordPress component styles.
		wp_enqueue_style( 'wp-components' );

		// Enqueue our dashboard script.
		$asset_file = SILC_WIA_PATH . 'assets/js/dashboard.asset.php';
		$deps       = array( 'wp-element', 'wp-components', 'wp-i18n', 'wp-api-fetch', 'wp-hooks', 'wp-html-entities' );
		$version    = SILC_WIA_VERSION;

		if ( file_exists( $asset_file ) ) {
			$asset = include $asset_file;
			if ( is_array( $asset ) ) {
				$deps    = array_merge( $deps, $asset['dependencies'] ?? array() );
				$version = $asset['version'] ?? $version;
			}
		}

		wp_enqueue_script(
			'silc-wia-dashboard',
			SILC_WIA_URL . 'assets/js/dashboard.js',
			$deps,
			$version,
			true
		);

		// Localize with data.
		wp_localize_script( 'silc-wia-dashboard', 'silcWiaData', array(
			'ajaxUrl' => admin_url( 'admin-ajax.php' ),
			'nonce'   => wp_create_nonce( SILC_WIA_Ajax::NONCE_ACTION ),
			'siteUrl' => site_url(),
			'pluginUrl' => SILC_WIA_URL,
			'l10n'    => array(
				'askQuestion'      => __( 'Ask a question about your WooCommerce data...', 'silc-wooinsight-ai' ),
				'generateSQL'      => __( 'Generate SQL', 'silc-wooinsight-ai' ),
				'runQuery'         => __( 'Run Query', 'silc-wooinsight-ai' ),
				'clearHistory'     => __( 'Clear History', 'silc-wooinsight-ai' ),
				'loadingModel'     => __( 'Loading AI model (this may take a moment)...', 'silc-wooinsight-ai' ),
				'modelReady'       => __( 'AI model loaded and ready.', 'silc-wooinsight-ai' ),
				'enterQuestion'    => __( 'Enter your question in natural language, e.g. "Show me the top 10 products by revenue"', 'silc-wooinsight-ai' ),
				'history'          => __( 'Query History', 'silc-wooinsight-ai' ),
				'results'          => __( 'Results', 'silc-wooinsight-ai' ),
				'generatedSQL'     => __( 'Generated SQL', 'silc-wooinsight-ai' ),
				'noResults'        => __( 'No results found.', 'silc-wooinsight-ai' ),
				'errorOccurred'    => __( 'An error occurred:', 'silc-wooinsight-ai' ),
				'invalidSQL'       => __( 'Invalid or unsafe SQL query.', 'silc-wooinsight-ai' ),
			),
		) );

		// Enqueue CSS.
		wp_enqueue_style(
			'silc-wia-admin',
			SILC_WIA_URL . 'assets/css/admin.css',
			array(),
			SILC_WIA_VERSION
		);
	}
}
