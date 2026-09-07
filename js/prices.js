/* ============================================================
   LIVE COMMODITY PRICES — Shared Module
   ============================================================

   API SETUP:
   Sign up for a FREE API key at https://metals.dev (no credit card).
   Replace the key below. Free plan = 100 requests/month.
   Prices are cached in localStorage (~8 hours) to stay within limits.

   For broader commodities (oil, wheat, sugar, etc.), sign up at
   https://commodities-api.com (free plan = 100 requests/month).
   ============================================================ */

var PRICE_CONFIG = {
  metalsApiKey: 'EQCZCZF193MYEMVENSGK217VENSGK',
  commoditiesApiKey: 'DEMO',
  metalsCacheTTL: 60000, //28800000
  refreshInterval: 60000,
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

  /* --- Metal symbol map for API --- */
  var metalMap = {
    XAU: 'gold', XAU_KG: 'gold', XAU_G: 'gold',
    XAG: 'silver', XAG_KG: 'silver', XAG_G: 'silver',
    XPT: 'platinum', XPD: 'palladium'
  };

  var conversionFactors = {
    XAU_KG: OZ_PER_KG, XAG_KG: OZ_PER_KG, COPPER_KG: LB_PER_KG,
    XAU_G: 1 / GRAMS_PER_OZ, XAG_G: 1 / GRAMS_PER_OZ, COPPER_G: LB_PER_KG / 1000
  };

  function isMetalSymbol(sym) {
    return metalMap[sym] != null;
  }

  /* --- LocalStorage cache helpers (metals only) --- */
  var METALS_CACHE_KEY = 'iic_metals_cache';

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
      localStorage.setItem(METALS_CACHE_KEY, JSON.stringify({ ts: Date.now(), metals: data }));
    } catch (e) { /* quota exceeded — ignore */ }
  }

  /* --- Fetch from Metals.dev API (cached, ~25 requests/month) --- */
  function fetchMetalsPrices(symbols, callback) {
    if (PRICE_CONFIG.metalsApiKey === 'DEMO') {
      callback(null, 'demo');
      return;
    }

    var cached = getMetalsCache();
    if (cached && cached.metals) {
      processMetalsData(cached.metals, symbols, callback, 'cached');
      return;
    }

    var url = 'https://api.metals.dev/v1/latest?api_key=' +
      PRICE_CONFIG.metalsApiKey + '&currency=USD&unit=toz';

    fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data && data.metals) {
          setMetalsCache(data.metals);
          processMetalsData(data.metals, symbols, callback, 'live');
        } else {
          callback(null, 'error');
        }
      })
      .catch(function () { callback(null, 'error'); });
  }

  function processMetalsData(metals, symbols, callback, mode) {
    var result = {};
    symbols.forEach(function (sym) {
      var key = metalMap[sym];
      if (key && metals[key] != null) {
        var prev = cache[sym] ? cache[sym].price : referencePrices[sym].price;
        var current = metals[key];
        if (conversionFactors[sym]) current = current * conversionFactors[sym];
        var pctChange = prev ? ((current - prev) / prev * 100) : 0;
        result[sym] = {
          name: referencePrices[sym].name,
          price: current,
          change: pctChange,
          unit: referencePrices[sym].unit,
          decimals: referencePrices[sym].decimals,
          live: true
        };
      }
    });
    cache = Object.assign(cache, result);
    callback(result, mode);
  }

  /* --- Fetch from Commodities-API --- */
  function fetchCommodityPrices(symbols, callback) {
    if (PRICE_CONFIG.commoditiesApiKey === 'DEMO') {
      callback(null, 'demo');
      return;
    }

    var symbolStr = symbols.join(',');
    var url = 'https://commodities-api.com/api/latest?access_key=' +
      PRICE_CONFIG.commoditiesApiKey + '&base=USD&symbols=' + symbolStr;

    fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data && data.data && data.data.rates) {
          var result = {};
          symbols.forEach(function (sym) {
            if (data.data.rates[sym] != null) {
              var rawRate = data.data.rates[sym];
              var current = rawRate > 0 ? (1 / rawRate) : 0;
              var prev = cache[sym] ? cache[sym].price : (referencePrices[sym] ? referencePrices[sym].price : current);
              var pctChange = prev ? ((current - prev) / prev * 100) : 0;
              result[sym] = {
                name: referencePrices[sym] ? referencePrices[sym].name : sym,
                price: current,
                change: pctChange,
                unit: referencePrices[sym] ? referencePrices[sym].unit : '',
                decimals: referencePrices[sym] ? referencePrices[sym].decimals : 2,
                live: true
              };
            }
          });
          cache = Object.assign(cache, result);
          callback(result, 'live');
        } else {
          callback(null, 'error');
        }
      })
      .catch(function () { callback(null, 'error'); });
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
      var metalsToFetch = symbols.filter(function (s) { return isMetalSymbol(s); });
      if (metalsToFetch.length > 0) {
        fetchMetalsPrices(metalsToFetch, function (result, mode) {
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
      var metalsToFetch = symbols.filter(function (s) { return isMetalSymbol(s); });
      var commoditiesToFetch = symbols.filter(function (s) { return !isMetalSymbol(s) && s !== 'DIAMOND' && s !== 'COPPER_KG'; });
      var pending = 0;
      var anyLive = false;

      if (metalsToFetch.length > 0) {
        pending++;
        fetchMetalsPrices(metalsToFetch, function (r, m) {
          if (m === 'live') anyLive = true;
          pending--;
          if (pending === 0) cb(anyLive ? 'live' : 'demo');
        });
      }
      if (commoditiesToFetch.length > 0) {
        pending++;
        fetchCommodityPrices(commoditiesToFetch, function (r, m) {
          if (m === 'live') anyLive = true;
          pending--;
          if (pending === 0) cb(anyLive ? 'live' : 'demo');
        });
      }
      if (pending === 0) cb('demo');
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

    var metalSyms = symbols.filter(function (s) { return isMetalSymbol(s); });
    var commoditySyms = symbols.filter(function (s) { return !isMetalSymbol(s) && s !== 'DIAMOND' && s !== 'COPPER_KG'; });

    function refresh() {
      var pending = 0;
      var anyLive = false;
      if (metalSyms.length > 0) {
        pending++;
        fetchMetalsPrices(metalSyms, function (r, m) {
          if (m === 'live') anyLive = true;
          pending--;
          if (pending === 0) renderPrices(containerId, symbols, anyLive ? 'live' : 'demo');
        });
      }
      if (commoditySyms.length > 0) {
        pending++;
        fetchCommodityPrices(commoditySyms, function (r, m) {
          if (m === 'live') anyLive = true;
          pending--;
          if (pending === 0) renderPrices(containerId, symbols, anyLive ? 'live' : 'demo');
        });
      }
      if (pending === 0) renderPrices(containerId, symbols, 'demo');
    }

    renderPrices(containerId, symbols, 'demo');
    refresh();
    timers.push(setInterval(refresh, PRICE_CONFIG.refreshInterval));
  };

})();
