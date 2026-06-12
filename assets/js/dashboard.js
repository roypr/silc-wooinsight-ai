/**
 * SILC WooInsight AI — Chat-style Dashboard
 *
 * One-shot chat interface: user asks a question → AI generates insight → result renders.
 * Sidebar with collapsible icon drawer for: SQL details, History, Guides, Settings.
 *
 * @package SILC_WooInsight_AI
 */

/* global SILC_WIA_Charts */

(function (wp) {
	'use strict';

	var el = wp.element.createElement;
	var useState = wp.element.useState;
	var useEffect = wp.element.useEffect;
	var useCallback = wp.element.useCallback;

	var TextControl = wp.components.TextControl;
	var Button = wp.components.Button;
	var Spinner = wp.components.Spinner;
	var Notice = wp.components.Notice;
	var ExternalLink = wp.components.ExternalLink;

	// Data from server.
	var data = window.silcWiaData || {};
	var ajaxUrl = data.ajaxUrl || '';
	var nonce = data.nonce || '';
	var l10n = data.l10n || {};
	var settings = data.settings || {};
	var defaults = data.defaults || {};
	var pluginVersion = data.pluginVersion || '2.0.0';
	var apiConfigured = data.apiConfigured || false;

	// ----------------------------------------------------------------------- //
	//  HELPERS
	// ----------------------------------------------------------------------- //

	function doAction(action, extra) {
		var formData = new FormData();
		formData.append('action', 'silc_wia_' + action);
		formData.append('nonce', nonce);
		if (extra) {
			Object.keys(extra).forEach(function (key) {
				formData.append(key, extra[key]);
			});
		}
		return fetch(ajaxUrl, { method: 'POST', body: formData }).then(function (r) { return r.json(); });
	}

	// SVG logo icon (simple chart/insight icon).
	function LogoSvg() {
		return el('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round' },
			el('line', { x1: '18', y1: '20', x2: '18', y2: '10' }),
			el('line', { x1: '12', y1: '20', x2: '12', y2: '4' }),
			el('line', { x1: '6', y1: '20', x2: '6', y2: '14' }),
		);
	}

	// Suggested prompts that produce different result types.
	var SUGGESTED_PROMPTS = [
		{ text: 'Best selling products last month', icon: '\uD83D\uDCCA', type: 'chart' },
		{ text: 'Monthly revenue trend this year', icon: '\uD83D\uDCC8', type: 'chart' },
		{ text: 'Order status distribution', icon: '\uD83E\uDDFE', type: 'chart' },
		{ text: 'Top 10 customers by spending', icon: '\uD83C\uDFC6', type: 'list' },
		{ text: 'Total revenue yesterday', icon: '\uD83D\uDCB0', type: 'answer' },
		{ text: 'Products low in stock', icon: '\u26A0\uFE0F', type: 'list' },
	];

	// Guide sections.
	var GUIDE_SECTIONS = [
		{
			title: '\uD83D\uDCC8 Charts & Trends',
			text: 'Ask about trends, comparisons, or distributions to get visual charts.',
			examples: [
				{ text: 'Best selling products by revenue this month', desc: 'Bar chart of top products' },
				{ text: 'Monthly revenue trend this year', desc: 'Line chart showing month-by-month' },
				{ text: 'Order status distribution', desc: 'Pie/doughnut chart' },
				{ text: 'Sales by product category', desc: 'Bar chart of category sales' },
				{ text: 'Daily orders for the past 7 days', desc: 'Line/bar chart' },
			],
		},
		{
			title: '\uD83D\uDCCB Lists & Details',
			text: 'Ask for lists to see individual items with details and links.',
			examples: [
				{ text: 'Top 10 customers by total spending', desc: 'List with customer links' },
				{ text: 'Recent orders with totals', desc: 'List of recent orders' },
				{ text: 'Products low in stock', desc: 'Inventory list' },
				{ text: 'Pending orders', desc: 'Order list filtered by status' },
			],
		},
		{
			title: '\u2139\uFE0F Quick Answers',
			text: 'Ask for counts, totals, or averages to get a single number answer.',
			examples: [
				{ text: 'How many orders did I get yesterday?', desc: 'Single number answer' },
				{ text: 'Total revenue this month', desc: 'Sum total answer' },
				{ text: 'Average order value', desc: 'Computed average' },
				{ text: 'How many products do I have?', desc: 'Product count' },
			],
		},
		{
			title: '\uD83D\uDCCA\u200D\uD83D\uDCBB Multi-metric',
			text: 'Combine metrics for richer insights.',
			examples: [
				{ text: 'Compare this month vs last month revenue', desc: 'Side by side chart' },
				{ text: 'Top 5 products by quantity sold', desc: 'Horizontal bar chart' },
				{ text: 'Orders by payment gateway', desc: 'Distribution chart' },
			],
		},
	];

	// ----------------------------------------------------------------------- //
	//  MAIN DASHBOARD COMPONENT
	// ----------------------------------------------------------------------- //

	function WooInsightDashboard() {
		// Chat state.
		var _question = useState('');
		var question = _question[0];
		var setQuestion = _question[1];

		var _isLoading = useState(false);
		var isLoading = _isLoading[0];
		var setLoading = _isLoading[1];

		var _error = useState(null);
		var error = _error[0];
		var setError = _error[1];

		// Result state.
		var _insightData = useState(null);
		var insightData = _insightData[0];
		var setInsightData = _insightData[1];

		var _hasRun = useState(false);
		var hasRun = _hasRun[0];
		var setHasRun = _hasRun[1];

		// Sidebar state.
		var _sidebarExpanded = useState(true);
		var sidebarExpanded = _sidebarExpanded[0];
		var setSidebarExpanded = _sidebarExpanded[1];

		var _activePanel = useState(null);
		var activePanel = _activePanel[0];
		var setActivePanel = _activePanel[1];

		// History state.
		var _insightHistory = useState([]);
		var insightHistory = _insightHistory[0];
		var setInsightHistory = _insightHistory[1];

		// Settings form state.
		var _formSettings = useState({
			api_url: settings.api_url || '',
			api_key: '',
			model: settings.model || '',
			max_tokens: settings.max_tokens || '',
			temperature: settings.temperature || '',
			cache_ttl: settings.cache_ttl || defaults.cache_ttl || 3600,
		});
		var formSettings = _formSettings[0];
		var setFormSettings = _formSettings[1];

		var _settingsDirty = useState(false);
		var settingsDirty = _settingsDirty[0];
		var setSettingsDirty = _settingsDirty[1];

		var _saving = useState(false);
		var saving = _saving[0];
		var setSaving = _saving[1];

		var _saveMsg = useState(null);
		var saveMsg = _saveMsg[0];
		var setSaveMsg = _saveMsg[1];

		var _testing = useState(false);
		var testing = _testing[0];
		var setTesting = _testing[1];

		var _testResult = useState(null);
		var testResult = _testResult[0];
		var setTestResult = _testResult[1];

		// --- Effects ---

		useEffect(function () {
			doAction('get_insight_history').then(function (resp) {
				if (resp.success && resp.data) {
					setInsightHistory(resp.data.history || []);
				}
			}).catch(function () {});
		}, []);

		// Destroy chart canvas on unmount.
		useEffect(function () {
			return function () {
				if (typeof SILC_WIA_Charts !== 'undefined') {
					SILC_WIA_Charts.destroyAll();
				}
			};
		}, []);

		// Render chart when insight data provides one.
		useEffect(function () {
			if (insightData && insightData.type === 'chart' && insightData.chart_config) {
				var timer = setTimeout(function () {
					if (typeof SILC_WIA_Charts !== 'undefined') {
						SILC_WIA_Charts.renderChart('insight-chart-canvas', insightData.chart_config);
					}
				}, 50);
				return function () {
					clearTimeout(timer);
					if (typeof SILC_WIA_Charts !== 'undefined') {
						SILC_WIA_Charts.destroyChart('insight-chart-canvas');
					}
				};
			}
		}, [insightData]);

		// --- Handlers ---

		var handleAsk = useCallback(function (promptText) {
			var q = promptText || question;
			if (!q.trim()) return;
			if (!apiConfigured) {
				setError(l10n.apiNotConfigured + '. Open the \u2699\uFE0F Settings panel to add your API key.');
				return;
			}

			setLoading(true);
			setError(null);
			setInsightData(null);
			setHasRun(true);
			setQuestion(q);

			// Destroy existing chart.
			if (typeof SILC_WIA_Charts !== 'undefined') {
				SILC_WIA_Charts.destroyChart('insight-chart-canvas');
			}

			doAction('generate_insight', { question: q })
				.then(function (resp) {
					setLoading(false);
					if (resp.success && resp.data) {
						setInsightData(resp.data);
						// Refresh history.
						doAction('get_insight_history').then(function (hResp) {
							if (hResp.success && hResp.data) {
								setInsightHistory(hResp.data.history || []);
							}
						}).catch(function () {});
					} else {
						setError(resp.data && resp.data.message ? resp.data.message : (l10n.errorOccurred || 'Failed to generate insight'));
					}
				})
				.catch(function () {
					setLoading(false);
					setError('Network error. Please try again.');
				});
		}, [question]);

		var handleLoadHistory = useCallback(function (item) {
			// Destroy existing chart.
			if (typeof SILC_WIA_Charts !== 'undefined') {
				SILC_WIA_Charts.destroyChart('insight-chart-canvas');
			}

			setQuestion(item.question || '');
			setHasRun(true);
			setError(null);
			setLoading(false);
			// Load the full stored result directly (no re-generation).
			setInsightData({
				type:          item.type,
				sql:           item.sql,
				sql_time_ms:   item.sql_time_ms,
				rows_returned: item.rows_returned,
				columns:       item.columns,
				title:         item.title || '',
				chart_config:  item.chart_config || null,
				list_data:     item.list_data || null,
				list_config:   item.list_config || null,
				answer_text:   item.answer_text || null,
				answer_value:  item.answer_value || null,
				answer_label:  item.answer_label || null,
				empty:         item.empty || null,
				empty_message: item.empty_message || null,
			});
		}, []);

		var handleClearHistory = useCallback(function () {
			doAction('clear_insight_history').then(function (resp) {
				if (resp.success) {
					setInsightHistory([]);
				}
			}).catch(function () {});
		}, []);

		var toggleSidebar = useCallback(function () {
			setSidebarExpanded(function (prev) { return !prev; });
		}, []);

		var openPanel = useCallback(function (panel) {
			setActivePanel(function (prev) { return prev === panel ? null : panel; });
		}, []);

		// Settings handlers.
		var updateSetting = useCallback(function (key, value) {
			setFormSettings(function (prev) {
				var next = Object.assign({}, prev);
				next[key] = value;
				return next;
			});
			setSettingsDirty(true);
			setSaveMsg(null);
		}, []);

		var handleSaveSettings = useCallback(function () {
			setSaving(true);
			setSaveMsg(null);
			setTestResult(null);

			var postData = {
				api_url: formSettings.api_url,
				api_key: formSettings.api_key,
				model: formSettings.model,
				max_tokens: parseInt(formSettings.max_tokens, 10) || defaults.max_tokens,
				temperature: parseFloat(formSettings.temperature) || defaults.temperature,
				cache_ttl: parseInt(formSettings.cache_ttl, 10) || defaults.cache_ttl,
			};

			doAction('save_settings', { settings: JSON.stringify(postData) })
				.then(function (resp) {
					setSaving(false);
					if (resp.success) {
						setSaveMsg({ type: 'success', text: resp.data.message || l10n.saved });
						setSettingsDirty(false);
						// If API key was saved, clear the field.
						if (formSettings.api_key) {
							setFormSettings(function (prev) {
								var next = Object.assign({}, prev);
								next.api_key = '';
								return next;
							});
						}
						// Reload page to reflect new config.
						if (resp.data.has_api_key && !apiConfigured) {
							setTimeout(function () { window.location.reload(); }, 1000);
						}
					} else {
						setSaveMsg({ type: 'error', text: resp.data && resp.data.message ? resp.data.message : 'Save failed' });
					}
				})
				.catch(function () {
					setSaving(false);
					setSaveMsg({ type: 'error', text: 'Network error' });
				});
		}, [formSettings]);

		var handleTestConnection = useCallback(function () {
			setTesting(true);
			setTestResult(null);
			doAction('test_api')
				.then(function (resp) {
					setTesting(false);
					if (resp.success) {
						setTestResult({ type: 'success', text: resp.data.message || l10n.connectionOk });
					} else {
						setTestResult({ type: 'fail', text: resp.data && resp.data.message ? resp.data.message : l10n.connectionFail });
					}
				})
				.catch(function () {
					setTesting(false);
					setTestResult({ type: 'fail', text: 'Network error' });
				});
		}, []);

		// --- Render: Sidebar item ---

		function SidebarItem(props) {
			var icon = props.icon;
			var label = props.label;
			var panel = props.panel;
			var isActive = activePanel === panel;

			return el('div', {
				className: 'silc-wia-sidebar-item' + (isActive ? ' active' : ''),
				onClick: function () { openPanel(panel); },
				title: label,
			},
				el('span', { className: 'dashicons dashicons-' + icon }),
				el('span', { className: 'label' }, label)
			);
		}

		// --- Render: Sidebar ---

		function renderSidebar() {
			var items = [
				{ icon: 'editor-code', label: l10n.sqlDetails || 'SQL', panel: 'sql' },
				{ icon: 'backup', label: l10n.history || 'History', panel: 'history' },
				{ icon: 'book', label: l10n.guides || 'Guides', panel: 'guides' },
			];

			return el('div', {
				className: 'silc-wia-sidebar ' + (sidebarExpanded ? 'expanded' : 'collapsed'),
			},
				// Toggle button.
				el('div', {
					className: 'silc-wia-sidebar-toggle',
					onClick: toggleSidebar,
					title: sidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar',
				},
					el('span', { className: 'dashicons dashicons-menu' })
				),
				// Nav items.
				items.map(function (item) {
					return el(SidebarItem, {
						key: item.panel,
						icon: item.icon,
						label: item.label,
						panel: item.panel,
					});
				}),
				// Spacer.
				el('div', { className: 'silc-wia-sidebar-spacer' }),
				// Settings at bottom.
				el(SidebarItem, {
					icon: 'admin-generic',
					label: l10n.settings || 'Settings',
					panel: 'settings',
				})
			);
		}

		// --- Render: Panel drawer ---

		function renderPanel() {
			if (!activePanel) return null;

			var panelContent;

			if (activePanel === 'sql') {
				panelContent = renderSqlPanel();
			} else if (activePanel === 'history') {
				panelContent = renderHistoryPanel();
			} else if (activePanel === 'guides') {
				panelContent = renderGuidesPanel();
			} else if (activePanel === 'settings') {
				panelContent = renderSettingsPanel();
			}

			return el('div', { className: 'silc-wia-panel', key: activePanel },
				el('div', { className: 'silc-wia-panel-header' },
					el('span', null, getPanelTitle(activePanel)),
					el('span', {
						className: 'silc-wia-panel-close dashicons dashicons-no-alt',
						onClick: function () { setActivePanel(null); },
					})
				),
				el('div', { className: 'silc-wia-panel-body' }, panelContent)
			);
		}

		function getPanelTitle(panel) {
			var titles = {
				sql: l10n.sqlDetails || 'SQL & Details',
				history: l10n.history || 'History',
				guides: l10n.guides || 'Guides',
				settings: l10n.settings || 'Settings',
			};
			return titles[panel] || panel;
		}

		// --- SQL Panel ---

		function renderSqlPanel() {
			if (!hasRun) {
				return el('p', { className: 'silc-wia-muted' }, 'Ask a question first — the generated SQL and execution details will appear here.');
			}

			if (isLoading) {
				return el('p', { className: 'silc-wia-muted' }, 'Generating...');
			}

			if (!insightData) {
				return el('p', { className: 'silc-wia-muted' }, 'No SQL to show yet.');
			}

			var parts = [];

			// SQL query.
			if (insightData.sql) {
				parts.push(
					el('div', { key: 'sql-label', style: { fontSize: '12px', fontWeight: 600, color: '#787c82', marginBottom: '6px' } }, 'SQL Query'),
					el('div', { key: 'sql', className: 'silc-wia-sql-display' }, insightData.sql)
				);
			}

			// Execution meta.
			var metaItems = [];
			if (insightData.sql_time_ms) {
				metaItems.push({ label: 'Execution time', value: insightData.sql_time_ms + 'ms' });
			}
			if (typeof insightData.rows_returned !== 'undefined') {
				metaItems.push({ label: 'Rows returned', value: insightData.rows_returned });
			}
			if (insightData.type) {
				metaItems.push({ label: 'Output type', value: insightData.type });
			}

			if (metaItems.length > 0) {
				parts.push(
					el('div', { key: 'meta', className: 'silc-wia-sql-meta' },
						metaItems.map(function (m, i) {
							return el('span', { key: i, className: 'silc-wia-sql-meta-item' },
								el('strong', null, m.label + ':'), ' ', m.value
							);
						})
					)
				);
			}
			}

			return el('div', null, parts);
		}

		// --- History Panel ---

		function renderHistoryPanel() {
			var items = [];

			if (!insightHistory || insightHistory.length === 0) {
				items.push(el('p', { key: 'empty', className: 'silc-wia-muted' }, l10n.noInsightHistory || 'No insight history yet.'));
			} else {
				items.push(
					el('div', { key: 'clear', style: { textAlign: 'right', marginBottom: '8px' } },
						el(Button, {
							isSmall: true,
							isDestructive: true,
							variant: 'link',
							onClick: handleClearHistory,
						}, l10n.clearHistory || 'Clear')
					)
				);

				insightHistory.forEach(function (item, idx) {
					var typeIcon = '';
					var typeLabel = item.type || '?';
					if (typeLabel === 'chart') typeIcon = '\uD83D\uDCCA';
					else if (typeLabel === 'list') typeIcon = '\uD83D\uDCCB';
					else if (typeLabel === 'answer') typeIcon = '\u2139\uFE0F';

					var displayTitle = item.title || item.question || '(Unknown)';

					items.push(
						el('div', {
							key: item.id || idx,
							className: 'silc-wia-history-item-panel',
							onClick: function () { handleLoadHistory(item); },
						},
							el('div', { className: 'title-row' },
								el('span', { className: 'type-icon' }, typeIcon),
								el('span', { className: 'title' }, displayTitle)
							),
							el('div', { className: 'meta' },
								typeLabel + (item.sql_time_ms ? ' \u00B7 ' + item.sql_time_ms + 'ms' : '') + (item.time ? ' \u00B7 ' + item.time : '')
							)
						)
					);
				});
			}

			return el('div', null, items);
		}
		// --- Guides Panel ---

		function renderGuidesPanel() {
			var sections = [];

			GUIDE_SECTIONS.forEach(function (section, si) {
				var examples = section.examples.map(function (ex, ei) {
					return el('div', {
						key: ei,
						className: 'silc-wia-guide-example',
						onClick: function () {
							setQuestion(ex.text);
							setActivePanel(null);
							handleAsk(ex.text);
						},
					},
						'\uD83D\uDC49 ' + ex.text,
						el('span', { className: 'desc' }, ex.desc)
					);
				});

				sections.push(
					el('div', { key: si, className: 'silc-wia-guide-section' },
						el('h3', null, section.title),
						el('p', null, section.text),
						examples
					)
				);
			});

			return el('div', null, sections);
		}

		// --- Settings Panel ---

		function renderSettingsPanel() {
			var hasKey = settings.api_key && settings.api_key.length > 0;

			// Helper: a labelled input row.
			function SettingsField(props) {
				return el('div', { className: 'silc-wia-settings-field' },
					el('label', null, props.label),
					props.children,
					props.help ? el('div', { className: 'help' }, props.help) : null
				);
			}

			return el('div', { className: 'silc-wia-settings-panel' },

				// ---------------------------------------------------------------
				// SECTION 1 — AI Provider
				// ---------------------------------------------------------------
				el('div', { className: 'silc-wia-settings-section' },
					el('div', { className: 'silc-wia-settings-section-title' },
						'\uD83E\uDD16 AI Provider'
					),
					el('div', { className: 'silc-wia-settings-section-desc' },
						'Choose which AI service powers your insights. WooInsight works with any OpenAI-compatible API.'
					),

					// API URL
					el(SettingsField, {
						label: l10n.settingsApiUrl || 'API URL',
						help: 'The address of your AI provider\u2019s API. The default works with OpenAI (ChatGPT). Most providers use the same format.',
					},
						el('input', {
							type: 'url',
							value: formSettings.api_url,
							placeholder: defaults.api_url,
							onChange: function (e) { updateSetting('api_url', e.target.value); },
						}),
						// Provider quick-links
						el('div', { className: 'silc-wia-settings-provider-links' },
							el('span', { className: 'label' }, 'Popular providers:'),
							el('span', {
								className: 'provider-link',
								onClick: function () { updateSetting('api_url', 'https://api.openai.com/v1'); },
							}, 'OpenAI'),
							el('span', {
								className: 'provider-link',
								onClick: function () { updateSetting('api_url', 'https://api.anthropic.com/v1'); },
							}, 'Anthropic'),
							el('span', {
								className: 'provider-link',
								onClick: function () { updateSetting('api_url', 'https://api.deepseek.com/v1'); },
							}, 'DeepSeek'),
						)
					),

					// Model
					el(SettingsField, {
						label: l10n.settingsModel || 'Model',
						help: 'The AI model to use. Stick with the default unless you know what you\u2019re doing. Popular options: gpt-4o-mini (fast/cheap), gpt-4o (powerful), claude-3-haiku, deepseek-r1.',
					},
						el('input', {
							type: 'text',
							value: formSettings.model,
							placeholder: defaults.model,
							onChange: function (e) { updateSetting('model', e.target.value); },
						})
					),
				),

				// ---------------------------------------------------------------
				// SECTION 2 — Authentication
				// ---------------------------------------------------------------
				el('div', { className: 'silc-wia-settings-section' },
					el('div', { className: 'silc-wia-settings-section-title' },
						'\uDDD1\uFE0F\u200D\uD83D\uDD12 Authentication'
					),
					el('div', { className: 'silc-wia-settings-section-desc' },
						'Your API key is stored securely in your WordPress database and is only sent to the API URL above. WooInsight never sends your data anywhere else.'
					),

					// API Key
					el(SettingsField, {
						label: l10n.settingsApiKey || 'API Key',
						help: hasKey && !formSettings.api_key
							? 'A key is already saved. Type a new one to replace it, or leave blank to keep the current key.'
							: 'Paste your API key here. Need one? Sign up at your AI provider and create a key from their dashboard.',
					},
						el('input', {
							type: 'password',
							value: formSettings.api_key,
							placeholder: hasKey ? 'API key is saved \u2014 enter new one to replace' : 'sk-...',
							onChange: function (e) { updateSetting('api_key', e.target.value); },
							autoComplete: 'off',
						}),
						hasKey && !formSettings.api_key
							? el('div', { className: 'has-key-indicator' }, '\u2713 API key is saved and active.')
							: null,
						// Link to get a key (OpenAI is the most common)
						el('div', { className: 'silc-wia-settings-key-links' },
							el('a', {
								href: 'https://platform.openai.com/api-keys',
								target: '_blank',
								rel: 'noopener noreferrer',
							}, 'Get an OpenAI API key \u2197'),
							' \u00B7 ',
							el('a', {
								href: 'https://docs.anthropic.com/en/docs/api-keys',
								target: '_blank',
								rel: 'noopener noreferrer',
							}, 'Anthropic \u2197'),
							' \u00B7 ',
							el('a', {
								href: 'https://platform.deepseek.com/api_keys',
								target: '_blank',
								rel: 'noopener noreferrer',
							}, 'DeepSeek \u2197'),
						)
					),
				),

				// ---------------------------------------------------------------
				// SECTION 3 — Advanced
				// ---------------------------------------------------------------
				el('div', { className: 'silc-wia-settings-section' },
					el('div', { className: 'silc-wia-settings-section-title' },
						'\u2699\uFE0F Advanced'
					),

					// Max Tokens
					el(SettingsField, {
						label: l10n.settingsMaxTokens || 'Max Tokens',
						help: 'Maximum length of the AI\u2019s response. Higher = more detailed but slower. 500 is a good starting point.',
					},
						el('input', {
							type: 'number',
							value: formSettings.max_tokens,
							placeholder: defaults.max_tokens,
							min: 50, max: 8192, step: 50,
							onChange: function (e) { updateSetting('max_tokens', e.target.value); },
						})
					),

					// Temperature
					el(SettingsField, {
						label: l10n.settingsTemp || 'Temperature',
						help: 'Controls how creative the AI is. Lower values (0.1\u20130.3) produce more consistent SQL. Higher values (0.7+) can be more creative but less reliable.',
					},
						el('input', {
							type: 'number',
							value: formSettings.temperature,
							placeholder: defaults.temperature,
							min: 0, max: 2, step: 0.1,
							onChange: function (e) { updateSetting('temperature', e.target.value); },
						})
					),
				),

				// ---------------------------------------------------------------
				// SECTION 4 — Caching
				// ---------------------------------------------------------------
				el('div', { className: 'silc-wia-settings-section' },
					el('div', { className: 'silc-wia-settings-section-title' },
						'\uD83D\uDCBE Caching'
					),
					el('div', { className: 'silc-wia-settings-section-desc' },
						'Results are cached so asking the same question again loads instantly. Set the duration below, or set to 0 to disable caching.'
					),

					// Cache Duration
					el(SettingsField, {
						label: l10n.settingsCache || 'Cache Duration',
						help: 'How long to remember results for the same question. Recommended: 1\u20136 hours. Set to 0 to disable caching entirely.',
					},
						el('div', { className: 'silc-wia-cache-row' },
							el('input', {
								type: 'number',
								value: Math.round(parseInt(formSettings.cache_ttl, 10) / 60) || 60,
								min: 0, max: 10080, step: 15,
								onChange: function (e) {
									var minutes = parseInt(e.target.value, 10) || 0;
									updateSetting('cache_ttl', Math.max(0, Math.min(10080, minutes)) * 60);
								},
							}),
							el('span', { className: 'silc-wia-cache-unit' }, 'minutes'),
						),
						// Quick presets
						el('div', { className: 'silc-wia-cache-presets' },
							el('span', { className: 'label' }, 'Quick:'),
							el('span', { className: 'preset', onClick: function () { updateSetting('cache_ttl', 0); } }, 'Off'),
							el('span', { className: 'preset', onClick: function () { updateSetting('cache_ttl', 30 * 60); } }, '30 min'),
							el('span', { className: 'preset', onClick: function () { updateSetting('cache_ttl', 3600); } }, '1 hour'),
							el('span', { className: 'preset', onClick: function () { updateSetting('cache_ttl', 6 * 3600); } }, '6 hours'),
							el('span', { className: 'preset', onClick: function () { updateSetting('cache_ttl', 86400); } }, '24 hours'),
						)
					),
				),

				// ---------------------------------------------------------------
				// ACTIONS
				// ---------------------------------------------------------------
				el('div', { className: 'silc-wia-settings-actions' },
					el(Button, {
						isPrimary: true,
						onClick: handleSaveSettings,
						disabled: saving || !settingsDirty,
					}, saving ? (l10n.saving || 'Saving...') : (l10n.save || 'Save Settings')),
					el(Button, {
						isSecondary: true,
						onClick: handleTestConnection,
						disabled: testing,
					}, testing ? (l10n.testing || 'Testing...') : (l10n.testConnection || 'Test Connection')),
					testResult
						? el('span', {
							className: 'silc-wia-test-result ' + (testResult.type === 'success' ? 'success' : 'fail'),
							key: testResult.text,
						}, (testResult.type === 'success' ? '\u2713 ' : '\u2717 ') + testResult.text)
						: null,
				),

				// Save message.
				saveMsg
					? el('p', {
						style: {
							margin: '12px 0 0 0',
							fontSize: '12px',
							fontWeight: 500,
							color: saveMsg.type === 'success' ? '#1a7a2e' : '#b32d2e',
						},
					}, saveMsg.text)
					: null
			);
		}

		// --- Render: Result ---

		function renderResult() {
			if (!insightData) return null;

			var parts = [];

			// Title bar with refresh button.
			var titleBarItems = [];

			if (insightData.title) {
				titleBarItems.push(
					el('div', { key: 'title', className: 'silc-wia-result-title' }, insightData.title)
				);
			}

			// Refresh button — re-runs the full pipeline with the same question.
			if (insightData.sql) {
				titleBarItems.push(
					el(Button, {
						key: 'refresh',
						isSmall: true,
						variant: 'secondary',
						className: 'silc-wia-refresh-btn',
						onClick: function () {
							handleAsk(question);
						},
						disabled: isLoading,
					}, isLoading ? el(Spinner, {}) : '\uD83D\uDD04 ' + (l10n.refresh || 'Refresh'))
				);
			}

			if (titleBarItems.length > 0) {
				parts.push(
					el('div', { className: 'silc-wia-result-header', key: 'header' }, titleBarItems)
				);
			}

			if (insightData.empty) {
				parts.push(
					el('div', { className: 'silc-wia-result-answer', key: 'empty' },
						el('p', { style: { margin: 0, color: '#787c82' } },
							insightData.empty_message || l10n.noResults || 'No results found.'
						)
					)
				);
				return el('div', null, parts);
			}

			var type = insightData.type || 'answer';

			// Metadata bar.
			if (insightData.sql) {
				var metaItems = [];
				if (insightData.sql_time_ms) metaItems.push('Executed in ' + insightData.sql_time_ms + 'ms');
				if (typeof insightData.rows_returned !== 'undefined') metaItems.push(insightData.rows_returned + ' row(s)');
				if (metaItems.length > 0) {
					parts.push(
						el('div', { className: 'silc-wia-query-info', key: 'meta' },
							metaItems.map(function (item, i) { return el('span', { key: i }, item); })
						)
					);
				}
			}

			// Content based on type.
			switch (type) {
				case 'chart':
					parts.push(renderChartResult());
					break;
				case 'list':
					parts.push(renderListResult());
					break;
				case 'answer':
				default:
					parts.push(renderAnswerResult());
					break;
			}

			return el('div', null, parts);
		}
					break;
				case 'answer':
			var config = insightData.chart_config;
			return el('div', null, parts);
		}

		function renderChartResult() {
			var config = insightData.chart_config;
			if (!config || !config.labels || config.labels.length === 0) {
				return el('p', { key: 'chart-empty', className: 'silc-wia-muted' }, 'No chart data available.');
			}

			var chartTypeLabel = config.chart_type || 'bar';
			var title = config.title || '';

			return el('div', { className: 'silc-wia-result-chart', key: 'chart' },
				title ? el('div', { className: 'silc-wia-result-chart-title' }, title) : null,
				el('div', { className: 'silc-wia-chart-wrapper' },
					el('canvas', { id: 'insight-chart-canvas', className: 'silc-wia-chart-canvas' })
				),
				el('div', { className: 'silc-wia-chart-type-badge' }, 'Chart: ' + chartTypeLabel)
			);
		}
				el('div', { className: 'silc-wia-chart-type-badge' }, 'Chart: ' + chartTypeLabel)
			);
		}

		function renderListResult() {
			var listData = insightData.list_data;
			var listConfig = insightData.list_config;

			if (!listData || listData.length === 0) {
				return el('p', { key: 'list-empty', className: 'silc-wia-muted' }, 'No list data available.');
			}

			var displayCols = [];
			if (listConfig && listConfig.display_columns && listConfig.display_columns.length > 0) {
				displayCols = listConfig.display_columns;
			} else if (listData.length > 0) {
				displayCols = Object.keys(listData[0]).filter(function (c) { return c !== '_links'; });
			}

			var titleCol = (listConfig && listConfig.title_column) ? listConfig.title_column : (displayCols[0] || '');

			var items = listData.map(function (row, idx) {
				var titleText = row[titleCol] || ('Item ' + (idx + 1));
				var details = [];

				displayCols.forEach(function (col) {
					if (col === titleCol || col === '_links') return;
					var val = row[col];
					if (val === null || val === undefined) val = '';
					details.push(
						el('span', { className: 'silc-wia-list-detail', key: col },
							el('span', { className: 'silc-wia-list-detail-label' }, col + ': '),
							el('span', { className: 'silc-wia-list-detail-value' }, String(val))
						)
					);
				});

				var links = [];
				if (row._links) {
					Object.keys(row._links).forEach(function (linkCol) {
						var url = row._links[linkCol];
						if (url) {
							links.push(
								el('a', {
									key: linkCol,
									href: url,
									target: '_blank',
									rel: 'noopener noreferrer',
									className: 'silc-wia-list-link',
									title: l10n.openInNewTab || 'Open',
								}, '\uD83D\uDD17 ' + linkCol)
							);
						}
					});
				}

				return el('div', { className: 'silc-wia-list-item', key: idx },
					el('div', { className: 'silc-wia-list-item-title' },
						String(titleText),
						links.length > 0 ? el('span', { className: 'silc-wia-list-item-links' }, links) : null
					),
					details.length > 0 ? el('div', { className: 'silc-wia-list-item-details' }, details) : null
				);
			});

			return el('div', { className: 'silc-wia-result-list', key: 'list' }, items);
		}

		function renderAnswerResult() {
			var answerText = insightData.answer_text || '';
			var answerValue = insightData.answer_value || '';
			var answerLabel = insightData.answer_label || '';

			return el('div', { className: 'silc-wia-result-answer', key: 'answer' },
				answerValue ? el('div', { className: 'silc-wia-result-answer-value' }, String(answerValue)) : null,
				answerLabel ? el('div', { className: 'silc-wia-result-answer-label' }, String(answerLabel)) : null,
				answerText ? el('div', { className: 'silc-wia-result-answer-text' }, answerText) : null
			);
		}

		// --- Render: Main content ---

		function renderMain() {
			if (!hasRun) {
				// Empty state: centered welcome.
				return el('div', { className: 'silc-wia-chat-empty' },
					el('div', { className: 'silc-wia-chat-empty-icon' }, '\uD83D\uDCCA'),
					el('h2', null, 'Ask anything about your WooCommerce store'),
					el('p', null,
						'Get instant charts, lists, and answers about your sales, products, customers, and more. Just type a question or try one below.'
					),
					!apiConfigured
						? el('p', {
							style: { color: '#b32d2e', fontSize: '13px', background: '#fcf0f1', padding: '8px 16px', borderRadius: '8px', marginBottom: '20px', maxWidth: '400px' },
						}, l10n.apiNotConfigured + '. Open the \u2699\uFE0F Settings panel to add your API key.')
						: null,
					el('div', { className: 'silc-wia-prompts' },
						SUGGESTED_PROMPTS.map(function (p, i) {
							return el('div', {
								key: i,
								className: 'silc-wia-prompt-chip',
								onClick: function () { handleAsk(p.text); },
							},
								el('span', { className: 'icon' }, p.icon),
								p.text
							);
						})
					)
				);
			}

			// Has results.
			return el('div', { className: 'silc-wia-chat-with-results' },
				// Scrollable results area.
				el('div', { className: 'silc-wia-chat-results' },
					// Loading indicator.
					isLoading
						? el('div', { className: 'silc-wia-loading' },
							el('span', null, l10n.generatingInsight || 'Generating insight'),
							el('span', { className: 'silc-wia-loading-dots' },
								el('span'), el('span'), el('span')
							)
						)
						: null,

					// Error.
					error
						? el('div', { className: 'silc-wia-error' },
							el('span', null, '\u26A0\uFE0F ' + error),
							el('span', { className: 'dismiss', onClick: function () { setError(null); } }, '\u00D7')
						)
						: null,

					// Result.
					!isLoading ? renderResult() : null
				),

				// Bottom input area.
				el('div', { className: 'silc-wia-chat-input-area' },
					el('div', { className: 'silc-wia-chat-input-row' },
						el(TextControl, {
							placeholder: l10n.askQuestion || 'Ask anything...',
							value: question,
							onChange: setQuestion,
							onKeyDown: function (e) {
								if (e.key === 'Enter' && !e.shiftKey) {
									e.preventDefault();
									handleAsk();
								}
							},
							disabled: isLoading,
						}),
						el(Button, {
							isPrimary: true,
							onClick: function () { handleAsk(); },
							disabled: isLoading || !question.trim() || !apiConfigured,
						}, isLoading ? el(Spinner, {}) : (l10n.getInsight || 'Get Insight'))
					),
					// Suggested prompts below input.
					el('div', { className: 'silc-wia-prompts-below' },
						SUGGESTED_PROMPTS.map(function (p, i) {
							return el('div', {
								key: i,
								className: 'silc-wia-prompt-chip',
								onClick: function () { handleAsk(p.text); },
							},
								el('span', { className: 'icon' }, p.icon),
								p.text
							);
						})
					)
				)
			);
		}

		// --- Final render ---

		return el('div', { style: { height: '100%', display: 'flex', flexDirection: 'column' } },

			// Top bar.
			el('div', { className: 'silc-wia-topbar' },
				el('div', { className: 'silc-wia-topbar-logo' },
					el(LogoSvg),
					'WooInsight AI'
				),
				el('span', { className: 'silc-wia-topbar-model' }, settings.model || defaults.model),
				el('div', { className: 'silc-wia-topbar-spacer' }),
				el('span', {
					className: 'silc-wia-topbar-status ' + (apiConfigured ? 'ready' : 'not-ready'),
				}, apiConfigured ? (l10n.apiReady || 'AI Ready') : (l10n.apiNotConfigured || 'API not configured')),
			),

			// Body: sidebar + panel + chat.
			el('div', { className: 'silc-wia-chat-layout' },
				renderSidebar(),
				renderPanel(),
				el('div', { className: 'silc-wia-chat' },
					renderMain()
				)
			)
		);
	}

	// ----------------------------------------------------------------------- //
	//  MOUNT
	// ----------------------------------------------------------------------- //

	var rootElement = document.getElementById('silc-wia-dashboard');
	if (rootElement) {
		wp.element.render(el(WooInsightDashboard), rootElement);
	}

})(window.wp);
