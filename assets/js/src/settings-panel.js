/**
 * SILC WooInsight AI — Settings panel renderer
 *
 * @package SILC_WooInsight_AI
 */

/* global wp */

import { l10n, defaults, settings } from './utils.js';

var el = wp.element.createElement;
var Button = wp.components.Button;

/**
 * Render the Settings panel.
 *
 * @param {Object}   props
 * @param {Object}   props.formSettings
 * @param {Function} props.updateSetting
 * @param {Function} props.handleSaveSettings
 * @param {Function} props.handleTestConnection
 * @param {boolean}  props.settingsDirty
 * @param {boolean}  props.saving
 * @param {boolean}  props.testing
 * @param {Object|null} props.saveMsg
 * @param {Object|null} props.testResult
 * @return {Object} Element.
 */
export function renderSettingsPanel(props) {
	var formSettings = props.formSettings;
	var updateSetting = props.updateSetting;
	var handleSaveSettings = props.handleSaveSettings;
	var handleTestConnection = props.handleTestConnection;
	var settingsDirty = props.settingsDirty;
	var saving = props.saving;
	var testing = props.testing;
	var saveMsg = props.saveMsg;
	var testResult = props.testResult;

	var hasKey = settings.api_key && settings.api_key.length > 0;

	// Helper: a labelled input row.
	function SettingsField(sfProps) {
		return el('div', { className: 'silc-wia-settings-field' },
			el('label', null, sfProps.label),
			sfProps.children,
			sfProps.help ? el('div', { className: 'help' }, sfProps.help) : null
		);
	}

	return el('div', { className: 'silc-wia-settings-panel' },

		// ---------------------------------------------------------------
		// SECTION 1 — AI Provider
		// ---------------------------------------------------------------
		el('div', { className: 'silc-wia-settings-section' },
			el('div', { className: 'silc-wia-settings-section-title' },
				'\uD83E\uDD16 AI Provider'
			),
			el('div', { className: 'silc-wia-settings-section-desc' },
				'Choose which AI service powers your insights. WooInsight works with any OpenAI-compatible API.'
			),

			// API URL
			el(SettingsField, {
				label: l10n.settingsApiUrl || 'API URL',
				help: 'The address of your AI provider\u2019s API. The default works with OpenAI (ChatGPT). Most providers use the same format.',
			},
				el('input', {
					type: 'url',
					value: formSettings.api_url,
					placeholder: defaults.api_url,
					onChange: function (e) { updateSetting('api_url', e.target.value); },
				}),
				// Provider quick-links
				el('div', { className: 'silc-wia-settings-provider-links' },
					el('span', { className: 'label' }, 'Popular providers:'),
					el('span', {
						className: 'provider-link',
						onClick: function () { updateSetting('api_url', 'https://api.openai.com/v1'); },
					}, 'OpenAI'),
					el('span', {
						className: 'provider-link',
						onClick: function () { updateSetting('api_url', 'https://api.anthropic.com/v1'); },
					}, 'Anthropic'),
					el('span', {
						className: 'provider-link',
						onClick: function () { updateSetting('api_url', 'https://api.deepseek.com/v1'); },
					}, 'DeepSeek'),
				)
			),

			// Model
			el(SettingsField, {
				label: l10n.settingsModel || 'Model',
				help: 'The AI model to use. Stick with the default unless you know what you\u2019re doing. Popular options: gpt-4o-mini (fast/cheap), gpt-4o (powerful), claude-3-haiku, deepseek-r1.',
			},
				el('input', {
					type: 'text',
					value: formSettings.model,
					placeholder: defaults.model,
					onChange: function (e) { updateSetting('model', e.target.value); },
				})
			),
		),

		// ---------------------------------------------------------------
		// SECTION 2 — Authentication
		// ---------------------------------------------------------------
		el('div', { className: 'silc-wia-settings-section' },
			el('div', { className: 'silc-wia-settings-section-title' },
				'\uDDD1\uFE0F\u200D\uD83D\uDD12 Authentication'
			),
			el('div', { className: 'silc-wia-settings-section-desc' },
				'Your API key is stored securely in your WordPress database and is only sent to the API URL above. WooInsight never sends your data anywhere else.'
			),

			// API Key
			el(SettingsField, {
				label: l10n.settingsApiKey || 'API Key',
				help: hasKey && !formSettings.api_key
					? 'A key is already saved. Type a new one to replace it, or leave blank to keep the current key.'
					: 'Paste your API key here. Need one? Sign up at your AI provider and create a key from their dashboard.',
			},
				el('input', {
					type: 'password',
					value: formSettings.api_key,
					placeholder: hasKey ? 'API key is saved \u2014 enter new one to replace' : 'sk-...',
					onChange: function (e) { updateSetting('api_key', e.target.value); },
					autoComplete: 'off',
				}),
				hasKey && !formSettings.api_key
					? el('div', { className: 'has-key-indicator' }, '\u2713 API key is saved and active.')
					: null,
				// Link to get a key
				el('div', { className: 'silc-wia-settings-key-links' },
					el('a', {
						href: 'https://platform.openai.com/api-keys',
						target: '_blank',
						rel: 'noopener noreferrer',
					}, 'Get an OpenAI API key \u2197'),
					' \u00B7 ',
					el('a', {
						href: 'https://docs.anthropic.com/en/docs/api-keys',
						target: '_blank',
						rel: 'noopener noreferrer',
					}, 'Anthropic \u2197'),
					' \u00B7 ',
					el('a', {
						href: 'https://platform.deepseek.com/api_keys',
						target: '_blank',
						rel: 'noopener noreferrer',
					}, 'DeepSeek \u2197'),
				)
			),
		),

		// ---------------------------------------------------------------
		// SECTION 3 — Advanced
		// ---------------------------------------------------------------
		el('div', { className: 'silc-wia-settings-section' },
			el('div', { className: 'silc-wia-settings-section-title' },
				'\u2699\uFE0F Advanced'
			),

			// Max Tokens
			el(SettingsField, {
				label: l10n.settingsMaxTokens || 'Max Tokens',
				help: 'Maximum length of the AI\u2019s response. Higher = more detailed but slower. 500 is a good starting point.',
			},
				el('input', {
					type: 'number',
					value: formSettings.max_tokens,
					placeholder: defaults.max_tokens,
					min: 50, max: 8192, step: 50,
					onChange: function (e) { updateSetting('max_tokens', e.target.value); },
				})
			),

			// Temperature
			el(SettingsField, {
				label: l10n.settingsTemp || 'Temperature',
				help: 'Controls how creative the AI is. Lower values (0.1\u20130.3) produce more consistent SQL. Higher values (0.7+) can be more creative but less reliable.',
			},
				el('input', {
					type: 'number',
					value: formSettings.temperature,
					placeholder: defaults.temperature,
					min: 0, max: 2, step: 0.1,
					onChange: function (e) { updateSetting('temperature', e.target.value); },
				})
			),
		),

		// ---------------------------------------------------------------
		// SECTION 4 — Caching
		// ---------------------------------------------------------------
		el('div', { className: 'silc-wia-settings-section' },
			el('div', { className: 'silc-wia-settings-section-title' },
				'\uD83D\uDCBE Caching'
			),
			el('div', { className: 'silc-wia-settings-section-desc' },
				'Results are cached so asking the same question again loads instantly. Set the duration below, or set to 0 to disable caching.'
			),

			// Cache Duration
			el(SettingsField, {
				label: l10n.settingsCache || 'Cache Duration',
				help: 'How long to remember results for the same question. Recommended: 1\u20136 hours. Set to 0 to disable caching entirely.',
			},
				el('div', { className: 'silc-wia-cache-row' },
					el('input', {
						type: 'number',
						value: Math.round(parseInt(formSettings.cache_ttl, 10) / 60) || 60,
						min: 0, max: 10080, step: 15,
						onChange: function (e) {
							var minutes = parseInt(e.target.value, 10) || 0;
							updateSetting('cache_ttl', Math.max(0, Math.min(10080, minutes)) * 60);
						},
					}),
					el('span', { className: 'silc-wia-cache-unit' }, 'minutes'),
				),
				// Quick presets
				el('div', { className: 'silc-wia-cache-presets' },
					el('span', { className: 'label' }, 'Quick:'),
					el('span', { className: 'preset', onClick: function () { updateSetting('cache_ttl', 0); } }, 'Off'),
					el('span', { className: 'preset', onClick: function () { updateSetting('cache_ttl', 30 * 60); } }, '30 min'),
					el('span', { className: 'preset', onClick: function () { updateSetting('cache_ttl', 3600); } }, '1 hour'),
					el('span', { className: 'preset', onClick: function () { updateSetting('cache_ttl', 6 * 3600); } }, '6 hours'),
					el('span', { className: 'preset', onClick: function () { updateSetting('cache_ttl', 86400); } }, '24 hours'),
				)
			),
		),

		// ACTIONS
		el('div', { className: 'silc-wia-settings-actions' },
			el(Button, {
				isPrimary: true,
				onClick: handleSaveSettings,
				disabled: saving || !settingsDirty,
			}, saving ? (l10n.saving || 'Saving...') : (l10n.save || 'Save Settings')),
			el(Button, {
				isSecondary: true,
				onClick: handleTestConnection,
				disabled: testing,
			}, testing ? (l10n.testing || 'Testing...') : (l10n.testConnection || 'Test Connection')),
			testResult
				? el('span', {
					className: 'silc-wia-test-result ' + (testResult.type === 'success' ? 'success' : 'fail'),
					key: testResult.text,
				}, (testResult.type === 'success' ? '✓ ' : '✗ ') + testResult.text)
				: null,
		),

		// Save message.
		saveMsg
			? el('p', {
				style: {
					margin: '12px 0 0 0',
					fontSize: '12px',
					fontWeight: 500,
					color: saveMsg.type === 'success' ? '#1a7a2e' : '#b32d2e',
				},
			}, saveMsg.text)
			: null
	);
}
