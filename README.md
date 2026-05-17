# Marktrader

Marktrader is a self-hosted financial markets trading intelligence tool that pairs a browser-native trading interface with **Lumen**, a market intelligence engine running two independent decision loops: an Intraday loop that scans on a thirty-minute cadence for swing and structural trades, and a Scalper loop that scans on a sixty-second cadence for short-horizon entries. The intelligence engine sits behind Vercel API routes with a server-side multi-provider fallback chain so the engines stay alive when one provider is down, and the front end is a pure browser application that runs without a build step beyond a static deploy.

`Status: Live at marktrader.vercel.app · Phase 2 in development · Last updated: 2026-05-17 (Phase 3 of the gateway shipped; Marktrader Gemini fallback wiring next)`

## Two engines, one tab

| Engine | Cadence | Confidence threshold | What it picks up |
|---|---|---|---|
| Lumen Intraday | Thirty-minute scans | 75 and above | Three instruments per UTC day chosen from the weekday universe (BTCUSD, ETHUSD, SOLUSD, XAUUSD, XAGUSD, EURUSD, GBPUSD, USDJPY, GBPJPY, SPX500, NAS100, US30, USOIL), filtered to crypto on weekends |
| Lumen Scalper | Sixty-second scans | 65 weekday, 75 weekend | Whichever instruments the user has selected, filtered to crypto on weekends |

Both engines run a three-tier confirmation framework: structure (trend, support and resistance, EMA-50 position), momentum (RSI, MACD, Stochastic, with at least two of three required to confirm), and context (session quality, fear and greed, spread, COT direction, recent news absence). Both produce a structured signal with action (BUY/SELL/SKIP), confidence (0 to 100), lots, stop loss, take profit, entry logic, key risk, and (for the Scalper) a grade of A, B, or C.

## Risk and behaviour governance

Marktrader treats trader behaviour as a first-class signal rather than as a soft afterthought, and the behaviour engine runs six detectors over the rolling seven-day trade log, deducting from a behaviour score on every flag:

| Flag | Detects | Score deduction |
|---|---|---|
| `REVENGE_TRADE` | A second trade entered within fifteen minutes of a stop-out, on the same instrument, in the same direction | −10 |
| `FOMO_ENTRY` | A market order on an instrument that has just moved 1.5×ATR in the last three bars | −7 |
| `EARLY_EXIT` | A position closed below 0.5R of its take profit while the underlying signal still holds | −5 |
| `STOP_WIDENING` | A stop-loss moved further from entry after the trade is open | −6 |
| `OVERTRADE` | More than the daily-cap number of trades on a single instrument in one UTC day | −4 |
| `TILT_PATTERN` | Three consecutive losing trades within a sixty-minute window | −12 |

The Risk Calculator surfaces position sizing with a Lumen sanity check before the order goes in, and the Lumen system prompt explicitly enforces a stop loss of at least one ATR from entry, a minimum 1.5R take profit ratio, no doubling-down on existing same-instrument-same-direction positions, and a twenty-point confidence reduction within thirty minutes of any high-impact news event.

## Other features

| Feature | What it covers |
|---|---|
| 54-instrument universe | Equities, forex, crypto, metals, indices, commodities |
| Multi-timeframe charts | 1m / 5m / 15m / 1h / 4h / 1D / 1W |
| Technical indicators | RSI, MACD, Bollinger Bands, EMA, SMA, VWAP |
| Wyckoff phase classifier | Sonnet-4.6 keyed by H4 bar timestamp; only re-fires on a new H4 close |
| Regime detector | Pure browser ADX, ATR percentile, Bollinger compression, combined with cached Wyckoff to produce a regime label |
| Liquidity zones | Pure browser detector across H1, H4, D1; 1-hour localStorage cache |
| Correlation heatmap | Pearson matrix across the Tier 1+2+3 universe; detects breakdowns between halves of the return series |
| Real Yields | FRED proxy with Upstash Redis cache and 24-hour localStorage |
| COT data | CFTC Commitments of Traders weekly proxy, 7-day cache |
| Economic calendar | TradingView free-CORS calendar with pre-event-caution and post-event-opportunity flags |
| Sessions | Active session detection with confidence multipliers (Asian 0.5, London Open 1.2, NY Open 1.4, NY Close 0.7) |
| Sim Trader | Paper trading with P&L tracking, persisted positions, full order entry |
| Trade Journal | Log trades with entry/exit/notes; performance stats including win rate, R:R, profit factor, session heatmap |
| Trading Academy | Seven-stage structured progression with Haiku-graded submissions returning JSON criteria results |
| Price alerts | Configurable per-instrument with browser notification |
| Chart analysis | Screenshot upload for Lumen-driven multi-timeframe analysis |

## Tech stack

| Layer | Technology |
|---|---|
| Front end | Vanilla JavaScript, modular ES modules, HTML, CSS custom properties |
| Charts | Lightweight Charts (TradingView) |
| Live prices | Binance WebSocket (crypto), Deriv WebSocket (forex and metals), Vercel `/api/prices` (indices and commodities) |
| Candles | Twelve Data via Vercel `/api/candles` with Upstash Redis cache |
| Lumen Intraday | `claude-sonnet-4-6` with Gemini 2.5 Flash server-side fallback, via Vercel `/api/scan` |
| Lumen Scalper | `claude-haiku-4-5-20251001` with Gemini 2.5 Flash server-side fallback, via Vercel `/api/behaviour` |
| Sentiment poller | Grok 3 → Claude Haiku 4.5 → Gemini 2.5 Flash, via Vercel `/api/sentiment`; runs every five minutes when an engine is active |
| Big-picture market read | `claude-opus-4-7` for the Markets-tab `/api/scan` default |
| Persistence | localStorage for trade journal, behaviour log, scalp log, academy progress, watchlists, alerts |
| Server cache | Upstash Redis for candle data, FRED proxy, COT proxy |
| Hosting | Vercel (serverless functions for the API layer, static front end) |

## Daily budget tracker

A per-UTC-day cap protects the operator against runaway spend, since the server already handles model fallback and the budget is a hard cap rather than a throttle: 200 Intraday calls, 1500 Scalper calls, 300 sentiment polls, 30 instrument-selection calls, all reset at the next UTC date roll-over. State is persisted in localStorage and surfaces as a small chip in the Lumen tab.

## Build status

Build is staged in fifteen-numbered stages, with stages 4 (Sim Trader), 5 (Lumen engine refactor), 6 (Academy infrastructure), and 15 (Performance and polish) shipped, and the remaining stages (Stage 0 modular file refactor, navigation shell, Home tab, Marktrader Chart component, Academy content stages 1 to 7, Behaviour engine, Trader Passport, Markets tab, Onboarding flow, Settings and legal) running in order. The Cloudflare Worker that previously fronted the Lumen calls was retired in April 2026 in favour of the Vercel API routes, which also have Redis caching the Worker lacked.

## Local development

Marktrader is a static front end with serverless API routes, so the simplest local pass is the Vercel CLI, which runs the front end and the API routes together with the same env-var resolution as production:

```bash
git clone https://github.com/osiabu/Marktrader.git
cd Marktrader
npx vercel dev
```

For a pure front-end pass without the API layer (the engines will not be able to call out), open `index.html` directly in any modern browser.

## Required environment variables

`ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `GROK_API_KEY` (sentiment poller only), `TWELVEDATA_API_KEY`, `FRED_API_KEY`, `FINNHUB_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`. Full list with descriptions is in `.env.example`.

---

Osi Abu, Aperintel · [osiabu.vercel.app](https://osiabu.vercel.app)
