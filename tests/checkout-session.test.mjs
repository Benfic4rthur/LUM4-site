import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

// Exercise the production checkout code with a small DOM and synthetic fetches.
// No request is sent to the license service and no purchase is created.
const source = await readFile(new URL('../dist/app.js', import.meta.url), 'utf8');
const start = source.indexOf('let purchasePollTimer = null;');
const end = source.indexOf('\nfunction renderProduct()', start);
assert.ok(start >= 0 && end > start, 'Checkout region must be present');
const checkoutSource = source.slice(start, end);

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function fixture() {
  const elements = new Map();
  const requests = [];
  const timers = new Map();
  const animations = [];
  let pauseAnimations = false;
  let timerId = 0;

  function element(selector) {
    if (elements.has(selector)) return elements.get(selector);
    const classes = new Set();
    const listeners = new Map();
    const node = {
      textContent: '', hidden: false, disabled: false, checked: false,
      value: '', dataset: {}, open: false,
      classList: {
        add: (...values) => values.forEach(value => classes.add(value)),
        remove: (...values) => values.forEach(value => classes.delete(value)),
        contains: value => classes.has(value),
        toggle(value, enabled) {
          if (enabled) classes.add(value); else classes.delete(value);
        }
      },
      addEventListener(type, listener) { listeners.set(type, listener); },
      emit(type, event = {}) { return listeners.get(type)?.(event); },
      querySelector: element,
      querySelectorAll: () => [...elements.values()],
      setAttribute() {}, removeAttribute(name) { delete this[name]; },
      getBoundingClientRect: () => ({ left: 0, right: 100, top: 0, bottom: 100 }),
      checkValidity: () => true, focus() {},
      showModal() { this.open = true; }, close() { this.open = false; },
      getAnimations: () => animations,
      animate() {
        const completion = deferred();
        const animation = { finished: completion.promise, cancel: completion.resolve };
        animations.push(animation);
        if (!pauseAnimations) completion.resolve();
        return animation;
      }
    };
    elements.set(selector, node);
    return node;
  }

  const namedElements = {
    checkoutDialog: '#checkout-dialog', checkoutForm: '#checkout-form',
    checkoutEmail: '#checkout-email', checkoutUsePublicCoupon: '#checkout-use-public-coupon',
    checkoutPublicCoupon: '[data-checkout-public-coupon]',
    checkoutPublicCouponCode: '[data-checkout-public-coupon-code]',
    checkoutPublicCouponDiscount: '[data-checkout-public-coupon-discount]',
    checkoutOriginalPrice: '[data-checkout-original-price]',
    checkoutDiscountBadge: '[data-checkout-discount-badge]',
    checkoutPrice: '[data-checkout-price]', checkoutError: '#checkout-error',
    checkoutSubmit: '#checkout-submit', pixResult: '#pix-result',
    pixPurchaseSummary: '[data-pix-purchase-summary]',
    pixEmailSummary: '[data-pix-email-summary]', pixCouponSummary: '[data-pix-coupon-summary]',
    pixQr: '#pix-qr', pixCode: '#pix-code', pixStatus: '#pix-status',
    licenseResult: '[data-license-result]', licenseKey: '#license-key',
    licenseCopyStatus: '#license-copy-status'
  };
  const globals = Object.fromEntries(Object.entries(namedElements).map(([name, selector]) => [name, element(selector)]));
  globals.checkoutDialog.open = true;
  globals.checkoutEmail.value = 'audit-a@example.invalid';

  const context = vm.createContext({
    ...globals, AbortController, AbortSignal, performance,
    licenseApiBase: 'https://audit.invalid',
    document: { querySelector: element, querySelectorAll: () => [] },
    window: {
      setTimeout(callback) { const id = ++timerId; timers.set(id, callback); return id; },
      clearTimeout: id => timers.delete(id)
    },
    navigator: { clipboard: { writeText: async () => {} } },
    fetch(url, options) {
      const result = deferred();
      requests.push({ url, options, ...result });
      return result.promise;
    },
    message: key => key,
    copy: () => ({ strings: { 'checkout.generatePix': 'Generate Pix' } }),
    formattedPrice: value => String(value),
    renderProduct() {}, refreshProduct: async () => {},
    product: { plans: [{ id: 'synthetic-plan', devices: 1, price: 14.99 }] }
  });
  vm.runInContext(`
    let activePurchase = null;
    let publishedCoupon = null;
    let selectedDevices = 1;
    const motionPreference = { matches: true };
    function selectedPlan() { return product.plans[0]; }
  `, context);
  vm.runInContext(checkoutSource, context);

  return {
    context, element, requests, timers,
    submit: () => globals.checkoutForm.emit('submit', { preventDefault() {} }),
    run: expression => vm.runInContext(expression, context),
    reopen(email = 'audit-b@example.invalid') {
      vm.runInContext('closeCheckout(); openCheckout();', context);
      globals.checkoutEmail.value = email;
    },
    pauseAnimations() {
      pauseAnimations = true;
      vm.runInContext('motionPreference.matches = false', context);
    }
  };
}

