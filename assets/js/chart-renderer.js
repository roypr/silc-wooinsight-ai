/**
 * SILC WooInsight AI - Chart.js Renderer
 *
 * Vanilla JS wrapper around Chart.js with proper lifecycle management
 * and rich visual styling.
 *
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
	 * Vibrant, well-distributed color palette (12 colors).
	 * Each has a solid and a semi-transparent variant for fill vs stroke.
	 * Order is randomized on each page load for variety.
	 */
	var palette = [
		{ solid: '#2271b1', fill: 'rgba(34,113,177,0.65)' },  // WP blue
		{ solid: '#2c8a4a', fill: 'rgba(44,138,74,0.65)' },   // green
		{ solid: '#d63638', fill: 'rgba(214,54,56,0.65)' },   // red
		{ solid: '#826eb4', fill: 'rgba(130,110,180,0.65)' }, // purple
		{ solid: '#e68a2e', fill: 'rgba(230,138,46,0.65)' },  // orange
		{ solid: '#00a0d2', fill: 'rgba(0,160,210,0.65)' },   // cyan
		{ solid: '#c9356e', fill: 'rgba(201,53,110,0.65)' },  // pink
		{ solid: '#46b450', fill: 'rgba(70,180,80,0.65)' },   // lime
		{ solid: '#ffb900', fill: 'rgba(255,185,0,0.65)' },   // yellow
		{ solid: '#7b5ea7', fill: 'rgba(123,94,167,0.65)' },  // violet
		{ solid: '#168a8a', fill: 'rgba(22,138,138,0.65)' },  // teal
		{ solid: '#cc6b2c', fill: 'rgba(204,107,44,0.65)' },  // burnt orange
	];

	/**
	 * Fisher-Yates shuffle to randomize palette order on load.
	 */
	function shuffleArray( arr ) {
		for ( var i = arr.length - 1; i > 0; i-- ) {
			var j = Math.floor( Math.random() * ( i + 1 ) );
			var tmp = arr[ i ];
			arr[ i ] = arr[ j ];
			arr[ j ] = tmp;
		}
		return arr;
	}
	/**
	 * Get palette color by index.
	 */
	function getColor( i ) {
		return palette[ i % palette.length ];
	}

	/**
	 * Get the solid hex color by index (for borders/points).
	 */
	function getSolidColor( i ) {
		return getColor( i ).solid;
	}

	/**
	 * Get the semi-transparent fill color by index.
	 */
	function getFillColor( i ) {
		return getColor( i ).fill;
	}

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

		var chartType = config.chart_type;
		var isPieOrDoughnut = chartType === 'pie' || chartType === 'doughnut';
		var isHorizontalBar = chartType === 'horizontalBar';
		var isBar = chartType === 'bar' || isHorizontalBar;

		// Randomize color order on every render (no page reload needed).
		shuffleArray( palette );

		// Build datasets with rich defaults.
		var datasets = ( config.datasets || [] ).map( function ( ds, index ) {
			var c = getColor( index );
			var bg = ds.backgroundColor || c.fill;
			var border = ds.borderColor || c.solid;

			// For pie/doughnut, assign a per-slice color array if a single string was given.
			if ( isPieOrDoughnut && typeof bg === 'string' && Array.isArray( ds.data ) ) {
				bg = ds.data.map( function ( _, i ) {
					return getFillColor( i );
				} );
				border = ds.data.map( function ( _, i ) {
					return getSolidColor( i );
				} );
			}

			// Only apply per-point colors for bar/line if user didn't provide an array.
			var dataset = {
				label: ds.label || '',
				data: ds.data || [],
				backgroundColor: bg,
				borderColor: border,
				borderWidth: 0,
				hoverBorderWidth: 0,
			};

			// Bar-specific enhancements.
			if ( isBar ) {
				dataset.borderRadius = 0;
				dataset.hoverBackgroundColor = border;
			}

			// Line-specific enhancements.
			if ( chartType === 'line' ) {
				dataset.tension = 0.35;
				dataset.pointRadius = 4;
				dataset.pointHoverRadius = 7;
				dataset.pointBackgroundColor = '#fff';
				dataset.pointBorderColor = border;
				dataset.pointBorderWidth = 2.5;
				dataset.pointHoverBackgroundColor = border;
				dataset.pointHoverBorderColor = '#fff';
				dataset.pointHoverBorderWidth = 2.5;
				dataset.fill = true;
				dataset.borderWidth = 2.5;
			}

			// Pie/doughnut: add hover offset for interactivity.
			if ( isPieOrDoughnut ) {
				dataset.hoverOffset = 8;
				dataset.spacing = 0;
			}

			return dataset;
		} );

		// Determine if legend should show.
		var showLegend = datasets.length > 1;
		if ( isPieOrDoughnut ) {
			showLegend = true;
		}

		// Build chart options.
		var chartOptions = {
			responsive: true,
			maintainAspectRatio: false,
			plugins: {
				title: {
					display: !! config.title,
					text: config.title || '',
					font: {
						size: 15,
						weight: '600',
					},
					padding: {
						bottom: 12,
					},
					color: '#1d2327',
				},
				legend: {
					display: showLegend,
					position: 'bottom',
					labels: {
						padding: 14,
						usePointStyle: true,
						pointStyle: 'circle',
						font: {
							size: 12,
							weight: '500',
						},
						color: '#50575e',
					},
				},
				tooltip: {
					backgroundColor: 'rgba(29,35,39,0.9)',
					titleFont: { weight: '600', size: 13 },
					bodyFont: { size: 12 },
					padding: 12,
					cornerRadius: 8,
					titleColor: '#fff',
					bodyColor: '#e0e0e0',
					caretSize: 6,
					boxPadding: 6,
					usePointStyle: true,
				},
			},
		};

		// Add scales for non-pie charts.
		if ( ! isPieOrDoughnut ) {
			chartOptions.scales = {
				x: {
					title: {
						display: !! config.x_label,
						text: config.x_label || '',
						font: { size: 12, weight: '500' },
						color: '#787c82',
					},
					grid: {
						display: true,
						color: 'rgba(0,0,0,0.06)',
						drawBorder: false,
						lineWidth: 1,
					},
					ticks: {
						color: '#787c82',
						font: { size: 11 },
						maxRotation: isHorizontalBar ? 0 : 45,
					},
				},
				y: {
					title: {
						display: !! config.y_label,
						text: config.y_label || '',
						font: { size: 12, weight: '500' },
						color: '#787c82',
					},
					beginAtZero: true,
					grid: {
						color: 'rgba(0,0,0,0.05)',
						drawBorder: false,
						lineWidth: 1,
					},
					ticks: {
						color: '#787c82',
						font: { size: 11 },
					},
				},
			};

			// For horizontalBar, flip x/y axis config.
			if ( isHorizontalBar ) {
				var tempTitle = chartOptions.scales.x.title;
				chartOptions.scales.x.title = chartOptions.scales.y.title;
				chartOptions.scales.y.title = tempTitle;
			}
		}

		// Pie/doughnut: add cutout and animation config.
		if ( isPieOrDoughnut ) {
			if ( chartType === 'doughnut' ) {
				chartOptions.cutout = '55%';
			}
			chartOptions.animation = {
				animateRotate: true,
				duration: 800,
			};
		}

		// Apply gradient for bar charts after chart is created
		// by hooking into the 'afterDraw' or 'beforeDraw' event.
		if ( isBar ) {
			chartOptions.plugins = chartOptions.plugins || {};
			chartOptions.plugins.colors = {
				enabled: false, // disable Chart.js built-in color plugin
			};
		}

		// Store the chart instance.
		charts[ canvasId ] = new Chart( ctx, {
			type: chartType === 'horizontalBar' ? 'bar' : chartType,
			data: {
				labels: config.labels || [],
				datasets: datasets,
			},
			options: chartOptions,
		} );

		// Apply gradient fills for bar charts post-creation.
		if ( isBar ) {
			var instance = charts[ canvasId ];
			var meta = instance.getDatasetMeta( 0 );
			if ( meta && meta.data && meta.data.length ) {
				var chartArea = instance.chartArea;
				if ( chartArea ) {
					instance.data.datasets.forEach( function ( ds, idx ) {
						var c = getColor( idx );
						var gradient = ctx.createLinearGradient(
							isHorizontalBar ? chartArea.left : 0,
							isHorizontalBar ? 0 : chartArea.top,
							isHorizontalBar ? chartArea.right : 0,
							isHorizontalBar ? 0 : chartArea.bottom
						);
						gradient.addColorStop( 0, c.solid );
						gradient.addColorStop( 1, c.fill );
						ds.backgroundColor = gradient;
					} );
					instance.update();
				}
			}
		}

		// For line charts, apply gradient fill after render.
		if ( chartType === 'line' ) {
			var lineInstance = charts[ canvasId ];
			var lineCtx = ctx;
			var lineChartArea = lineInstance.chartArea;
			if ( lineChartArea ) {
				lineInstance.data.datasets.forEach( function ( ds, idx ) {
					if ( typeof ds.backgroundColor === 'string' && ds.backgroundColor !== 'rgba(0,0,0,0)' ) {
						var grad = lineCtx.createLinearGradient( 0, lineChartArea.top, 0, lineChartArea.bottom );
						var baseColor = getColor( idx ).solid;
						grad.addColorStop( 0, baseColor.replace(')', ',0.35)').replace('rgb', 'rgba') || 'rgba(34,113,177,0.35)' );
						grad.addColorStop( 1, 'rgba(255,255,255,0.02)' );
						ds.backgroundColor = grad;
						lineInstance.update();
					}
				} );
			}
		}
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
		defaultColors: palette.map( function ( c ) { return c.solid; } ),
	};
} )();
