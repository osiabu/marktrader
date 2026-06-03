// ════════════════════════════════════════════════════════════════════
// HOME COMMAND CENTRE
// All renderers prefixed home_. The page reads cached LumenIntel.*
// payloads where possible and never blocks on a fresh upstream call.
// ════════════════════════════════════════════════════════════════════

// Default watch set used when atTodayInstruments has not been picked yet.
var HOME_DEFAULT_WATCH = ['XAUUSD', 'BTCUSD', 'EURUSD'];

// Display names for instrument cards.
var HOME_INSTRUMENT_NAMES = {
  BTCUSD: 'Bitcoin', ETHUSD: 'Ethereum', SOLUSD: 'Solana',
  XAUUSD: 'Gold', XAGUSD: 'Silver', XPTUSD: 'Platinum', XCUUSD: 'Copper',
  EURUSD: 'Euro', GBPUSD: 'Sterling', USDJPY: 'Yen', GBPJPY: 'Guppy',
  USDCAD: 'Loonie', AUDUSD: 'Aussie', NZDUSD: 'Kiwi', USDCHF: 'Swissy',
  SPX500: 'S and P 500', NAS100: 'Nasdaq 100', US30: 'Dow 30',
  USOIL: 'WTI Crude', UKOIL: 'Brent Crude', NATGAS: 'Natural Gas'
};

// Map from Lumen Intraday instrument to COT asset key for legacyCacheRow.
var HOME_COT_KEY = {
  XAUUSD: 'gold', XAGUSD: 'silver', XCUUSD: 'copper',
  USOIL: 'oil', UKOIL: 'oil', NATGAS: 'natgas',
  EURUSD: 'eurusd', GBPUSD: 'gbpusd', USDJPY: 'jpyusd',
  USDCHF: 'chfusd', USDCAD: 'cadusd', AUDUSD: 'audusd', NZDUSD: 'nzdusd',
  BTCUSD: 'btc', ETHUSD: 'ether'
};

// ── UTC clock ───────────────────────────────────────────────────────
function home_tickClock() {
  var el = document.getElementById('home-utc-clock');
  if (!el) return;
  var now = new Date();
  var hh = String(now.getUTCHours()).padStart(2, '0');
  var mm = String(now.getUTCMinutes()).padStart(2, '0');
  var ss = String(now.getUTCSeconds()).padStart(2, '0');
  el.textContent = hh + ':' + mm + ':' + ss + ' UTC';
}

// ── Live ticker rebuild every thirty seconds ────────────────────────
var _homeTickerTimer = null;
function home_startTickerInterval() {
  if (_homeTickerTimer) return;
  if (typeof rebuildPriceStrip === 'function') rebuildPriceStrip();
  _homeTickerTimer = setInterval(function () {
    if (document.visibilityState === 'hidden') return;
    if (typeof rebuildPriceStrip === 'function') rebuildPriceStrip();
  }, 30000);
}

