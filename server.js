/**
 * Noiré Skincare - PayMongo Backend Server
 * 
 * Provides:
 * 1. POST /api/paymongo/create-checkout (Step 3: Creates PayMongo checkout session for GCash)
 * 2. POST /api/paymongo/webhook         (Step 5: Webhook from PayMongo when GCash payment succeeds)
 */

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// =====================================================
// Notice: Webhook endpoint needs raw body for signature verification if used
// =====================================================
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } })); // raw body needed to verify PayMongo's webhook signature
app.use(express.static(__dirname)); // serves cart.html, account.html etc. at http://localhost:3000

// <!-- =================-->
// PayMongo API Configuration & Keys
// Replace with your actual PayMongo keys from dashboard.paymongo.com
const PAYMONGO_SECRET_KEY = process.env.PAYMONGO_SECRET_KEY || "sk_test_YOUR_PAYMONGO_SECRET_KEY";
const PAYMONGO_PUBLIC_KEY = process.env.PAYMONGO_PUBLIC_KEY || "pk_test_YOUR_PAYMONGO_PUBLIC_KEY";
const PAYMONGO_WEBHOOK_SECRET = process.env.PAYMONGO_WEBHOOK_SECRET || "whsec_YOUR_WEBHOOK_SIGNING_SECRET";

// Firebase Realtime Database URL
const SITE_URL = process.env.SITE_URL || "http://localhost:3000";
const FIREBASE_DB_URL = "https://noire-17ed6-default-rtdb.firebaseio.com";
// <!--=====================-->

// <!-- =================-->
// <!--==PayMongo API here-->
// <!--<code>-->

/**
 * Step 3: Create PayMongo Checkout Session
 * Receives order details from frontend and returns PayMongo GCash checkout session URL
 */
