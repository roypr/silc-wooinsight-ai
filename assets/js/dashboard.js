/**
 * SILC WooInsight AI - React Dashboard
 *
 * Uses @wordpress/element (React) and @wordpress/components for the UI.
 * Integrates Transformer.js for browser-side AI model inference.
 *
 * @package SILC_WooInsight_AI
 */

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
	var SnackbarList = wp.components.SnackbarList;
	var Panel = wp.components.Panel;
	var PanelBody = wp.components.PanelBody;
	var PanelRow = wp.components.PanelRow;
	var TabPanel = wp.components.TabPanel;
	var Notice = wp.components.Notice;
	var Card = wp.components.Card;
	var CardHeader = wp.components.CardHeader;
	var CardBody = wp.components.CardBody;
	var Icon = wp.components.Icon;
	var Dashicon = wp.components.Dashicon;
	var Modal = wp.components.Modal;
	var DropdownMenu = wp.components.DropdownMenu;

	// ----------------------------------------------------------------------- //
	//  DATA
	// ----------------------------------------------------------------------- //

	var data = window.silcWiaData || {};
	var ajaxUrl = data.ajaxUrl || '';
	var nonce = data.nonce || '';
	var l10n = data.l10n || {};

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
	//  TRANSFORMER.JS LOADER
	// ----------------------------------------------------------------------- //

	/**
	 * Load Transformer.js from CDN and attempt to initialize the model.
	 */
	function createModelLoader() {
		var modelLoaded = false;
		var modelError = null;
		var pipeline = null;
		var loading = false;

		return {
			getStatus: function () {
				if (loading) return 'loading';
				if (modelLoaded) return 'ready';
				if (modelError) return 'error';
				return 'idle';
			},
			getError: function () { return modelError; },
			isReady: function () { return modelLoaded; },
			getPipeline: function () { return pipeline; },

			load: function () {
				if (loading || modelLoaded) return;
				loading = true;

				var self = this;

				// Step 1: Dynamically import @huggingface/transformers as an ES module.
				import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0')
					.then(function (module) {
						var pipelineFn = module.pipeline;

						// Step 2: Create a text-generation pipeline using the ONNX model.
						var modelId = 'onnx-community/Qwen2.5-Coder-0.5B-Instruct';

						return pipelineFn('text-generation', modelId, {
							quantized: true,
							device: 'wasm',
						});
					})
					.then(function (pipe) {
						pipeline = pipe;
						modelLoaded = true;
						loading = false;
						console.log('SILC WooInsight AI: Model loaded successfully.');
					})
					.catch(function (err) {
						modelError = err.message || 'Unknown error loading model.';
						loading = false;
						console.warn('SILC WooInsight AI: Model load failed -', modelError);
					});
			},

			/**
			 * Generate SQL from a user question using the loaded model.
			 * Falls back to a simple template-based approach if model isn't available.
			 */
			generateSQL: function (question, schemaContext) {
				if (!modelLoaded || !pipeline) {
					return Promise.reject(new Error('Model not loaded.'));
				}

				var prompt = schemaContext + '\n\nUSER QUESTION: ' + question + '\n\nGenerate ONLY the SQL query:';

				return pipeline(prompt, {
					max_new_tokens: 300,
					temperature: 0.2,
					do_sample: false,
				}).then(function (result) {
					var text = result[0].generated_text || '';
					// Extract just the SQL part (after the prompt).
					var sql = text.substring(text.indexOf('SELECT'));
					sql = sql.split('\n')[0]; // First line only.
					// Clean up.
					sql = sql.replace(/```sql|```/gi, '').trim();
					return sql;
				});
			},
		};
	}

	// ----------------------------------------------------------------------- //
	//  MAIN DASHBOARD COMPONENT
	// ----------------------------------------------------------------------- //

	function WooInsightDashboard() {
		var _useState = useState('');
		var question = _useState[0];
		var setQuestion = _useState[1];

		var _useState2 = useState('');
		var sqlInput = _useState2[0];
		var setSqlInput = _useState2[1];

		var _useState3 = useState(null);
		var results = _useState3[0];
		var setResults = _useState3[1];

		var _useState4 = useState(false);
		var isLoading = _useState4[0];
		var setLoading = _useState4[1];

		var _useState5 = useState(null);
		var queryInfo = _useState5[0];
		var setQueryInfo = _useState5[1];

		var _useState6 = useState(null);
		var error = _useState6[0];
		var setError = _useState6[1];

		var _useState7 = useState([]);
		var history = _useState7[0];
		var setHistory = _useState7[1];

		var _useState8 = useState('idle');
		var modelStatus = _useState8[0];
		var setModelStatus = _useState8[1];

		var _useState9 = useState('');
		var schemaContext = _useState9[0];
		var setSchemaContext = _useState9[1];

		var modelLoaderRef = useRef(null);
		var schemaLoadedRef = useRef(false);

		// Initialize: load schema and model.
		useEffect(function () {
			// Load schema context from server.
			doAction('get_schema').then(function (resp) {
				if (resp.success && resp.data) {
					setSchemaContext(resp.data.context || '');
					schemaLoadedRef.current = true;
				}
			}).catch(function () {
				// Silently fail - manual SQL entry still works.
			});

			// Load query history.
			doAction('get_history').then(function (resp) {
				if (resp.success && resp.data) {
					setHistory(resp.data.history || []);
				}
			}).catch(function () { });

			// Initialize model loader.
			var loader = createModelLoader();
			modelLoaderRef.current = loader;

			// Attempt to load the model (async, non-blocking).
			loader.load();

			// Poll model status.
			var interval = setInterval(function () {
				var status = loader.getStatus();
				setModelStatus(status);
				if (status === 'ready' || status === 'error') {
					clearInterval(interval);
				}
			}, 500);

			return function () { clearInterval(interval); };
		}, []);

		/**
		 * Generate SQL from natural language using the AI model (or fallback).
		 */
		var handleGenerateSQL = useCallback(function () {
			if (!question.trim()) {
				setError(l10n.enterQuestion || 'Please enter a question.');
				return;
			}

			setLoading(true);
			setError(null);

			var loader = modelLoaderRef.current;

			if (loader && loader.isReady()) {
				// Use the model.
				loader.generateSQL(question, schemaContext)
					.then(function (sql) {
						if (!sql || !sql.toUpperCase().startsWith('SELECT')) {
							// Model didn't produce valid SQL, use fallback.
							sql = fallbackGenerateSQL(question);
						}
						setSqlInput(sql);
						setLoading(false);
					})
					.catch(function () {
						// Fallback to template-based generation.
						var sql = fallbackGenerateSQL(question);
						setSqlInput(sql);
						setLoading(false);
					});
			} else {
				// Model not loaded - use fallback.
				setTimeout(function () {
					var sql = fallbackGenerateSQL(question);
					setSqlInput(sql);
					setLoading(false);
				}, 300);
			}
		}, [question, schemaContext]);

		/**
		 * Execute the SQL query.
		 */
		var handleRunQuery = useCallback(function () {
			if (!sqlInput.trim()) {
				setError(l10n.invalidSQL || 'No SQL to execute.');
				return;
			}

			setLoading(true);
			setError(null);
			setResults(null);
			setQueryInfo(null);

			doAction('execute_query', { sql: sqlInput })
				.then(function (resp) {
					setLoading(false);
					if (resp.success && resp.data) {
						setResults(resp.data.data || []);
						setQueryInfo({
							sql: resp.data.sql || sqlInput,
							timeMs: resp.data.time_ms || 0,
							rows: resp.data.rows || (resp.data.data ? resp.data.data.length : 0),
						});

						// Save to history.
						doAction('save_history', {
							question: question,
							sql: resp.data.sql || sqlInput,
							label: question.substring(0, 100),
						}).then(function (hResp) {
							if (hResp.success && hResp.data) {
								setHistory(hResp.data.history || []);
							}
						}).catch(function () { });
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

		/**
		 * Load a history item.
		 */
		var handleLoadHistory = useCallback(function (item) {
			setQuestion(item.question || '');
			setSqlInput(item.sql || '');
		}, []);

		/**
		 * Clear all history.
		 */
		var handleClearHistory = useCallback(function () {
			doAction('clear_history').then(function (resp) {
				if (resp.success) {
					setHistory([]);
				}
			}).catch(function () { });
		}, []);

		/**
		 * Render the results table or JSON.
		 */
		function renderResults() {
			if (!results) {
				return el('p', { className: 'silc-wia-muted' }, l10n.noResults || 'Run a query to see results.');
			}

			if (results.length === 0) {
				return el('p', {}, l10n.noResults || 'No results found.');
			}

			var columns = Object.keys(results[0]);

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
						results.map(function (row, idx) {
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
				JSON.stringify(results, null, 2)
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

		/**
		 * Render the model status indicator.
		 */
		function renderModelStatus() {
			var statusMap = {
				'idle': { text: 'AI: Idle', className: 'loading' },
				'loading': { text: 'AI: Loading model...', className: 'loading' },
				'ready': { text: 'AI: Ready', className: 'ready' },
				'error': { text: 'AI: Unavailable (using fallback)', className: 'error' },
			};

			var info = statusMap[modelStatus] || statusMap.idle;
			return el('span', { className: 'silc-wia-model-status ' + info.className }, info.text);
		}

		return el('div', { className: 'silc-wia-dashboard' },

			// Error notice.
			error ? el(Notice, {
				status: 'error',
				isDismissible: true,
				onRemove: function () { setError(null); },
			}, error) : null,

			// Top row: model status + info.
			el('div', { className: 'silc-wia-flex silc-wia-items-center silc-wia-gap-2 silc-wia-mb-3' },
				renderModelStatus()
			),

			// Main content grid.
			el('div', { className: 'silc-wia-main-content' },

				// Left column: Input + Results.
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

						renderResults()
					)
				),

				// Right column: History + Schema.
				el('div', { className: 'silc-wia-right' },

					// History card.
					el('div', { className: 'silc-wia-card silc-wia-mb-3' },
						el('div', { className: 'silc-wia-flex silc-wia-items-center silc-wia-gap-2', style: { justifyContent: 'space-between', marginBottom: '12px' } },
							el('h2', { style: { margin: 0, border: 'none', padding: 0 } }, l10n.history || 'Query History'),
							history.length > 0 ? el(Button, {
								isSmall: true,
								isDestructive: true,
								variant: 'link',
								onClick: handleClearHistory,
							}, l10n.clearHistory || 'Clear') : null
						),
						history.length > 0 ? el('div', { className: 'silc-wia-history-list' },
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
						) : el('p', { style: { color: '#787c82', fontSize: '13px' } }, 'No history yet.')
					),

					// Schema card (collapsible).
					el('div', { className: 'silc-wia-card' },
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
					)
				)
			),

			// Footer.
			el('div', { className: 'silc-wia-footer' },
				'SILC WooInsight AI v' + (data.pluginVersion || '1.0.0'),
				' — ',
				'SQL queries are validated server-side. Only SELECT queries against WooCommerce tables are allowed.',
				el('br'),
				'AI model: ',
				el('a', {
					href: 'https://huggingface.co/onnx-community/Qwen2.5-Coder-0.5B-Instruct',
					target: '_blank',
					rel: 'noopener noreferrer',
				}, 'Qwen2.5-Coder-0.5B-Instruct'),
				' via ',
				el('a', {
					href: 'https://huggingface.co/docs/transformers.js/en/index',
					target: '_blank',
					rel: 'noopener noreferrer',
				}, 'Transformers.js')
			)
		);
	}

	// ----------------------------------------------------------------------- //
	//  FALLBACK SQL GENERATOR (template-based, no AI model)
	// ----------------------------------------------------------------------- //

	function fallbackGenerateSQL(question) {
		var q = question.toLowerCase().trim();
		var prefix = 'wp_'; // Will be adjusted server-side.

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

		// Default: generic query using wc_order_stats.
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
