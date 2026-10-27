/* Noiré — applies admin-edited page text from Firebase (siteContent/<page>).
   Elements marked data-content="key" keep their built-in text unless the
   admin has saved something different. */
   (function () {
    var DB = "https://noire-17ed6-default-rtdb.firebaseio.com";
    var page = document.body.getAttribute("data-content-page");
    if (!page) return;
  
    var CACHE_KEY = "noire_site_content_" + page;
    var els = Array.prototype.slice.call(document.querySelectorAll("[data-content]"));
    els.forEach(function (el) { el.__orig = el.innerHTML; });
  
    // Blank line = new paragraph; lines starting with "- " = bullet list.
    function renderRich(el, text) {
      while (el.firstChild) el.removeChild(el.firstChild);
      text.split(/\n\s*\n/).forEach(function (block) {
        var lines = block.split("\n").map(function (l) { return l.trim(); }).filter(Boolean);
        if (!lines.length) return;
        var bullets = lines.every(function (l) { return /^[-\u2022]\s+/.test(l); });
        if (bullets) {
          var ul = document.createElement("ul");
          lines.forEach(function (l) {
            var li = document.createElement("li");
            li.textContent = l.replace(/^[-\u2022]\s+/, "");
            ul.appendChild(li);
          });
          el.appendChild(ul);
        } else {
          var p = document.createElement("p");
          p.textContent = lines.join(" ");
          el.appendChild(p);
        }
      });
    }
  
    function apply(data) {
      data = data || {};
      els.forEach(function (el) {
        var value = data[el.getAttribute("data-content")];
        if (typeof value === "string" && value.trim()) {
          if (el.hasAttribute("data-rich")) renderRich(el, value);
          else el.textContent = value;
          if (el.hasAttribute("data-multiline")) el.style.whiteSpace = "pre-line";
        } else {
          el.innerHTML = el.__orig;
          el.style.whiteSpace = "";
        }
      });
    }
  
    // Show the last known content instantly, then refresh from Firebase.
    try {
      var cached = localStorage.getItem(CACHE_KEY);
      if (cached) apply(JSON.parse(cached));
    } catch (e) {}
  
    fetch(DB + "/siteContent/" + encodeURIComponent(page) + ".json")
      .then(function (res) { return res.ok ? res.json() : undefined; })
      .then(function (data) {
        if (data === undefined) return; // request refused: keep what is showing
        apply(data);
        try {
          if (data) localStorage.setItem(CACHE_KEY, JSON.stringify(data));
          else localStorage.removeItem(CACHE_KEY);
        } catch (e) {}
      })
      .catch(function () {});
  })();