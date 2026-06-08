/**
 * SILC WooInsight AI - React Dashboard
 *
 * Uses @wordpress/element (React) and @wordpress/components for the UI.
 * Supports two modes:
 *   - SQL Mode: Generate SQL → edit → execute (v1.0)
 *   - Insight Mode: Question → AI → SQL → Execute → Render (v2.0)
 *
 * Insight mode renders charts via Chart.js (SILC_WIA_Charts global),
 * rich lists with HPOS-aware admin links, and formatted answer text.
 *
 * @package SILC_WooInsight_AI
 */

/* global SILC_WIA_Charts */

(function (wp) {
	'use strict';

	// WordPress dependencies.
	var el = wp.element.createElement;
	var useState = wp.element.useState;
	var useEffect = wp.element.useEffect;
	var useRef = wp.element.useRef;
	var useCallback = wp.element.useCallback;
	var __ = wp.i18n.__;
	var apiFetch = wp.apiFetch;
	var decodeEntities = wp.htmlEntities ? wp.htmlEntities.decodeEntities : function (s) { return s; };

	// Components.
	var TextControl = wp.components.TextControl;
	var TextareaControl = wp.components.TextareaControl;
	var Button = wp.components.Button;
	var Spinner = wp.components.Spinner;
	var Panel = wp.components.Panel;
	var PanelBody = wp.components.PanelBody;
	var TabPanel = wp.components.TabPanel;
	var Notice = wp.components.Notice;
	var ExternalLink = wp.components.ExternalLink;
	var Card = wp.components.Card;
	var CardHeader = wp.components.CardHeader;
	var CardBody = wp.components.CardBody;
	var Flex = wp.components.Flex;
	var FlexItem = wp.components.FlexItem;

	// ----------------------------------------------------------------------- //
	//  DATA
	// ----------------------------------------------------------------------- //

	var data = window.silcWiaData || {};
	var ajaxUrl = data.ajaxUrl || '';
	var nonce = data.nonce || '';
	var l10n = data.l10n || {};
	var settingsUrl = data.settingsUrl || '';
	var apiConfigured = data.apiConfigured || false;

	/**
	 * Helper to make AJAX requests to our plugin.
	 */
	function doAction(action, extra) {
		var formData = new FormData();
		formData.append('action', 'silc_wia_' + action);
		formData.append('nonce', nonce);

		if (extra) {
			Object.keys(extra).forEach(function (key) {
				formData.append(key, extra[key]);
			});
		}

		return fetch(ajaxUrl, {
			method: 'POST',
			body: formData,
		}).then(function (r) { return r.json(); });
	}

	// ----------------------------------------------------------------------- //
	//  MAIN DASHBOARD COMPONENT
	// ----------------------------------------------------------------------- //

	function WooInsightDashboard() {
		// Mode: 'sql' or 'insight'
		var _mode = useState('sql');
		var mode = _mode[0];
		var setMode = _mode[1];

		// Shared question input.
		var _q = useState('');
		var question = _q[0];
		var setQuestion = _q[1];

		// SQL mode state.
		var _sqlInput = useState('');
		var sqlInput = _sqlInput[0];
		var setSqlInput = _sqlInput[1];

		var _results = useState(null);
		var sqlResults = _results[0];
		var setSqlResults = _results[1];

		var _loading = useState(false);
		var isLoading = _loading[0];
		var setLoading = _loading[1];

		var _queryInfo = useState(null);
		var queryInfo = _queryInfo[0];
		var setQueryInfo = _queryInfo[1];

		var _error = useState(null);
		var error = _error[0];
		var setError = _error[1];

		var _history = useState([]);
		var history = _history[0];
		var setHistory = _history[1];

		var _schema = useState('');
		var schemaContext = _schema[0];
		var setSchemaContext = _schema[1];

		// Insight mode state.
		var _insightData = useState(null);
		var insightData = _insightData[0];
		var setInsightData = _insightData[1];

		var _insightHistory = useState([]);
		var insightHistory = _insightHistory[0];
		var setInsightHistory = _insightHistory[1];

		var chartContainerRef = useRef(null);

		// ------------------------------------------------------------------- //
		//  EFFECT: Bootstrap schema and history.
		// ------------------------------------------------------------------- //

		useEffect(function () {
			doAction('get_schema').then(function (resp) {
				if (resp.success && resp.data) {
					setSchemaContext(resp.data.context || '');
				}
			}).catch(function () {});

			doAction('get_history').then(function (resp) {
				if (resp.success && resp.data) {
					setHistory(resp.data.history || []);
				}
			}).catch(function () {});

			doAction('get_insight_history').then(function (resp) {
				if (resp.success && resp.data) {
					setInsightHistory(resp.data.history || []);
				}
			}).catch(function () {});
		}, []);

		// Chart cleanup on unmount or when insight data changes.
		useEffect(function () {
			return function () {
				if (typeof SILC_WIA_Charts !== 'undefined') {
					SILC_WIA_Charts.destroyAll();
				}
			};
		}, []);

		// Render chart when insight data changes.
		useEffect(function () {
			if (mode === 'insight' && insightData && insightData.type === 'chart' && insightData.chart_config) {
				// Small delay to ensure DOM is ready.
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
		}, [insightData, mode]);

		// ------------------------------------------------------------------- //
		//  HANDLERS — SQL Mode
		// ------------------------------------------------------------------- //

		var handleGenerateSQL = useCallback(function () {
			if (!question.trim()) {
				setError(l10n.enterQuestion || 'Please enter a question.');
				return;
			}

			setLoading(true);
			setError(null);

			if (apiConfigured) {
				doAction('generate_sql', { question: question })
					.then(function (resp) {
						setLoading(false);
						if (resp.success && resp.data && resp.data.sql) {
							setSqlInput(resp.data.sql);
						} else {
							var msg = resp.data && resp.data.message ? resp.data.message : 'Failed to generate SQL';
							setError(msg);
							var sql = fallbackGenerateSQL(question);
							if (sql) {
								setSqlInput(sql);
								setError(null);
							}
						}
					})
					.catch(function () {
						setLoading(false);
						setError('Network error. Please try again.');
					});
			} else {
				setTimeout(function () {
					var sql = fallbackGenerateSQL(question);
					setSqlInput(sql);
					setLoading(false);
				}, 200);
			}
		}, [question, apiConfigured]);

		var handleRunQuery = useCallback(function () {
			if (!sqlInput.trim()) {
				setError(l10n.invalidSQL || 'No SQL to execute.');
				return;
			}

			setLoading(true);
			setError(null);
			setSqlResults(null);
			setQueryInfo(null);

			doAction('execute_query', { sql: sqlInput })
				.then(function (resp) {
					setLoading(false);
					if (resp.success && resp.data) {
						setSqlResults(resp.data.data || []);
						setQueryInfo({
							sql: resp.data.sql || sqlInput,
							timeMs: resp.data.time_ms || 0,
							rows: resp.data.rows || (resp.data.data ? resp.data.data.length : 0),
						});

						doAction('save_history', {
							question: question,
							sql: resp.data.sql || sqlInput,
							label: question.substring(0, 100),
						}).then(function (hResp) {
							if (hResp.success && hResp.data) {
								setHistory(hResp.data.history || []);
							}
						}).catch(function () {});
					} else {
						var errorMsg = resp.data && resp.data.message ? resp.data.message : (l10n.errorOccurred || 'Unknown error');
						setError(errorMsg);
					}
				})
				.catch(function () {
					setLoading(false);
					setError('Network error. Please try again.');
				});
		}, [sqlInput, question]);

		var handleLoadHistory = useCallback(function (item) {
			setQuestion(item.question || '');
			setSqlInput(item.sql || '');
		}, []);

		var handleClearHistory = useCallback(function () {
			doAction('clear_history').then(function (resp) {
				if (resp.success) {
					setHistory([]);
				}
			}).catch(function () {});
		}, []);

		// ------------------------------------------------------------------- //
		//  HANDLERS — Insight Mode
		// ------------------------------------------------------------------- //

		var handleGenerateInsight = useCallback(function () {
			if (!question.trim()) {
				setError(l10n.enterQuestion || 'Please enter a question.');
				return;
			}

			setLoading(true);
			setError(null);
			setInsightData(null);

			// Destroy any existing chart before new insight.
			if (typeof SILC_WIA_Charts !== 'undefined') {
				SILC_WIA_Charts.destroyChart('insight-chart-canvas');
			}

			doAction('generate_insight', { question: question })
				.then(function (resp) {
					setLoading(false);
					if (resp.success && resp.data) {
						setInsightData(resp.data);

						// Save to insight history.
						doAction('get_insight_history').then(function (hResp) {
							if (hResp.success && hResp.data) {
								setInsightHistory(hResp.data.history || []);
							}
						}).catch(function () {});
					} else {
						var msg = resp.data && resp.data.message ? resp.data.message : (l10n.errorOccurred || 'Failed to generate insight');
						setError(msg);
					}
				})
				.catch(function () {
					setLoading(false);
					setError('Network error. Please try again.');
				});
		}, [question]);

		var handleLoadInsightHistory = useCallback(function (item) {
			setQuestion(item.question || '');
		}, []);

		var handleClearInsightHistory = useCallback(function () {
			doAction('clear_insight_history').then(function (resp) {
				if (resp.success) {
					setInsightHistory([]);
				}
			}).catch(function () {});
		}, []);

		// ------------------------------------------------------------------- //
		//  RENDER HELPERS — Common
		// ------------------------------------------------------------------- //

		function renderApiStatus() {
			var badge;
			if (apiConfigured) {
				badge = el('span', {
					className: 'silc-wia-model-status ready',
				}, l10n.apiReady || 'AI Ready (API)');
			} else {
				badge = el('span', {
					className: 'silc-wia-model-status error',
				}, l10n.usingFallback || 'Using built-in templates (API not configured)');
			}

			var settingsLink = el(Button, {
				isSmall: true,
				variant: 'link',
				href: settingsUrl,
				style: { marginLeft: '8px' },
			}, l10n.settings || 'Settings');

			return el('div', { className: 'silc-wia-status-group' },
				badge,
				settingsLink
			);
		}

		// ------------------------------------------------------------------- //
		//  RENDER HELPERS — SQL Mode Results
		// ------------------------------------------------------------------- //

		function renderSqlResults() {
			if (!sqlResults) {
				return el('p', { className: 'silc-wia-muted' }, l10n.noResults || 'Run a query to see results.');
			}

			if (sqlResults.length === 0) {
				return el('p', {}, l10n.noResults || 'No results found.');
			}

			var columns = Object.keys(sqlResults[0]);

			var tableEl = el('div', { className: 'silc-wia-results-container' },
				el('table', { className: 'silc-wia-results-table' },
					el('thead', null,
						el('tr', null,
							columns.map(function (col) {
								return el('th', { key: col }, col);
							})
						)
					),
					el('tbody', null,
						sqlResults.map(function (row, idx) {
							return el('tr', { key: idx },
								columns.map(function (col) {
									var val = row[col];
									if (val === null || val === undefined) {
										val = 'NULL';
									} else if (typeof val === 'object') {
										val = JSON.stringify(val);
									}
									return el('td', { key: col }, String(val));
								})
							);
						})
					)
				)
			);

			var jsonEl = el('pre', { className: 'silc-wia-json-display' },
				JSON.stringify(sqlResults, null, 2)
			);

			return el(TabPanel, {
				className: 'silc-wia-result-tabs',
				tabs: [
					{ name: 'table', title: 'Table' },
					{ name: 'json', title: 'JSON' },
				],
			}, function (tab) {
				if (tab.name === 'table') return tableEl;
				return jsonEl;
			});
		}

		// ------------------------------------------------------------------- //
		//  RENDER HELPERS — Insight Mode
		// ------------------------------------------------------------------- //

		function renderInsightResults() {
			if (!insightData) {
				return el('p', { className: 'silc-wia-muted' },
					'Ask a question and click "Get Insight" to see results here.'
				);
			}

			if (insightData.empty) {
				return el('div', { className: 'silc-wia-insight-empty' },
					el('p', { className: 'silc-wia-insight-empty-icon' }, '\uD83D\uDCCB'),
					el('p', null, insightData.empty_message || l10n.noResults || 'No results found.')
				);
			}

			var type = insightData.type || 'answer';
			var parts = [];

			// Metadata bar.
			if (insightData.sql) {
				var metaItems = [];
				if (insightData.sql_time_ms) {
					metaItems.push('Executed in ' + insightData.sql_time_ms + 'ms');
				}
				if (typeof insightData.rows_returned !== 'undefined') {
					metaItems.push(insightData.rows_returned + ' row(s)');
				}

				if (metaItems.length > 0) {
					parts.push(
						el('div', { className: 'silc-wia-query-info', key: 'meta' },
							metaItems.map(function (item, i) {
								return el('span', { key: i }, item);
							})
						)
					);
				}
			}

			// Render based on type.
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

		function renderChartResult() {
			var config = insightData.chart_config;
			if (!config || !config.labels || config.labels.length === 0) {
				return el('p', { key: 'chart-empty' }, 'No chart data available.');
			}

			var chartTypeLabel = config.chart_type || 'bar';
			var title = config.title || '';

			return el('div', { className: 'silc-wia-chart-container', key: 'chart' },
				title ? el('h3', { className: 'silc-wia-chart-title' }, title) : null,
				el('div', { className: 'silc-wia-chart-wrapper' },
					el('canvas', {
						id: 'insight-chart-canvas',
						className: 'silc-wia-chart-canvas',
					})
				),
				el('div', { className: 'silc-wia-chart-type-badge' },
					'Chart type: ' + chartTypeLabel
				)
			);
		}

		function renderListResult() {
			var listData = insightData.list_data;
			var listConfig = insightData.list_config;

			if (!listData || listData.length === 0) {
				return el('p', { key: 'list-empty' }, 'No list data available.');
			}

			// Determine display columns.
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
					if (col === titleCol) return;
					if (col === '_links') return;
					var val = row[col];
					if (val === null || val === undefined) val = '';
					details.push(
						el('span', { className: 'silc-wia-list-detail', key: col },
							el('span', { className: 'silc-wia-list-detail-label' }, col + ': '),
							el('span', { className: 'silc-wia-list-detail-value' }, String(val))
						)
					);
				});

				// Links.
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
									title: l10n.openInNewTab || 'Open in new tab',
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

			return el('div', { className: 'silc-wia-list-container', key: 'list' },
				items
			);
		}

		function renderAnswerResult() {
			var answerText = insightData.answer_text || '';
			var answerValue = insightData.answer_value || '';
			var answerLabel = insightData.answer_label || '';

			return el('div', { className: 'silc-wia-answer-container', key: 'answer' },
				answerValue ? el('div', { className: 'silc-wia-answer-value' }, String(answerValue)) : null,
				answerLabel ? el('div', { className: 'silc-wia-answer-label' }, String(answerLabel)) : null,
				answerText ? el('div', { className: 'silc-wia-answer-text' }, String(answerText)) : null
			);
		}

		// ------------------------------------------------------------------- //
		//  MODE TABBED CONTENT
		// ------------------------------------------------------------------- //

		function renderModeContent() {
			if (mode === 'sql') {
				return el('div', { className: 'silc-wia-main-content' },

					// Left column: SQL Input + Results.
					el('div', { className: 'silc-wia-left' },

						// Input card.
						el('div', { className: 'silc-wia-card silc-wia-mb-3' },
							el('h2', null, 'Ask a Question'),
							el('div', { className: 'silc-wia-input-area' },
								el('div', { className: 'silc-wia-input-row' },
									el(TextControl, {
										placeholder: l10n.askQuestion || 'Ask a question about your WooCommerce data...',
										value: question,
										onChange: setQuestion,
										onKeyDown: function (e) {
											if (e.key === 'Enter' && !e.shiftKey) {
												e.preventDefault();
												handleGenerateSQL();
											}
										},
									}),
									el(Button, {
										isPrimary: true,
										onClick: handleGenerateSQL,
										disabled: isLoading || !question.trim(),
									}, isLoading ? el(Spinner, {}) : (l10n.generateSQL || 'Generate SQL'))
								),
								el('div', { className: 'silc-wia-sql-field' },
									el(TextareaControl, {
										label: 'SQL Query:',
										help: 'Edit the SQL if needed, then click Run Query.',
										value: sqlInput,
										onChange: setSqlInput,
										placeholder: 'SELECT ...',
										rows: 4,
									})
								),
								el(Button, {
									isSecondary: true,
									onClick: handleRunQuery,
									disabled: isLoading || !sqlInput.trim(),
								}, isLoading ? el(Spinner, {}) : (l10n.runQuery || 'Run Query'))
							)
						),

						// Results card.
						el('div', { className: 'silc-wia-card' },
							el('h2', null, l10n.results || 'Results'),

							queryInfo ? el('div', { className: 'silc-wia-query-info' },
								el('span', null, 'Query executed in ' + queryInfo.timeMs + 'ms'),
								el('span', null, queryInfo.rows + ' row(s) returned')
							) : null,

							renderSqlResults()
						)
					),

					// Right column: History + Schema.
					el('div', { className: 'silc-wia-right' },
						renderSqlHistoryCard(),
						renderSchemaCard()
					)
				);
			}

			// Insight mode layout.
			return el('div', { className: 'silc-wia-main-content' },

				// Left column: Input + Insight Results.
				el('div', { className: 'silc-wia-left' },

					// Insight input card.
					el('div', { className: 'silc-wia-card silc-wia-mb-3' },
						el('h2', null, 'Ask for an Insight'),
						el('div', { className: 'silc-wia-input-area' },
							el('div', { className: 'silc-wia-input-row' },
								el(TextControl, {
									placeholder: l10n.askQuestion || 'Ask a question about your WooCommerce data...',
									value: question,
									onChange: setQuestion,
									onKeyDown: function (e) {
										if (e.key === 'Enter' && !e.shiftKey) {
											e.preventDefault();
											handleGenerateInsight();
										}
									},
								}),
								el(Button, {
									isPrimary: true,
									onClick: handleGenerateInsight,
									disabled: isLoading || !question.trim() || !apiConfigured,
									title: !apiConfigured ? (l10n.apiNotConfigured || 'API not configured') : '',
								}, isLoading ? el(Spinner, {}) : (l10n.getInsight || 'Get Insight'))
							),
							!apiConfigured ? el('p', {
								style: { color: '#b32d2e', fontSize: '12px', marginTop: '4px' },
							}, l10n.apiNotConfigured || 'API not configured. Go to Settings to add your API key.') : null
						)
					),

					// Insight results card.
					el('div', { className: 'silc-wia-card' },
						el('h2', null, l10n.results || 'Results'),
						renderInsightResults()
					)
				),

				// Right column: Insight History.
				el('div', { className: 'silc-wia-right' },
					renderInsightHistoryCard()
				)
			);
		}

		// ------------------------------------------------------------------- //
		//  SIDEBAR CARDS
		// ------------------------------------------------------------------- //

		function renderSqlHistoryCard() {
			return el('div', { className: 'silc-wia-card silc-wia-mb-3' },
				el('div', {
					className: 'silc-wia-flex silc-wia-items-center silc-wia-gap-2',
					style: { justifyContent: 'space-between', marginBottom: '12px' },
				},
					el('h2', { style: { margin: 0, border: 'none', padding: 0 } }, l10n.history || 'Query History'),
					history.length > 0 ? el(Button, {
						isSmall: true,
						isDestructive: true,
						variant: 'link',
						onClick: handleClearHistory,
					}, l10n.clearHistory || 'Clear') : null
				),
				history.length > 0
					? el('div', { className: 'silc-wia-history-list' },
						history.map(function (item, idx) {
							return el('div', {
								key: item.id || idx,
								className: 'silc-wia-history-item',
								onClick: function () { handleLoadHistory(item); },
							},
								el('div', { className: 'question' }, item.question || '(Direct SQL)'),
								el('div', { className: 'sql-preview' }, item.sql || ''),
								item.time ? el('div', { className: 'time' }, item.time) : null
							);
						})
					)
					: el('p', { style: { color: '#787c82', fontSize: '13px' } }, 'No history yet.')
			);
		}

		function renderSchemaCard() {
			return el('div', { className: 'silc-wia-card' },
				el(Panel, null,
					el(PanelBody, {
						title: 'Database Schema Reference',
						initialOpen: false,
					},
						el('pre', {
							style: {
								fontSize: '11px',
								lineHeight: '1.4',
								maxHeight: '400px',
								overflow: 'auto',
								background: '#f6f7f7',
								padding: '8px',
								borderRadius: '4px',
							},
						}, schemaContext || 'Loading schema...')
					)
				)
			);
		}

		function renderInsightHistoryCard() {
			return el('div', { className: 'silc-wia-card' },
				el('div', {
					className: 'silc-wia-flex silc-wia-items-center silc-wia-gap-2',
					style: { justifyContent: 'space-between', marginBottom: '12px' },
				},
					el('h2', { style: { margin: 0, border: 'none', padding: 0 } }, l10n.insightHistory || 'Insight History'),
					insightHistory.length > 0 ? el(Button, {
						isSmall: true,
						isDestructive: true,
						variant: 'link',
						onClick: handleClearInsightHistory,
					}, l10n.clearInsightHistory || 'Clear') : null
				),
				insightHistory.length > 0
					? el('div', { className: 'silc-wia-history-list' },
						insightHistory.map(function (item, idx) {
							var typeLabel = item.type || '?';
							var typeIcon = '';
							if (typeLabel === 'chart') typeIcon = '\uD83D\uDCCA';
							else if (typeLabel === 'list') typeIcon = '\uD83D\uDCCB';
							else if (typeLabel === 'answer') typeIcon = '\u2139\uFE0F';

							return el('div', {
								key: item.id || idx,
								className: 'silc-wia-history-item',
								onClick: function () { handleLoadInsightHistory(item); },
							},
								el('div', { className: 'question' },
									typeIcon ? el('span', { style: { marginRight: '6px' } }, typeIcon) : null,
									item.question || '(Unknown)'
								),
								el('div', { className: 'sql-preview' }, 'Type: ' + typeLabel),
								item.time ? el('div', { className: 'time' }, item.time) : null
							);
						})
					)
					: el('p', { style: { color: '#787c82', fontSize: '13px' } }, l10n.noInsightHistory || 'No insight history yet.')
			);
		}

		// ------------------------------------------------------------------- //
		//  MAIN RENDER
		// ------------------------------------------------------------------- //

		return el('div', { className: 'silc-wia-dashboard' },

			// Error notice.
			error ? el(Notice, {
				status: 'error',
				isDismissible: true,
				onRemove: function () { setError(null); },
			}, error) : null,

			// Top row: API status + Mode tabs.
			el('div', { className: 'silc-wia-flex silc-wia-items-center silc-wia-gap-2 silc-wia-mb-3' },
				renderApiStatus()
			),

			// Mode switcher.
			el('div', { className: 'silc-wia-mode-tabs silc-wia-mb-3' },
				el(Button, {
					isPrimary: mode === 'sql',
					isSecondary: mode !== 'sql',
					onClick: function () { setMode('sql'); setError(null); },
					style: { marginRight: '8px' },
				}, l10n.sqlMode || 'SQL Mode'),
				el(Button, {
					isPrimary: mode === 'insight',
					isSecondary: mode !== 'insight',
					onClick: function () { setMode('insight'); setError(null); },
					disabled: !apiConfigured,
					title: !apiConfigured ? (l10n.apiNotConfigured || 'API not configured') : '',
				}, l10n.insightMode || 'Insight Mode')
			),

			// Mode content.
			renderModeContent(),

			// Footer.
			el('div', { className: 'silc-wia-footer' },
				'SILC WooInsight AI v' + (data.pluginVersion || '2.0.0'),
				' — ',
				mode === 'sql'
					? 'SQL queries are validated server-side. Only SELECT queries against WooCommerce tables are allowed.'
					: 'Insights are generated by AI, SQL validated server-side, and rendered automatically.',
				el('br'),
				'AI via ',
				el(ExternalLink, {
					href: 'https://platform.openai.com/docs/overview',
				}, 'OpenAI-compatible API'),
				'. ',
				el(ExternalLink, {
					href: settingsUrl,
				}, 'Configure API settings')
			)
		);
	}

	// ----------------------------------------------------------------------- //
	//  FALLBACK SQL GENERATOR (template-based, no API needed)
	// ----------------------------------------------------------------------- //

	function fallbackGenerateSQL(question) {
		var q = question.toLowerCase().trim();
		var prefix = 'wp_';

		// Top products.
		if (/top\s+(\d+)?\s*products?\b/i.test(q) && /(revenue|sales|earned|sold)/i.test(q)) {
			var limit = q.match(/top\s+(\d+)/i);
			var l = limit ? parseInt(limit[1], 10) : 10;
			return 'SELECT p.ID AS product_id, p.post_title AS product_name,\n       SUM( oim.meta_value ) AS total_sales\nFROM ' + prefix + 'posts AS p\nLEFT JOIN ' + prefix + 'woocommerce_order_items AS oi ON oi.order_id IN (\n    SELECT ID FROM ' + prefix + 'posts WHERE post_type = \'shop_order\'\n)\nLEFT JOIN ' + prefix + 'woocommerce_order_itemmeta AS oim ON oim.order_item_id = oi.order_item_id AND oim.meta_key = \'_line_total\'\nWHERE p.post_type = \'product\' AND p.post_status = \'publish\'\nGROUP BY p.ID\nORDER BY total_sales DESC\nLIMIT ' + l + ';';
		}

		// Order count / total orders.
		if (/how\s+many\s+orders/i.test(q) || /total\s+orders/i.test(q) || /order\s+count/i.test(q)) {
			var statusFilter = '';
			if (/completed/i.test(q)) statusFilter = " AND p.post_status = 'wc-completed'";
			if (/pending/i.test(q)) statusFilter = " AND p.post_status = 'wc-pending'";
			if (/processing/i.test(q)) statusFilter = " AND p.post_status = 'wc-processing'";
			return 'SELECT COUNT(*) AS order_count\nFROM ' + prefix + 'posts AS p\nWHERE p.post_type = \'shop_order\'' + (statusFilter || " AND p.post_status LIKE 'wc-%'") + ';';
		}

		// Revenue / earnings.
		if (/(revenue|earnings|total\s*sales|income)/i.test(q)) {
			if (/today/i.test(q)) {
				return 'SELECT COALESCE( SUM( meta.meta_value ), 0 ) AS total_revenue_today\nFROM ' + prefix + 'posts AS p\nLEFT JOIN ' + prefix + 'postmeta AS meta ON p.ID = meta.post_id AND meta.meta_key = \'_order_total\'\nWHERE p.post_type = \'shop_order\'\n  AND p.post_status IN ( \'wc-completed\', \'wc-processing\' )\n  AND DATE( p.post_date ) = CURDATE();';
			}
			if (/this\s+month/i.test(q) || /current\s+month/i.test(q)) {
				return 'SELECT COALESCE( SUM( meta.meta_value ), 0 ) AS total_revenue_this_month\nFROM ' + prefix + 'posts AS p\nLEFT JOIN ' + prefix + 'postmeta AS meta ON p.ID = meta.post_id AND meta.meta_key = \'_order_total\'\nWHERE p.post_type = \'shop_order\'\n  AND p.post_status IN ( \'wc-completed\', \'wc-processing\' )\n  AND YEAR( p.post_date ) = YEAR( CURDATE() )\n  AND MONTH( p.post_date ) = MONTH( CURDATE() );';
			}
			return 'SELECT COALESCE( SUM( meta.meta_value ), 0 ) AS total_revenue\nFROM ' + prefix + 'posts AS p\nLEFT JOIN ' + prefix + 'postmeta AS meta ON p.ID = meta.post_id AND meta.meta_key = \'_order_total\'\nWHERE p.post_type = \'shop_order\'\n  AND p.post_status IN ( \'wc-completed\', \'wc-processing\' );';
		}

		// Products low in stock.
		if (/(low\s+stock|out\s+of\s+stock|stock\s+status|inventory)/i.test(q)) {
			return 'SELECT p.ID, p.post_title AS product_name,\n       pm_stock.meta_value AS stock_quantity,\n       pm_status.meta_value AS stock_status\nFROM ' + prefix + 'posts AS p\nLEFT JOIN ' + prefix + 'postmeta AS pm_stock ON p.ID = pm_stock.post_id AND pm_stock.meta_key = \'_stock\'\nLEFT JOIN ' + prefix + 'postmeta AS pm_status ON p.ID = pm_status.post_id AND pm_status.meta_key = \'_stock_status\'\nWHERE p.post_type = \'product\' AND p.post_status = \'publish\'\n  AND ( CAST( pm_stock.meta_value AS UNSIGNED ) <= 5 OR pm_status.meta_value = \'outofstock\' )\nORDER BY CAST( pm_stock.meta_value AS UNSIGNED ) ASC\nLIMIT 20;';
		}

		// Customers / user count.
		if (/(customers|users)\s+(count|total|number|how\s+many)/i.test(q) || /total\s+customers/i.test(q)) {
			return 'SELECT COUNT(*) AS total_customers\nFROM ' + prefix + 'users AS u\nINNER JOIN ' + prefix + 'usermeta AS um ON u.ID = um.user_id AND um.meta_key = \'' + prefix + 'capabilities\'\nWHERE um.meta_value LIKE \'%customer%\';';
		}

		// Products by category.
		if (/products?\s+(by|in|per)\s+category/i.test(q) || /category/i.test(q)) {
			return 'SELECT t.name AS category, COUNT(tr.object_id) AS product_count\nFROM ' + prefix + 'term_taxonomy AS tt\nINNER JOIN ' + prefix + 'terms AS t ON tt.term_id = t.term_id\nINNER JOIN ' + prefix + 'term_relationships AS tr ON tt.term_taxonomy_id = tr.term_taxonomy_id\nINNER JOIN ' + prefix + 'posts AS p ON tr.object_id = p.ID\nWHERE tt.taxonomy = \'product_cat\' AND p.post_type = \'product\' AND p.post_status = \'publish\'\nGROUP BY t.term_id\nORDER BY product_count DESC;';
		}

		// Recent orders.
		if (/recent\s+orders/i.test(q) || /latest\s+orders/i.test(q)) {
			var limit2 = q.match(/(\d+)/i);
			var l2 = limit2 ? parseInt(limit2[1], 10) : 10;
			return 'SELECT p.ID AS order_id, p.post_date, p.post_status,\n       pm_total.meta_value AS order_total,\n       pm_email.meta_value AS billing_email\nFROM ' + prefix + 'posts AS p\nLEFT JOIN ' + prefix + 'postmeta AS pm_total ON p.ID = pm_total.post_id AND pm_total.meta_key = \'_order_total\'\nLEFT JOIN ' + prefix + 'postmeta AS pm_email ON p.ID = pm_email.post_id AND pm_email.meta_key = \'_billing_email\'\nWHERE p.post_type = \'shop_order\'\nORDER BY p.post_date DESC\nLIMIT ' + l2 + ';';
		}

		// Average order value.
		if (/average\s+order\s+value/i.test(q) || /avg\s+order/i.test(q) || /aov/i.test(q)) {
			return 'SELECT COALESCE( AVG( meta.meta_value ), 0 ) AS average_order_value\nFROM ' + prefix + 'posts AS p\nLEFT JOIN ' + prefix + 'postmeta AS meta ON p.ID = meta.post_id AND meta.meta_key = \'_order_total\'\nWHERE p.post_type = \'shop_order\'\n  AND p.post_status IN ( \'wc-completed\', \'wc-processing\' );';
		}

		// Best selling categories.
		if (/best\s+selling\s+categories/i.test(q) || /top\s+categories/i.test(q)) {
			return 'SELECT t.name AS category, COUNT(tr.object_id) AS products_sold\nFROM ' + prefix + 'term_taxonomy AS tt\nINNER JOIN ' + prefix + 'terms AS t ON tt.term_id = t.term_id\nINNER JOIN ' + prefix + 'term_relationships AS tr ON tt.term_taxonomy_id = tr.term_taxonomy_id\nINNER JOIN ' + prefix + 'posts AS p ON tr.object_id = p.ID\nINNER JOIN ' + prefix + 'wc_product_meta_lookup AS l ON p.ID = l.product_id\nWHERE tt.taxonomy = \'product_cat\' AND p.post_type = \'product\' AND p.post_status = \'publish\'\nGROUP BY t.term_id\nORDER BY SUM(l.total_sales) DESC\nLIMIT 10;';
		}

		// Order stats / analytics.
		if (/order\s+stats/i.test(q) || /analytics/i.test(q)) {
			return 'SELECT *\nFROM ' + prefix + 'wc_order_stats\nORDER BY date_created_gmt DESC\nLIMIT 20;';
		}

		// Default fallback - list products.
		return 'SELECT p.ID, p.post_title, p.post_date, p.post_status,\n       l.sku, l.min_price, l.max_price, l.stock_status, l.total_sales\nFROM ' + prefix + 'posts AS p\nLEFT JOIN ' + prefix + 'wc_product_meta_lookup AS l ON p.ID = l.product_id\nWHERE p.post_type = \'product\' AND p.post_status = \'publish\'\nORDER BY p.post_date DESC\nLIMIT 50;';
	}

	// ----------------------------------------------------------------------- //
	//  MOUNT
	// ----------------------------------------------------------------------- //

	var rootElement = document.getElementById('silc-wia-dashboard');
	if (rootElement) {
		wp.element.render(el(WooInsightDashboard), rootElement);
	}

})(window.wp);
