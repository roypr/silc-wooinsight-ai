/**
 * SILC WooInsight AI - Chart.js Renderer
 *
 * Vanilla JS wrapper around Chart.js with proper lifecycle management.
 * Exposes the SILC_WIA_Charts global for use by the React dashboard.
 *
 * Enqueued as 'silc-wia-chart-renderer', depends on 'silc-wia-chartjs'.
 *
 * @package SILC_WooInsight_AI
 */

/* global Chart */

var SILC_WIA_Charts = ( function () {
	'use strict';

	var charts = {};

	/**
	 * Get the WP admin theme color, falling back to a default blue.
	 */
	function getThemeColor() {
		if (typeof document !== 'undefined') {
			var val = getComputedStyle(document.documentElement)
				.getPropertyValue('--wp-admin-theme-color').trim();
			if (val) return val;
		}
		return '#2271b1';
	}

	var themeColor = getThemeColor();

	var defaultColors = [
		themeColor,
		'#2c8a4a',
		'#d63638',
		'#826eb4',
		'#f0a849',
		'#46b450',
		'#ffb900',
		'#c9356e',
		'#00a0d2',
	];

	/**
	 * Render a chart into a canvas element.
	 *
	 * @param {string} canvasId  The ID of the canvas element.
	 * @param {Object} config    Chart configuration object.
	 */
	function renderChart( canvasId, config ) {
		var canvas = document.getElementById( canvasId );
		if ( ! canvas ) {
			return;
		}

		// Destroy any existing chart instance for this canvas.
		destroyChart( canvasId );

		var ctx = canvas.getContext( '2d' );
		if ( ! ctx ) {
			return;
		}

		if ( ! config || ! config.chart_type ) {
			return;
		}

		// Build datasets with defaults.
		var datasets = ( config.datasets || [] ).map( function ( ds, index ) {
			return {
				label: ds.label || '',
				data: ds.data || [],
				backgroundColor: ds.backgroundColor || defaultColors[ index % defaultColors.length ],
				borderColor: ds.borderColor || themeColor,
				borderWidth: 1,
			};
		} );

		// Determine if legend should show.
		var showLegend = datasets.length > 1;
		if ( config.chart_type === 'pie' || config.chart_type === 'doughnut' ) {
			showLegend = true;
		}

		charts[ canvasId ] = new Chart( ctx, {
			type: config.chart_type,
			data: {
				labels: config.labels || [],
				datasets: datasets,
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					title: {
						display: !! config.title,
						text: config.title || '',
						font: {
							size: 14,
							weight: '600',
						},
					},
					legend: {
						display: showLegend,
						position: 'bottom',
					},
				},
				scales: {
					x: {
						title: {
							display: !! config.x_label,
							text: config.x_label || '',
						},
						grid: {
							display: true,
							color: 'rgba(0,0,0,0.06)',
						},
					},
					y: {
						title: {
							display: !! config.y_label,
							text: config.y_label || '',
						},
						beginAtZero: true,
						grid: {
							color: 'rgba(0,0,0,0.06)',
						},
					},
				},
			},
		} );
	}

	/**
	 * Destroy a chart instance by canvas ID.
	 *
	 * @param {string} canvasId
	 */
	function destroyChart( canvasId ) {
		if ( charts[ canvasId ] ) {
			charts[ canvasId ].destroy();
			delete charts[ canvasId ];
		}
	}

	/**
	 * Destroy all chart instances.
	 */
	function destroyAll() {
		Object.keys( charts ).forEach( function ( id ) {
			destroyChart( id );
		} );
	}

	return {
		renderChart: renderChart,
		destroyChart: destroyChart,
		destroyAll: destroyAll,
		defaultColors: defaultColors,
	};
} )();
