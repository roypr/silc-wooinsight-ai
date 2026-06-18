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
 * Render a list result.
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
	});

	return el('div', { className: 'silc-wia-result-list', key: 'list' }, items);
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

	return el('div', { className: 'silc-wia-result-answer', key: 'answer' },
		answerValue ? el('div', { className: 'silc-wia-result-answer-value' }, String(answerValue)) : null,
		answerLabel ? el('div', { className: 'silc-wia-result-answer-label' }, String(answerLabel)) : null,
		answerText ? el('div', { className: 'silc-wia-result-answer-text' }, answerText) : null
	);
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
		titleBarItems.push(
			el('div', { key: 'title', className: 'silc-wia-result-title' }, insightData.title)
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
