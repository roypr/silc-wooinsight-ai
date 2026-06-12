/**
 * SILC WooInsight AI — Sidebar component
 *
 * @package SILC_WooInsight_AI
 */

/* global wp */

import { l10n } from './utils.js';

var el = wp.element.createElement;

/**
 * A single sidebar icon item.
 *
 * @param {Object}  props
 * @param {string}  props.icon   Dashicon class suffix.
 * @param {string}  props.label  Display label.
 * @param {string}  props.panel  Panel key.
 * @param {boolean} props.active Whether this item is active.
 * @param {Function} props.onClick Click handler.
 */
function SidebarItem(props) {
	var icon = props.icon;
	var label = props.label;
	var panel = props.panel;
	var isActive = props.activePanel === panel;
	var openPanel = props.openPanel;

	return el('div', {
		className: 'silc-wia-sidebar-item' + (isActive ? ' active' : ''),
		onClick: function () {
			openPanel(panel);
		},
		title: label,
	},
		el('span', { className: 'dashicons dashicons-' + icon }),
		el('span', { className: 'label' }, label)
	);
}

/**
 * Render the sidebar.
 *
 * @param {Object}   props
 * @param {boolean}  props.sidebarExpanded
 * @param {Function} props.toggleSidebar
 * @param {Function} props.openPanel
 * @param {string|null} props.activePanel
 * @return {Object} Element.
 */
export function renderSidebar(props) {
	var sidebarExpanded = props.sidebarExpanded;
	var toggleSidebar = props.toggleSidebar;

	var items = [
		{ icon: 'editor-code', label: l10n.sqlDetails || 'SQL', panel: 'sql' },
		{ icon: 'backup', label: l10n.history || 'History', panel: 'history' },
		{ icon: 'book', label: l10n.guides || 'Guides', panel: 'guides' },
	];

	return el('div', {
		className: 'silc-wia-sidebar ' + (sidebarExpanded ? 'expanded' : 'collapsed'),
	},
		// Toggle button.
		el('div', {
			className: 'silc-wia-sidebar-toggle',
			onClick: toggleSidebar,
			title: sidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar',
		},
			el('span', { className: 'dashicons dashicons-menu' })
		),
		// Nav items.
		items.map(function (item) {
			return el(SidebarItem, {
				key: item.panel,
				icon: item.icon,
				label: item.label,
				panel: item.panel,
				activePanel: props.activePanel,
				openPanel: props.openPanel,
			});
		}),
		// Spacer.
		el('div', { className: 'silc-wia-sidebar-spacer' }),
		// Settings at bottom.
		el(SidebarItem, {
			icon: 'admin-generic',
			label: l10n.settings || 'Settings',
			panel: 'settings',
			activePanel: props.activePanel,
			openPanel: props.openPanel,
		})
	);
}
