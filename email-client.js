/* =====================================================
   NOIRÉ EMAIL CLIENT
   Classic script (works from file:// and Firebase Hosting).
   Talks to the Google Apps Script web app in email-backend/Code.gs,
   which sends the emails from galaroace@gmail.com.

   SETUP: paste your deployed Web App URL below (ends with /exec).
   Exposes window.NoireMail:
     .orderPlaced(user, orderId)
     .orderStatus(user, userId, orderId)
     .promo(user, {subject, message, ctaText, ctaUrl, testOnly})
===================================================== */
(function () {
    var MAIL_URL = "https://script.google.com/macros/s/AKfycbywwpDVcP-YzZ6EzFawrR7JpND2OBWZ7PkjuWfvQ-LwT9_Ilm8jRVXFD8-hYi743lHDTg/exec";
  
    function configured() {
      return /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(MAIL_URL);
    }
  
    function toast(msg, ok) {
      try {
        var el = document.createElement("div");
        el.textContent = msg;
        el.style.cssText =
          "position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:30000;max-width:90vw;" +
          "padding:12px 18px;border-radius:10px;font:600 12px 'DM Sans',Arial,sans-serif;color:#fff;" +
          "box-shadow:0 10px 30px rgba(0,0,0,.25);background:" + (ok ? "#111" : "#B76E79") + ";";
        document.body.appendChild(el);
        setTimeout(function () { el.remove(); }, 3800);
      } catch (e) {}
    }
  
    async function call(user, payload, opts) {
      opts = opts || {};
      if (!configured()) {
        console.warn("NoireMail: MAIL_URL not set in email-client.js — email skipped.");
        return { ok: false, skipped: true, error: "Email service is not set up yet." };
      }
      var signedIn = user && typeof user.getIdToken === "function";
      if (!signedIn && !opts.allowGuest) {
        return { ok: false, error: "Not signed in." };
      }
      try {
        var idToken = signedIn ? await user.getIdToken() : "";
        // text/plain avoids a CORS preflight, which Apps Script cannot answer.
        var res = await fetch(MAIL_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(Object.assign({ idToken: idToken }, payload)),
          keepalive: !!opts.keepalive
        });
        return await res.json();
      } catch (err) {
        console.error("NoireMail error:", err);
        return { ok: false, error: err.message || "Network error." };
      }
    }
  
    window.NoireMail = {
      configured: configured,
      toast: toast,
      orderPlaced: function (user, orderId) {
        return call(user, { action: "orderPlaced", orderId: orderId }, { keepalive: true });
      },
      orderStatus: function (user, userId, orderId) {
        return call(user, { action: "orderStatus", userId: userId, orderId: orderId });
      },
      // Works for guests too. data: {name, email, subject, message, orderNumber?, website? (honeypot)}
      contact: function (user, data) {
        return call(user, Object.assign({ action: "contact" }, data), { allowGuest: true });
      },
      promo: function (user, data) {
        return call(user, Object.assign({ action: "promo" }, data));
      }
    };
  })();