// ── Status strip ────────────────────────────────────────────────────
function home_refreshStatusStrip() {
  // Session
  var sessDot = document.getElementById('home-session-dot');
  var sessLabel = document.getElementById('home-session-label');
  if (sessDot && sessLabel) {
    var info = home_currentSession();
    sessLabel.textContent = info.label;
    if (info.high) {
      sessDot.style.background = 'var(--green)';
      sessDot.style.boxShadow = '0 0 6px rgba(0,232,122,0.6)';
      sessDot.style.animation = 'pulse 1.6s infinite';
    } else {
      sessDot.style.background = 'var(--text4)';
      sessDot.style.boxShadow = 'none';
      sessDot.style.animation = 'none';
    }
  }

  // Fear and Greed
  var fngEl = document.getElementById('home-fng-display');
  if (fngEl) {
    if (typeof scalpFearGreed !== 'undefined' && scalpFearGreed && scalpFearGreed.value != null) {
      var v = scalpFearGreed.value;
      var lbl = scalpFearGreed.label || home_fngLabel(v);
      var col = v < 30 ? 'var(--red)' : v < 50 ? '#FF9900' : v < 70 ? 'var(--text)' : 'var(--teal)';
      fngEl.innerHTML = '<span style="color:' + col + ';font-weight:600;">' + v + '</span>'
        + '<span class="qual" style="color:var(--text3);font-size:11px;font-weight:400;margin-left:6px;">' + lbl + '</span>';
    } else {
      fngEl.textContent = 'Standby';
      if (typeof scalpFetchFearGreed === 'function') {
        scalpFetchFearGreed().then(function (fg) {
          if (typeof scalpFearGreed !== 'undefined') scalpFearGreed = fg;
          home_refreshStatusStrip();
        }).catch(function () {});
      }
    }
  }

  // Market pulse
  var pulseEl = document.getElementById('home-pulse-label');
  if (pulseEl && typeof atGetSessionScore === 'function') {
    var s = atGetSessionScore();
    var score = s && s.score != null ? s.score : 0;
    var word, col;
    if (score >= 75)      { word = 'Active';   col = 'var(--teal)'; }
    else if (score >= 45) { word = 'Moderate'; col = '#FF9900'; }
    else if (score < 20)  { word = 'Quiet';    col = 'var(--text3)'; }
    else                  { word = 'Volatile'; col = 'var(--purple)'; }
    pulseEl.textContent = word;
    pulseEl.style.color = col;
  }

  // Open exposure
  var exEl = document.getElementById('home-portfolio-state');
  if (exEl) {
    var ledger = home_collectPositions();
    var openCount = ledger.length;
    if (openCount === 0) {
      exEl.textContent = 'No positions open';
      exEl.style.color = 'var(--text3)';
    } else {
      var floating = ledger.reduce(function (acc, r) { return acc + (r.pnl || 0); }, 0);
      var pnlSign = floating >= 0 ? '+' : '';
      var pnlCol  = floating > 0 ? 'var(--green)' : floating < 0 ? 'var(--red)' : 'var(--text)';
      exEl.innerHTML = openCount + (openCount === 1 ? ' position. ' : ' positions. ')
        + '<span style="color:' + pnlCol + ';font-weight:600;">' + pnlSign + '$' + Math.abs(floating).toFixed(0) + '</span>';
    }
  }

  // Next event
  var evEl = document.getElementById('home-next-event');
  if (evEl) {
    var cal = home_getCachedCalendar();
    if (cal && cal.nearest_high) {
      var ne = cal.nearest_high;
      var due = home_minutesUntil(ne.timestamp);
      var dueText = due == null ? '' : (due > 60 ? Math.round(due / 60) + ' h' : due > 0 ? due + ' min' : 'now');
      var prefix = ne.country ? (ne.country + ' ') : '';
      evEl.innerHTML = '<span style="color:var(--gold);font-weight:600;">' + (dueText || 'imminent') + '</span>'
        + '<span class="qual" style="color:var(--text3);font-size:11px;font-weight:400;margin-left:6px;">' + prefix + (ne.title || 'High impact release') + '</span>';
    } else {
      evEl.textContent = 'Calendar quiet';
      evEl.style.color = 'var(--text3)';
    }
  }

  // Refreshed stamp
  var stamp = document.getElementById('home-hero-refresh-stamp');
  if (stamp) {
    var n = new Date();
    stamp.textContent = String(n.getUTCHours()).padStart(2, '0') + ':' + String(n.getUTCMinutes()).padStart(2, '0') + ' UTC';
  }
}

function home_currentSession() {
  var now = new Date();
  var t = now.getUTCHours() * 60 + now.getUTCMinutes();
  var asia    = (t >= 0 && t < 9 * 60);
  var london  = (t >= 8 * 60 && t < 17 * 60);
  var ny      = (t >= 13 * 60 && t < 22 * 60);
  var overlap = london && ny;
  if (overlap) return { label: 'London and New York overlap', high: true };
  if (london)  return { label: 'London open', high: true };
  if (ny)      return { label: 'New York open', high: true };
  if (asia)    return { label: 'Asia open', high: false };
  return { label: 'Off hours', high: false };
}

function home_fngLabel(v) {
  if (v < 25) return 'Extreme fear';
  if (v < 45) return 'Fear';
  if (v < 55) return 'Neutral';
  if (v < 75) return 'Greed';
  return 'Extreme greed';
}

function home_minutesUntil(ts) {
  if (!ts) return null;
  var d = new Date(ts);
  if (isNaN(d.getTime())) return null;
  return Math.round((d.getTime() - Date.now()) / 60000);
}

function home_getCachedCalendar() {
  if (!window.LumenIntel || !window.LumenIntel.calendar) return null;
  var c = null;
  try { c = window.LumenIntel.calendar.cached(); } catch (_) {}
  if (c) return c;
  // Trigger first fetch quietly; will populate on next tick.
  try { window.LumenIntel.calendar().catch(function () {}); } catch (_) {}
  return null;
}

// ── Intelligence snapshot grid ──────────────────────────────────────
function home_pickWatchInstruments() {
  if (typeof atTodayInstruments !== 'undefined' && Array.isArray(atTodayInstruments) && atTodayInstruments.length) {
    return atTodayInstruments.slice(0, 3);
  }
  return HOME_DEFAULT_WATCH.slice();
}

// ── Stream-native day stats, tick buffer and momentum (no external API) ──────
var _homeTickBuf = {};   // inst -> [{ t, p }] recent samples for momentum

function home_dayKey(inst) {
  var d = new Date();
  return 'wm_home_day_' + inst + '_' + d.getUTCFullYear() + '-' + (d.getUTCMonth() + 1) + '-' + d.getUTCDate();
}

