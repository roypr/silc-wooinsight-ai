/**
 * SILC WooInsight AI — Side panel renderers (SQL, History, Guides, Suggested)
 *
 * @package SILC_WooInsight_AI
 */

/* global wp */

import { l10n, GUIDE_SECTIONS, SUGGESTED_PROMPTS } from './utils.js';

var el = wp.element.createElement;
var Button = wp.components.Button;

/**
 * Get the title for a panel key.
 *
 * @param {string} panel Panel key.
 * @return {string} Title.
 * */

export function getPanelTitle(panel) {
	var titles = {
		sql: l10n.sqlDetails || 'SQL & Details',
		history: l10n.history || 'History',
		guides: l10n.guides || 'Guides',
		suggested: l10n.suggestedPrompts || 'Suggested Prompts',
		settings: l10n.settings || 'Settings',
	};
	return titles[panel] || panel;
}

/**
 * Render the SQL details panel.
 *
 * @param {Object}  props
 * @param {boolean} props.hasRun
 * @param {boolean} props.isLoading
 * @param {Object|null} props.insightData
 * @return {Object|null} Element.
 */
export function renderSqlPanel(props) {
	if (!props.hasRun) {
		return el('p', { className: 'silc-wia-muted' }, 'Ask a question first \u2014 the generated SQL and execution details will appear here.');
	}

	if (props.isLoading) {
		return el('p', { className: 'silc-wia-muted' }, 'Generating...');
	}

	if (!props.insightData) {
		return el('p', { className: 'silc-wia-muted' }, 'No SQL to show yet.');
	}

	var parts = [];
	var insightData = props.insightData;

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

	return el('div', null, parts);
}

/**
 * Render the History panel.
 *
 * @param {Object}   props
 * @param {Array}    props.insightHistory
 * @param {Function} props.handleLoadHistory
 * @param {Function} props.handleClearHistory
 * @return {Object} Element.
 */
export function renderHistoryPanel(props) {
	var items = [];

	if (!props.insightHistory || props.insightHistory.length === 0) {
		items.push(el('p', { key: 'empty', className: 'silc-wia-muted' }, l10n.noInsightHistory || 'No insight history yet.'));
	} else {
		items.push(
			el('div', { key: 'clear', style: { textAlign: 'right', marginBottom: '8px' } },
				el(Button, {
					isSmall: true,
					isDestructive: true,
					variant: 'link',
					onClick: props.handleClearHistory,
				}, l10n.clearHistory || 'Clear')
			)
		);

		props.insightHistory.forEach(function (item, idx) {
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
					onClick: function () { props.handleLoadHistory(item); },
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

/**
 * Render the Guides panel.
 *
 * @param {Object}   props
 * @param {Function} props.setQuestion
 * @param {Function} props.setActivePanel
 * @param {Function} props.handleAsk
 * @return {Object} Element.
 */
export function renderGuidesPanel(props) {
	var sections = [];

	GUIDE_SECTIONS.forEach(function (section, si) {
		var examples = section.examples.map(function (ex, ei) {
			return el('div', {
				key: ei,
				className: 'silc-wia-guide-example',
				onClick: function () {
					props.setQuestion(ex.text);
					props.setActivePanel(null);
					props.handleAsk(ex.text);
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

/**
}

/**
 * Render the Suggested Prompts panel.
 *
 * @param {Object}   props
 * @param {Function} props.setQuestion
 * @param {Function} props.setActivePanel
 * @param {Function} props.handleAsk
 * @return {Object} Element.
 */
export function renderSuggestedPanel(props) {
	var chips = SUGGESTED_PROMPTS.map(function (p, i) {
		return el('div', {
			key: i,
			className: 'silc-wia-suggested-panel-chip',
			onClick: function () {
				props.setActivePanel(null);
				props.handleAsk(p.text);
			},
		},
			el('span', { className: 'icon' }, p.icon),
			el('span', { className: 'text' }, p.text)
		);
	});

	return el('div', { className: 'silc-wia-suggested-panel' }, chips);
}
