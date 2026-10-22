/* =====================================================
   NOIRÉ INVOICE HELPER
   Classic script (not a module) so it also works when
   you open the HTML files directly from disk.
   Exposes: window.NoireInvoice
     .ensure(order)        -> order with invoiceNumber/invoiceDate filled in
     .build(order)         -> invoice HTML string
     .view(order)          -> opens preview modal (with Download button)
     .download(order)      -> downloads a portrait A4 PDF via jsPDF (CDN)
===================================================== */
(function () {
  const JSPDF_CDN =
    "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";

  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[c]));

  const php = (n) =>
    (Number(n) || 0).toLocaleString("en-PH", { style: "currency", currency: "PHP" });

  function invoiceNumberFor(order) {
    if (order.invoiceNumber) return order.invoiceNumber;
    const base = String(order.orderNumber || order.orderId || order.id || "")
      .replace(/^NOIRE-/i, "");
    return "INV-" + (base || "000000");
  }

  function ensure(order) {
    return {
      ...order,
      invoiceNumber: invoiceNumberFor(order),
      invoiceDate: order.invoiceDate || order.createdAt || Date.now()
    };
  }

  function build(rawOrder) {
    const order = ensure(rawOrder);
    const items = Array.isArray(order.items)
      ? order.items
      : Object.values(order.items || {});

    const date = new Date(Number(order.invoiceDate)).toLocaleDateString("en-PH", {
      year: "numeric", month: "long", day: "numeric"
    });

    const paymentStatus = order.paymentStatus || (order.paymentMethod === "Cash on Delivery" ? "Pay on delivery" : "Unpaid");
    const refunded =
      order.refundStatus === "Refunded" || String(order.status || "").toLowerCase() === "refunded"
        ? Number(order.refundAmount ?? order.total) || 0
        : 0;

    return `
    <div class="noire-invoice" style="font-family:'DM Sans',Arial,sans-serif;color:#111;padding:40px;width:720px;max-width:100%;box-sizing:border-box;background:#fff;">
      <div style="display:flex;justify-content:space-between;border-bottom:2px solid #111;padding-bottom:18px;">
        <div>
          <div style="font-family:'Playfair Display',Georgia,serif;font-size:28px;letter-spacing:5px;">NOIRÉ</div>
          <div style="font-size:11px;color:#B76E79;letter-spacing:2px;margin-top:2px;">SKINCARE</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:22px;font-weight:700;letter-spacing:2px;">INVOICE</div>
          <div style="font-size:12px;color:#777;margin-top:4px;">${esc(order.invoiceNumber)}</div>
          <div style="font-size:12px;color:#777;">${esc(date)}</div>
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;gap:20px;margin:25px 0;font-size:12px;line-height:1.7;">
        <div>
          <strong style="font-size:10px;letter-spacing:1.5px;color:#B76E79;">BILLED TO</strong><br>
          ${esc(order.customerName || order.name || "Customer")}<br>
          ${order.email ? esc(order.email) + "<br>" : ""}
          ${order.phone ? esc(order.phone) + "<br>" : ""}
          ${esc(order.address || "")}
        </div>
        <div style="text-align:right;">
          <strong style="font-size:10px;letter-spacing:1.5px;color:#B76E79;">ORDER DETAILS</strong><br>
          Order No: ${esc(order.orderNumber || order.orderId || order.id || "")}<br>
          Payment: ${esc(order.paymentMethod || "—")}<br>
          Payment Status: ${esc(paymentStatus)}<br>
          Order Status: ${esc(order.status || "Pending")}
        </div>
      </div>

      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead>
          <tr style="background:#F9F9F6;text-align:left;">
            <th style="padding:10px;">Item</th>
            <th style="padding:10px;text-align:center;">Qty</th>
            <th style="padding:10px;text-align:right;">Price</th>
            <th style="padding:10px;text-align:right;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${
            items.length
              ? items.map((i) => `
            <tr style="border-bottom:1px solid #eee;">
              <td style="padding:10px;">${esc(i.name || "Product")}</td>
              <td style="padding:10px;text-align:center;">${Number(i.quantity) || 1}</td>
              <td style="padding:10px;text-align:right;">${php(i.price)}</td>
              <td style="padding:10px;text-align:right;">${php((Number(i.price) || 0) * (Number(i.quantity) || 1))}</td>
            </tr>`).join("")
              : `<tr><td colspan="4" style="padding:14px;text-align:center;color:#999;">No item details available.</td></tr>`
          }
        </tbody>
      </table>

      <div style="margin-top:20px;margin-left:auto;width:270px;font-size:12px;">
        <div style="display:flex;justify-content:space-between;padding:5px 0;"><span>Subtotal</span><span>${php(order.subtotal)}</span></div>
        <div style="display:flex;justify-content:space-between;padding:5px 0;"><span>Shipping</span><span>${Number(order.shipping) === 0 ? "FREE" : php(order.shipping)}</span></div>
        <div style="display:flex;justify-content:space-between;padding:10px 0;margin-top:4px;border-top:2px solid #111;font-size:15px;font-weight:700;"><span>Total</span><span>${php(order.total)}</span></div>
        ${refunded ? `<div style="display:flex;justify-content:space-between;padding:4px 0;color:#B76E79;"><span>Refunded</span><span>-${php(refunded)}</span></div>` : ""}
      </div>

      ${order.deliveryNotes ? `<p style="margin-top:22px;font-size:11px;color:#777;"><strong>Delivery notes:</strong> ${esc(order.deliveryNotes)}</p>` : ""}

      <p style="margin-top:40px;font-size:11px;color:#999;text-align:center;">Thank you for choosing Noiré. This invoice was generated automatically.</p>
    </div>`;
  }

  /* ---------- PDF (drawn directly with jsPDF: crisp text, true A4 portrait) ---------- */

  function loadJsPdf() {
    return new Promise((resolve, reject) => {
      if (window.jspdf && window.jspdf.jsPDF) return resolve();
      const s = document.createElement("script");
      s.src = JSPDF_CDN;
      s.onload = () => (window.jspdf && window.jspdf.jsPDF ? resolve() : reject(new Error("jsPDF not available")));
      s.onerror = () => reject(new Error("Could not load the PDF library."));
      document.head.appendChild(s);
    });
  }

  // jsPDF's built-in fonts cannot draw the peso sign, so the PDF uses "PHP".
  const pdfMoney = (n) =>
    "PHP " + (Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function buildPdf(rawOrder) {
    const order = ensure(rawOrder);
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

    const L = 18, R = 192, PAGE_BOTTOM = 275;
    const ROSE = [183, 110, 121], DARK = [17, 17, 17], GRAY = [119, 119, 119];
    const colQty = 118, colPrice = 156, colTotal = R;

    const items = Array.isArray(order.items) ? order.items : Object.values(order.items || {});
    const date = new Date(Number(order.invoiceDate)).toLocaleDateString("en-PH", {
      year: "numeric", month: "long", day: "numeric"
    });
    const paymentStatus = order.paymentStatus || (order.paymentMethod === "Cash on Delivery" ? "Pay on delivery" : "Unpaid");
    const refunded =
      order.refundStatus === "Refunded" || String(order.status || "").toLowerCase() === "refunded"
        ? Number(order.refundAmount ?? order.total) || 0
        : 0;

    const color = (c) => doc.setTextColor(c[0], c[1], c[2]);

    // ----- Header -----
    doc.setFont("times", "bold"); doc.setFontSize(24); color(DARK);
    doc.text("NOIRÉ", L, 26, { charSpace: 2 });
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); color(ROSE);
    doc.text("SKINCARE", L, 31, { charSpace: 1.5 });

    doc.setFont("helvetica", "bold"); doc.setFontSize(18); color(DARK);
    doc.text("INVOICE", R, 24, { align: "right", charSpace: 1 });
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); color(GRAY);
    doc.text(String(order.invoiceNumber), R, 30, { align: "right" });
    doc.text(date, R, 35, { align: "right" });

    doc.setDrawColor(17, 17, 17); doc.setLineWidth(0.6);
    doc.line(L, 40, R, 40);

    // ----- Billed to / Order details -----
    let y = 50;
    doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); color(ROSE);
    doc.text("BILLED TO", L, y, { charSpace: 0.6 });
    doc.text("ORDER DETAILS", R, y, { align: "right", charSpace: 0.6 });

    doc.setFont("helvetica", "normal"); doc.setFontSize(9); color(DARK);
    const billed = [order.customerName || order.name || "Customer", order.email, order.phone]
      .filter(Boolean)
      .concat(doc.splitTextToSize(String(order.address || ""), 85));
    const details = [
      "Order No: " + (order.orderNumber || order.orderId || order.id || ""),
      "Payment: " + (order.paymentMethod || "-"),
      "Payment Status: " + paymentStatus,
      "Order Status: " + (order.status || "Pending")
    ];
    let ly = y + 6, ry = y + 6;
    billed.forEach((line) => { doc.text(String(line), L, ly); ly += 5; });
    details.forEach((line) => { doc.text(line, R, ry, { align: "right" }); ry += 5; });
    y = Math.max(ly, ry) + 6;

    // ----- Table -----
    function tableHeader(yy) {
      doc.setFillColor(249, 249, 246);
      doc.rect(L, yy, R - L, 9, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(9); color(DARK);
      doc.text("Item", L + 3, yy + 6);
      doc.text("Qty", colQty, yy + 6, { align: "center" });
      doc.text("Price", colPrice, yy + 6, { align: "right" });
      doc.text("Total", colTotal - 3, yy + 6, { align: "right" });
      return yy + 9;
    }
    y = tableHeader(y);

    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    doc.setDrawColor(230, 230, 230); doc.setLineWidth(0.2);

    if (!items.length) {
      color(GRAY);
      doc.text("No item details available.", (L + R) / 2, y + 9, { align: "center" });
      y += 14;
    }

    items.forEach((it) => {
      const qty = Number(it.quantity) || 1;
      const price = Number(it.price) || 0;
      const nameLines = doc.splitTextToSize(String(it.name || "Product"), 85);
      const rowH = Math.max(10, nameLines.length * 5 + 5);

      if (y + rowH > PAGE_BOTTOM) {
        doc.addPage();
        y = tableHeader(20);
      }
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); color(DARK);
      doc.text(nameLines, L + 3, y + 6.5);
      doc.text(String(qty), colQty, y + 6.5, { align: "center" });
      doc.text(pdfMoney(price), colPrice, y + 6.5, { align: "right" });
      doc.text(pdfMoney(price * qty), colTotal - 3, y + 6.5, { align: "right" });
      y += rowH;
      doc.line(L, y, R, y);
    });

    // ----- Totals -----
    if (y + 40 > PAGE_BOTTOM) { doc.addPage(); y = 20; }
    y += 10;
    const tx = 120;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); color(DARK);
    doc.text("Subtotal", tx, y); doc.text(pdfMoney(order.subtotal), R, y, { align: "right" });
    y += 6;
    doc.text("Shipping", tx, y);
    doc.text(Number(order.shipping) === 0 ? "FREE" : pdfMoney(order.shipping), R, y, { align: "right" });
    y += 4;
    doc.setDrawColor(17, 17, 17); doc.setLineWidth(0.6);
    doc.line(tx, y, R, y);
    y += 7;
    doc.setFont("helvetica", "bold"); doc.setFontSize(12);
    doc.text("Total", tx, y); doc.text(pdfMoney(order.total), R, y, { align: "right" });
    if (refunded) {
      y += 7;
      doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); color(ROSE);
      doc.text("Refunded", tx, y); doc.text("-" + pdfMoney(refunded), R, y, { align: "right" });
    }

    if (order.deliveryNotes) {
      y += 14;
      if (y > PAGE_BOTTOM - 10) { doc.addPage(); y = 20; }
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); color(GRAY);
      doc.text(doc.splitTextToSize("Delivery notes: " + order.deliveryNotes, R - L), L, y);
    }

    // ----- Footer on the last page -----
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); color([150, 150, 150]);
    doc.text("Thank you for choosing Noiré. This invoice was generated automatically.", 105, 285, { align: "center" });

    return doc;
  }

  async function download(rawOrder) {
    const order = ensure(rawOrder);
    try {
      await loadJsPdf();
      buildPdf(order).save(order.invoiceNumber + ".pdf");
    } catch (err) {
      console.error("INVOICE DOWNLOAD ERROR:", err);
      alert("Unable to download the invoice. Please try again.");
    }
  }

  function view(rawOrder) {
    const order = ensure(rawOrder);
    document.getElementById("noireInvoiceOverlay")?.remove();

    const overlay = document.createElement("div");
    overlay.id = "noireInvoiceOverlay";
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:20000;background:rgba(17,17,17,.65);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:20px;";
    overlay.innerHTML = `
      <div style="background:#F9F9F6;border-radius:18px;max-width:780px;width:100%;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 25px 70px rgba(0,0,0,.3);">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid #eae7e1;">
          <strong style="font-family:'DM Sans',sans-serif;font-size:13px;">${esc(order.invoiceNumber)}</strong>
          <div style="display:flex;gap:8px;">
            <button type="button" data-inv="download" style="border:0;background:#000;color:#fff;border-radius:8px;padding:9px 14px;font:700 11px 'DM Sans',sans-serif;letter-spacing:1px;text-transform:uppercase;cursor:pointer;">Download PDF</button>
            <button type="button" data-inv="close" style="border:1px solid #ddd;background:#fff;border-radius:8px;padding:9px 14px;font:700 11px 'DM Sans',sans-serif;letter-spacing:1px;text-transform:uppercase;cursor:pointer;">Close</button>
          </div>
        </div>
        <div style="overflow:auto;padding:16px;display:flex;justify-content:center;">${build(order)}</div>
      </div>`;

    const close = () => overlay.remove();
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
    overlay.querySelector('[data-inv="close"]').addEventListener("click", close);
    overlay.querySelector('[data-inv="download"]').addEventListener("click", () => download(order));
    document.body.appendChild(overlay);
  }

  window.NoireInvoice = { ensure, build, buildPdf, view, download };
})();
