/* ============================================================
   LIVE COMMODITY PRICES — Shared Module
   ============================================================

   API SETUP:
   Sign up for a FREE API key at https://www.goldapi.io
   Replace the key below. Free plan = 500 requests/month.
   Prices are cached in localStorage (~8 hours) to stay within limits.
   Covers Gold (XAU) and Silver (XAG). Other commodities use
   indicative reference prices.
   ============================================================ */

var PRICE_CONFIG = {
  goldApiKey: 'goldapi-95c93903adab83d4c934c18d674b98d3-io',
  metalsCacheTTL: 28800000,
  currency: 'USD'
};

(function () {
  'use strict';

  var cache = {};
  var timers = [];
  var OZ_PER_KG = 32.1507;
  var GRAMS_PER_OZ = 31.1035;
  var LB_PER_KG = 2.20462;

  function formatPrice(val, decimals) {
    if (val == null || isNaN(val)) return '—';
    decimals = decimals != null ? decimals : 2;
    return val.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }

  function formatChange(val) {
    if (val == null || isNaN(val)) return '';
    var sign = val >= 0 ? '+' : '';
    return sign + val.toFixed(2) + '%';
  }

  function changeClass(val) {
    if (val == null || isNaN(val)) return '';
    return val >= 0 ? 'price-up' : 'price-down';
  }

  function arrowSvg(val) {
    if (val == null || isNaN(val)) return '';
    if (val >= 0) {
      return '<svg class="price-arrow price-arrow--up" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m18 15-6-6-6 6"/></svg>';
    }
    return '<svg class="price-arrow price-arrow--down" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m6 9 6 6 6-6"/></svg>';
  }

  /* --- Reference prices (fallback when API unavailable) --- */
  var referencePrices = {
    XAU:      { name: 'Gold',           price: 4417.00,   change: 0.45,  unit: 'oz',    decimals: 2 },
    XAU_KG:   { name: 'Gold',           price: 142000.00, change: 0.45,  unit: 'kg',    decimals: 2 },
    XAU_G:    { name: 'Gold',           price: 142.00,    change: 0.45,  unit: 'g',     decimals: 2 },
    XAG:      { name: 'Silver',         price: 31.50,     change: 0.72,  unit: 'oz',    decimals: 2 },
    XAG_KG:   { name: 'Silver',         price: 1012.74,   change: 0.72,  unit: 'kg',    decimals: 2 },
    XAG_G:    { name: 'Silver',         price: 1.01,      change: 0.72,  unit: 'g',     decimals: 2 },
    XPT:      { name: 'Platinum',       price: 1020.00,   change: -0.18, unit: 'oz',    decimals: 2 },
    XPD:      { name: 'Palladium',      price: 980.00,    change: -0.35, unit: 'oz',    decimals: 2 },
    COPPER_KG:{ name: 'Copper',         price: 9.37,      change: 0.65,  unit: 'kg',    decimals: 2 },
    COPPER_G: { name: 'Copper',         price: 0.0094,    change: 0.65,  unit: 'g',     decimals: 4 },
    COPPER:   { name: 'Copper',         price: 4.25,      change: 0.65,  unit: 'lb',    decimals: 2 },
    WTI:      { name: 'Crude Oil WTI',  price: 78.50,     change: 1.12,  unit: 'bbl',   decimals: 2 },
    BRENT:    { name: 'Brent Crude',    price: 82.30,     change: 0.95,  unit: 'bbl',   decimals: 2 },
    NG:       { name: 'Natural Gas',    price: 2.85,      change: -1.40, unit: 'MMBtu', decimals: 2 },
    WHEAT:    { name: 'Wheat',          price: 625.00,    change: 0.32,  unit: 'bu',    decimals: 2 },
    CORN:     { name: 'Corn',           price: 485.00,    change: -0.15, unit: 'bu',    decimals: 2 },
    SUGAR:    { name: 'Sugar',          price: 22.80,     change: 0.88,  unit: 'lb',    decimals: 2 },
    RICE:     { name: 'Rice',           price: 15.60,     change: 0.20,  unit: 'cwt',   decimals: 2 },
    SOYBEAN:  { name: 'Soybeans',       price: 1180.00,   change: -0.42, unit: 'bu',    decimals: 2 },
    UREA:     { name: 'Urea',           price: 310.00,    change: 0.30,  unit: 'mt',    decimals: 2 },
    DIAMOND:  { name: 'Diamond (1ct)',   price: 5200.00,   change: 0.10,  unit: 'ct',    decimals: 0 }
  };

  /* --- GoldAPI.io symbol map --- */
  var goldApiMap = {
    XAU: 'XAU', XAU_KG: 'XAU', XAU_G: 'XAU',
    XAG: 'XAG', XAG_KG: 'XAG', XAG_G: 'XAG',
    XPT: 'XPT', XPD: 'XPD'
  };

  var conversionFactors = {
    XAU_KG: OZ_PER_KG, XAG_KG: OZ_PER_KG,
    XAU_G: 1 / GRAMS_PER_OZ, XAG_G: 1 / GRAMS_PER_OZ
  };

  function isLiveSymbol(sym) {
    return goldApiMap[sym] != null;
  }

  /* --- LocalStorage cache helpers --- */
  var METALS_CACHE_KEY = 'iic_goldapi_cache';

  function getMetalsCache() {
    try {
      var raw = localStorage.getItem(METALS_CACHE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      var age = Date.now() - (parsed.ts || 0);
      if (age > PRICE_CONFIG.metalsCacheTTL) return null;
      return parsed;
    } catch (e) { return null; }
  }

  function setMetalsCache(data) {
    try {
      localStorage.setItem(METALS_CACHE_KEY, JSON.stringify({ ts: Date.now(), prices: data }));
    } catch (e) { /* quota exceeded */ }
  }

  /* --- Fetch from GoldAPI.io (cached, ~8 hours) --- */
  function fetchMetalsPrices(symbols, callback) {
    if (PRICE_CONFIG.goldApiKey === 'DEMO') {
      callback(null, 'demo');
      return;
    }

    var cached = getMetalsCache();
    if (cached && cached.prices) {
      processGoldApiData(cached.prices, symbols, callback, 'cached');
      return;
    }

    var uniqueMetals = {};
    symbols.forEach(function (sym) {
      var apiSym = goldApiMap[sym];
      if (apiSym) uniqueMetals[apiSym] = true;
    });
    var toFetch = Object.keys(uniqueMetals);

    var results = {};
    var pending = toFetch.length;
    if (pending === 0) { callback(null, 'demo'); return; }

    toFetch.forEach(function (metal) {
      fetch('https://www.goldapi.io/api/' + metal + '/USD', {
        headers: { 'x-access-token': PRICE_CONFIG.goldApiKey }
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data && data.price) {
            results[metal] = { price: data.price, chp: data.chp || 0 };
          }
          pending--;
          if (pending === 0) {
            setMetalsCache(results);
            processGoldApiData(results, symbols, callback, 'live');
          }
        })
        .catch(function () {
          pending--;
          if (pending === 0) {
            if (Object.keys(results).length > 0) {
              setMetalsCache(results);
              processGoldApiData(results, symbols, callback, 'live');
            } else {
              callback(null, 'error');
            }
          }
        });
    });
  }

  function processGoldApiData(prices, symbols, callback, mode) {
    var result = {};
    symbols.forEach(function (sym) {
      var apiSym = goldApiMap[sym];
      if (apiSym && prices[apiSym]) {
        var current = prices[apiSym].price;
        if (conversionFactors[sym]) current = current * conversionFactors[sym];
        result[sym] = {
          name: referencePrices[sym].name,
          price: current,
          change: prices[apiSym].chp || 0,
          unit: referencePrices[sym].unit,
          decimals: referencePrices[sym].decimals,
          live: true
        };
      }
    });
    cache = Object.assign(cache, result);
    callback(result, mode);
  }

  /* --- Build a single price card HTML --- */
  function cardHtml(sym) {
    var d = cache[sym] || referencePrices[sym];
    if (!d) return '';
    var h = '';
    h += '<div class="price-card">';
    h += '  <div class="price-card__header">';
    h += '    <span class="price-card__name">' + d.name + '</span>';
    h += '    <span class="price-card__unit">/' + d.unit + '</span>';
    h += '  </div>';
    h += '  <div class="price-card__value">';
    h += '    <span class="price-card__currency">$</span>';
    h += '    <span class="price-card__price">' + formatPrice(d.price, d.decimals) + '</span>';
    h += '  </div>';
    h += '  <div class="price-card__change ' + changeClass(d.change) + '">';
    h += '    ' + arrowSvg(d.change);
    h += '    <span>' + formatChange(d.change) + '</span>';
    h += '  </div>';
    h += '</div>';
    return h;
  }

  /* --- Update status label --- */
  function updateStatus(containerId, mode) {
    var statusEl = document.getElementById(containerId + '-status');
    if (!statusEl) return;
    var isDemo = mode === 'demo' || mode === 'error';
    if (isDemo) {
      statusEl.innerHTML = 'Indicative prices &middot; <a href="#price-setup" style="color:var(--gold)">Connect live API</a>';
      statusEl.className = 'price-status price-status--demo';
    } else if (mode === 'cached') {
      var cachedData = getMetalsCache();
      var cachedTime = cachedData ? new Date(cachedData.ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
      statusEl.textContent = 'Market data · Cached ' + cachedTime;
      statusEl.className = 'price-status price-status--live';
    } else {
      var timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      statusEl.textContent = 'Live market data · Updated ' + timeStr;
      statusEl.className = 'price-status price-status--live';
    }
  }

  /* --- Render price cards into a container (simple grid) --- */
  function renderPrices(containerId, symbols, mode) {
    var container = document.getElementById(containerId);
    if (!container) return;
    var html = '';
    symbols.forEach(function (sym) { html += cardHtml(sym); });
    container.innerHTML = html;
    updateStatus(containerId, mode);
  }

  /* --- Render price cards with carousel pagination --- */
  function renderPriceCarousel(containerId, symbols, mode, perPage) {
    var wrapper = document.getElementById(containerId);
    if (!wrapper) return;

    var totalPages = Math.ceil(symbols.length / perPage);
    var currentPage = wrapper._currentPage || 0;
    if (currentPage >= totalPages) currentPage = 0;
    wrapper._currentPage = currentPage;

    var start = currentPage * perPage;
    var pageSymbols = symbols.slice(start, start + perPage);

    var gridEl = wrapper.querySelector('.price-carousel__grid');
    if (!gridEl) {
      wrapper.innerHTML = '<div class="price-carousel__grid price-grid price-grid--4"></div><div class="price-carousel__dots"></div>';
      gridEl = wrapper.querySelector('.price-carousel__grid');
    }

    var html = '';
    pageSymbols.forEach(function (sym) {
      var card = cardHtml(sym);
      html += card.replace('class="price-card"',
        'class="price-card" style="opacity:0;transform:translateY(8px)"');
    });
    gridEl.innerHTML = html;

    var cards = gridEl.querySelectorAll('.price-card');
    setTimeout(function () {
      cards.forEach(function (c) {
        c.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
        c.style.opacity = '1';
        c.style.transform = 'translateY(0)';
      });
    }, 30);

    var dotsEl = wrapper.querySelector('.price-carousel__dots');
    if (totalPages > 1 && dotsEl) {
      var dotsHtml = '';
      for (var i = 0; i < totalPages; i++) {
        dotsHtml += '<button class="price-carousel__dot' +
          (i === currentPage ? ' price-carousel__dot--active' : '') +
          '" data-page="' + i + '" aria-label="Go to page ' + (i + 1) + '"></button>';
      }
      dotsEl.innerHTML = dotsHtml;
    }

    updateStatus(containerId, mode);
  }

  /* --- Public: Initialize metals price ticker (Gold page) --- */
  window.initMetalsPriceTicker = function (containerId, symbols) {
    symbols = symbols || ['XAU', 'XAG', 'XPT', 'XPD'];

    function refresh() {
      var liveSymbols = symbols.filter(function (s) { return isLiveSymbol(s); });
      if (liveSymbols.length > 0) {
        fetchMetalsPrices(liveSymbols, function (result, mode) {
          renderPrices(containerId, symbols, mode);
        });
      } else {
        renderPrices(containerId, symbols, 'demo');
      }
    }

    renderPrices(containerId, symbols, 'demo');
    refresh();
  };

  /* --- Public: Initialize commodity price carousel (General Trading page) --- */
  window.initCommodityPriceCarousel = function (containerId, symbols, perPage, interval) {
    symbols = symbols || ['XAU_KG', 'XAG_KG', 'COPPER_KG', 'WTI', 'BRENT', 'NG', 'SUGAR', 'RICE', 'WHEAT', 'CORN', 'SOYBEAN', 'UREA'];
    perPage = perPage || 4;
    interval = interval || 5000;

    var lastMode = 'demo';
    var wrapper = document.getElementById(containerId);
    var autoTimer = null;
    var isPaused = false;

    function render() {
      renderPriceCarousel(containerId, symbols, lastMode, perPage);
    }

    function goToPage(page) {
      if (!wrapper) return;
      var totalPages = Math.ceil(symbols.length / perPage);
      wrapper._currentPage = page >= totalPages ? 0 : (page < 0 ? totalPages - 1 : page);
      render();
    }

    function advance() {
      if (isPaused) return;
      var cur = (wrapper && wrapper._currentPage) || 0;
      goToPage(cur + 1);
    }

    function startAuto() {
      stopAuto();
      autoTimer = setInterval(advance, interval);
    }

    function stopAuto() {
      if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
    }

    function fetchAll(cb) {
      var liveSymbols = symbols.filter(function (s) { return isLiveSymbol(s); });
      if (liveSymbols.length > 0) {
        fetchMetalsPrices(liveSymbols, function (r, m) {
          cb(m === 'live' || m === 'cached' ? m : 'demo');
        });
      } else {
        cb('demo');
      }
    }

    function refresh() {
      fetchAll(function (mode) {
        lastMode = mode;
        render();
      });
    }

    render();
    refresh();

    if (wrapper) {
      wrapper.addEventListener('click', function (e) {
        var dot = e.target.closest('.price-carousel__dot');
        if (!dot) return;
        goToPage(parseInt(dot.dataset.page, 10));
        startAuto();
      });
      wrapper.addEventListener('mouseenter', function () { isPaused = true; });
      wrapper.addEventListener('mouseleave', function () { isPaused = false; });
    }

    startAuto();
  };

  /* --- Backward compat: simple grid ticker --- */
  window.initCommodityPriceTicker = function (containerId, symbols) {
    symbols = symbols || ['XAU', 'XAG', 'COPPER', 'WTI', 'BRENT', 'NG', 'WHEAT', 'CORN', 'SUGAR', 'RICE', 'SOYBEAN', 'UREA'];

    var liveSyms = symbols.filter(function (s) { return isLiveSymbol(s); });

    function refresh() {
      if (liveSyms.length > 0) {
        fetchMetalsPrices(liveSyms, function (r, m) {
          renderPrices(containerId, symbols, m === 'live' || m === 'cached' ? m : 'demo');
        });
      } else {
        renderPrices(containerId, symbols, 'demo');
      }
    }

    renderPrices(containerId, symbols, 'demo');
    refresh();
  };

})();