app.post('/api/paymongo/create-checkout', async (req, res) => {
  try {
    const { orderId, orderNumber, amount, items, customer } = req.body;

    if (!orderId || !amount) {
      return res.status(400).json({ error: "Missing required order parameters (orderId, amount)." });
    }

    // PayMongo amounts are represented in centavos (e.g. ₱100.00 = 10000)
    const amountInCentavos = Math.round(Number(amount) * 100);

    // Format line items for PayMongo
    const lineItems = (items && items.length > 0) ? items.map(item => ({
      currency: 'PHP',
      amount: Math.round((Number(item.price) || 0) * 100),
      name: item.name || 'Noiré Product',
      quantity: Number(item.quantity) || 1,
      images: /^https?:\/\//.test(item.image || '') ? [item.image] : [] // PayMongo needs public URLs
    })) : [{
      currency: 'PHP',
      amount: amountInCentavos,
      name: `Noiré Order ${orderNumber || orderId}`,
      quantity: 1
    }];

    // Shipping isn't in the cart items, so add the difference as its own line item.
    // Otherwise PayMongo would charge less than the order total.
    if (items && items.length > 0) {
      const itemsCentavos = lineItems.reduce((s, li) => s + li.amount * li.quantity, 0);
      const shippingCentavos = amountInCentavos - itemsCentavos;
      if (shippingCentavos > 0) {
        lineItems.push({ currency: 'PHP', amount: shippingCentavos, name: 'Shipping', quantity: 1 });
      }
    }

    // PayMongo Checkout Session payload
    const payload = {
      data: {
        attributes: {
          billing: {
            name: customer?.name || "Customer",
            email: customer?.email || "customer@noireskincare.com",
            phone: customer?.phone || ""
          },
          send_email_receipt: true,
          show_description: true,
          show_line_items: true,
          line_items: lineItems,
          // GCash Payment Method
          payment_method_types: ['gcash'],
          description: `Noiré Skincare Ritual - Order ${orderNumber || orderId}`,
          success_url: `${SITE_URL}/account.html?payment=success&order=${encodeURIComponent(orderNumber || orderId)}`,
          cancel_url: `${SITE_URL}/cart.html?payment=cancelled&order=${encodeURIComponent(orderNumber || orderId)}`,
          metadata: {
            orderId: orderId,
            orderNumber: orderNumber || "",
            userId: customer?.userId || ""
          }
        }
      }
    };

    // Call PayMongo API
    const authHeader = 'Basic ' + Buffer.from(PAYMONGO_SECRET_KEY + ':').toString('base64');
    const response = await fetch('https://api.paymongo.com/v1/checkout_sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("PayMongo API Error:", data);
      return res.status(response.status).json({
        error: "PayMongo API Error",
        details: data.errors || data
      });
    }

    const checkoutUrl = data.data.attributes.checkout_url;
    const checkoutSessionId = data.data.id;

    // Return URL for customer to pay in GCash
    return res.json({
      success: true,
      checkoutUrl: checkoutUrl,
      checkoutSessionId: checkoutSessionId
    });

  } catch (error) {
    console.error("Error creating PayMongo checkout session:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// Rejects fake "paid" calls: PayMongo signs each webhook with your webhook secret.
// Header looks like: t=<timestamp>,te=<test signature>,li=<live signature>
function verifyPaymongoSignature(req) {
  if (PAYMONGO_WEBHOOK_SECRET.startsWith('whsec_YOUR')) return false; // not configured yet
  const parts = Object.fromEntries((req.get('Paymongo-Signature') || '').split(',').map(p => p.split('=')));
  if (!parts.t || !req.rawBody) return false;
  const expected = crypto.createHmac('sha256', PAYMONGO_WEBHOOK_SECRET).update(`${parts.t}.${req.rawBody}`).digest('hex');
  const given = parts.li || parts.te || '';
  return given.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

/**
 * Step 5: PayMongo Webhook Handler
 * PayMongo calls this webhook when the customer completes payment in GCash
 * Marks order as "Paid" in Firebase Realtime Database
 */
app.post('/api/paymongo/webhook', async (req, res) => {
  try {
    if (!verifyPaymongoSignature(req)) {
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }
    const event = req.body;
    console.log("Received PayMongo Webhook Event:", event?.data?.attributes?.type);

    const eventType = event?.data?.attributes?.type;
    const eventData = event?.data?.attributes?.data;

    // Triggered when checkout session is paid
    if (eventType === 'checkout_session.payment.paid' || eventType === 'payment.paid') {
      const metadata = eventData?.attributes?.metadata || {};
      const orderId = metadata.orderId;
      const userId = metadata.userId;

      console.log(`Payment confirmed for Order: ${orderId}, User: ${userId}`);

      if (orderId && userId) {
        // Step 5: Mark order as "Paid" in Firebase Realtime Database
        const updateUrl = `${FIREBASE_DB_URL}/orders/${userId}/${orderId}.json`;
        const updatePayload = {
          paymentStatus: "Paid", // fulfillment `status` stays managed from the admin page
          paidAt: Date.now(),
          paymongoPaymentId: eventData?.id || ""
        };

        const fbResponse = await fetch(updateUrl, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatePayload)
        });

        if (fbResponse.ok) {
          console.log(`Successfully updated order ${orderId} status to 'Paid' in Firebase.`);
        } else {
          console.error("Failed to update Firebase order:", await fbResponse.text());
        }
      }
    }

    // Acknowledge receipt to PayMongo
    return res.status(200).json({ received: true });

  } catch (error) {
    console.error("Webhook processing error:", error);
    return res.status(500).json({ error: error.message });
  }
});

// <!--</code>-->
// <!--=====================-->

app.get('/', (req, res) => {
  res.send({ status: "Noiré Skincare PayMongo Backend is running." });
});

app.listen(PORT, () => {
  console.log(`✨ Noiré PayMongo server listening on port ${PORT}`);
  console.log(`- Create Checkout: http://localhost:${PORT}/api/paymongo/create-checkout`);
  console.log(`- Webhook Receiver: http://localhost:${PORT}/api/paymongo/webhook`);
});