// Returns { open, hi, lo } for the current UTC day. When a price is passed it
// also updates the high and low. A new UTC day starts a fresh record because
// the key carries the date, so yesterday's open never leaks into today.
function home_dayStats(inst, price) {
  var key = home_dayKey(inst);
  var rec = null;
  try { var raw = localStorage.getItem(key); rec = raw ? JSON.parse(raw) : null; } catch (_) { rec = null; }
  if (price == null || isNaN(price)) return (rec && typeof rec === 'object') ? rec : null;
  if (!rec || typeof rec !== 'object') {
    rec = { open: price, hi: price, lo: price };
  } else {
    if (price > rec.hi) rec.hi = price;
    if (price < rec.lo) rec.lo = price;
  }
  try { localStorage.setItem(key, JSON.stringify(rec)); } catch (_) {}
  return rec;
}

function home_sampleTicks() {
  var picks = home_pickWatchInstruments();
  var now = Date.now();
  var live = (typeof livePriceCache !== 'undefined') ? livePriceCache : {};
  picks.forEach(function (inst) {
    var p = live[inst];
    if (p == null || isNaN(p)) return;
    home_dayStats(inst, p);
    var buf = _homeTickBuf[inst] || (_homeTickBuf[inst] = []);
    buf.push({ t: now, p: p });
    var cutoff = now - 120000;   // keep the last two minutes
    while (buf.length && buf[0].t < cutoff) buf.shift();
    if (buf.length > 60) buf.splice(0, buf.length - 60);
  });
}

// Momentum over roughly the last sixty seconds, from the in-memory tick buffer.
function home_momentum(inst) {
  var buf = _homeTickBuf[inst];
  if (!buf || buf.length < 2) return null;
  var last = buf[buf.length - 1];
  var target = last.t - 60000;
  var ref = buf[0];
  for (var i = 0; i < buf.length; i++) { if (buf[i].t <= target) ref = buf[i]; else break; }
  return { delta: last.p - ref.p, secs: Math.max(1, Math.round((last.t - ref.t) / 1000)), samples: buf.length };
}

// Global strip: behaviour score and sim account, both from local data only.
function home_refreshTraderStrip() {
  var el = document.getElementById('home-trader-strip');
  if (!el) return;
  var cardStyle = 'flex:1;min-width:180px;background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:10px 12px;';
  var labelStyle = 'font-family:var(--font-mono);font-size:8px;letter-spacing:1.5px;color:var(--text4);margin-bottom:4px;';
  var mainStyle = "font-family:'Inter',sans-serif;font-size:20px;font-weight:800;letter-spacing:-0.03em;";
  var subStyle = 'font-size:11px;color:var(--text3);font-weight:600;';
  var metaStyle = 'font-family:var(--font-mono);font-size:9px;color:var(--text4);margin-top:3px;';
  var html = '';

  var beh = (typeof calcBehaviourScore === 'function') ? calcBehaviourScore(7) : null;
  if (beh) {
    var bCol = beh.score >= 80 ? 'var(--green)' : beh.score >= 60 ? 'var(--blue)' : beh.score >= 40 ? 'var(--gold)' : 'var(--red)';
    var bArr = beh.trend === 'UP' ? '▲' : beh.trend === 'DOWN' ? '▼' : '◉';
    var flag = beh.topFlag ? ('last flag ' + String(beh.topFlag).toLowerCase().replace(/_/g, ' ')) : 'no flags in 7d';
    html += '<div style="' + cardStyle + '">'
      + '<div style="' + labelStyle + '">BEHAVIOUR</div>'
      + '<div style="' + mainStyle + 'color:' + bCol + ';">' + beh.score
        + '<span style="' + subStyle + '">/100</span> <span style="' + subStyle + '">' + beh.label + ' ' + bArr + '</span></div>'
      + '<div style="' + metaStyle + '">' + flag + '</div>'
      + '</div>';
  }

  if (typeof simAccount !== 'undefined' && simAccount) {
    var pos = home_collectPositions();
    var openPnl = pos.reduce(function (a, r) { return a + (r.pnl || 0); }, 0);
    var equity = (simAccount.balance || 0) + openPnl;
    var peak = simAccount.peakBalance || simAccount.startBalance || simAccount.balance || 0;
    var dd = peak > 0 ? Math.max(0, (peak - (simAccount.balance || 0)) / peak * 100) : 0;
    var pCol = openPnl > 0 ? 'var(--green)' : openPnl < 0 ? 'var(--red)' : 'var(--text3)';
    html += '<div style="' + cardStyle + '">'
      + '<div style="' + labelStyle + '">SIM ACCOUNT</div>'
      + '<div style="' + mainStyle + 'color:var(--text);">$' + equity.toLocaleString(undefined, { maximumFractionDigits: 0 })
        + '<span style="' + subStyle + '"> equity</span></div>'
      + '<div style="' + metaStyle + '">open <span style="color:' + pCol + ';">' + (openPnl >= 0 ? '+' : '-') + '$' + Math.abs(openPnl).toFixed(2) + '</span>'
        + ' · ' + pos.length + ' open · DD ' + dd.toFixed(1) + '%</div>'
      + '</div>';
  }

  el.innerHTML = html;
}

