=== SILC WooInsight AI ===
Contributors: silc
Tags: woocommerce, analytics, reports, sql, ai, charts, business-intelligence
Requires at least: 6.0
Tested up to: 6.8
Requires PHP: 7.4
WC requires at least: 8.0
Stable tag: 2.3.1
License: GPL v2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Ask plain-English questions about your WooCommerce store and get instant charts, lists, and answers — no SQL or coding needed.

== Description ==

**SILC WooInsight AI** turns natural language into data visualizations. Type a question like _"What were my best selling products last month?"_ or _"Show me pending orders"_ and get back beautiful charts, sortable lists, and precise answers — all pulled directly from your WooCommerce database.

= Three Pillars That Set It Apart =

**🗣️ Natural Language to Data Visualization**  
AI bridges the gap between asking a question and writing code. This plugin brings that power into your WooCommerce admin. No memorizing table names, no crafting SQL by hand — just ask, and the answer appears as a chart, a list, or a single highlighted number. You run the store; the plugin runs the queries.

**🔒 True Data Privacy — Your Data Never Leaves Your Server**  
The AI generates only the SQL query from database schema information (table names and column types). It **never** sees a single row of your actual customer, order, or product data. For industries with regulatory concerns — GDPR, HIPAA-adjacent workflows, PCI compliance — this is critical. Your sales numbers, customer emails, and order details stay exactly where they belong: inside your database.

**📊 Visualization That Replaces Spreadsheet Diving**  
Stop clicking through endless admin screens and exporting CSVs. A question produces a result in one of three rich formats: an interactive Chart.js visualization (bar, line, doughnut, pie), a clickable list with direct links to orders/products/customers, or a clean numeric answer. Insights that used to take 20 minutes of digging take 5 seconds of typing.

= How It Works =

1. Install the plugin and add your API key (any OpenAI-compatible provider — OpenAI, Azure, Ollama, LocalAI, vLLM, etc.)
2. Ask a question in plain English
3. The AI generates a structured JSON response containing a SQL query and display configuration
4. The SQL runs against your local WooCommerce database — securely validated and restricted to SELECT-only
5. Results render instantly as a chart, list, or answer

= Features =

* **Full AI Pipeline** — Natural language → SQL → execute → visualize, all in one click
* **30 Built-In Library Queries** — Works out of the box without an API key. Browse pre-built insights for revenue, orders, customers, inventory, and more
* **BYOK (Bring Your Own Key)** — Works with OpenAI, Azure OpenAI, Ollama, LocalAI, vLLM, and any OpenAI-compatible endpoint
* **Reasoning Model Support** — Detects and handles reasoning models (o1, o3, DeepSeek-R1) with correct parameter mapping
* **Auto-Detected Schema** — Dynamically discovers your WooCommerce tables and columns, HPOS-aware
* **Strict SQL Validation** — SELECT-only whitelist; all DML/DDL blocked; table and function whitelisting
* **Cache Layer** — Configurable result caching reduces duplicate API calls
* **History Panel** — Revisit past insights without regenerating
* **Refresh Button** — Re-execute a stored query against live data without calling the AI again
* **Settings Panel** — Configure API URL, key, model, max tokens, temperature, and cache TTL inline
* **HPOS & Legacy Compatible** — Automatically adapts table references based on active order storage backend
* **Lightweight** — React dashboard powered by WordPress core @wordpress/element and @wordpress/components; zero third-party UI frameworks

= Use Cases =

* **Store owners** — "How much did I make yesterday?" / "Which products are running low?"
* **Marketing teams** — "Top 10 customers by spending" / "Monthly revenue trend"
* **Support agents** — "Show me pending orders" / "Find refunded orders this week"
* **Accountants** — "Total tax collected this month" / "Revenue by payment method"
* **Inventory managers** — "Products never purchased" / "Out of stock products"

= Privacy & Security =

* Your data **never touches the AI** — only database schema (table/column names) is sent
* SQL queries are validated against a strict whitelist of allowed tables and functions
* Only SELECT statements are permitted — no INSERT, UPDATE, DELETE, DROP, or multi-statement injection
* All AJAX endpoints require WooCommerce admin capabilities
* Nonce-verified requests with WordPress security best practices
* **GDPR-friendly** — no customer data leaves your infrastructure
* **HIPAA-adjacent safe** — no PHI is ever transmitted to third parties
* **PCI-aware** — payment data never leaves your secure environment

= Requirements =

* WordPress 6.0+
* WooCommerce 8.0+
* PHP 7.4+
* An API key from any OpenAI-compatible provider (optional — the built-in Library works without one)

= Bring Your Own Key (BYOK) =

The plugin is API-agnostic. Any provider exposing an `/chat/completions` endpoint works:

* **OpenAI** (api.openai.com)
* **Azure OpenAI** (your-instance.openai.azure.com)
* **Ollama** (localhost:11434)
* **LocalAI** (self-hosted)
* **vLLM** (self-hosted)
* **LM Studio** (localhost)
* Any other OpenAI-compatible proxy or gateway

= Library — Insights Without AI =

