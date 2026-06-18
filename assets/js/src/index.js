/**
 * SILC WooInsight AI — Main Entry Point
 *
 * @package SILC_WooInsight_AI
 */

/* global wp, SILC_WIA_Charts */

import {
	doAction,
	LogoSvg,
	l10n,
	settings,
	defaults,
	SUGGESTED_PROMPTS,
	apiConfigured,
} from './utils.js';

import {
	getPanelTitle,
	renderSqlPanel,
	renderHistoryPanel,
	renderGuidesPanel,
	renderSuggestedPanel,
} from './panels.js';

import { renderResult } from './results.js';
import { renderSidebar } from './sidebar.js';
import { renderSettingsPanel } from './settings-panel.js';

var el = wp.element.createElement;
var useState = wp.element.useState;
var useEffect = wp.element.useEffect;
var useCallback = wp.element.useCallback;

var TextControl = wp.components.TextControl;
var Button = wp.components.Button;
var Spinner = wp.components.Spinner;

/**
 * WooInsight Dashboard component.
 */
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
	var _sidebarExpanded = useState(false);
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

	// Guides search state.
	var _guideSearchQuery = useState('');
	var guideSearchQuery = _guideSearchQuery[0];
	var setGuideSearchQuery = _guideSearchQuery[1];

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
		setActivePanel(null);
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

	var handleRefresh = useCallback(function (insightData) {
		if (!insightData || !insightData.sql) return;

		// Destroy existing chart.
		if (typeof SILC_WIA_Charts !== 'undefined') {
			SILC_WIA_Charts.destroyChart('insight-chart-canvas');
		}

		setLoading(true);
		setError(null);

		doAction('execute_sql', {
			sql: insightData.sql,
			type: insightData.type || 'answer',
			chart_config: insightData.chart_config ? JSON.stringify(insightData.chart_config) : '',
			list_config: insightData.list_config ? JSON.stringify(insightData.list_config) : '',
			answer_text: insightData.answer_text || '',
		})
			.then(function (resp) {
				setLoading(false);
				if (resp.success && resp.data) {
					setInsightData(resp.data);
				} else {
					setError(resp.data && resp.data.message ? resp.data.message : (l10n.errorOccurred || 'Failed to refresh'));
				}
			})
			.catch(function () {
				setLoading(false);
				setError('Network error. Please try again.');
			});
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

	// --- Render: Panel drawer ---

	function renderPanel() {
		if (!activePanel) return null;

		var panelContent;

		if (activePanel === 'sql') {
			panelContent = renderSqlPanel({
				hasRun: hasRun,
				isLoading: isLoading,
				insightData: insightData,
			});
		} else if (activePanel === 'history') {
			panelContent = renderHistoryPanel({
				insightHistory: insightHistory,
				handleLoadHistory: handleLoadHistory,
				handleClearHistory: handleClearHistory,
			});
		} else if (activePanel === 'guides') {
			panelContent = renderGuidesPanel({
				setQuestion: setQuestion,
				setActivePanel: setActivePanel,
				handleAsk: handleAsk,
				guideSearchQuery: guideSearchQuery,
				setGuideSearchQuery: setGuideSearchQuery,
			});
		} else if (activePanel === 'suggested') {
			panelContent = renderSuggestedPanel({
				setQuestion: setQuestion,
				setActivePanel: setActivePanel,
				handleAsk: handleAsk,
			});
		} else if (activePanel === 'settings') {
			panelContent = renderSettingsPanel({
				formSettings: formSettings,
				updateSetting: updateSetting,
				handleSaveSettings: handleSaveSettings,
				handleTestConnection: handleTestConnection,
				settingsDirty: settingsDirty,
				saving: saving,
				testing: testing,
				saveMsg: saveMsg,
				testResult: testResult,
			});
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

	// --- Render: Main content ---

	function renderMain() {
		if (!hasRun) {
			// Empty state: centered welcome.
			return el('div', { className: 'silc-wia-chat-empty' },
				el('div', { className: 'silc-wia-chat-results' },
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
					),
				),
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
					}, isLoading
						? el(Spinner, {})
						: el('span', { className: 'silc-wia-btn-content' },
							el('span', { className: 'dashicons dashicons-visibility' }),
							el('span', { className: 'silc-wia-btn-label' }, l10n.getInsight || 'Get Insight')
						)
					)
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
				!isLoading ? renderResult({ insightData: insightData, question: question, handleAsk: handleAsk, handleRefresh: handleRefresh, isLoading: isLoading }) : null
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
					}, isLoading
						? el(Spinner, {})
						: el('span', { className: 'silc-wia-btn-content' },
							el('span', { className: 'dashicons dashicons-visibility' }),
							el('span', { className: 'silc-wia-btn-label' }, l10n.getInsight || 'Get Insight')
						)
					)
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
			renderSidebar({
				sidebarExpanded: sidebarExpanded,
				toggleSidebar: toggleSidebar,
				openPanel: openPanel,
				activePanel: activePanel,
			}),
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
	wp.element.render(el(WooInsightDashboard, null), rootElement);
}