function home_refreshIntelSnapshot() {
  var grid = document.getElementById('home-intel-grid');
  if (!grid) return;
  var picks = home_pickWatchInstruments();
  var todayActive = (typeof atTodayInstruments !== 'undefined' && Array.isArray(atTodayInstruments) && atTodayInstruments.length);

  // Stamp
  var stamp = document.getElementById('home-snapshot-stamp');
  if (stamp) {
    if (todayActive) {
      stamp.textContent = "Lumen's picks for today";
    } else {
      stamp.textContent = 'Default watch. Start Intraday for fresh picks.';
    }
  }

  // Two identical copies of the cards so the marquee can translate -50% and
  // line the second copy up where the first started — a true seamless loop.
  // The track element is reused across refreshes so the CSS animation keeps
  // its phase instead of restarting every 15 seconds.
  var seq = picks.map(function (inst) {
    return home_renderIntelCard(inst, todayActive);
  }).join('');
  var track = grid.querySelector('.home-intel-track');
  if (!track) {
    grid.innerHTML = '<div class="home-intel-track"></div>';
    track = grid.querySelector('.home-intel-track');
  }
  track.innerHTML = seq + seq;

  // Sample the live price stream so day stats and momentum stay current. This
  // is the whole data source for the cards now: the old phase, regime, COT,
  // real-yields and liquidity feeds were removed because they depended on
  // rate-limited Twelve Data, CFTC and FRED endpoints and sat permanently at
  // "Not yet read". Everything here comes from the price stream and your own
  // local data, so the cards cannot go stale the same way.
  home_sampleTicks();
}

function home_renderIntelCard(inst, todayActive) {
  var name = HOME_INSTRUMENT_NAMES[inst] || inst;
  var price = (typeof livePriceCache !== 'undefined' && livePriceCache[inst]) ? livePriceCache[inst] : null;
  var priceStale = price != null && typeof priceIsStale === 'function' && priceIsStale(inst);
  var priceTxt = price != null
    ? (home_formatPrice(price, inst) + (priceStale ? '<span title="Last working day close" style="font-size:9px;color:var(--text4);margin-left:6px;letter-spacing:1px;font-weight:500;">CLOSED</span>' : ''))
    : 'Awaiting feed';

  // Stream-native intel. Everything below comes from the live price stream
  // (today's move, momentum, day range) plus the LLM-free session module. No
  // candle or macro API, so these rows cannot freeze at "Not yet read".
  var ds = home_dayStats(inst, price);
  var mom = home_momentum(inst);
  var sess = (window.LumenIntel && window.LumenIntel.session) ? window.LumenIntel.session() : null;

  // Top stripe direction from today's move.
  var dayChg = (ds && ds.open && price != null) ? (price - ds.open) : null;
  var stripeClass = todayActive ? 'is-active' : '';
  if (dayChg != null && dayChg > 0) stripeClass = 'is-bullish';
  else if (dayChg != null && dayChg < 0) stripeClass = 'is-bearish';

  var rows = '';

  // Today's move versus the captured session open.
  if (dayChg != null && ds.open) {
    var pct = (dayChg / ds.open) * 100;
    var dCol = dayChg > 0 ? 'var(--green)' : dayChg < 0 ? 'var(--red)' : 'var(--text3)';
    var dArr = dayChg > 0 ? '▲' : dayChg < 0 ? '▼' : '◉';
    rows += home_intelRow('Today',
      '<strong style="color:' + dCol + ';">' + (dayChg >= 0 ? '+' : '') + pct.toFixed(2) + '%</strong>'
      + '<span class="qual" style="color:' + dCol + ';margin-left:6px;">' + dArr + ' ' + (dayChg >= 0 ? '+' : '-') + home_formatPrice(Math.abs(dayChg), inst) + '</span>');
  } else {
    rows += home_intelRow('Today', '<span style="color:var(--text4);">opening reference warming</span>');
  }

  // Short-window momentum from the tick buffer.
  if (mom && mom.samples >= 2) {
    var mCol = mom.delta > 0 ? 'var(--green)' : mom.delta < 0 ? 'var(--red)' : 'var(--text3)';
    var mTxt = mom.delta > 0 ? '▲ rising' : mom.delta < 0 ? '▼ falling' : '◉ flat';
    rows += home_intelRow('Momentum',
      '<strong style="color:' + mCol + ';">' + mTxt + '</strong>'
      + '<span class="qual">' + mom.secs + 's ' + (mom.delta >= 0 ? '+' : '-') + home_formatPrice(Math.abs(mom.delta), inst) + '</span>');
  } else {
    rows += home_intelRow('Momentum', '<span style="color:var(--text4);">reading the tape</span>');
  }

  // Session multiplier (LLM-free time module, already reliable).
  if (sess && sess.primary_session) {
    var mult = sess.signal_confidence_multiplier;
    rows += home_intelRow('Session', '<strong>' + sess.primary_session + '</strong>'
      + '<span class="qual">x ' + (mult != null ? mult.toFixed(2) : '1.00') + '</span>');
  }

  // Day range position: where price sits between today's low and high.
  var liq = '';
  if (ds && ds.hi != null && ds.lo != null && ds.hi > ds.lo && price != null) {
    var posPct = Math.max(0, Math.min(100, ((price - ds.lo) / (ds.hi - ds.lo)) * 100));
    liq = '<div class="home-intel-range">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;">'
        + '<span style="font-family:var(--font-mono);font-size:8px;color:var(--text4);letter-spacing:1px;">DAY RANGE</span>'
        + '<span style="font-family:var(--font-mono);font-size:9px;color:var(--text3);">' + Math.round(posPct) + '%</span>'
      + '</div>'
      + '<div style="height:5px;background:var(--bg3);border-radius:3px;margin-top:4px;position:relative;">'
        + '<div style="position:absolute;left:' + posPct.toFixed(1) + '%;top:-1px;width:3px;height:7px;background:var(--gold);border-radius:1px;transform:translateX(-50%);"></div>'
      + '</div>'
      + '<div style="display:flex;justify-content:space-between;margin-top:3px;font-family:var(--font-mono);font-size:8px;color:var(--text4);">'
        + '<span>L ' + home_formatPrice(ds.lo, inst) + '</span>'
        + '<span>H ' + home_formatPrice(ds.hi, inst) + '</span>'
      + '</div>'
      + '</div>';
  } else {
    liq = '<div class="home-intel-card-empty">Day range builds as price ticks in.</div>';
  }

  return '<article class="home-intel-card ' + stripeClass + '">'
    + '<div class="home-intel-head">'
      + '<div>'
        + '<span class="home-intel-symbol">' + inst + '</span>'
        + '<span class="home-intel-symbol-name">' + name + '</span>'
      + '</div>'
      + '<div>'
        + '<div class="home-intel-price">' + priceTxt + '</div>'
      + '</div>'
    + '</div>'
    + '<div class="home-intel-rows">' + rows + '</div>'
    + '<div class="home-intel-liq">' + liq + '</div>'
    + '</article>';
}

