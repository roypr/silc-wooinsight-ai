/**
 * SILC WooInsight AI — Result renderers (chart, list, answer)
 *
 * @package SILC_WooInsight_AI
 */

/* global wp */

import { l10n } from './utils.js';

var el = wp.element.createElement;
var Button = wp.components.Button;
var Spinner = wp.components.Spinner;

/**
 * Render a chart result.
 *
 * @param {Object} insightData
 * @return {Object|null} Element.
 */
export function renderChartResult(insightData) {
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

/**
 * Render a list result with type-specific templates.
 *
 * Each row is enriched by the server with:
 *   _row_type  – 'order', 'product', 'customer', 'coupon', 'generic'
 *   _labels    – { col: 'Readable Label' }
 *   _formatted – { col: 'Formatted Value' }  (timestamps, etc.)
 *   _links     – { col: url }
 *
 * @param {Object} insightData
 * @return {Object|null} Element.
 */
export function renderListResult(insightData) {
	var listData = insightData.list_data;
	var listConfig = insightData.list_config;

	if (!listData || listData.length === 0) {
		return el('p', { key: 'list-empty', className: 'silc-wia-muted' }, 'No list data available.');
	}

	// Determine display columns (skip internal meta columns).
	var displayCols = [];
	if (listConfig && listConfig.display_columns && listConfig.display_columns.length > 0) {
		displayCols = listConfig.display_columns;
	} else if (listData.length > 0) {
		displayCols = Object.keys(listData[0]).filter(function (c) {
			return c.charAt(0) !== '_';
		});
	}

	var items = listData.map(function (row, idx) {
		return renderListItem(row, idx, displayCols, listConfig);
	});

	return el('div', { className: 'silc-wia-result-list', key: 'list' }, items);
}

/**
 * Dispatch a single row to the appropriate template based on _row_type.
 *
 * @param {Object} row          The enriched row data.
 * @param {number} idx          Row index.
 * @param {Array}  displayCols  Column names to display.
 * @return {Object} Element.
 */
function renderListItem(row, idx, displayCols, listConfig) {
	var rowType = row._row_type || 'generic';
	switch (rowType) {
		case 'order':
			return renderOrderItem(row, idx, displayCols, listConfig);
		case 'product':
			return renderProductItem(row, idx, displayCols, listConfig);
		case 'customer':
			return renderCustomerItem(row, idx, displayCols, listConfig);
		default:
			return renderGenericItem(row, idx, displayCols, listConfig);
	}
}
/**
 *   Title: "Order #123" linked to order edit.
 *   Details: customer_name, status, total, date, etc.
 */
function renderOrderItem(row, idx, displayCols) {
	var labels = row._labels || {};
	var formatted = row._formatted || {};
	var links = row._links || {};

	// Determine the order link and ID.
	var orderUrl = null;
	var orderId = row.order_id || '';

	if (row._links && row._links.order_id) {
		orderUrl = row._links.order_id;
	} else {
		// Fallback: try first link value.
		var linkKeys = Object.keys(links);
		if (linkKeys.length > 0) {
			orderUrl = links[linkKeys[0]];
		}
	}

	var titleEl;
	if (orderUrl) {
		titleEl = el('a', {
			href: orderUrl,
			target: '_blank',
			rel: 'noopener noreferrer',
			className: 'silc-wia-list-item-link',
		}, 'Order #' + orderId);
	} else {
		titleEl = el('span', null, orderId ? ('Order #' + orderId) : ('Item ' + (idx + 1)));
	}

	var details = [];
	displayCols.forEach(function (col) {
		if (col === 'order_id' || col.charAt(0) === '_') return;
		var val = formatted[col] !== undefined ? formatted[col] : (row[col] != null ? String(row[col]) : '');
		var label = labels[col] || col;
		details.push(
			el('span', { className: 'silc-wia-list-detail', key: col },
				el('span', { className: 'silc-wia-list-detail-label' }, label + ': '),
				el('span', { className: 'silc-wia-list-detail-value' }, val)
			)
		);
	});

	return el('div', { className: 'silc-wia-list-item silc-wia-list-item--order', key: idx },
		el('div', { className: 'silc-wia-list-item-title' }, titleEl),
		details.length > 0 ? el('div', { className: 'silc-wia-list-item-details' }, details) : null
	);
}

/**
 * Render a product row.
 *   Left: fixed-width thumbnail placeholder (populated if _thumbnail exists).
 *   Right: title + details.
 */
function renderProductItem(row, idx, displayCols, listConfig) {
	var labels = row._labels || {};
	var formatted = row._formatted || {};
	var links = row._links || {};

	// Find product link.
	var productUrl = null;
	if (row._links && row._links.product_id) {
		productUrl = row._links.product_id;
	} else if (row._links && row._links.variation_id) {
		productUrl = row._links.variation_id;
	} else {
		var linkKeys = Object.keys(links);
		if (linkKeys.length > 0) {
			productUrl = links[linkKeys[0]];
		}
	}

	// Use a name-like column as title (check listConfig.title_column first).
	var titleCol = null;
	if (listConfig && listConfig.title_column && row[listConfig.title_column] != null && row[listConfig.title_column] !== '') {
		titleCol = listConfig.title_column;
	} else {
		titleCol = findTitleCol(row, displayCols, ['product_name', 'name', 'post_title', 'product']);
	}
	var titleText = titleCol ? (row[titleCol] || '') : ('Product ' + (idx + 1));

	var titleEl;
	if (productUrl) {
		titleEl = el('a', {
			href: productUrl,
			target: '_blank',
			rel: 'noopener noreferrer',
			className: 'silc-wia-list-item-link',
		}, String(titleText));
	} else {
		titleEl = el('span', null, String(titleText));
	}

	var details = [];
	displayCols.forEach(function (col) {
		if (col === titleCol || col === 'product_id' || col === 'variation_id' || col.charAt(0) === '_') return;
		var val = formatted[col] !== undefined ? formatted[col] : (row[col] != null ? String(row[col]) : '');
		var label = labels[col] || col;
		details.push(
			el('span', { className: 'silc-wia-list-detail', key: col },
				el('span', { className: 'silc-wia-list-detail-label' }, label + ': '),
				el('span', { className: 'silc-wia-list-detail-value' }, val)
			)
		);
	});

	// Thumbnail: always show fixed-width placeholder, populate if URL exists.
	var thumbUrl = row._thumbnail || '';
	var thumbEl;
	if (thumbUrl) {
		thumbEl = el('div', { className: 'silc-wia-list-thumb' },
			el('img', {
				src: thumbUrl,
				alt: '',
				className: 'silc-wia-list-thumb-img',
				onError: function (e) {
					// Remove the broken image, show gray placeholder.
					e.target.style.display = 'none';
					e.target.parentNode.classList.add('silc-wia-list-thumb--fallback');
				},
			})
		);
	} else {
		thumbEl = el('div', { className: 'silc-wia-list-thumb silc-wia-list-thumb--fallback' });
	}

	return el('div', { className: 'silc-wia-list-item silc-wia-list-item--product', key: idx },
		thumbEl,
		el('div', { className: 'silc-wia-list-item-body' },
			el('div', { className: 'silc-wia-list-item-title' }, titleEl),
			details.length > 0 ? el('div', { className: 'silc-wia-list-item-details' }, details) : null
		)
	);
}

/**
 * Render a customer / user row.
 *   Title: customer name linked to user edit.
 *   Details: email, orders_count, total_spent, etc.
 */
function renderCustomerItem(row, idx, displayCols) {
	var labels = row._labels || {};
	var formatted = row._formatted || {};
	var links = row._links || {};

	// Find user link.
	var userUrl = null;
	if (row._links && row._links.customer_id) {
		userUrl = row._links.customer_id;
	} else if (row._links && row._links.user_id) {
		userUrl = row._links.user_id;
	} else {
		var linkKeys = Object.keys(links);
		if (linkKeys.length > 0) {
			userUrl = links[linkKeys[0]];
		}
	}

	// Use a name-like column as title.
	var titleCol = findTitleCol(row, displayCols, ['customer_name', 'display_name', 'user_name', 'name', 'user_email', 'email', 'billing_email']);
	var titleText = titleCol ? (row[titleCol] || '') : ('Customer ' + (idx + 1));

	var titleEl;
	if (userUrl) {
		titleEl = el('a', {
			href: userUrl,
			target: '_blank',
			rel: 'noopener noreferrer',
			className: 'silc-wia-list-item-link',
		}, String(titleText));
	} else {
		titleEl = el('span', null, String(titleText));
	}

	var details = [];
	displayCols.forEach(function (col) {
		if (col === titleCol || col === 'customer_id' || col === 'user_id' || col.charAt(0) === '_') return;
		var val = formatted[col] !== undefined ? formatted[col] : (row[col] != null ? String(row[col]) : '');
		var label = labels[col] || col;
		details.push(
			el('span', { className: 'silc-wia-list-detail', key: col },
				el('span', { className: 'silc-wia-list-detail-label' }, label + ': '),
				el('span', { className: 'silc-wia-list-detail-value' }, val)
			)
		);
	});

	return el('div', { className: 'silc-wia-list-item silc-wia-list-item--customer', key: idx },
		el('div', { className: 'silc-wia-list-item-title' }, titleEl),
		details.length > 0 ? el('div', { className: 'silc-wia-list-item-details' }, details) : null
	);
}

/**
 * Render a generic row (default fallback).
 *   Title: first available value or "Item N".
 *   Details: all non-meta columns.
 */
function renderGenericItem(row, idx, displayCols, listConfig) {
	var labels = row._labels || {};
	var formatted = row._formatted || {};

	// Use listConfig.title_column first, then first non-meta column.
	var titleCol = null;
	if (listConfig && listConfig.title_column && row[listConfig.title_column] != null && row[listConfig.title_column] !== '') {
		titleCol = listConfig.title_column;
	} else {
		titleCol = displayCols.length > 0 ? displayCols[0] : null;
	}
	var titleText = titleCol ? (row[titleCol] || '') : ('Item ' + (idx + 1));

	var details = [];
	displayCols.forEach(function (col) {
		if (col === titleCol || col.charAt(0) === '_') return;
		var val = formatted[col] !== undefined ? formatted[col] : (row[col] != null ? String(row[col]) : '');
		var label = labels[col] || col;
		details.push(
			el('span', { className: 'silc-wia-list-detail', key: col },
				el('span', { className: 'silc-wia-list-detail-label' }, label + ': '),
				el('span', { className: 'silc-wia-list-detail-value' }, val)
			)
		);
	});

	// Links row.
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
					}, '🔗 ' + linkCol)
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
}

