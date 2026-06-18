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
 * @param {string}   props.guideSearchQuery
 * @param {Function} props.setGuideSearchQuery
 * @return {Object} Element.
 */
export function renderGuidesPanel(props) {
	var searchQuery = props.guideSearchQuery || '';
	var setSearchQuery = props.setGuideSearchQuery;

	var isSearching = searchQuery.trim().length > 0;

	// Attempt to build a case-insensitive regex from the query.
	var regex;
	var regexValid = true;
	if (isSearching) {
		try {
			regex = new RegExp(searchQuery, 'i');
		} catch (e) {
			regexValid = false;
			void e; // eslint-disable-line no-unused-vars
		}
	}

	var sections = [];
	var matchCount = 0;

	GUIDE_SECTIONS.forEach(function (section, si) {
		var showSection;
		var showExamples;

		if (!isSearching || !regexValid) {
			// No search active or invalid regex — show everything.
			showSection = true;
			showExamples = section.examples;
		} else {
			var sectionHeaderMatch = regex.test(section.title) || regex.test(section.text);
			var matchingExamples = section.examples.filter(function (ex) {
				return regex.test(ex.text) || regex.test(ex.desc);
			});

			if (sectionHeaderMatch || matchingExamples.length > 0) {
				showSection = true;
				// If the section header itself matched, show all its examples;
				// otherwise only the examples that matched.
				showExamples = sectionHeaderMatch ? section.examples : matchingExamples;
			}
		}

		if (showSection) {
			matchCount++;

			var examples = showExamples.map(function (ex, ei) {
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
		}
	});

	// Search input + content.
	return el('div', null,

		// Search bar.
		el('div', { className: 'silc-wia-guide-search', style: { marginBottom: '12px' } },
			el('input', {
				type: 'text',
				placeholder: 'Search guides (regex supported)...',
				value: searchQuery,
				onChange: function (e) { setSearchQuery(e.target.value); },
				style: { width: '100%', boxSizing: 'border-box' },
			})
		),

		// Invalid regex warning.
		!regexValid
			? el('p', { className: 'silc-wia-muted', style: { color: '#b32d2e', fontSize: '12px', margin: '0 0 8px' } },
				'Invalid regex pattern.'
			)
			: null,

		// No-match message or sections.
		isSearching && regexValid && matchCount === 0
			? el('p', { className: 'silc-wia-muted' }, 'No guides match "' + searchQuery + '".')
			: sections
	);
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