function home_intelRow(label, value) {
  return '<div class="home-intel-row">'
    + '<span class="home-intel-row-label">' + label + '</span>'
    + '<span class="home-intel-row-value">' + value + '</span>'
    + '</div>';
}

function home_formatPrice(p, inst) {
  if (p == null || isNaN(p)) return 'Awaiting feed';
  var n = Number(p);
  // Forex pairs use 4 or 5 decimals; metals 2; crypto/indices use a comma-grouped integer with 2 decimals.
  if (/^[A-Z]{3}JPY$/.test(inst)) return n.toFixed(3);
  if (/^[A-Z]{6}$/.test(inst)) return n.toFixed(5);
  if (inst === 'XAUUSD' || inst === 'XAGUSD' || inst === 'XPTUSD' || inst === 'XCUUSD') return n.toFixed(2);
  if (n >= 1000) return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (n >= 100)  return n.toFixed(2);
  if (n >= 1)    return n.toFixed(3);
  return n.toFixed(4);
}

// ── Open positions ledger ──────────────────────────────────────────
function home_collectPositions() {
  var rows = [];
  var live = (typeof livePriceCache !== 'undefined') ? livePriceCache : {};

  if (typeof atPositions !== 'undefined' && Array.isArray(atPositions)) {
    atPositions.forEach(function (p) {
      var sym = p.pair || p.instrument;
      var lp = live[sym] || p.entry;
      var lots = p.lots || p.lotSize || 0;
      var pnl = p.dir === 'BUY' ? (lp - p.entry) * lots : (p.entry - lp) * lots;
      rows.push({
        source: 'intraday', sym: sym, dir: p.dir, lots: lots,
        entry: p.entry, sl: p.sl, tp: p.tp, live: lp, pnl: pnl, openedAt: p.openedAt
      });
    });
  }
  if (typeof scalpPositions !== 'undefined' && Array.isArray(scalpPositions)) {
    scalpPositions.forEach(function (p) {
      var sym = p.instrument;
      var lp = live[sym] || p.entry;
      var lots = p.lots || 0.02;
      var pnl = p.dir === 'BUY' ? (lp - p.entry) * lots : (p.entry - lp) * lots;
      rows.push({
        source: 'scalp', sym: sym, dir: p.dir, lots: lots,
        entry: p.entry, sl: p.sl, tp: p.tp, live: lp, pnl: pnl, openedAt: p.openedAt
      });
    });
  }
  if (typeof simPositions !== 'undefined' && Array.isArray(simPositions)) {
    simPositions.forEach(function (p) {
      var sym = p.inst;
      var lp = live[sym] || p.entryPrice;
      var diff = p.dir === 'BUY' ? lp - p.entryPrice : p.entryPrice - lp;
      var pnl = diff * (p.pipVal || 10) * (p.lots || 0);
      rows.push({
        source: 'sim', sym: sym, dir: p.dir, lots: p.lots,
        entry: p.entryPrice, sl: p.sl, tp: p.tp, live: lp, pnl: pnl, openedAt: p.openedAt
      });
    });
  }
  return rows;
}

