# SILC WooInsight AI

**Natural language to data visualization for WooCommerce.**

Ask plain-English questions — _"What were my best selling products last month?"_, _"Show me pending orders"_, _"How much revenue yesterday?"_ — and get instant charts, clickable lists, and precise answers. No SQL. No exporting. No clicking through twenty admin screens.

---

## ✨ Why WooInsight AI?

### 🗣️ Natural Language → Data Visualization

AI bridges the gap between curiosity and code. This plugin brings that power into your WooCommerce dashboard. You run the store — the plugin writes and executes the queries. Every answer appears as a rich visualization: an interactive chart, a sortable list with clickable links, or a clean numeric answer.

### 🔒 True Data Privacy

The AI **never sees your actual data**. Only database schema metadata — table names and column types — is sent in the prompt. Your sales numbers, customer emails, and order details stay inside your database. This is critical for:

- **GDPR** compliance — no personal data transmitted to third parties
- **HIPAA**-adjacent environments — no PHI exposure
- **PCI** awareness — payment data never leaves your infrastructure
- **Regulated industries** — financial, legal, healthcare

### 📊 Visualization Over Spreadsheets

Stop digging through admin panels and exporting CSVs. Each insight renders in one of three rich formats:

| Type | Example | Output |
|------|---------|--------|
| **Chart** | "Monthly revenue trend" | Interactive Chart.js (bar, line, pie, doughnut, horizontalBar) |
| **List** | "Top 10 customers by spending" | Clickable rows with direct links to orders, products, customers |
| **Answer** | "Total revenue yesterday" | Large formatted number with context |

---

## 🚀 Quick Start

1. Install the plugin
2. Go to **WooCommerce → WooInsight AI**
3. (Optional) Add your API key in the ⚙️ Settings panel
4. Start asking questions — or browse the built-in Library

**No API key?** The Insight Library has 30 pre-built queries that work immediately with zero configuration.

---

## 📚 Insight Library (v2.3+)

30 ready-to-execute insights — no AI, no API key, no configuration:

### 📈 Charts & Trends (10)
Best selling products · Monthly revenue trend · Order status distribution · Sales by category · Daily orders/revenue · Top products by quantity · Month vs month comparison · Weekly revenue · Revenue by day of week

### 📋 Lists & Details (12)
Top customers by spending · Recent orders · Low stock products · Pending/On-hold/Refunded orders · Out of stock products · Best selling categories · Orders with coupons · Latest customers · Never-purchased products · Top rated products

### ℹ️ Quick Answers (8)
Revenue this month/yesterday/year · Total orders · Average order value · Product count · Customer count · Tax collected

All searchable with regex. One click to execute.

---

## 🔧 Technical Details

### Architecture

```
User Question (plain English)
        │
        ▼
┌──────────────────────┐
│   AI API (BYOK)      │  ← Schema-only prompt
│   Returns JSON:       │     (table/column names)
│   { sql, type,        │
│     chart_config... } │
└──────────────────────┘
        │
        ▼
┌──────────────────────┐
│   SQL Validator      │  ← SELECT-only whitelist
│   Table whitelist    │     DML/DDL blocked
│   Function whitelist │     Multi-statement blocked
└──────────────────────┘
        │
        ▼
┌──────────────────────┐
│   wpdb Execution     │  ← Runs locally
│   Row data stays     │
│   on your server     │
└──────────────────────┘
        │
        ▼
┌──────────────────────┐
│   Insight Renderer   │  ← Chart.js / List / Answer
│   Admin links        │
│   Value formatting   │
└──────────────────────┘
```

### Security

- **SELECT-only** — No INSERT, UPDATE, DELETE, DROP, ALTER, or multi-statement queries
- **Table whitelist** — Only known WooCommerce tables allowed
- **Function whitelist** — Only safe SQL functions permitted (COUNT, SUM, AVG, DATE_FORMAT, COALESCE, etc.)
- **Capability check** — `manage_woocommerce` required for all AJAX endpoints
- **Nonce verification** — All requests validated with WordPress nonces

### BYOK — Bring Your Own Key

Works with any OpenAI-compatible `/chat/completions` endpoint:

- **OpenAI** — `api.openai.com`
- **Azure OpenAI** — Your instance endpoint
- **Ollama** — `localhost:11434`
- **LocalAI** — Self-hosted
- **vLLM** — Self-hosted
- **LM Studio** — Local
- Any compatible proxy or gateway

### Reasoning Model Support

Auto-detects reasoning models (o1, o3, DeepSeek-R1, Claude 3.5 Opus, Gemini Flash Thinking) and adjusts parameters: omits temperature, folds system prompt into user message, and allocates appropriate token budget.

### HPOS & Legacy Compatible

Dynamically discovers your active WooCommerce order storage backend. Adjusts table references automatically. Both HPOS and legacy post-based orders are fully supported.

---

## 📦 Requirements

| Component | Minimum |
|-----------|---------|
| WordPress | 6.0+ |
| WooCommerce | 8.0+ |
| PHP | 7.4+ |
| API Key | Optional (Library works without) |

---

## 🏗️ Development

```bash
# Install dependencies
npm install
composer install

# Build JS bundle
npm run build

# Lint
npm run lint
```

The React dashboard is built with `@wordpress/element` and `@wordpress/components` — zero third-party UI frameworks. Chart.js is bundled as a minimal asset (MIT license).

---

## 📄 License

GPL v2 or later. See [LICENSE](./LICENSE) for full text.

---

## 🔗 Links

- **Plugin URI**: [GitHub](https://github.com/roypr/silc-wooinsight-ai)
- **Chart.js**: [chartjs.org](https://www.chartjs.org/) (MIT)
