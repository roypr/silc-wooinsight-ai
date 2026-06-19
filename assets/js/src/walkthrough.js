/**
 * SILC WooInsight AI — Walkthrough / Onboarding Tour
 *
 * A simple guided tour that highlights key UI elements for first-time users.
 * Uses localStorage to remember dismissal. No external dependencies.
 *
 * @package SILC_WooInsight_AI
 */

/* global wp */

var el = wp.element.createElement;
var useState = wp.element.useState;
var useEffect = wp.element.useEffect;
var useCallback = wp.element.useCallback;

var Button = wp.components.Button;

var STORAGE_KEY = 'silc_wia_walkthrough_done';
var STEPS = [
	{
		target: 'silc-wia-chat-input-row',
		title: 'Ask a Question',
		body: 'Type a question about your WooCommerce store in plain English. For example: "Best selling products this month" or "Total revenue yesterday."',
		placement: 'top',
	},
	{
		target: 'silc-wia-prompts',
		title: 'Try a Suggestion',
		body: 'Click any of these chips to quickly run a pre-built insight. Great way to see what the plugin can do!',
		placement: 'bottom',
	},
	{
		target: 'silc-wia-sidebar',
		title: 'Sidebar Panels',
		body: 'Access your insight history, pre-built library, SQL details, and settings from the sidebar.',
		placement: 'right',
	},
	{
		target: 'silc-wia-topbar-status',
		title: 'Ready to Go!',
		body: "You're all set. Ask anything about your WooCommerce data. Charts, lists, and answers \u2014 all from plain English.",
		placement: 'bottom',
	},
];

/**
 * Walkthrough overlay component.
 *
 * @param {Object}   props
 * @param {boolean}  props.active  Whether the walkthrough is active.
 * @param {Function} props.onDismiss Called when user dismisses.
 * @return {Object|null} Element.
 */
export function WalkthroughOverlay(props) {
	if (!props.active) return null;

	var stepIdx = useState(0);
	var currentStep = stepIdx[0];
	var setStep = stepIdx[1];

	var step = STEPS[currentStep];
	var isLast = currentStep >= STEPS.length - 1;

	var handleNext = useCallback(function () {
		if (isLast) {
			props.onDismiss();
		} else {
			setStep(function (s) { return s + 1; });
		}
	}, [isLast]);

	var handleDismiss = useCallback(function () {
		props.onDismiss();
	}, []);

	return el('div', {
		className: 'silc-wia-walkthrough-overlay',
		onClick: handleDismiss,
	},
		el('div', {
			className: 'silc-wia-walkthrough-tooltip',
			onClick: function (e) { e.stopPropagation(); },
		},
			el('div', { className: 'silc-wia-walkthrough-step' },
				'Step ' + (currentStep + 1) + ' of ' + STEPS.length
			),
			el('h3', { className: 'silc-wia-walkthrough-title' }, step.title),
			el('p', { className: 'silc-wia-walkthrough-body' }, step.body),
			el('div', { className: 'silc-wia-walkthrough-actions' },
				el(Button, {
					isLink: true,
					onClick: handleDismiss,
				}, 'Dismiss'),
				el('div', { className: 'silc-wia-walkthrough-dots' },
					STEPS.map(function (_, i) {
						return el('span', {
							key: i,
							className: 'silc-wia-walkthrough-dot' + (i === currentStep ? ' active' : ''),
						});
					})
				),
				el(Button, {
					isPrimary: true,
					onClick: handleNext,
				}, isLast ? 'Get Started' : 'Next')
			)
		)
	);
}

/**
 * Hook to manage walkthrough state.
 *
 * @return {Object} { active, dismiss }
 */
export function useWalkthrough() {
	var _active = useState(false);
	var active = _active[0];
	var setActive = _active[1];

	useEffect(function () {
		// Check localStorage — show tour if never dismissed.
		var done;
		try {
			done = window.localStorage.getItem(STORAGE_KEY);
		} catch (e) { /* localStorage not available */ } // eslint-disable-line no-unused-vars

		if (!done) {
			// Small delay to let the UI render first.
			var timer = setTimeout(function () {
				setActive(true);
			}, 800);
			return function () { clearTimeout(timer); };
		}
	}, []);

	var dismiss = useCallback(function () {
		setActive(false);
		try {
			window.localStorage.setItem(STORAGE_KEY, '1');
		} catch (e) { /* ignore */ } // eslint-disable-line no-unused-vars
	}, []);

	return { active: active, dismiss: dismiss };
}
