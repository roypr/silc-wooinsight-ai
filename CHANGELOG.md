# Changelog

All notable changes to SILC WooInsight AI will be documented in this file.

## [2.3.1] — 2025

### Fixed
- **UI/UX improvements** across the dashboard for better visual consistency
- **Bug fixes** in chart rendering and layout behavior
- Minor styling refinements for sidebar, panels, and responsive layout

---

## [2.3.0] — 2026

### Added
- **Insight Library** — 30 built-in, ready-to-execute queries that work without an AI API key
  - 10 chart insights (best sellers, trends, distributions, comparisons)
  - 12 list insights (customers, orders, inventory, categories)
  - 8 answer insights (revenue, counts, averages, tax)
  - Regex search across all library items
- `SILC_WIA_Library` PHP class for library management
- Library CSS styles (`.silc-wia-library-*`)
- Library data passed to JS via `wp_localize_script` (`libraryItems`)

### Changed
- **Guides panel renamed to Library** (sidebar icon, panel key, all labels)
- Library items execute directly via `execute_sql` AJAX — same pipeline as the Refresh button
- `renderGuidesPanel` → `renderLibraryPanel` in JS
- `GUIDE_SECTIONS` → `LIBRARY_ITEMS` in JS utils
- Sidebar icon for Library: `book` → `book-alt`
- l10n key `guides` → `library`

### Removed
- Legacy `GUIDE_SECTIONS` data structure from `utils.js`
- `renderGuidesPanel` import from `index.js`

---

## [2.0.0] — 2026

### Added
- Complete React dashboard built on `@wordpress/element` and `@wordpress/components`
- OpenAI-compatible AI pipeline with structured JSON output (SQL + type + config)
- HPOS-aware schema discovery with dynamic `SHOW COLUMNS` and hardcoded fallback
- Strict SQL validator: SELECT-only, table whitelist, function whitelist, multi-statement blocking
- Chart.js visualization: bar, line, pie, doughnut, horizontalBar, polarArea, radar
- Transform-based chart data preparation (`group_split`, `columns_to_datasets`)
- List rendering with type-specific templates (order, product, customer, coupon, generic)
- Admin link generation for orders, products, customers, coupons (HPOS-aware)
- Answer type for single numeric results with `{{column}}` template substitution
- History panel with instant replay of past insights (no re-generation)
- Inline settings panel: API URL, key, model, max tokens, temperature, cache TTL
- Refresh button to re-execute stored queries without AI call
- Sidebar navigation: SQL Details, History, Guides, Suggested Prompts, Settings
- Connection test utility
- Suggested prompts on empty state
- Collapsible sidebar with panel drawer
- Result caching with configurable TTL (transients)
- Reasoning model detection and auto-configuration (o1, o3, DeepSeek-R1, Claude Opus, Gemini Flash Thinking)
- `max_completion_tokens` support for OpenAI reasoning models
- Multi-strategy JSON parsing (direct decode, strip markdown, regex extraction)
- AJAX retry with assistant message context for reasoning models
- Plugin update checker integration (yahnis-elsts/plugin-update-checker)
- Webpack build pipeline with Babel and React JSX transform
- ESLint configuration
- Debug logging for API requests and responses

### Changed
- Plugin architecture completely rewritten from v1
- AI prompt now includes full schema context with table relationships
- Chart config uses `transform` objects instead of pre-computed data (AI never sees actual data)

---

## [1.0.0] — 2026

### Added
- Initial private release
- Basic AI-to-SQL pipeline via OpenAI-compatible API
- Chart.js integration for basic chart types
- API settings management (URL, key, model)
- SELECT-only SQL validation
- Simple result rendering (chart / text)
- Core plugin architecture and documentation
