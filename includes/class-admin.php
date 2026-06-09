<?php
/**
 * Admin Page & Assets
 *
 * Registers the admin menu page, settings page, and enqueues the React dashboard
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
	 * Page hook suffix for the dashboard.
	 *
	 * @var string
	 */
	private static $page_hook = '';

	/**
	 * Page hook suffix for settings.
	 *
	 * @var string
	 */
	private static $settings_hook = '';

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
	}

	/**
	 * Register admin menu pages under WooCommerce.
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

		self::$settings_hook = add_submenu_page(
			'woocommerce',
			__( 'WooInsight AI Settings', 'silc-wooinsight-ai' ),
			__( 'AI Settings', 'silc-wooinsight-ai' ),
			'manage_options',
			'silc-wooinsight-ai-settings',
			array( __CLASS__, 'render_settings_page' )
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
				),
			)
		);

		add_settings_section(
			'silc_wia_api_section',
			__( 'AI Provider Settings', 'silc-wooinsight-ai' ),
			array( __CLASS__, 'render_section_description' ),
			self::SETTINGS_OPTION
		);

		add_settings_field(
			'api_url',
			__( 'API URL', 'silc-wooinsight-ai' ),
			array( __CLASS__, 'render_field_api_url' ),
			self::SETTINGS_OPTION,
			'silc_wia_api_section'
		);

		add_settings_field(
			'api_key',
			__( 'API Key', 'silc-wooinsight-ai' ),
			array( __CLASS__, 'render_field_api_key' ),
			self::SETTINGS_OPTION,
			'silc_wia_api_section'
		);

		add_settings_field(
			'model',
			__( 'Model', 'silc-wooinsight-ai' ),
			array( __CLASS__, 'render_field_model' ),
			self::SETTINGS_OPTION,
			'silc_wia_api_section'
		);

		add_settings_field(
			'max_tokens',
			__( 'Max Tokens', 'silc-wooinsight-ai' ),
			array( __CLASS__, 'render_field_max_tokens' ),
			self::SETTINGS_OPTION,
			'silc_wia_api_section'
		);

		add_settings_field(
			'temperature',
			__( 'Temperature', 'silc-wooinsight-ai' ),
			array( __CLASS__, 'render_field_temperature' ),
			self::SETTINGS_OPTION,
			'silc_wia_api_section'
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

		return $output;
	}

	/**
	 * Render the section description.
	 */
	public static function render_section_description(): void {
		echo '<p>' . esc_html__( 'Configure your OpenAI-compatible API endpoint. You can use OpenAI, Azure OpenAI, Ollama, LocalAI, or any other provider that supports the OpenAI chat completions format.', 'silc-wooinsight-ai' ) . '</p>';
	}

	/**
	 * Render the API URL field.
	 */
	public static function render_field_api_url(): void {
		$settings = SILC_WIA_API::get_settings();
		$value    = $settings['api_url'] ?? SILC_WIA_API::DEFAULT_API_URL;
		?>
		<input type="url"
			name="<?php echo esc_attr( self::SETTINGS_OPTION ); ?>[api_url]"
			value="<?php echo esc_attr( $value ); ?>"
			class="regular-text code"
			placeholder="https://api.openai.com/v1"
		/>
		<p class="description">
			<?php esc_html_e( 'Base URL for the OpenAI-compatible API. Must end with /v1 (e.g. https://api.openai.com/v1).', 'silc-wooinsight-ai' ); ?>
		</p>
		<?php
	}

	/**
	 * Render the API key field.
	 */
	public static function render_field_api_key(): void {
		$settings = SILC_WIA_API::get_settings();
		$has_key  = ! empty( $settings['api_key'] );
		?>
		<div>
			<input type="password"
				name="<?php echo esc_attr( self::SETTINGS_OPTION ); ?>[api_key]"
				value=""
				class="regular-text"
				placeholder="<?php echo $has_key ? esc_attr__( 'API key is saved — enter a new one to replace it', 'silc-wooinsight-ai' ) : 'sk-...'; ?>"
				autocomplete="off"
			/>
			<?php if ( $has_key ) : ?>
				<p class="description" style="color:#1a7a2e;">
					&#10003; <?php esc_html_e( 'An API key is saved. Leave the field empty to keep it.', 'silc-wooinsight-ai' ); ?>
				</p>
			<?php else : ?>
				<p class="description">
					<?php esc_html_e( 'Your API key. Never shared — only sent to the API URL above.', 'silc-wooinsight-ai' ); ?>
				</p>
			<?php endif; ?>
		</div>
		<?php
	}

	/**
	 * Render the model field.
	 */
	public static function render_field_model(): void {
		$settings = SILC_WIA_API::get_settings();
		$value    = $settings['model'] ?? SILC_WIA_API::DEFAULT_MODEL;
		?>
		<input type="text"
			name="<?php echo esc_attr( self::SETTINGS_OPTION ); ?>[model]"
			value="<?php echo esc_attr( $value ); ?>"
			class="regular-text"
			placeholder="gpt-4o-mini"
		/>
		<p class="description">
			<?php esc_html_e( 'Model name to use (e.g. gpt-4o-mini, gpt-4o, claude-3-haiku, llama3, deepseek-r1, etc.).', 'silc-wooinsight-ai' ); ?>
			<?php esc_html_e( 'Reasoning models (o1, o3, deepseek-r1) are auto-detected and handled with larger token budgets.', 'silc-wooinsight-ai' ); ?>
		</p>
		<?php
	}

	/**
	 * Render the max tokens field.
	 */
	public static function render_field_max_tokens(): void {
		$settings = SILC_WIA_API::get_settings();
		$value    = $settings['max_tokens'] ?? SILC_WIA_API::DEFAULT_MAX_TOKENS;
		$model    = $settings['model'] ?? '';
		$is_reason = SILC_WIA_API::is_reasoning_model( $model );
		$extra_note = $is_reason
			? __( 'Reasoning model — uses max_completion_tokens internally (min 4000 for reasoning overhead).', 'silc-wooinsight-ai' )
			: __( 'Insight mode internally overrides to 1500 for JSON output capacity.', 'silc-wooinsight-ai' );
		?>
		<input type="number"
			name="<?php echo esc_attr( self::SETTINGS_OPTION ); ?>[max_tokens]"
			value="<?php echo esc_attr( $value ); ?>"
			class="small-text"
			min="50" max="8192" step="50"
		/>
		<p class="description">
			<?php echo esc_html( sprintf( __( 'Maximum tokens (50–8192). %s', 'silc-wooinsight-ai' ), $extra_note ) ); ?>
		</p>
		<?php
	}

	/**
	 * Render the temperature field.
	 */
	public static function render_field_temperature(): void {
		$settings = SILC_WIA_API::get_settings();
		$value    = $settings['temperature'] ?? SILC_WIA_API::DEFAULT_TEMPERATURE;
		$model    = $settings['model'] ?? '';
		$is_reason = SILC_WIA_API::is_reasoning_model( $model );
		$disabled_attr = $is_reason ? 'disabled' : '';
		$extra_note = $is_reason
			? __( 'Temperature is not supported by reasoning models and will be ignored.', 'silc-wooinsight-ai' )
			: __( 'Controls randomness (0 = deterministic, 2 = very random). 0.1–0.3 recommended for SQL generation.', 'silc-wooinsight-ai' );
		?>
		<input type="number"
			name="<?php echo esc_attr( self::SETTINGS_OPTION ); ?>[temperature]"
			value="<?php echo esc_attr( $value ); ?>"
			class="small-text"
			min="0" max="2" step="0.1"
			<?php echo $disabled_attr; ?>
		/>
		<p class="description">
			<?php echo esc_html( $extra_note ); ?>
		</p>
		<?php
	}

	/**
	 * Render the dashboard page.
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
	 * Render the settings page.
	 */
	public static function render_settings_page(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'Insufficient permissions.', 'silc-wooinsight-ai' ) );
		}

		$settings = SILC_WIA_API::get_settings();
		$has_key  = ! empty( $settings['api_key'] );
		?>
		<div class="wrap">
			<h1><?php echo esc_html__( 'WooInsight AI Settings', 'silc-wooinsight-ai' ); ?></h1>

			<form action="options.php" method="post">
				<?php
				settings_fields( self::SETTINGS_OPTION );
				do_settings_sections( self::SETTINGS_OPTION );
				submit_button( __( 'Save Settings', 'silc-wooinsight-ai' ) );
				?>
			</form>

			<hr />

			<h2><?php esc_html_e( 'Test Connection', 'silc-wooinsight-ai' ); ?></h2>
			<p>
				<?php esc_html_e( 'Click the button below to verify your API settings work.', 'silc-wooinsight-ai' ); ?>
			</p>
			<button type="button" id="silc-wia-test-api" class="button"
				<?php echo $has_key ? '' : 'disabled'; ?>>
				<?php esc_html_e( 'Test API Connection', 'silc-wooinsight-ai' ); ?>
			</button>
			<span id="silc-wia-test-result" style="margin-left: 10px;"></span>

			<?php if ( ! $has_key ) : ?>
				<p class="description">
					<?php esc_html_e( 'Save an API key above before testing.', 'silc-wooinsight-ai' ); ?>
				</p>
			<?php endif; ?>
		</div>

		<script>
		(function() {
			var btn = document.getElementById('silc-wia-test-api');
			var result = document.getElementById('silc-wia-test-result');
			if (!btn) return;

			btn.addEventListener('click', function() {
				btn.disabled = true;
				btn.textContent = 'Testing...';
				result.innerHTML = '<span style="color:#787c82;">Testing...</span>';

				var formData = new FormData();
				formData.append('action', 'silc_wia_test_api');
				formData.append('nonce', '<?php echo esc_js( wp_create_nonce( SILC_WIA_Ajax::NONCE_ACTION ) ); ?>');

				fetch('<?php echo esc_js( admin_url( 'admin-ajax.php' ) ); ?>', {
					method: 'POST',
					body: formData,
				})
				.then(function(r) { return r.json(); })
				.then(function(resp) {
					btn.disabled = false;
					btn.textContent = 'Test API Connection';
					if (resp.success) {
						result.innerHTML = '<span style="color:#1a7a2e;font-weight:500;">&#10003; ' + (resp.data.message || 'Success') + '</span>';
					} else {
						result.innerHTML = '<span style="color:#b32d2e;font-weight:500;">&#10007; ' + (resp.data.message || 'Failed') + '</span>';
					}
				})
				.catch(function() {
					btn.disabled = false;
					btn.textContent = 'Test API Connection';
					result.innerHTML = '<span style="color:#b32d2e;font-weight:500;">&#10007; Network error</span>';
				});
			});
		})();
		</script>
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
	 * Enqueue scripts and styles.
	 *
	 * @param string $hook Current admin page hook.
	 */
	public static function enqueue_assets( string $hook ): void {
		if ( $hook === self::$settings_hook ) {
			return;
		}

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
		$api_settings    = SILC_WIA_API::get_settings();
		$api_configured  = ! empty( $api_settings['api_key'] );
		$is_reason_model = SILC_WIA_API::is_reasoning_model( $api_settings['model'] ?? '' );

		wp_localize_script( 'silc-wia-dashboard', 'silcWiaData', array(
			'ajaxUrl'        => admin_url( 'admin-ajax.php' ),
			'nonce'          => wp_create_nonce( SILC_WIA_Ajax::NONCE_ACTION ),
			'siteUrl'        => site_url(),
			'pluginUrl'      => SILC_WIA_URL,
			'settingsUrl'    => admin_url( 'admin.php?page=silc-wooinsight-ai-settings' ),
			'apiConfigured'  => $api_configured,
			'isReasoningModel' => $is_reason_model,
			'pluginVersion'  => SILC_WIA_VERSION,
			'l10n'           => array(
				'askQuestion'      => __( 'Ask a question about your WooCommerce data...', 'silc-wooinsight-ai' ),
				'generateSQL'      => __( 'Generate SQL', 'silc-wooinsight-ai' ),
				'runQuery'         => __( 'Run Query', 'silc-wooinsight-ai' ),
				'clearHistory'     => __( 'Clear History', 'silc-wooinsight-ai' ),
				'enterQuestion'    => __( 'Enter your question in natural language, e.g. "Show me the top 10 products by revenue"', 'silc-wooinsight-ai' ),
				'history'          => __( 'Query History', 'silc-wooinsight-ai' ),
				'results'          => __( 'Results', 'silc-wooinsight-ai' ),
				'generatedSQL'     => __( 'Generated SQL', 'silc-wooinsight-ai' ),
				'noResults'        => __( 'No results found.', 'silc-wooinsight-ai' ),
				'errorOccurred'    => __( 'An error occurred:', 'silc-wooinsight-ai' ),
				'invalidSQL'       => __( 'Invalid or unsafe SQL query.', 'silc-wooinsight-ai' ),
				'generating'       => __( 'Generating SQL...', 'silc-wooinsight-ai' ),
				'apiNotConfigured' => __( 'API not configured. Go to Settings to add your API key.', 'silc-wooinsight-ai' ),
				'settings'         => __( 'Settings', 'silc-wooinsight-ai' ),
				'usingFallback'    => __( 'Using built-in templates (API not configured)', 'silc-wooinsight-ai' ),
				'apiReady'         => __( 'AI Ready (API)', 'silc-wooinsight-ai' ),
				'insights'         => __( 'Insights', 'silc-wooinsight-ai' ),
				'getInsight'       => __( 'Get Insight', 'silc-wooinsight-ai' ),
				'generatingInsight' => __( 'Generating insight...', 'silc-wooinsight-ai' ),
				'insightHistory'   => __( 'Insight History', 'silc-wooinsight-ai' ),
				'clearInsightHistory' => __( 'Clear Insight History', 'silc-wooinsight-ai' ),
				'sqlMode'          => __( 'SQL Mode', 'silc-wooinsight-ai' ),
				'insightMode'      => __( 'Insight Mode', 'silc-wooinsight-ai' ),
				'chart'            => __( 'Chart', 'silc-wooinsight-ai' ),
				'list'             => __( 'List', 'silc-wooinsight-ai' ),
				'answer'           => __( 'Answer', 'silc-wooinsight-ai' ),
				'noInsightHistory' => __( 'No insight history yet.', 'silc-wooinsight-ai' ),
				'openInNewTab'     => __( 'Open in new tab', 'silc-wooinsight-ai' ),
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