Version 2.3 introduces the **Insight Library**: 30 hand-crafted, ready-to-execute queries that work immediately with zero configuration. Browse, search (with regex!), and click to run — exactly the same output format as the AI pipeline. Perfect for demos, evaluations, and everyday quick-checks when you don't want to spend API credits.

Categories include:
* **Charts & Trends** — Best sellers, revenue trends, status distributions, category breakdowns, weekly comparisons
* **Lists & Details** — Customers by spending, recent orders, low stock, pending/on-hold/refunded orders, top rated products
* **Quick Answers** — Revenue this month/yesterday/year, order count, AOV, product count, customer count, tax totals

== Installation ==

1. Upload the `silc-wooinsight-ai` folder to `/wp-content/plugins/` or install via the WordPress plugin directory.
2. Activate the plugin through the 'Plugins' menu.
3. Navigate to **WooCommerce → WooInsight AI**.
4. Open the ⚙️ **Settings** panel in the sidebar.
5. Enter your API URL and API Key (or skip — the built-in Library works without an API).
6. Start asking questions or browse the Library.

== Frequently Asked Questions ==

= Do I need an API key? =

No. The built-in Library provides 30 pre-built insights that execute directly against your database without any AI involvement. An API key unlocks the natural-language query generator where you can ask anything in plain English.

= Which AI models work best? =

GPT-4o-mini provides excellent cost/performance. GPT-4o and Claude 3.5 Sonnet produce the most accurate SQL. For self-hosted setups, Llama 3 70B and DeepSeek-V3 work well via Ollama or vLLM. Reasoning models (o1, o3, DeepSeek-R1) are fully supported.

= Is my store data sent to the AI? =

**No.** Only database schema metadata (table names and column names/types) is included in the prompt. The AI never sees actual customer names, order totals, email addresses, or any row-level data.

= What happens to failed queries? =

Invalid SQL is caught by the validator before execution. Empty results show a friendly message. Errors are displayed inline so you can refine your question.

= Does this work with HPOS? =

Yes. The plugin auto-detects whether WooCommerce High-Performance Order Storage is active and adjusts table references accordingly. Both HPOS and legacy post-based orders are fully supported.

= Can I use this on a multisite? =

Yes, with per-site settings.

= What about caching? =

Results are cached (configurable TTL, default 1 hour) to avoid redundant API calls and database queries. Cache can be set to 0 to disable.

== Screenshots ==

1. Main dashboard — Ask a question and get a chart, list, or answer.
2. Library panel — 30 pre-built insights, searchable, no API required.
3. Settings panel — Configure your API provider inline.
4. History panel — Revisit past insights.
5. SQL details panel — Inspect generated queries and execution stats.

== Changelog ==

= 2.3.1 =
* 🐛 Bug fixes across chart rendering, SQL execution display, and responsive layout
* 🎨 Visual improvements to sidebar navigation, panel headers, and mobile breakpoints
* ⚡ Minor performance optimizations and UI polish

= 2.3.0 =
* ✨ **Insight Library** — 30 built-in queries (10 charts, 12 lists, 8 answers) that work without an API key
* 🏷️ Guides panel renamed to Library
* 🔍 Library supports regex search
* 🖱️ Library items execute directly via the refresh pipeline — no AI call needed
* 🎨 New library-specific CSS styles
* 🧹 Removed legacy GUIDE_SECTIONS data structure
* 📚 PHP class `SILC_WIA_Library` added for library management

= 2.0.0 =
* 🚀 Complete rewrite with React dashboard (@wordpress/element, @wordpress/components)
* 🧠 OpenAI-compatible AI pipeline with structured JSON output
* 🗄️ HPOS-aware schema discovery with hardcoded fallbacks
* 🔒 Strict SQL validator: SELECT-only, table whitelist, multi-statement blocking
* 🎨 Chart.js visualization: bar, line, pie, doughnut, horizontalBar, polarArea, radar
* 📋 List rendering with admin links for orders, products, customers, coupons
* 💬 Answer type for single numeric results
* 💾 History panel with instant replay of past insights
* ⚙️ Inline settings panel (API URL, key, model, tokens, temperature, cache)
* 🔄 Refresh button to re-execute stored queries without AI
* 🧩 Sidebar navigation: SQL, History, Guides, Suggested, Settings
* 🧪 Connection test utility
* 💰 Suggested prompts on empty state
* 📱 Responsive layout with collapsible sidebar

= 1.0.0 =
* Initial private release
* Basic AI-to-SQL pipeline
* Chart.js integration
* API settings management
* Documentation and core architecture

== Upgrade Notice ==

= 2.3.1 =
Bug fixes and visual improvements. No breaking changes — all existing settings, history, and library items are preserved. Recommended update for a smoother experience.

= 2.3.0 =
The Guides panel has been replaced with the new Insight Library. All functionality is backward-compatible; existing API settings and history are preserved. The Library adds 30 pre-built queries that work without an API key — ideal for demonstration and evaluation.

== Credits ==

Built by the SILC team. Uses Chart.js for visualizations (MIT license). WordPress admin UI built on @wordpress/element and @wordpress/components.
