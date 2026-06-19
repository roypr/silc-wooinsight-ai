/**
 * SILC WooInsight AI — Side panel renderers (SQL, History, Library, Suggested)
 *
 * @package SILC_WooInsight_AI
 */

/* global wp */

import { l10n, LIBRARY_ITEMS, SUGGESTED_PROMPTS } from './utils.js';

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
		library: l10n.library || 'Library',
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
 * Render the Library panel.
 *
 * Displays pre-built insight items that can be executed without AI.
 * Supports regex search across item questions.
 * On click: passes the full library item to handleLibraryItem which
 * executes the SQL directly (same pipeline as the Refresh button).
 *
 * @param {Object}   props
 * @param {Function} props.handleLibraryItem  Called with the full library item.
 * @param {string}   props.librarySearchQuery Current search string.
 * @param {Function} props.setLibrarySearchQuery  Setter for search string.
 * @return {Object} Element.
 */
export function renderLibraryPanel(props) {
	var searchQuery = props.librarySearchQuery || '';
	var setSearchQuery = props.setLibrarySearchQuery;

	var isSearching = searchQuery.trim().length > 0;

	// Attempt to build a case-insensitive regex from the query.
	var regex = null;
	var regexValid = true;
	if (isSearching) {
		try {
			regex = new RegExp(searchQuery, 'i');
		} catch (e) { // eslint-disable-line no-unused-vars
			regexValid = false;
		}
	}

	// Filter items by search query.
	var filteredItems = LIBRARY_ITEMS;
	if (isSearching && regexValid) {
		filteredItems = LIBRARY_ITEMS.filter(function (item) {
			return regex.test(item.question) || regex.test(item.title);
		});
	}

	// Build item elements.
	var itemElements = filteredItems.map(function (item) {
		var typeIcon = '';
		if (item.type === 'chart') typeIcon = '\uD83D\uDCCA ';
		else if (item.type === 'list') typeIcon = '\uD83D\uDCCB ';
		else if (item.type === 'answer') typeIcon = '\u2139\uFE0F ';

		return el('div', {
			key: item.id,
			className: 'silc-wia-library-item',
			onClick: function () {
				props.handleLibraryItem(item);
			},
		},
			el('span', { className: 'icon' }, typeIcon),
			el('span', { className: 'text' }, item.question),
			item.title
				? el('span', { className: 'desc' }, item.title)
				: null
		);
	});

	// Search input + content.
	return el('div', null,

		// Search bar.
		el('div', { className: 'silc-wia-library-search', style: { marginBottom: '12px' } },
			el('input', {
				type: 'text',
				placeholder: 'Search library (regex supported)...',
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

		// No-match message or items.
		isSearching && regexValid && filteredItems.length === 0
			? el('p', { className: 'silc-wia-muted' }, 'No library items match "' + searchQuery + '".')
			: el('div', { className: 'silc-wia-library-list' }, itemElements)
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