/**
 * Find the best title column from a row by checking preferred names.
 *
 * @param {Object} row        The row data.
 * @param {Array}  candidates Column names to check.
 * @return {string|null} The first matching column, or null.
 */
function findTitleCol(row, displayCols, candidates) {
	for (var i = 0; i < candidates.length; i++) {
		if (displayCols.indexOf(candidates[i]) !== -1 && row[candidates[i]] != null && row[candidates[i]] !== '') {
			return candidates[i];
		}
	}
	return null;
}

/**
 * Render an answer result.
 *
 * @param {Object} insightData
 * @return {Object} Element.
 */
export function renderAnswerResult(insightData) {
	var answerText = insightData.answer_text || '';
	var answerValue = insightData.answer_value || '';
	var answerLabel = insightData.answer_label || '';

	var displayText;
	if (answerText && answerLabel && answerText.indexOf('{{' + answerLabel + '}}') !== -1) {
		// Replace {{answerLabel}} placeholder with the actual answer value.
		displayText = answerText.replace('{{' + answerLabel + '}}', answerValue);
	} else {
		// If no proper placeholder found, just show the value without context.
		displayText = answerValue;
	}

	return el('div', { className: 'silc-wia-result-answer', key: 'answer' },
		displayText ? el('div', { className: 'silc-wia-result-answer-text' }, String(displayText)) : null
	);
}