function checkoutResponse(id) {
  return {
    ok: true,
    json: async () => ({
      purchaseId: id, amount: 14.99,
      pix: { qrCode: `synthetic-pix-${id}` }
    })
  };
}

test('a current checkout renders its Pix and starts polling', async () => {
  const f = fixture();
  const submitted = f.submit();
  f.requests[0].resolve(checkoutResponse('current'));
  await submitted;
  assert.equal(f.element('#pix-code').textContent, 'synthetic-pix-current');
  assert.equal(f.element('[data-pix-email-summary]').textContent, 'audit-a@example.invalid');
  assert.equal(f.element('#pix-result').hidden, false);
  assert.equal(f.requests.length, 2);
  assert.equal(f.requests[1].url, 'https://audit.invalid/v1/checkout/current');
  assert.equal(f.element('#checkout-submit').disabled, false);
});

test('closing aborts a pending creation and ignores a late success', async () => {
  const f = fixture();
  const submitted = f.submit();
  f.run('closeCheckout()');
  assert.equal(f.requests[0].options.signal.aborted, true);
  f.requests[0].resolve(checkoutResponse('closed'));
  await submitted;
  assert.equal(f.element('#pix-code').textContent, '');
  assert.equal(f.requests.length, 1);
});

test('an older checkout cannot replace the reopened checkout', async () => {
  const f = fixture();
  const older = f.submit();
  f.reopen();
  const newer = f.submit();
  f.requests[1].resolve(checkoutResponse('newer'));
  await newer;
  f.requests[0].resolve(checkoutResponse('older'));
  await older;
  assert.equal(f.element('#pix-code').textContent, 'synthetic-pix-newer');
  assert.equal(f.element('[data-pix-email-summary]').textContent, 'audit-b@example.invalid');
  assert.equal(f.run('activePurchase'), 'newer');
  assert.equal(f.requests.length, 3, 'The stale checkout must not start polling');
});

test('an older failure cannot show an error or enable a newer pending submit', async () => {
  const f = fixture();
  const older = f.submit();
  f.reopen();
  const newer = f.submit();
  f.requests[0].reject(new Error('synthetic failure'));
  await older;
  assert.equal(f.element('#checkout-error').hidden, true);
  assert.equal(f.element('#checkout-submit').disabled, true);
  f.requests[1].resolve(checkoutResponse('newer'));
  await newer;
  assert.equal(f.element('#checkout-submit').disabled, false);
});

test('a late paid status from a closed checkout cannot reveal its license', async () => {
  const f = fixture();
  const submitted = f.submit();
  f.requests[0].resolve(checkoutResponse('older'));
  await submitted;
  const statusRequest = f.requests[1];
  f.reopen();
  assert.equal(statusRequest.options.signal.aborted, true);
  statusRequest.resolve({ ok: true, json: async () => ({ licensed: true, licenseKey: 'synthetic-license' }) });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.element('#license-key').textContent, '');
  assert.equal(f.element('[data-license-result]').hidden, true);
});

test('resetting during a license animation prevents an old license from reappearing', async () => {
  const f = fixture();
  f.pauseAnimations();
  f.run("activePurchase = 'older'");
  const transition = f.run("transitionToLicenseResult('synthetic-license', 'older', checkoutGeneration)");
  f.reopen();
  assert.equal(await transition, false);
  assert.equal(f.element('#license-key').textContent, '');
  assert.equal(f.element('[data-license-result]').hidden, true);
});

test('Escape cancels an in-flight checkout without suppressing native dialog closing', async () => {
  const f = fixture();
  const submitted = f.submit();
  let prevented = false;
  f.element('#checkout-dialog').emit('cancel', { preventDefault() { prevented = true; } });
  assert.equal(prevented, false);
  assert.equal(f.requests[0].options.signal.aborted, true);
  f.requests[0].resolve(checkoutResponse('escaped'));
  await submitted;
  assert.equal(f.element('#pix-code').textContent, '');
});
