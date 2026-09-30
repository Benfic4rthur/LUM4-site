import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(
  new URL('../dist/locales.js', import.meta.url),
  'utf8'
);

const context = vm.createContext({ window: {} });
vm.runInContext(source, context);

const locales = context.window.LUM4_LOCALES;
const languages = ['pt', 'en', 'es'];
const paypalKeys = [
  'purchase.paypalPrice',
  'checkout.help',
  'checkout.paymentMethod',
  'checkout.pixCurrency',
  'checkout.paypalCurrency',
  'checkout.paypalUnavailable',
  'checkout.paypalLoading',
  'checkout.paypalCancelled',
  'checkout.paypalError',
  'checkout.selectedPlan',
  'checkout.email',
  'checkout.emailNote'
];

test('PayPal checkout copy exists in every supported language', () => {
  for (const language of languages) {
    const copy = locales[language];

    assert.ok(copy, `Missing locale: ${language}`);

    for (const key of paypalKeys) {
      assert.equal(
        typeof copy.strings[key],
        'string',
        `Missing ${key} in ${language}`
      );
      assert.ok(
        copy.strings[key].trim().length > 0,
        `Empty ${key} in ${language}`
      );
    }
  }
});

test('PayPal currency copy identifies USD while Pix identifies BRL', () => {
  assert.match(locales.pt.strings['checkout.pixCurrency'], /reais/i);
  assert.match(locales.pt.strings['checkout.paypalCurrency'], /dólares/i);
  assert.match(locales.en.strings['checkout.pixCurrency'], /reais/i);
  assert.match(locales.en.strings['checkout.paypalCurrency'], /dollars/i);
  assert.match(locales.es.strings['checkout.pixCurrency'], /reales/i);
  assert.match(locales.es.strings['checkout.paypalCurrency'], /dólares/i);
});