/**
 * Apply placeholder replacement to a title string.
 * If the title contains a {{column_name}} pattern, replace it with answerValue.
 * Otherwise return the raw title.
 *
 * @param {string} title
 * @param {string} answerValue
 * @return {string}
 */
function resolveTitle(title, answerValue) {
	if (!title) return '';
	var match = title.match(/\{\{(.+?)\}\}/);
	if (match) {
		return title.replace(match[0], answerValue || '');
	}
	return title;
}

/**
 * Render the full insight result area.
 *
 * @param {Object}   props
 * @param {Object|null} props.insightData
 * @param {string}   props.question
 * @param {Function} props.handleAsk
 * @param {Function} props.handleRefresh
 * @param {boolean}  props.isLoading
 * @return {Object|null} Element.
 */
export function renderResult(props) {
	var insightData = props.insightData;
	var handleRefresh = props.handleRefresh;
	if (!insightData) return null;

	var parts = [];

	// Title bar with refresh button.
	var titleBarItems = [];

	if (insightData.title) {
		var resolvedTitle = resolveTitle(insightData.title, insightData.answer_value);
		titleBarItems.push(
			el('div', { key: 'title', className: 'silc-wia-result-title' }, resolvedTitle)
		);
	}
	// Refresh button.
	if (insightData.sql) {
		titleBarItems.push(
			el(Button, {
				key: 'refresh',
				onClick: function () { handleRefresh(insightData); },
				disabled: props.isLoading,
			}, props.isLoading
				? el(Spinner, {})
				: el('span', { className: 'silc-wia-btn-content' },
					el('span', { className: 'dashicons dashicons-update' }),
					el('span', { className: 'silc-wia-btn-label' }, l10n.refresh || 'Refresh')
				)
			)
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
			parts.push(renderChartResult(insightData));
			break;
		case 'list':
			parts.push(renderListResult(insightData));
			break;
		case 'answer':
		default:
			parts.push(renderAnswerResult(insightData));
			break;
	}

	return el('div', null, parts);
}