function home_refreshLedger() {
  var el = document.getElementById('home-ledger');
  if (!el) return;
  var rows = home_collectPositions();
  var stamp = document.getElementById('home-ledger-stamp');
  if (stamp) {
    stamp.textContent = rows.length === 0 ? 'no positions open'
      : rows.length === 1 ? '1 position open'
      : rows.length + ' positions open';
  }

  if (!rows.length) {
    el.innerHTML = '<div class="home-ledger-empty">No open positions. Start an engine from the launch panel below.</div>';
    return;
  }

  var head = '<div class="home-ledger-head">'
    + '<span>Engine</span>'
    + '<span>Side</span>'
    + '<span>Instrument</span>'
    + '<span class="home-ledger-head-num">Entry</span>'
    + '<span class="home-ledger-head-num">Live</span>'
    + '<span class="home-ledger-head-num">Lots</span>'
    + '<span class="home-ledger-head-num">P and L</span>'
    + '</div>';

  var body = rows.map(function (r) {
    var pnlSign = r.pnl >= 0 ? '+' : '';
    var pnlCls  = r.pnl > 0 ? 'up' : r.pnl < 0 ? 'down' : '';
    var name = HOME_INSTRUMENT_NAMES[r.sym] || '';
    return '<div class="home-ledger-row">'
      + '<span class="home-ledger-source ' + r.source + '">' + (r.source === 'sim' ? 'Sim' : r.source === 'scalp' ? 'Scalp' : 'Intraday') + '</span>'
      + '<span class="home-ledger-side ' + (r.dir === 'BUY' ? 'buy' : 'sell') + '">' + r.dir + '</span>'
      + '<span><span class="home-ledger-symbol">' + r.sym + '</span>'
        + (name ? '<span class="home-ledger-symbol-meta">' + name + '</span>' : '')
      + '</span>'
      + '<span class="home-ledger-num">' + home_formatPrice(r.entry, r.sym) + '</span>'
      + '<span class="home-ledger-num"><strong>' + home_formatPrice(r.live, r.sym) + '</strong></span>'
      + '<span class="home-ledger-num">' + (r.lots != null ? Number(r.lots).toFixed(2) : '0.00') + '</span>'
      + '<span class="home-ledger-num ' + pnlCls + '"><strong>' + pnlSign + '$' + Math.abs(r.pnl || 0).toFixed(2) + '</strong></span>'
      + '</div>';
  }).join('');

  el.innerHTML = head + body;
}

// ── Calendar strip ─────────────────────────────────────────────────
function home_refreshCalendarStrip() {
  var el = document.getElementById('home-calendar-strip');
  if (!el) return;
  var cal = home_getCachedCalendar();
  var events = (cal && cal.upcoming_high_impact) || [];
  if (!events.length) {
    el.innerHTML = '<div class="home-calendar-empty">No high impact events on the horizon.</div>';
    return;
  }
  el.innerHTML = events.slice(0, 5).map(function (ev) {
    var due = home_minutesUntil(ev.timestamp);
    var imminent = due != null && due >= 0 && due <= 120;
    var t = ev.timestamp ? new Date(ev.timestamp) : null;
    var hh = t ? String(t.getUTCHours()).padStart(2, '0') : '';
    var mm = t ? String(t.getUTCMinutes()).padStart(2, '0') : '';
    var time = t ? hh + ':' + mm : 'soon';
    var fc = ev.forecast != null && ev.forecast !== '' ? ev.forecast : 'no forecast';
    var pv = ev.previous != null && ev.previous !== '' ? ev.previous : '';
    return '<div class="home-calendar-row ' + (imminent ? 'is-imminent' : '') + '">'
      + '<span class="home-calendar-time">' + time + ' UTC</span>'
      + '<span class="home-calendar-country">' + (ev.country || '') + '</span>'
      + '<span class="home-calendar-title">' + (ev.title || ev.event || 'Release') + '</span>'
      + '<span class="home-calendar-figs">'
        + 'fc <strong>' + fc + '</strong>'
        + (pv !== '' ? 'prev <strong>' + pv + '</strong>' : '')
      + '</span>'
      + (imminent
        ? '<span class="home-calendar-flag"><span class="home-calendar-flag-dot"></span>caution</span>'
        : '<span class="home-calendar-flag" style="color:var(--text4);">scheduled</span>')
      + '</div>';
  }).join('');
}

