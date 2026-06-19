<?php
/**
 * Admin Page & Assets
 *
 * Registers the admin menu page and enqueues the React dashboard
 * along with WordPress dependencies (@wordpress/element, @wordpress/components, etc.).
 * Settings are managed inline within the dashboard — no separate settings page.
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
	 * Page hook suffix for the dashboard.
	 *
	 * @var string
	 */
	private static $page_hook = '';

	/**
	 * Option name for API settings.
	 */
	const SETTINGS_OPTION = 'silc_wia_api_settings';

	/**
	 * Initialize admin hooks.
	 */
	public static function init(): void {
		add_action( 'admin_menu', array( __CLASS__, 'add_menu_pages' ) );
		add_action( 'admin_enqueue_scripts', array( __CLASS__, 'enqueue_assets' ) );
		add_action( 'admin_init', array( __CLASS__, 'register_settings' ) );
		add_action( 'wp_ajax_silc_wia_test_api', array( __CLASS__, 'handle_test_api' ) );
		add_action( 'wp_ajax_silc_wia_save_settings', array( __CLASS__, 'handle_save_settings' ) );
	}

	/**
	 * Register admin menu page under WooCommerce.
	 */
	public static function add_menu_pages(): void {
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
	 * Register settings with the WordPress Settings API.
	 */
	public static function register_settings(): void {
		register_setting(
			self::SETTINGS_OPTION,
			self::SETTINGS_OPTION,
			array(
				'sanitize_callback' => array( __CLASS__, 'sanitize_settings' ),
				'default'           => array(
					'api_url'     => SILC_WIA_API::DEFAULT_API_URL,
					'api_key'     => '',
					'model'       => SILC_WIA_API::DEFAULT_MODEL,
					'max_tokens'  => SILC_WIA_API::DEFAULT_MAX_TOKENS,
					'temperature' => SILC_WIA_API::DEFAULT_TEMPERATURE,
					'cache_ttl'   => SILC_WIA_API::DEFAULT_CACHE_TTL,
				),
			)
		);
	}

	/**
	 * Sanitize settings before saving.
	 *
	 * @param array $input Raw input.
	 * @return array Sanitized input.
	 */
	public static function sanitize_settings( $input ): array {
		$current = get_option( self::SETTINGS_OPTION, array() );
		$output  = array();

		$output['api_url'] = isset( $input['api_url'] )
			? esc_url_raw( untrailingslashit( trim( $input['api_url'] ) ) )
			: SILC_WIA_API::DEFAULT_API_URL;

		if ( ! empty( $input['api_key'] ) ) {
			$output['api_key'] = sanitize_text_field( $input['api_key'] );
		} elseif ( isset( $current['api_key'] ) ) {
			$output['api_key'] = $current['api_key'];
		}

		$output['model'] = isset( $input['model'] )
			? sanitize_text_field( trim( $input['model'] ) )
			: SILC_WIA_API::DEFAULT_MODEL;

		$output['max_tokens'] = isset( $input['max_tokens'] )
			? max( 50, min( 8192, intval( $input['max_tokens'] ) ) )
			: SILC_WIA_API::DEFAULT_MAX_TOKENS;

		$output['temperature'] = isset( $input['temperature'] )
			? max( 0, min( 2, floatval( $input['temperature'] ) ) )
			: SILC_WIA_API::DEFAULT_TEMPERATURE;

		$output['cache_ttl'] = isset( $input['cache_ttl'] )
			? max( 0, min( 604800, intval( $input['cache_ttl'] ) ) )  // 0 to 7 days in seconds.
			: SILC_WIA_API::DEFAULT_CACHE_TTL;

		return $output;
	}

	/**
	 * Render the dashboard page.
	 */
	public static function render_page(): void {
		?>
		<div class="wrap silc-wia-wrap">
			<div id="silc-wia-dashboard"></div>
		</div>
		<?php
	}

	/**
	 * AJAX handler: Test API connection.
	 */
	public static function handle_test_api(): void {
		if ( ! check_ajax_referer( SILC_WIA_Ajax::NONCE_ACTION, 'nonce', false ) ) {
			wp_send_json_error( array( 'message' => __( 'Security check failed.', 'silc-wooinsight-ai' ) ) );
			return;
		}

		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( array( 'message' => __( 'Insufficient permissions.', 'silc-wooinsight-ai' ) ) );
			return;
		}

		require_once SILC_WIA_PATH . 'includes/class-api.php';
		$result = SILC_WIA_API::test_connection();

		if ( $result['success'] ) {
			wp_send_json_success( array( 'message' => $result['message'] ) );
		} else {
			wp_send_json_error( array( 'message' => $result['message'] ) );
		}
	}

	/**
	 * AJAX handler: Save settings from inline dashboard.
	 */
	public static function handle_save_settings(): void {
		if ( ! check_ajax_referer( SILC_WIA_Ajax::NONCE_ACTION, 'nonce', false ) ) {
			wp_send_json_error( array( 'message' => __( 'Security check failed.', 'silc-wooinsight-ai' ) ) );
			return;
		}

		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( array( 'message' => __( 'Insufficient permissions.', 'silc-wooinsight-ai' ) ) );
			return;
		}

		$input = isset( $_POST['settings'] ) ? json_decode( wp_unslash( $_POST['settings'] ), true ) : array();

		if ( ! is_array( $input ) ) {
			wp_send_json_error( array( 'message' => __( 'Invalid settings data.', 'silc-wooinsight-ai' ) ) );
			return;
		}

		$sanitized = self::sanitize_settings( $input );
		update_option( self::SETTINGS_OPTION, $sanitized );

		wp_send_json_success( array(
			'message'          => __( 'Settings saved.', 'silc-wooinsight-ai' ),
			'has_api_key'      => ! empty( $sanitized['api_key'] ),
			'is_reasoning'     => SILC_WIA_API::is_reasoning_model( $sanitized['model'] ?? '' ),
		) );
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

		wp_enqueue_script( 'wp-element' );
		wp_enqueue_script( 'wp-components' );
		wp_enqueue_script( 'wp-i18n' );
		wp_enqueue_script( 'wp-api-fetch' );
		wp_enqueue_script( 'wp-hooks' );
		wp_enqueue_script( 'wp-html-entities' );

		wp_enqueue_style( 'wp-components' );

		$chartjs_file = SILC_WIA_PATH . 'assets/lib/chart.min.js';
		if ( file_exists( $chartjs_file ) ) {
			wp_enqueue_script(
				'silc-wia-chartjs',
				SILC_WIA_URL . 'assets/lib/chart.min.js',
				array(),
				'4.4.7',
				true
			);
		}

		wp_enqueue_script(
			'silc-wia-chart-renderer',
			SILC_WIA_URL . 'assets/js/chart-renderer.js',
			array( 'silc-wia-chartjs' ),
			SILC_WIA_VERSION,
			true
		);

		$asset_file = SILC_WIA_PATH . 'assets/js/dashboard.asset.php';
		$deps       = array( 'wp-element', 'wp-components', 'wp-i18n', 'wp-api-fetch', 'wp-hooks', 'wp-html-entities', 'silc-wia-chart-renderer' );
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

		require_once SILC_WIA_PATH . 'includes/class-api.php';
		require_once SILC_WIA_PATH . 'includes/class-library.php';
		$api_settings    = SILC_WIA_API::get_settings();
		$api_configured  = ! empty( $api_settings['api_key'] );
		$is_reason_model = SILC_WIA_API::is_reasoning_model( $api_settings['model'] ?? '' );
		$library_items   = SILC_WIA_Library::get_library_for_js();

		wp_localize_script( 'silc-wia-dashboard', 'silcWiaData', array(
			'ajaxUrl'          => admin_url( 'admin-ajax.php' ),
			'nonce'            => wp_create_nonce( SILC_WIA_Ajax::NONCE_ACTION ),
			'siteUrl'          => site_url(),
			'pluginUrl'        => SILC_WIA_URL,
			'apiConfigured'    => $api_configured,
			'isReasoningModel' => $is_reason_model,
			'pluginVersion'    => SILC_WIA_VERSION,
			'libraryItems'     => $library_items,
			'settings'         => array(
				'api_url'     => $api_settings['api_url'] ?? SILC_WIA_API::DEFAULT_API_URL,
				'api_key'     => $api_settings['api_key'] ?? '',
				'model'       => $api_settings['model'] ?? SILC_WIA_API::DEFAULT_MODEL,
				'max_tokens'  => $api_settings['max_tokens'] ?? SILC_WIA_API::DEFAULT_MAX_TOKENS,
				'temperature' => $api_settings['temperature'] ?? SILC_WIA_API::DEFAULT_TEMPERATURE,
				'cache_ttl'   => $api_settings['cache_ttl'] ?? SILC_WIA_API::DEFAULT_CACHE_TTL,
			),
			'defaults' => array(
				'api_url'     => SILC_WIA_API::DEFAULT_API_URL,
				'model'       => SILC_WIA_API::DEFAULT_MODEL,
				'max_tokens'  => SILC_WIA_API::DEFAULT_MAX_TOKENS,
				'temperature' => SILC_WIA_API::DEFAULT_TEMPERATURE,
				'cache_ttl'   => SILC_WIA_API::DEFAULT_CACHE_TTL,
			),
			'l10n' => array(
				'askQuestion'        => __( 'Ask anything about your WooCommerce store...', 'silc-wooinsight-ai' ),
				'getInsight'         => __( 'Get AI Insight', 'silc-wooinsight-ai' ),
				'generatingInsight'  => __( 'Generating insight...', 'silc-wooinsight-ai' ),
				'enterQuestion'      => __( 'Enter your question in plain English', 'silc-wooinsight-ai' ),
				'results'            => __( 'Results', 'silc-wooinsight-ai' ),
				'noResults'          => __( 'No results found.', 'silc-wooinsight-ai' ),
				'errorOccurred'      => __( 'Something went wrong:', 'silc-wooinsight-ai' ),
				'apiNotConfigured'   => __( 'API not configured', 'silc-wooinsight-ai' ),
				'apiReady'           => __( 'AI Ready', 'silc-wooinsight-ai' ),
				'tryAsking'          => __( 'Try asking:', 'silc-wooinsight-ai' ),
				'clearHistory'       => __( 'Clear', 'silc-wooinsight-ai' ),
				'noHistory'          => __( 'No past insights yet.', 'silc-wooinsight-ai' ),
				'openInNewTab'       => __( 'Open in new tab', 'silc-wooinsight-ai' ),
				'noInsightHistory'   => __( 'No insight history yet.', 'silc-wooinsight-ai' ),
				'save'               => __( 'Save Settings', 'silc-wooinsight-ai' ),
				'saving'             => __( 'Saving...', 'silc-wooinsight-ai' ),
				'saved'              => __( 'Settings saved!', 'silc-wooinsight-ai' ),
				'testConnection'     => __( 'Test Connection', 'silc-wooinsight-ai' ),
				'testing'            => __( 'Testing...', 'silc-wooinsight-ai' ),
				'connectionOk'       => __( 'Connection successful!', 'silc-wooinsight-ai' ),
				'connectionFail'     => __( 'Connection failed.', 'silc-wooinsight-ai' ),
				'settingsApiUrl'     => __( 'API URL', 'silc-wooinsight-ai' ),
				'settingsApiKey'     => __( 'API Key', 'silc-wooinsight-ai' ),
				'settingsModel'      => __( 'Model', 'silc-wooinsight-ai' ),
				'settingsMaxTokens'  => __( 'Max Tokens', 'silc-wooinsight-ai' ),
				'settingsTemp'       => __( 'Temperature', 'silc-wooinsight-ai' ),
				'settingsCache'      => __( 'Cache Duration', 'silc-wooinsight-ai' ),
				'sqlDetails'         => __( 'SQL & Details', 'silc-wooinsight-ai' ),
				'history'            => __( 'History', 'silc-wooinsight-ai' ),
				'library'            => __( 'Library', 'silc-wooinsight-ai' ),
				'settings'           => __( 'Settings', 'silc-wooinsight-ai' ),
				'refresh'            => __( 'Refresh', 'silc-wooinsight-ai' ),
			),
		) );

		wp_enqueue_style(
			'silc-wia-admin',
			SILC_WIA_URL . 'assets/css/admin.css',
			array(),
			SILC_WIA_VERSION
		);
	}
}
