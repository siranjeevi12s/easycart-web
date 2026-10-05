// Hosted Razorpay Checkout page (served by backend, no secret inside).
// Why hosted? The Expo customer app has no native Razorpay SDK, and adding
// one requires dev-client rebuilds. This page loads Razorpay checkout.js with
// the PUBLIC key_id + razorpay order_id, then deep-links the result back:
//   easycart://payment-callback?orderId=...&razorpay_order_id=...&razorpay_payment_id=...&razorpay_signature=...
// The mobile app (authenticated) then calls POST /payments/verify, and the
// webhook independently confirms. Amount/signature are always verified server-side.
import { env } from '../config/env';

export interface CheckoutPageParams {
  keyId: string;
  razorpayOrderId: string;
  amountPaise: number;
  currency: string;
  restaurantName: string;
  orderNumber: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  appOrderId: string;
  // Multi-seller batch: every sibling order covered by this one payment
  batchOrderIds?: string[];
}

const esc = (s: string) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function renderCheckoutPage(p: CheckoutPageParams): string {
  const scheme = env.APP_DEEP_SCHEME || 'easycart';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Pay • ${esc(p.restaurantName)} • EasyCart</title>
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<style>
  body { font-family: system-ui, sans-serif; background: #FFF8F5; margin: 0; padding: 24px; color: #1A1A1A; }
  .card { max-width: 420px; margin: 8vh auto; background: #fff; border-radius: 16px; padding: 24px; box-shadow: 0 8px 30px rgba(0,0,0,.08); text-align: center; }
  .amt { font-size: 32px; font-weight: 800; color: #FF6B35; margin: 8px 0; }
  .btn { background: #FF6B35; color: #fff; border: 0; border-radius: 12px; padding: 14px 20px; font-size: 16px; font-weight: 700; width: 100%; cursor: pointer; }
  .ghost { background: #fff; color: #666; border: 1px solid #eee; margin-top: 8px; }
  .muted { color: #666; font-size: 13px; }
</style>
</head>
<body>
<div class="card">
  <div style="font-weight:800;font-size:18px">EasyCart • ${esc(p.restaurantName)}</div>
  <div class="muted">Order ${esc(p.orderNumber)}</div>
  <div class="amt">₹${(p.amountPaise / 100).toFixed(p.amountPaise % 100 === 0 ? 0 : 2)}</div>
  <p class="muted">Secure payment via Razorpay (UPI • Cards • Netbanking)</p>
  <button class="btn" id="pay">Pay now</button>
  <button class="btn ghost" id="cancel">Cancel</button>
  <p class="muted" id="status"></p>
</div>
<script>
(function () {
  var appOrderId = ${JSON.stringify(p.appOrderId)};
  var batchOrderIds = ${JSON.stringify(p.batchOrderIds || [p.appOrderId])};
  var scheme = ${JSON.stringify(scheme)};
  function backToApp(params) {
    // Always attach the full batch so one payment verifies every sibling order
    params.orderIds = batchOrderIds;
    var q = Object.keys(params).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k] || ''); }).join('&');
    var deep = scheme + '://payment-callback?' + q;
    if (window.ReactNativeWebView) { window.ReactNativeWebView.postMessage(JSON.stringify(params)); return; }
    window.location.href = deep;
  }
  document.getElementById('cancel').onclick = function () {
    backToApp({ orderId: appOrderId, cancelled: '1' });
  };
  var options = {
    key: ${JSON.stringify(p.keyId)},
    amount: ${p.amountPaise},
    currency: ${JSON.stringify(p.currency)},
    order_id: ${JSON.stringify(p.razorpayOrderId)},
    name: 'EasyCart',
    description: ${JSON.stringify('Order ' + p.orderNumber + ' • ' + p.restaurantName)},
    prefill: { name: ${JSON.stringify(p.customerName || '')}, email: ${JSON.stringify(p.customerEmail || '')}, contact: ${JSON.stringify(p.customerPhone || '')} },
    theme: { color: '#FF6B35' },
    handler: function (resp) {
      document.getElementById('status').textContent = 'Payment received — returning to EasyCart…';
      backToApp({ orderId: appOrderId, razorpay_order_id: resp.razorpay_order_id, razorpay_payment_id: resp.razorpay_payment_id, razorpay_signature: resp.razorpay_signature });
    },
    modal: { ondismiss: function () { document.getElementById('status').textContent = 'Checkout closed — you can retry or cancel.'; } }
  };
  document.getElementById('pay').onclick = function () {
    if (!window.Razorpay) { document.getElementById('status').textContent = 'Razorpay failed to load. Check connection and retry.'; return; }
    new window.Razorpay(options).open();
  };
  // Auto-open for fastest flow; user can still cancel
  window.onload = function () { setTimeout(function(){ document.getElementById('pay').click(); }, 600); };
})();
</script>
</body>
</html>`;
}