// ── Lumen activity feed ─────────────────────────────────────────────
function home_refreshActivityFeed() {
  var el = document.getElementById('home-activity-feed');
  if (!el) return;
  var combined = [];

  if (typeof atLog !== 'undefined' && Array.isArray(atLog)) {
    atLog.slice(0, 12).forEach(function (e) {
      combined.push({ time: e.time, source: 'intraday', type: e.type, msg: e.msg || e.message || '' });
    });
  }
  if (typeof scalpLog !== 'undefined' && Array.isArray(scalpLog)) {
    scalpLog.slice(0, 12).forEach(function (e) {
      var t = e.time && typeof e.time === 'number' ? new Date(e.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (e.time || '');
      combined.push({ time: t, source: 'scalp', type: e.type, msg: e.text || e.message || e.msg || '' });
    });
  }

  combined.sort(function (a, b) {
    return String(b.time).localeCompare(String(a.time));
  });

  if (!combined.length) {
    el.innerHTML = '<div class="home-activity-empty">Both engines idle. Start one from the launch panel to populate this feed.</div>';
    return;
  }

  el.innerHTML = combined.slice(0, 14).map(function (e) {
    var tag, tagCls;
    var msgLow = (e.msg || '').toLowerCase();
    if (e.type === 'trade' || msgLow.indexOf('executed') !== -1 || msgLow.indexOf('opened') !== -1) {
      tag = 'Exec'; tagCls = 'exec';
    } else if (msgLow.indexOf('skip') !== -1 || msgLow.indexOf('below') !== -1) {
      tag = 'Skip'; tagCls = 'skip';
    } else if (msgLow.indexOf('caution') !== -1 || msgLow.indexOf('blocked') !== -1) {
      tag = 'Warn'; tagCls = 'warn';
    } else {
      tag = 'Scan'; tagCls = 'scan';
    }
    var time = String(e.time || '').slice(0, 5);
    var msg = home_highlightActivity(e.msg || '');
    return '<div class="home-activity-row">'
      + '<span class="home-activity-time">' + time + '</span>'
      + '<span class="home-activity-tag ' + tagCls + '">' + tag + '</span>'
      + '<span class="home-activity-msg">' + msg + '</span>'
      + '</div>';
  }).join('');
}

function home_highlightActivity(msg) {
  if (!msg) return '';
  // Highlight instrument symbols.
  return msg.replace(/\b([A-Z]{3,6}USD|XAUUSD|XAGUSD|US30|SPX500|NAS100|GBPJPY|USDJPY|USDCAD|EURJPY|AUDJPY|CHFJPY|USOIL|UKOIL|NATGAS)\b/g, '<strong>$1</strong>');
}

// ── Correlation pulse ──────────────────────────────────────────────
function home_refreshCorrelationPulse() {
  var el = document.getElementById('home-correlation-pulse');
  if (!el) return;
  var corr = (window.LumenIntel && window.LumenIntel.correlations && window.LumenIntel.correlations.cached) ? window.LumenIntel.correlations.cached() : null;
  if (!corr) {
    if (window.LumenIntel && window.LumenIntel.correlations) {
      try { window.LumenIntel.correlations().catch(function () {}); } catch (_) {}
    }
    el.innerHTML = '<div class="home-correlation-empty">Correlation matrix is warming up. First read takes a moment.</div>';
    return;
  }
  var breaks = (corr.breakdowns || []).slice(0, 5);
  if (!breaks.length) {
    el.innerHTML = '<div class="home-correlation-empty">No correlation breakdowns this session. Cross asset behaviour is stable.</div>';
    return;
  }
  el.innerHTML = breaks.map(function (b) {
    var prior = b.prior_correlation != null ? Number(b.prior_correlation).toFixed(2) : 'n.a.';
    var now   = b.current_correlation != null ? Number(b.current_correlation).toFixed(2) : 'n.a.';
    return '<div class="home-corr-row">'
      + '<span class="home-corr-pair">' + (b.a || '') + ' vs ' + (b.b || '') + '</span>'
      + '<span class="home-corr-shift"><strong>' + prior + '</strong> shifted to <strong>' + now + '</strong></span>'
      + '<span class="home-corr-tag">Breakdown</span>'
      + '</div>';
  }).join('');
}

// ── Weekly insights ─────────────────────────────────────────────────
function home_runInsights() {
  var btn = document.getElementById('home-insights-run');
  var body = document.getElementById('home-insights-body');
  if (!body) return;
  if (typeof lumenMinePatterns !== 'function') {
    body.innerHTML = '<div class="home-insights-empty">Insights engine is not available in this build.</div>';
    return;
  }
  if (btn) { btn.disabled = true; btn.textContent = 'Reading the tape'; }
  body.innerHTML = '<div class="home-insights-empty">Mining this week\'s pattern read.</div>';

  Promise.resolve(lumenMinePatterns(true)).then(function (out) {
    home_renderInsights(out);
  }).catch(function () {
    body.innerHTML = '<div class="home-insights-empty">Could not read the tape. Try again in a minute.</div>';
  }).finally(function () {
    if (btn) { btn.disabled = false; btn.textContent = 'Mine the week'; }
  });
}

function home_renderInsights(out) {
  var body = document.getElementById('home-insights-body');
  if (!body) return;
  if (!out) {
    body.innerHTML = '<div class="home-insights-empty">No insights available yet.</div>';
    return;
  }

  // Two shapes: cached object with summary only (under ten trades) or full LLM payload.
  if (out.summary && !out.strengths && !out.actions) {
    var s = out.summary;
    body.innerHTML = '<div class="home-insights-empty">Pattern miner needs at least ten closed Lumen trades. Currently <em>' + (s.total_closed || 0) + '</em> closed across both engines.</div>';
    return;
  }

  var s = out.strengths || out.what_worked || [];
  var w = out.watchouts || out.what_did_not || out.weaknesses || [];
  var a = out.actions || out.recommendations || [];

  function block(title, items, cls) {
    if (!items || !items.length) return '';
    return '<div class="home-insights-block ' + cls + '">'
      + '<div class="home-insights-block-label">' + title + '</div>'
      + '<ul class="home-insights-list">'
      + items.map(function (i) { return '<li>' + (typeof i === 'string' ? i : (i.text || i.note || JSON.stringify(i))) + '</li>'; }).join('')
      + '</ul></div>';
  }

  var html = block('Strengths', s, 'strengths')
    + block('Watch outs', w, 'watchouts')
    + block('Actions for next week', a, 'actions');

  body.innerHTML = html || '<div class="home-insights-empty">Nothing actionable surfaced this week.</div>';
}

// ── Performance card ───────────────────────────────────────────────
function home_refreshPerf() {
  var hist = (typeof scalpHistory !== 'undefined') ? scalpHistory : [];
  var today = new Date().toDateString();
  var todayTrades = hist.filter(function (t) {
    var ts = t.closeTime || t.closedAt;
    return ts && new Date(ts).toDateString() === today;
  });
  var count = todayTrades.length;
  var wins  = todayTrades.filter(function (t) { return (t.pnl || 0) > 0; }).length;
  var pnl   = todayTrades.reduce(function (s, t) { return s + (t.pnl || 0); }, 0);
  var wr    = count ? Math.round(wins / count * 100) + '%' : '0%';

  var el_t = document.getElementById('home-perf-trades');
  var el_w = document.getElementById('home-perf-wr');
  var el_p = document.getElementById('home-perf-pnl');
  if (el_t) el_t.textContent = count;
  if (el_w) {
    el_w.textContent = wr;
    el_w.style.color = count ? (wins / count >= 0.5 ? 'var(--teal)' : 'var(--red)') : 'var(--text)';
  }
  if (el_p) {
    el_p.textContent = (pnl >= 0 ? '+' : '') + '$' + Math.abs(pnl).toFixed(0);
    el_p.style.color = pnl > 0 ? 'var(--teal)' : pnl < 0 ? 'var(--red)' : 'var(--text)';
  }
}

// ── Instinct quote ─────────────────────────────────────────────────
function home_refreshInstinct() {
  var el = document.getElementById('home-instinct-text');
  if (!el) return;
  var log = (typeof scalpLog !== 'undefined') ? scalpLog : [];
  var instinct = null;
  for (var i = 0; i < log.length; i++) {
    var msg = log[i].text || log[i].message || log[i].msg || '';
    var m = msg.match(/instinct[_\s]reading["\s:]+([^"\n\|]{10,140})/i);
    if (m) { instinct = m[1].replace(/[",\\]+/g, '').trim(); break; }
    var m2 = msg.match(/"instinct_reading"\s*:\s*"([^"]{10,140})"/i);
    if (m2) { instinct = m2[1].trim(); break; }
  }
  el.textContent = instinct || 'Marktrader is reading the tape. Start an engine to surface live intelligence here.';
}

// ── Init and intervals ─────────────────────────────────────────────
var _homeStatusTimer = null;
var _homeIntelTimer  = null;
var _homeFastTimer   = null;
var _homeClockTimer  = null;

function home_init() {
  home_tickClock();
  home_startTickerInterval();
  home_refreshStatusStrip();
  home_sampleTicks();
  home_refreshIntelSnapshot();
  home_refreshTraderStrip();
  home_refreshLedger();
  home_refreshCalendarStrip();
  home_refreshActivityFeed();
  home_refreshCorrelationPulse();
  home_refreshPerf();
  home_refreshInstinct();

  if (!_homeClockTimer) _homeClockTimer = setInterval(function () {
    if (document.visibilityState !== 'hidden') home_tickClock();
  }, 1000);

  // Fast cadence (3s): ledger and activity feed track the live engines.
  if (!_homeFastTimer) _homeFastTimer = setInterval(function () {
    if (document.visibilityState === 'hidden') return;
    home_sampleTicks();
    home_refreshLedger();
    home_refreshActivityFeed();
  }, 3000);

  // Status strip and intel snapshot every 15s.
  if (!_homeStatusTimer) _homeStatusTimer = setInterval(function () {
    if (document.visibilityState === 'hidden') return;
    home_refreshStatusStrip();
    home_refreshIntelSnapshot();
    home_refreshTraderStrip();
    home_refreshCalendarStrip();
    home_refreshCorrelationPulse();
  }, 15000);

  // Heavy refresh every 60s.
  if (!_homeIntelTimer) _homeIntelTimer = setInterval(function () {
    if (document.visibilityState === 'hidden') return;
    home_refreshPerf();
    home_refreshInstinct();
  }, 60000);
}

// Boot once globals are ready.
setTimeout(home_init, 1800);

// Expose the insights handler to inline onclick handlers.
window.home_runInsights = home_runInsights;
