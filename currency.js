/* Noiré — approximate prices in the visitor's currency (display only).
   Prices stay in PHP; orders are always charged in PHP.
   Rates come from Firebase (siteContent/currency), set by admins as "PHP per 1 unit".
   Mark any element with data-php="<amount in PHP>" and this script fills it in. */
   (function () {
    var DB = "https://noire-17ed6-default-rtdb.firebaseio.com";
    var CHOICE_KEY = "noire_currency", RATES_KEY = "noire_currency_rates";
    var COUNTRY = { US:"USD", GB:"GBP", JP:"JPY", AU:"AUD", CA:"CAD", SG:"SGD", HK:"HKD", KR:"KRW", AE:"AED",
      DE:"EUR", FR:"EUR", ES:"EUR", IT:"EUR", NL:"EUR", IE:"EUR", PT:"EUR", AT:"EUR", BE:"EUR", FI:"EUR", GR:"EUR" };
    var rates = {}; // currency -> PHP per 1 unit
  
    function store(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
    function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  
    function detected() {
      var lang = (navigator.languages && navigator.languages[0]) || navigator.language || "";
      var m = lang.match(/[-_]([A-Za-z]{2})$/);
      return m ? COUNTRY[m[1].toUpperCase()] : null;
    }
  
    function current() {
      var c = load(CHOICE_KEY) || detected();
      return c && c !== "PHP" && rates[c] ? c : "PHP";
    }
  
    function format(php) {
      var c = current();
      if (c === "PHP") return "";
      try {
        return "≈ " + new Intl.NumberFormat(undefined, { style: "currency", currency: c }).format(php / rates[c]);
      } catch (e) { return ""; }
    }
  
    function refresh() {
      var els = document.querySelectorAll("[data-php]");
      for (var i = 0; i < els.length; i++) {
        var el = els[i], php = parseFloat(el.getAttribute("data-php"));
        var text = isNaN(php) ? "" : format(php);
        if (text && el.hasAttribute("data-suffix")) text += el.getAttribute("data-suffix");
        if (el.textContent !== text) el.textContent = text;
      }
    }
  
    function parseRates(data) {
      var out = {};
      Object.keys(data || {}).forEach(function (c) {
        var n = parseFloat(data[c]);
        if (/^[A-Z]{3}$/.test(c) && n > 0) out[c] = n;
      });
      return out;
    }
  
    var select;
    function buildSelect() {
      var host = document.querySelector(".nav-icons, .nav-actions");
      var codes = Object.keys(rates);
      if (!host || !codes.length) { if (select) select.style.display = "none"; return; }
      if (!select) {
        select = document.createElement("select");
        select.className = "noire-currency";
        select.setAttribute("aria-label", "Display currency");
        select.addEventListener("change", function () { store(CHOICE_KEY, select.value); refresh(); });
        host.insertBefore(select, host.firstChild);
      }
      select.style.display = "";
      select.innerHTML = "";
      ["PHP"].concat(codes).forEach(function (c) {
        var o = document.createElement("option");
        o.value = c; o.textContent = c;
        select.appendChild(o);
      });
      select.value = current();
    }
  
    var css = document.createElement("style");
    css.textContent =
      ".approx-price{font-size:12px;color:#777;margin-top:3px;font-weight:500}.approx-price:empty{display:none}" +
      ".noire-currency{border:1px solid #e9e3dc;border-radius:8px;background:#fff;color:#111;font:600 12px inherit;font-family:inherit;padding:6px 8px;cursor:pointer;margin-right:8px}";
    document.head.appendChild(css);
  
    function start(data) { rates = parseRates(data); buildSelect(); refresh(); }
  
    try { var cached = load(RATES_KEY); if (cached) start(JSON.parse(cached)); } catch (e) {}
  
    fetch(DB + "/siteContent/currency.json")
      .then(function (r) { return r.ok ? r.json() : undefined; })
      .then(function (data) {
        if (data === undefined) return;
        store(RATES_KEY, data ? JSON.stringify(data) : null);
        start(data);
      })
      .catch(function () {});
  
    // Shop and cart redraw prices dynamically, so keep new elements filled in.
    var queued = false;
    new MutationObserver(function () {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () { queued = false; refresh(); });
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-php"] });
  
    window.NoireCurrency = { refresh: refresh, format: format, current: current };
  })();