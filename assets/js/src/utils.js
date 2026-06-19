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
 * Pre-built library items loaded from the server.
 * Each item has the full AI-response format: id, question, sql, type,
 * title, chart_config, list_config, answer_text.
 */
export var LIBRARY_ITEMS = data.libraryItems || [];

/**
 * Map of error codes to user-friendly messages.
 */
export var ERROR_MESSAGES = {
	FORBIDDEN: 'This action is not allowed. I can only answer questions about your store data \u2014 I cannot modify or delete anything.',
	OUT_OF_SCOPE: 'I can only help with WooCommerce store questions. Try asking about sales, products, orders, or customers.',
	NOT_WOOCOMMERCE: 'I only work with WooCommerce store data. That request involves non-store content I cannot access.',
	SQL_VALIDATION: 'The generated query could not be validated for safety.',
	QUERY_ERROR: 'The query ran into a database error. Please try rephrasing your question.',
};

/**
 * Get a user-friendly error message for an error code.
 *
 * @param {string} errorCode
 * @param {string} fallback
 * @return {string}
 */
export function getErrorMessage(errorCode, fallback) {
	if (errorCode && ERROR_MESSAGES[errorCode]) {
		return ERROR_MESSAGES[errorCode];
	}
	return fallback || 'Something went wrong.';
}
