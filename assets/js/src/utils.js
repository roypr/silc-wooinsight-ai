/**
 * SILC WooInsight AI — Utility functions and constants
 *
 * @package SILC_WooInsight_AI
 */

/* global wp */

/**
 * Perform an AJAX action via POST.
 *
 * @param {string} action Action suffix (without 'silc_wia_' prefix).
 * @param {Object} extra  Extra form data fields.
 * @return {Promise<Object>} Parsed JSON response.
 */
export function doAction(action, extra) {
	var nonce = (window.silcWiaData && window.silcWiaData.nonce) || '';
	var ajaxUrl = (window.silcWiaData && window.silcWiaData.ajaxUrl) || '';
	var formData = new FormData();
	formData.append('action', 'silc_wia_' + action);
	formData.append('nonce', nonce);
	if (extra) {
		Object.keys(extra).forEach(function (key) {
			formData.append(key, extra[key]);
		});
	}
	return fetch(ajaxUrl, { method: 'POST', body: formData }).then(function (r) {
		return r.json();
	});
}

/**
 * SVG logo icon.
 */
export function LogoSvg() {
	var el = wp.element.createElement;
	return el(
		'svg',
		{
			viewBox: '0 0 24 24',
			fill: 'none',
			stroke: 'currentColor',
			strokeWidth: '2',
			strokeLinecap: 'round',
			strokeLinejoin: 'round',
		},
		el('line', { x1: '18', y1: '20', x2: '18', y2: '10' }),
		el('line', { x1: '12', y1: '20', x2: '12', y2: '4' }),
		el('line', { x1: '6', y1: '20', x2: '6', y2: '14' })
	);
}

/**
 * Global data shortcut.
 */
export var data = window.silcWiaData || {};
export var l10n = data.l10n || {};
export var settings = data.settings || {};
export var defaults = data.defaults || {};
export var apiConfigured = data.apiConfigured || false;
export var pluginVersion = data.pluginVersion || '2.0.0';

/**
 * Suggested prompts that produce different result types.
 */
export var SUGGESTED_PROMPTS = [
	{ text: 'Best selling products last month', icon: '\uD83D\uDCCA', type: 'chart' },
	{ text: 'Monthly revenue trend this year', icon: '\uD83D\uDCC8', type: 'chart' },
	{ text: 'Order status distribution', icon: '\uD83E\uDDFE', type: 'chart' },
	{ text: 'Top 10 customers by spending', icon: '\uD83C\uDFC6', type: 'list' },
	{ text: 'Total revenue yesterday', icon: '\uD83D\uDCB0', type: 'answer' },
	{ text: 'Products low in stock', icon: '\u26A0\uFE0F', type: 'list' },
];

/**
 * Guide sections for the Guides panel.
 */
export var GUIDE_SECTIONS = [
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
