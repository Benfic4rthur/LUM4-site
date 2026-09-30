import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

// Exercise the production checkout code with a small DOM and synthetic fetches.
// No request is sent to the license service and no purchase is created.
const source = await readFile(new URL('../dist/app.js', import.meta.url), 'utf8');
const start = source.indexOf('function checkoutCurrency()');
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
    dialog: '#availability-dialog',
    checkoutDialog: '#checkout-dialog', checkoutForm: '#checkout-form',
    checkoutEmail: '#checkout-email', checkoutUsePublicCoupon: '#checkout-use-public-coupon',
    checkoutPublicCoupon: '[data-checkout-public-coupon]',
    checkoutPublicCouponCode: '[data-checkout-public-coupon-code]',
    checkoutPublicCouponDiscount: '[data-checkout-public-coupon-discount]',
    checkoutOriginalPrice: '[data-checkout-original-price]',
    checkoutDiscountBadge: '[data-checkout-discount-badge]',
    checkoutPrice: '[data-checkout-price]', checkoutError: '#checkout-error',
    checkoutSubmit: '#checkout-submit', paypalButton: '#paypal-button',
    pixResult: '#pix-result',
    pixPurchaseSummary: '[data-pix-purchase-summary]',
    pixEmailSummary: '[data-pix-email-summary]', pixCouponSummary: '[data-pix-coupon-summary]',
    pixQr: '#pix-qr', pixCode: '#pix-code', pixStatus: '#pix-status',
    licenseResult: '[data-license-result]', licenseKey: '#license-key',
    licenseCopyStatus: '#license-copy-status'
  };
  const globals = Object.fromEntries(Object.entries(namedElements).map(([name, selector]) => [name, element(selector)]));
  const pixMethod = element('[data-payment-method="pix"]');
  pixMethod.dataset.paymentMethod = 'pix';
  const paypalMethod = element('[data-payment-method="paypal"]');
  paypalMethod.dataset.paymentMethod = 'paypal';
  globals.paymentMethodButtons = [pixMethod, paypalMethod];
  globals.checkoutDialog.open = true;
  globals.checkoutEmail.value = 'audit-a@example.invalid';

  const context = vm.createContext({
    ...globals, AbortController, AbortSignal, performance,
    licenseApiBase: 'https://audit.invalid',
    document: {
      querySelector: element,
      querySelectorAll(selector) {
        if (selector === '[data-payment-method]') return globals.paymentMethodButtons;
        return [];
      },
      createElement: () => element('script'),
      head: { appendChild() {} }
    },
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
    copy: () => ({ strings: {
      'checkout.generatePix': 'Generate Pix',
      'checkout.paypalLoading': 'Preparing PayPal',
      'checkout.paypalError': 'PayPal error',
      'checkout.paypalCancelled': 'PayPal cancelled'
    } }),
    formattedPrice: value => String(value),
    formatMoney: (value, currency) =>
      `${currency}:${Number(value).toFixed(2)}`,
    renderProduct() {}, refreshProduct: async () => {},
    product: {
      currency: 'BRL',
      paypalCurrency: 'USD',
      paypalAvailable: false,
      paypalClientId: null,
      paypalEnvironment: 'sandbox',
      plans: [{ id: 'synthetic-plan', devices: 1, price: 14.99, priceUSD: 9.99 }]
    }
  });
  vm.runInContext(`
    let activePurchase = null;
    let activePayPalOrder = null;
    let publishedCoupon = null;
    let availabilityType = 'download';
    let selectedDevices = 1;
    let checkoutPaymentMethod = 'pix';
    let paypalPaymentSession = null;
    let paypalSdkPromise = null;
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

async function preparePayPalCheckout(f) {
  f.run(`
    resetCheckoutResult();
    product.paypalAvailable = true;
    product.paypalClientId = 'public-client-id';
    product.paypalEnvironment = 'live';
    window.paypal = {
      createInstance: async (options) => {
        window.__paypalInstanceOptions = options;
        return {
          findEligibleMethods: async (options) => {
            window.__paypalEligibilityOptions = options;
            return { isEligible: method => method === 'paypal' };
          },
          createPayPalOneTimePaymentSession: async handlers => {
            window.__paypalHandlers = handlers;
            return {
              start: async (options, orderPromise) => {
                window.__paypalStartOptions = options;
                window.__paypalOrderPromise = orderPromise;
                window.__paypalOrderResult = await orderPromise;
              }
            };
          }
        };
      }
    };
  `);
  await f.run('ensurePayPalCheckout()');
  f.run("setPaymentMethod('paypal')");
}

function paypalOrderResponse(purchaseId = 'paypal-approved', orderId = 'ORDER-APPROVED') {
  return {
    ok: true,
    json: async () => ({ purchaseId, orderId, amount: '9.99', currency: 'USD' })
  };
}

function assertNoLicense(f) {
  assert.equal(f.element('#license-key').textContent, '');
  assert.equal(f.element('[data-license-result]').hidden, true);
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


test('PayPal selection switches checkout to USD and the same coupon percentage', () => {
  const f = fixture();
  f.run(`
    product.paypalAvailable = true;
    paypalPaymentSession = {};
    publishedCoupon = {
      code: 'LANCAMENTO10',
      discountPercent: 10
    };
    checkoutUsePublicCoupon.checked = true;
    setPaymentMethod('paypal');
    renderCheckoutSummary();
  `);

  assert.equal(f.run('checkoutPaymentMethod'), 'paypal');
  assert.equal(
    f.element('[data-checkout-price]').textContent,
    'USD:8.99'
  );
  assert.equal(
    f.element('[data-checkout-original-price]').textContent,
    'USD:9.99'
  );
  assert.equal(
    f.element('[data-checkout-discount-badge]').textContent,
    '−10%'
  );

  f.run(`
    setPaymentMethod('pix');
    renderCheckoutSummary();
  `);

  assert.equal(
    f.element('[data-checkout-price]').textContent,
    'BRL:13.49'
  );
  assert.equal(
    f.element('[data-checkout-original-price]').textContent,
    'BRL:14.99'
  );
});

test('PayPal order creation uses the selected plan and public coupon', async () => {
  const f = fixture();
  f.run(`
    product.paypalAvailable = true;
    paypalPaymentSession = {};
    publishedCoupon = {
      code: 'LANCAMENTO10',
      discountPercent: 10
    };
    checkoutUsePublicCoupon.checked = true;
    setPaymentMethod('paypal');
  `);

  const creation = f.run('createPayPalOrderForCheckout()');
  assert.equal(f.requests.length, 1);
  assert.equal(
    f.requests[0].url,
    'https://audit.invalid/v1/checkout/paypal/create'
  );
  assert.deepEqual(
    JSON.parse(f.requests[0].options.body),
    {
      email: 'audit-a@example.invalid',
      planId: 'synthetic-plan',
      couponCode: 'LANCAMENTO10'
    }
  );

  f.requests[0].resolve({
    ok: true,
    json: async () => ({
      purchaseId: 'paypal-purchase',
      orderId: 'PAYPAL-ORDER',
      amount: '8.99',
      currency: 'USD'
    })
  });

  assert.equal((await creation).orderId, 'PAYPAL-ORDER');
  assert.equal(f.run('activePurchase'), 'paypal-purchase');
  assert.equal(f.run('activePayPalOrder'), 'PAYPAL-ORDER');
  assert.equal(
    f.element('[data-pix-coupon-summary]').textContent,
    'LANCAMENTO10 · −10%'
  );
});

test('PayPal starts during the click with a pending order and captures only after approval', async () => {
  const f = fixture();
  await preparePayPalCheckout(f);

  assert.equal(
    f.run('window.__paypalInstanceOptions.clientId'),
    'public-client-id'
  );
  assert.equal(
    f.run('window.__paypalEligibilityOptions.currencyCode'),
    'USD'
  );

  const click = f.element('#paypal-button').emit('click');
  assert.equal(f.requests.length, 1);
  // These assertions run before yielding: moving start after an awaited order
  // would lose the click's browser activation and fail this regression check.
  assert.equal(f.run('window.__paypalStartOptions.presentationMode'), 'auto');
  assert.equal(f.run('typeof window.__paypalOrderPromise.then'), 'function');
  assert.equal(f.run('window.__paypalOrderResult'), undefined);
  assert.equal(f.run('activePurchase'), null);
  assertNoLicense(f);

  f.requests[0].resolve(paypalOrderResponse());
  await click;

  assert.deepEqual(
    JSON.parse(f.run('JSON.stringify(window.__paypalOrderResult)')),
    { orderId: 'ORDER-APPROVED' }
  );
  assert.equal(f.requests.length, 1, 'Creating an order must not capture it');
  assert.equal(f.timers.size, 0, 'No license polling before approval');
  assertNoLicense(f);

  const approval = f.run(
    "window.__paypalHandlers.onApprove({ orderId: 'ORDER-APPROVED' })"
  );

  assert.equal(f.requests.length, 2);
  assert.equal(
    f.requests[1].url,
    'https://audit.invalid/v1/checkout/paypal/paypal-approved/capture'
  );
  assert.deepEqual(
    JSON.parse(f.requests[1].options.body),
    { orderId: 'ORDER-APPROVED' }
  );
  assertNoLicense(f);

  f.requests[1].resolve({
    ok: true,
    json: async () => ({
      licensed: true,
      licenseKey: 'LUM4-PAYPAL-LICENSE'
    })
  });

  await approval;
  assert.equal(
    f.element('#license-key').textContent,
    'LUM4-PAYPAL-LICENSE'
  );
  assert.equal(
    f.element('[data-license-result]').hidden,
    false
  );
});

test('PayPal ignores approval for another order or a closed checkout', async () => {
  const f = fixture();
  await preparePayPalCheckout(f);
  const click = f.element('#paypal-button').emit('click');
  f.requests[0].resolve(paypalOrderResponse());
  await click;

  await f.run("window.__paypalHandlers.onApprove({ orderId: 'ANOTHER-ORDER' })");
  assert.equal(f.requests.length, 1, 'A mismatched approval must not capture');
  assertNoLicense(f);

  f.run('closeCheckout()');
  await f.run("window.__paypalHandlers.onApprove({ orderId: 'ORDER-APPROVED' })");
  assert.equal(f.requests.length, 1, 'A closed checkout must not capture');
  assert.equal(f.timers.size, 0);
  assertNoLicense(f);
});

for (const failure of ['network rejection', 'server rejection', 'invalid order response']) {
  test(`PayPal ${failure} cannot capture or reveal a license`, async () => {
    const f = fixture();
    await preparePayPalCheckout(f);
    const click = f.element('#paypal-button').emit('click');

    if (failure === 'network rejection') {
      f.requests[0].reject(new Error('Synthetic order creation failure'));
    } else if (failure === 'server rejection') {
      f.requests[0].resolve({
        ok: false,
        json: async () => ({ error: 'Synthetic order creation failure' })
      });
    } else {
      f.requests[0].resolve(paypalOrderResponse('unapproved-purchase', null));
    }
    await click;

    await f.run("window.__paypalHandlers.onApprove({ orderId: 'ORDER-APPROVED' })");
    assert.equal(f.requests.length, 1, 'Failed order creation must not capture');
    assert.equal(f.run('activePurchase'), null);
    assert.equal(f.run('activePayPalOrder'), null);
    assert.equal(f.element('#checkout-error').hidden, false);
    assert.equal(f.timers.size, 0);
    assertNoLicense(f);
  });
}

test('PayPal SDK error cannot capture or reveal a license before buyer approval', async () => {
  const f = fixture();
  await preparePayPalCheckout(f);
  const click = f.element('#paypal-button').emit('click');
  f.requests[0].resolve(paypalOrderResponse());
  await click;

  f.run("window.__paypalHandlers.onError(new Error('Synthetic PayPal failure'))");
  assert.equal(f.requests.length, 1, 'SDK error must not capture the order');
  assert.equal(f.element('#checkout-error').hidden, false);
  assert.equal(f.timers.size, 0);
  assertNoLicense(f);
});

test('PayPal cancellation releases the pending purchase and keeps Pix usable', async () => {
  const f = fixture();

  f.run(`
    product.paypalAvailable = true;
    product.paypalClientId = 'public-client-id';
    window.paypal = {
      createInstance: async () => ({
        findEligibleMethods: async () => ({
          isEligible: method => method === 'paypal'
        }),
        createPayPalOneTimePaymentSession: async handlers => {
          window.__paypalHandlers = handlers;
          return { start: async () => {} };
        }
      })
    };
  `);

  await f.run('ensurePayPalCheckout()');
  f.run(`
    setPaymentMethod('paypal');
    activePurchase = 'cancel-purchase';
    activePayPalOrder = 'CANCEL-ORDER';
    window.__paypalHandlers.onCancel();
  `);

  assert.equal(f.run('activePurchase'), null);
  assert.equal(f.run('activePayPalOrder'), null);
  assert.equal(
    f.element('#checkout-error').textContent,
    'PayPal cancelled'
  );
  assert.equal(f.requests.length, 1);
  assert.equal(
    f.requests[0].url,
    'https://audit.invalid/v1/checkout/paypal/cancel-purchase/cancel'
  );
  assert.deepEqual(
    JSON.parse(f.requests[0].options.body),
    { orderId: 'CANCEL-ORDER' }
  );

  f.requests[0].resolve({
    ok: true,
    json: async () => ({ canceled: true })
  });
  await new Promise(resolve => setImmediate(resolve));

  f.run("setPaymentMethod('pix')");
  assert.equal(f.run('checkoutPaymentMethod'), 'pix');
  assert.equal(f.element('#checkout-submit').disabled, false);
});

test('PayPal ineligibility falls back to Pix without disabling checkout', async () => {
  const f = fixture();

  f.run(`
    product.paypalAvailable = true;
    product.paypalClientId = 'public-client-id';
    checkoutPaymentMethod = 'paypal';
    window.paypal = {
      createInstance: async () => ({
        findEligibleMethods: async () => ({
          isEligible: () => false
        }),
        createPayPalOneTimePaymentSession: async () => {
          throw new Error('must not create a session');
        }
      })
    };
  `);

  await f.run('ensurePayPalCheckout()');

  assert.equal(f.run('product.paypalAvailable'), false);
  assert.equal(f.run('checkoutPaymentMethod'), 'pix');
  assert.equal(f.element('#checkout-submit').disabled, false);
  assert.equal(
    f.element('[data-checkout-price]').textContent,
    'BRL:14.99'
  );
});

test('PayPal terminal failure stops polling instead of looping forever', async () => {
  const f = fixture();

  f.run("activePurchase = 'paypal-failed'");
  const poll = f.run(
    "pollPurchase('paypal-failed', checkoutGeneration)"
  );

  assert.equal(f.requests.length, 1);
  f.requests[0].resolve({
    ok: true,
    json: async () => ({
      licensed: false,
      status: 'failed'
    })
  });

  await poll;
  assert.equal(
    f.element('#pix-status').textContent,
    'checkoutPaymentFailed'
  );
  assert.equal(f.timers.size, 0);
});
