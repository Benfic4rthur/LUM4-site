console.log('sai daqui, ô metido a hacker.');

const range = document.querySelector('#boost-range');
const output = document.querySelector('#boost-output');
const toggle = document.querySelector('#boost-switch');
const image = document.querySelector('#preview-image');
const stateLabel = document.querySelector('#boost-state');
const dialog = document.querySelector('#availability-dialog');
const checkoutDialog = document.querySelector('#checkout-dialog');
const checkoutForm = document.querySelector('#checkout-form');
const checkoutEmail = document.querySelector('#checkout-email');
const checkoutUsePublicCoupon = document.querySelector('#checkout-use-public-coupon');
const checkoutPublicCoupon = document.querySelector('[data-checkout-public-coupon]');
const checkoutPublicCouponCode = document.querySelector('[data-checkout-public-coupon-code]');
const checkoutPublicCouponDiscount = document.querySelector('[data-checkout-public-coupon-discount]');
const checkoutOriginalPrice = document.querySelector('[data-checkout-original-price]');
const checkoutDiscountBadge = document.querySelector('[data-checkout-discount-badge]');
const checkoutPrice = document.querySelector('[data-checkout-price]');
const checkoutError = document.querySelector('#checkout-error');
const checkoutSubmit = document.querySelector('#checkout-submit');
const pixResult = document.querySelector('#pix-result');
const pixPurchaseSummary = document.querySelector('[data-pix-purchase-summary]');
const pixEmailSummary = document.querySelector('[data-pix-email-summary]');
const pixCouponSummary = document.querySelector('[data-pix-coupon-summary]');
const pixQr = document.querySelector('#pix-qr');
const pixCode = document.querySelector('#pix-code');
const pixStatus = document.querySelector('#pix-status');
const licenseResult = document.querySelector('[data-license-result]');
const licenseKey = document.querySelector('#license-key');
const licenseCopyStatus = document.querySelector('#license-copy-status');
const salesCounter = document.querySelector('[data-sales-counter]');
const salesNumber = document.querySelector('[data-sales-number]');
const salesLabel = document.querySelector('[data-sales-label]');
const demoSalesBoost = 15;
const licenseApiBase = 'https://lum-4-license-server.vercel.app';
// The public download link works independently of product and checkout requests.
const directDownloadAvailable = Boolean(document.querySelector('[data-download][href^="https://"]'));
let product = { downloadAvailable: directDownloadAvailable, checkoutAvailable: false, price: 14.99, currency: 'BRL', plans: [{ id: 'mac_1', devices: 1, price: 14.99, checkoutAvailable: false }, { id: 'mac_2', devices: 2, price: 23.99, checkoutAvailable: false }, { id: 'mac_3', devices: 3, price: 29.99, checkoutAvailable: false }] };
let publishedCoupon = null;
let salesCount = 0;
let activePurchase = null;
let selectedDevices = 1;
let availabilityType = 'download';
const locales = window.LUM4_LOCALES;
function validLanguage(value) { return typeof value === 'string' && Object.hasOwn(locales, value); }
function initialLanguage() {
  const requested = new URL(window.location.href).searchParams.get('lang');
  if (validLanguage(requested)) return requested;
  try {
    const saved = localStorage.getItem('lum4-language');
    if (validLanguage(saved)) return saved;
  } catch { /* The language buttons also work when storage is blocked. */ }
  return 'pt';
}
let language = initialLanguage();
function copy() { return locales[language]; }
function message(key, values = {}) {
  return copy().dynamic[key].replace(/\{(\w+)\}/g, (placeholder, name) => values[name] ?? placeholder);
}

// GitHub download totals have their own state; checkout availability never changes them.
const downloadCacheKey = 'lum4-release-downloads-v1';
const downloadCacheTtl = 5 * 60 * 1000;
let downloadsTotal = null;
let downloadsFetchedAt = 0;
let downloadsLastAttempt = 0;
let downloadsRequest = null;

function readDownloadCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(downloadCacheKey));
    if (cached && Number.isSafeInteger(cached.total) && cached.total >= 0 &&
      Number.isSafeInteger(cached.fetchedAt) && cached.fetchedAt > 0 && cached.fetchedAt <= Date.now()) {
      return cached;
    }
  } catch { /* The public counter also works when browser storage is blocked. */ }
  return null;
}

function renderDownloadSummary() {
  const known = Number.isSafeInteger(downloadsTotal) && downloadsTotal >= 0;
  document.querySelector('[data-download-total]').hidden = !known;
  document.querySelector('[data-download-divider]').hidden = !known;
  document.querySelector('[data-download-count]').textContent = known ? new Intl.NumberFormat(copy().locale).format(downloadsTotal) : '—';
  document.querySelector('[data-download-unit]').textContent = message(downloadsTotal === 1 ? 'downloadOne' : 'downloadOther');
  document.querySelector('[data-release-status]').textContent = message(known ? 'downloadTotal' : 'downloadReady');
}

async function fetchGitHubDownloads() {
  const { fetchReleaseDownloadTotal } = await import('./release-downloads.js?v=downloads1');
  return fetchReleaseDownloadTotal({ signal: AbortSignal.timeout(10000) });
}

function refreshDownloadCount(fetchTotal = fetchGitHubDownloads) {
  if (downloadsRequest) return downloadsRequest;
  const now = Date.now();
  const cached = readDownloadCache();
  if (cached && cached.fetchedAt >= downloadsFetchedAt) {
    downloadsTotal = cached.total;
    downloadsFetchedAt = cached.fetchedAt;
    renderDownloadSummary();
    if (now - cached.fetchedAt < downloadCacheTtl) return Promise.resolve();
  }
  if (downloadsLastAttempt > 0 && now >= downloadsLastAttempt && now - downloadsLastAttempt < downloadCacheTtl) return Promise.resolve();
  downloadsLastAttempt = now;
  downloadsRequest = (async () => {
    try {
      const total = await fetchTotal();
      if (!Number.isSafeInteger(total) || total < 0) throw new Error('Invalid download total');
      downloadsTotal = total;
      downloadsFetchedAt = Date.now();
      try {
        localStorage.setItem(downloadCacheKey, JSON.stringify({ total, fetchedAt: downloadsFetchedAt }));
      } catch { /* Saving this public count is optional. */ }
      renderDownloadSummary();
    } catch { /* Retain the last verified total rather than inventing a zero or partial count. */ }
  })().finally(() => { downloadsRequest = null; });
  return downloadsRequest;
}

function translateStatic() {
  document.documentElement.lang = copy().locale;
  const bindings = [
    ['data-i18n', null], ['data-i18n-html', 'html'],
    ['data-i18n-aria-label', 'aria-label'], ['data-i18n-aria-roledescription', 'aria-roledescription'],
    ['data-i18n-content', 'content'], ['data-i18n-placeholder', 'placeholder'],
    ['data-i18n-alt', 'alt']
  ];
  bindings.forEach(([binding, attribute]) => {
    document.querySelectorAll(`[${binding}]`).forEach(element => {
      const value = copy().strings[element.getAttribute(binding)];
      if (typeof value !== 'string') return;
      // HTML comes only from the bundled, reviewed translation catalog.
      if (attribute === 'html') element.innerHTML = value;
      else if (attribute) element.setAttribute(attribute, value);
      else element.textContent = value;
    });
  });
  document.querySelectorAll('[data-language]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.language === language));
  });
  document.querySelector('[data-apple-install-help]').href = {
    pt: 'https://support.apple.com/pt-br/102445',
    en: 'https://support.apple.com/en-us/102445',
    es: 'https://support.apple.com/es-es/102445'
  }[language];
}
translateStatic();
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
const downloadHelp = document.querySelector('#download-help');
const installCopyButton = document.querySelector('#copy-install-command');
const installCopyStatus = document.querySelector('#install-copy-status');
// The instructions remain expanded when JavaScript is unavailable.
downloadHelp.open = false;
installCopyButton.hidden = false;
document.querySelectorAll('[data-download]').forEach(link => {
  link.addEventListener('click', () => { downloadHelp.open = true; });
});
installCopyButton.addEventListener('click', async () => {
  let key = 'downloadHelp.copySuccess';
  try {
    await navigator.clipboard.writeText(document.querySelector('#download-help-command').textContent.trim());
  } catch {
    key = 'downloadHelp.copyError';
  }
  installCopyStatus.dataset.i18n = key;
  installCopyStatus.textContent = copy().strings[key];
  installCopyStatus.hidden = false;
});
const heroLight = document.querySelector('#hero-title > span');
if (heroLight && !motionPreference.matches) {
  heroLight.classList.add('luminosity-pass');
  heroLight.addEventListener('animationend', () => heroLight.classList.remove('luminosity-pass'), { once: true });
  motionPreference.addEventListener('change', event => {
    if (event.matches) heroLight.classList.remove('luminosity-pass');
  });
}
const scenes = [
  { src: '/assets/ocean-sunrise.webp', base: 0.715, step: 0.008 },
  { src: '/assets/night-lake.webp', base: 0.56, step: 0.01 },
  { src: '/assets/snow-day.webp', base: 0.82, step: 0.0036 }
];
let currentScene = 0;
let sceneRequest = 0;
let sceneFailed = false;

function updatePreview() {
  const active = toggle.getAttribute('aria-checked') === 'true';
  const boost = active ? Number(range.value) : 0;
  output.replaceChildren(document.createTextNode(String(boost)), Object.assign(document.createElement('span'), { textContent: '%' }));
  image.style.filter = `brightness(${scenes[currentScene].base + boost * scenes[currentScene].step})`;
  range.style.setProperty('--progress', `${range.value}%`);
  range.setAttribute('aria-valuetext', message('percent', { value: boost }));
  range.disabled = !active;
  stateLabel.textContent = message(!active || boost === 0 ? 'boostOff' : boost < 35 ? 'boostSoft' : boost < 80 ? 'boostBalanced' : 'boostHigh');
}
range.addEventListener('input', updatePreview);
toggle.addEventListener('click', () => {
  toggle.setAttribute('aria-checked', String(toggle.getAttribute('aria-checked') !== 'true'));
  updatePreview();
});
updatePreview();

const sceneButtons = [...document.querySelectorAll('[data-scene]')];
function updateSceneCopy(announce = false) {
  image.alt = copy().scenes[currentScene].alt;
  if (announce || sceneFailed || document.querySelector('#scene-announcement').textContent) document.querySelector('#scene-announcement').textContent = sceneFailed
    ? message('sceneError')
    : message('sceneAnnouncement', { index: currentScene + 1, total: scenes.length, name: copy().scenes[currentScene].name });
}
async function selectScene(index) {
  const request = ++sceneRequest;
  const scene = scenes[index];
  if (!scene || index === currentScene) return;
  try {
    const nextImage = new Image();
    nextImage.src = scene.src;
    await nextImage.decode();
    if (request !== sceneRequest) return;
    currentScene = index;
    sceneFailed = false;
    image.src = scene.src;
    updateSceneCopy(true);
    sceneButtons.forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.scene) === index)));
    document.querySelector('#scene-position').textContent = `${index + 1} / ${scenes.length}`;
    updatePreview();
    if (!motionPreference.matches) image.animate([{ opacity: 0.75 }, { opacity: 1 }], { duration: 240, easing: 'ease-out' });
  } catch {
    if (request !== sceneRequest) return;
    sceneFailed = true;
    updateSceneCopy();
  }
}
sceneButtons.forEach((button, index) => {
  button.addEventListener('click', () => selectScene(index));
  button.addEventListener('keydown', event => {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % sceneButtons.length;
    if (event.key === 'ArrowLeft') next = (index + sceneButtons.length - 1) % sceneButtons.length;
    if (next !== undefined) { event.preventDefault(); sceneButtons[next].focus(); selectScene(next); }
  });
});

const tabs = [...document.querySelectorAll('[data-mode]')];
function selectMode(tab, focus = false) {
  const mode = copy().modes[tab.dataset.mode];
  tabs.forEach(item => { item.setAttribute('aria-selected', String(item === tab)); item.tabIndex = item === tab ? 0 : -1; });
  document.querySelector('#mode-panel').setAttribute('aria-labelledby', tab.id);
  document.querySelector('#mode-title').textContent = mode.title;
  document.querySelector('#mode-description').textContent = mode.description;
  document.querySelector('#mode-extra').textContent = mode.extra;
  document.querySelector('#mode-note').textContent = mode.note;
  document.querySelector('#mode-note-icon use').setAttribute('href', `#i-${mode.icon}`);
  const status = document.querySelector('#mode-status');
  status.textContent = mode.status;
  if (focus) tab.focus();
}
tabs.forEach(tab => {
  tab.addEventListener('click', () => selectMode(tab));
  tab.addEventListener('keydown', event => {
    let next;
    if (event.key === 'ArrowRight') next = (tabs.indexOf(tab) + 1) % tabs.length;
    if (event.key === 'ArrowLeft') next = (tabs.indexOf(tab) + tabs.length - 1) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    if (next !== undefined) { event.preventDefault(); selectMode(tabs[next], true); }
  });
});

function selectedPlan() { return product.plans.find(plan => plan.devices === selectedDevices); }
function formattedPrice(price = selectedPlan().price) {
  return new Intl.NumberFormat(copy().locale, { style: 'currency', currency: product.currency, currencyDisplay: language === 'pt' ? 'symbol' : 'code' }).format(price);
}
function updateDialog() {
  const prefix = availabilityType === 'checkout' ? 'checkout' : 'download';
  document.querySelector('#dialog-title').textContent = message(`${prefix}DialogTitle`);
  document.querySelector('#dialog-description').textContent = message(`${prefix}DialogDescription`, { price: formattedPrice(), devices: selectedDevices, deviceLabel: message(selectedDevices === 1 ? 'deviceOne' : 'deviceOther') });
}
function showAvailability(type) {
  availabilityType = type;
  updateDialog();
  dialog.showModal();
}
document.querySelectorAll('[data-checkout]').forEach(button => button.addEventListener('click', () => {
  if (!selectedPlan().checkoutAvailable) {
    showAvailability('checkout');
    return;
  }
  openCheckout();
}));
document.querySelectorAll('input[name="license-plan"]').forEach(input => input.addEventListener('change', () => {
  const devices = Number(input.value);
  if (!input.checked || !product.plans.some(plan => plan.devices === devices)) return;
  selectedDevices = devices;
  renderProduct();
}));
document.querySelector('#dialog-close').addEventListener('click', () => dialog.close());
document.querySelector('#dialog-done').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {
  const rect = dialog.getBoundingClientRect();
  if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
});

let purchasePollTimer = null;
let checkoutGeneration = 0;
let checkoutRequestController = null;
let purchasePollController = null;

function clearPurchasePoll() {
  if (purchasePollTimer) window.clearTimeout(purchasePollTimer);
  purchasePollTimer = null;
}

function invalidateCheckoutSession() {
  checkoutGeneration += 1;
  clearPurchasePoll();
  checkoutRequestController?.abort();
  purchasePollController?.abort();
  checkoutRequestController = null;
  purchasePollController = null;
  activePurchase = null;
}

function isCurrentCheckout(generation) {
  return generation === checkoutGeneration && checkoutDialog.open;
}

function isCurrentPurchase(purchaseId, generation) {
  return isCurrentCheckout(generation) && activePurchase === purchaseId;
}

async function animateCheckoutElements(elements, keyframes, options) {
  if (motionPreference.matches) return;

  const animations = elements
    .filter(element => element && !element.hidden)
    .map(element => element.animate(keyframes, options));

  await Promise.allSettled(
    animations.map(animation => animation.finished)
  );
}

async function transitionToPixResult(generation) {
  if (!isCurrentCheckout(generation)) return false;
  const outgoing = [
    checkoutForm.querySelector('.checkout-field'),
    checkoutPublicCoupon,
    checkoutSubmit
  ];

  await animateCheckoutElements(
    outgoing,
    [
      { opacity: 1, transform: 'translateY(0)' },
      { opacity: 0, transform: 'translateY(-16px)' }
    ],
    {
      duration: 220,
      easing: 'cubic-bezier(.4,0,.2,1)',
      fill: 'forwards'
    }
  );

  if (!isCurrentCheckout(generation)) return false;
  checkoutDialog.classList.add('pix-created');
  pixPurchaseSummary.hidden = false;
  pixResult.hidden = false;

  await animateCheckoutElements(
    [pixPurchaseSummary, pixResult],
    [
      { opacity: 0, transform: 'translateY(16px)' },
      { opacity: 1, transform: 'translateY(0)' }
    ],
    {
      duration: 290,
      easing: 'cubic-bezier(.2,.7,.2,1)',
      fill: 'both'
    }
  );

  if (!isCurrentCheckout(generation)) return false;
  await animateCheckoutElements(
    [pixQr],
    [
      { opacity: 0, transform: 'scale(.96)' },
      { opacity: 1, transform: 'scale(1)' }
    ],
    {
      duration: 240,
      easing: 'cubic-bezier(.2,.7,.2,1)',
      fill: 'both'
    }
  );
  return isCurrentCheckout(generation);
}

async function transitionToLicenseResult(licenseValue, purchaseId, generation) {
  if (
    !isCurrentPurchase(purchaseId, generation) ||
    checkoutDialog.classList.contains('payment-confirmed') ||
    checkoutDialog.classList.contains('payment-transitioning')
  ) {
    return false;
  }

  checkoutDialog.classList.add('payment-transitioning');

  const outgoing = [
    document.querySelector('.pix-result-heading'),
    pixQr,
    document.querySelector('.pix-instruction'),
    document.querySelector('.pix-code-row')
  ];

  await animateCheckoutElements(
    outgoing,
    [
      { opacity: 1, transform: 'translateY(0) scale(1)' },
      { opacity: 0, transform: 'translateY(-14px) scale(.97)' }
    ],
    {
      duration: 240,
      easing: 'cubic-bezier(.4,0,.2,1)',
      fill: 'forwards'
    }
  );

  if (!isCurrentPurchase(purchaseId, generation)) return false;
  pixStatus.textContent = message('checkoutPaymentConfirmed');
  licenseKey.textContent = licenseValue;
  licenseResult.hidden = false;
  checkoutDialog.classList.add('payment-confirmed');
  checkoutDialog.classList.remove('payment-transitioning');

  await animateCheckoutElements(
    [pixStatus, licenseResult],
    [
      { opacity: 0, transform: 'translateY(14px)' },
      { opacity: 1, transform: 'translateY(0)' }
    ],
    {
      duration: 320,
      easing: 'cubic-bezier(.2,.7,.2,1)',
      fill: 'both'
    }
  );
  return isCurrentPurchase(purchaseId, generation);
}

function checkoutErrorMessage(error, fallback = 'checkoutUnavailable') {
  if (error && typeof error === 'object') {
    const details = error.error;
    if (details && typeof details === 'object' && typeof details.message === 'string') {
      return details.message;
    }
  }
  return message(fallback);
}

function couponPrice(plan, enabled = checkoutUsePublicCoupon.checked) {
  if (!enabled || !publishedCoupon) return plan.price;
  const cents = Math.round(plan.price * 100);
  const discounted = cents - Math.round(cents * publishedCoupon.discountPercent / 100);
  return Math.max(1, discounted) / 100;
}

function animateCheckoutPrice(from, to) {
  const duration = motionPreference.matches ? 0 : 720;
  const startedAt = performance.now();

  function frame(now) {
    const progress = duration === 0 ? 1 : Math.min(1, (now - startedAt) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = from + (to - from) * eased;
    checkoutPrice.textContent = formattedPrice(value);
    if (progress < 1) requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

function renderCheckoutSummary(animate = false) {
  const plan = selectedPlan();

  document.querySelectorAll('[data-checkout-plan-option]').forEach(button => {
    const devices = Number(button.dataset.checkoutPlanOption);
    const active = devices === selectedDevices;
    button.setAttribute('aria-pressed', String(active));
    button.classList.toggle('active', active);
  });

  const usePublicCoupon = Boolean(
    publishedCoupon &&
    checkoutUsePublicCoupon.checked
  );
  const nextPrice = couponPrice(plan, usePublicCoupon);
  const currentPrice = Number(
    checkoutPrice.dataset.numericPrice ?? plan.price
  );

  checkoutOriginalPrice.hidden = !usePublicCoupon;
  checkoutOriginalPrice.textContent = formattedPrice(plan.price);
  checkoutDiscountBadge.hidden = !usePublicCoupon;
  checkoutDiscountBadge.textContent = usePublicCoupon
    ? `−${publishedCoupon.discountPercent}%`
    : '';
  checkoutPrice.dataset.numericPrice = String(nextPrice);

  checkoutPrice.classList.toggle('discounted', usePublicCoupon);
  checkoutDiscountBadge.classList.toggle('is-visible', usePublicCoupon);

  if (animate && Math.abs(currentPrice - nextPrice) > 0.0001) {
    animateCheckoutPrice(currentPrice, nextPrice);
  } else {
    checkoutPrice.textContent = formattedPrice(nextPrice);
  }
}

function renderPublishedCoupon() {
  if (!publishedCoupon) {
    checkoutPublicCoupon.hidden = true;
    checkoutUsePublicCoupon.checked = false;
    return;
  }

  checkoutPublicCoupon.hidden = false;
  checkoutPublicCouponCode.textContent = publishedCoupon.code;
  checkoutPublicCouponDiscount.textContent = message('checkoutCouponDiscount', {
    discount: publishedCoupon.discountPercent
  });
}

function resetCheckoutResult() {
  invalidateCheckoutSession();
  checkoutError.hidden = true;
  checkoutError.textContent = '';
  pixResult.hidden = true;
  pixPurchaseSummary.hidden = true;
  pixEmailSummary.textContent = '';
  pixCouponSummary.hidden = true;
  pixCouponSummary.textContent = '';
  checkoutDialog
    .querySelectorAll('*')
    .forEach(element =>
      element.getAnimations().forEach(animation => animation.cancel())
    );
  checkoutDialog.classList.remove(
    'pix-created',
    'payment-confirmed',
    'payment-transitioning'
  );
  licenseResult.hidden = true;
  licenseKey.textContent = '';
  licenseCopyStatus.hidden = true;
  licenseCopyStatus.textContent = '';
  pixQr.hidden = true;
  pixQr.removeAttribute('src');
  pixCode.textContent = '';
  pixStatus.textContent = message('checkoutPaymentPending');
  checkoutSubmit.disabled = false;
  checkoutSubmit.querySelector('span').textContent = copy().strings['checkout.generatePix'];
}

function openCheckout() {
  resetCheckoutResult();
  checkoutUsePublicCoupon.checked = false;
  renderPublishedCoupon();
  renderCheckoutSummary();
  checkoutDialog.showModal();
  window.setTimeout(() => checkoutEmail.focus(), 0);
}

function closeCheckout() {
  invalidateCheckoutSession();
  checkoutDialog.close();
}

checkoutUsePublicCoupon.addEventListener('change', () => {
  renderCheckoutSummary(true);
});

document.querySelectorAll('[data-checkout-plan-option]').forEach(button => {
  button.addEventListener('click', () => {
    if (checkoutDialog.classList.contains('pix-created')) return;

    const devices = Number(button.dataset.checkoutPlanOption);
    if (!product.plans.some(plan => plan.devices === devices)) return;

    selectedDevices = devices;

    document.querySelectorAll('input[name="license-plan"]').forEach(input => {
      input.checked = Number(input.value) === devices;
    });

    renderProduct();
    renderCheckoutSummary(true);
  });
});

document.querySelector('#checkout-close').addEventListener('click', closeCheckout);
checkoutDialog.addEventListener('cancel', invalidateCheckoutSession);
checkoutDialog.addEventListener('click', event => {
  const rect = checkoutDialog.getBoundingClientRect();
  if (event.target === checkoutDialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) closeCheckout();
});
document.querySelector('#pix-copy').addEventListener('click', async () => {
  if (!pixCode.textContent) return;
  try {
    await navigator.clipboard.writeText(pixCode.textContent);
    pixStatus.textContent = message('checkoutCopied');
  } catch {
    pixStatus.textContent = pixCode.textContent;
  }
});

document.querySelector('#license-copy').addEventListener('click', async () => {
  if (!licenseKey.textContent) return;
  try {
    await navigator.clipboard.writeText(licenseKey.textContent);
    licenseCopyStatus.textContent = message('checkoutLicenseCopied');
    licenseCopyStatus.hidden = false;
  } catch {
    licenseCopyStatus.textContent = licenseKey.textContent;
    licenseCopyStatus.hidden = false;
  }
});

async function pollPurchase(purchaseId, generation = checkoutGeneration) {
  if (!isCurrentPurchase(purchaseId, generation)) return;
  clearPurchasePoll();
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);
  purchasePollController = controller;
  try {
    const response = await fetch(`${licenseApiBase}/v1/checkout/${encodeURIComponent(purchaseId)}`, {
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: controller.signal,
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) throw new Error('Status unavailable');
    const data = await response.json();
    if (!isCurrentPurchase(purchaseId, generation)) return;

    if (data.licensed === true && typeof data.licenseKey === 'string' && data.licenseKey.trim()) {
      if (await transitionToLicenseResult(data.licenseKey.trim(), purchaseId, generation)) {
        void refreshProduct();
      }
      return;
    }

    if (data.status === 'processed' && data.statusDetail === 'accredited') {
      pixStatus.textContent = message('checkoutPaymentPreparingLicense');
    }
    if (['expired', 'canceled', 'cancelled', 'refunded', 'create_failed'].includes(data.status)) {
      pixStatus.textContent = message('checkoutPaymentFailed');
      return;
    }
  } catch {
    if (!isCurrentPurchase(purchaseId, generation)) return;
  } finally {
    window.clearTimeout(timeout);
    if (purchasePollController === controller) purchasePollController = null;
  }

  if (isCurrentPurchase(purchaseId, generation)) {
    purchasePollTimer = window.setTimeout(() => void pollPurchase(purchaseId, generation), 3000);
  }
}

checkoutForm.addEventListener('submit', async event => {
  event.preventDefault();
  resetCheckoutResult();
  const generation = checkoutGeneration;

  const email = checkoutEmail.value.trim();
  if (!checkoutEmail.checkValidity() || !email) {
    checkoutError.textContent = message('checkoutInvalidEmail');
    checkoutError.hidden = false;
    checkoutEmail.focus();
    return;
  }

  const plan = selectedPlan();
  const couponCode = checkoutUsePublicCoupon.checked && publishedCoupon
    ? publishedCoupon.code
    : '';
  checkoutSubmit.disabled = true;
  checkoutSubmit.querySelector('span').textContent = message('checkoutCreating');
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15000);
  checkoutRequestController = controller;

  try {
    const response = await fetch(`${licenseApiBase}/v1/checkout/create`, {
      method: 'POST',
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        planId: plan.id,
        ...(couponCode ? { couponCode } : {})
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!isCurrentCheckout(generation)) return;
    if (!response.ok) throw data;

    if (typeof data.purchaseId !== 'string' || !data.pix || typeof data.pix !== 'object') {
      throw new Error('Invalid checkout response');
    }

    const qrCode = typeof data.pix.qrCode === 'string' ? data.pix.qrCode : '';
    const qrBase64 = typeof data.pix.qrCodeBase64 === 'string' ? data.pix.qrCodeBase64 : '';
    if (!qrCode && !qrBase64) throw new Error('Pix unavailable');

    activePurchase = data.purchaseId;
    pixEmailSummary.textContent = email;
    if (couponCode && publishedCoupon) {
      pixCouponSummary.hidden = false;
      pixCouponSummary.textContent = `${publishedCoupon.code} · −${publishedCoupon.discountPercent}%`;
    } else {
      pixCouponSummary.hidden = true;
      pixCouponSummary.textContent = '';
    }
    document.querySelector('[data-pix-amount]').textContent = formattedPrice(Number(data.amount));

    if (qrBase64) {
      pixQr.src = qrBase64.startsWith('data:') ? qrBase64 : `data:image/jpeg;base64,${qrBase64}`;
      pixQr.hidden = false;
    }

    pixCode.textContent = qrCode;
    document.querySelector('.pix-code-row').hidden = !qrCode;
    pixStatus.textContent = message('checkoutCreated', {
      amount: formattedPrice(Number(data.amount))
    });
    if (await transitionToPixResult(generation)) {
      void pollPurchase(data.purchaseId, generation);
    }
  } catch (error) {
    if (!isCurrentCheckout(generation)) return;
    checkoutError.textContent = error instanceof Error
      ? message('checkoutUnavailable')
      : checkoutErrorMessage(error);
    checkoutError.hidden = false;
  } finally {
    window.clearTimeout(timeout);
    if (checkoutRequestController === controller) checkoutRequestController = null;
    if (isCurrentCheckout(generation)) {
      checkoutSubmit.disabled = false;
      checkoutSubmit.querySelector('span').textContent = copy().strings['checkout.generatePix'];
    }
  }
});

function renderProduct() {
  const plan = selectedPlan();
  document.querySelectorAll('[data-plan-price]').forEach(item => {
    item.textContent = formattedPrice(product.plans.find(option => option.devices === Number(item.dataset.planPrice)).price);
  });
  document.querySelectorAll('[data-checkout]').forEach(button => {
    button.disabled = !plan.checkoutAvailable;
    button.setAttribute('aria-disabled', String(!plan.checkoutAvailable));
  });
  const separatePrice = Math.round(product.plans[0].price * 100) * 3;
  const savings = Math.max(0, separatePrice - Math.round(product.plans[2].price * 100));
  const badge = document.querySelector('[data-plan-savings-badge]');
  badge.hidden = savings === 0;
  badge.textContent = `−${new Intl.NumberFormat(copy().locale, { style: 'percent', maximumFractionDigits: 0 }).format(separatePrice ? savings / separatePrice : 0)}`;
  document.querySelector('[data-plan-savings-copy]').textContent = savings > 0 ? message('tripleSavings', { savings: formattedPrice(savings / 100) }) : copy().strings['purchase.caption'];
  document.querySelector('[data-plan-savings-basis]').hidden = savings === 0;
  renderDownloadSummary();
  document.querySelector('[data-sale-status]').textContent = message(plan.checkoutAvailable ? 'saleReady' : 'saleSoon');
  document.querySelector('[data-checkout-note]').textContent = message(plan.checkoutAvailable ? 'checkoutReady' : 'checkoutSoon', { devices: selectedDevices, deviceLabel: message(selectedDevices === 1 ? 'deviceOne' : 'deviceOther') });
  if (Number.isSafeInteger(salesCount) && salesCount >= 0) {
    const displayedSalesCount = demoSalesBoost + salesCount;
    salesCounter.hidden = false;
    salesNumber.textContent = new Intl.NumberFormat(copy().locale).format(displayedSalesCount);
    salesLabel.textContent = message(displayedSalesCount === 1 ? 'salesOne' : 'salesOther');
  } else {
    salesCounter.hidden = true;
  }
  renderPublishedCoupon();
  if (checkoutDialog.open) renderCheckoutSummary();
  if (dialog.open) updateDialog();
}

function validPublicCoupon(value) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    typeof value.code === 'string' &&
    value.code.length >= 3 &&
    value.code.length <= 64 &&
    Number.isInteger(value.discountPercent) &&
    value.discountPercent >= 1 &&
    value.discountPercent <= 99
  );
}

async function refreshProduct() {
  try {
    const [plansResponse, couponsResponse, statsResponse] = await Promise.all([
      fetch(`${licenseApiBase}/v1/plans`, {
        signal: AbortSignal.timeout(8000),
        cache: 'no-store',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        headers: { Accept: 'application/json' }
      }),
      fetch(`${licenseApiBase}/v1/coupons/public`, {
        signal: AbortSignal.timeout(8000),
        cache: 'no-store',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        headers: { Accept: 'application/json' }
      }),
      fetch(`${licenseApiBase}/v1/stats`, {
        signal: AbortSignal.timeout(8000),
        cache: 'no-store',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        headers: { Accept: 'application/json' }
      }).catch(() => null)
    ]);

    if (!plansResponse.ok) throw new Error('Plans unavailable');
    const plansData = await plansResponse.json();
    if (
      typeof plansData.currency !== 'string' ||
      !/^[A-Z]{3}$/.test(plansData.currency) ||
      !Array.isArray(plansData.plans)
    ) throw new Error('Invalid plans');

    const plans = plansData.plans
      .map(plan => ({
        id: plan?.id,
        devices: plan?.maxDevices,
        price: Number(plan?.priceBRL),
        checkoutAvailable: true
      }))
      .filter(plan =>
        typeof plan.id === 'string' &&
        Number.isInteger(plan.devices) &&
        plan.devices >= 1 &&
        plan.devices <= 3 &&
        Number.isFinite(plan.price) &&
        plan.price > 0
      )
      .sort((a, b) => a.devices - b.devices);

    if (plans.length !== 3 || plans.some((plan, index) => plan.devices !== index + 1)) {
      throw new Error('Invalid plans');
    }

    let nextCoupon = null;
    if (couponsResponse.ok) {
      const couponData = await couponsResponse.json();
      if (Array.isArray(couponData.coupons)) {
        nextCoupon = couponData.coupons.find(validPublicCoupon) ?? null;
      }
    }

    if (statsResponse?.ok) {
      const statsData = await statsResponse.json().catch(() => null);
      if (
        statsData &&
        Number.isSafeInteger(statsData.salesCount) &&
        statsData.salesCount >= 0
      ) {
        salesCount = statsData.salesCount;
      }
    }

    product = {
      downloadAvailable: directDownloadAvailable,
      price: plans[0].price,
      currency: plansData.currency,
      checkoutAvailable: true,
      plans
    };
    publishedCoupon = nextCoupon;
  } catch {
    product = {
      ...product,
      downloadAvailable: directDownloadAvailable,
      checkoutAvailable: false,
      plans: product.plans.map(plan => ({ ...plan, checkoutAvailable: false }))
    };
  }

  renderProduct();
}
function setLanguage(next, persist = true) {
  if (!validLanguage(next)) return;
  language = next;
  translateStatic();
  updatePreview();
  updateSceneCopy();
  selectMode(tabs.find(tab => tab.getAttribute('aria-selected') === 'true'));
  renderProduct();
  if (persist) {
    try { localStorage.setItem('lum4-language', language); } catch { /* Optional preference only. */ }
    try {
      const url = new URL(window.location.href);
      if (language === 'pt') url.searchParams.delete('lang');
      else url.searchParams.set('lang', language);
      window.history.replaceState(null, '', url);
    } catch { /* Language switching does not depend on a writable URL. */ }
    document.querySelector('#language-announcement').textContent = message('languageSelected');
  }
}
document.querySelectorAll('[data-language]').forEach(button => button.addEventListener('click', () => {
  if (button.dataset.language !== language) setLanguage(button.dataset.language);
}));
updateSceneCopy();
selectMode(tabs[0]);
renderProduct();
refreshDownloadCount();
refreshProduct();
window.addEventListener('focus', refreshProduct);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { refreshProduct(); refreshDownloadCount(); } });
setInterval(() => { if (!document.hidden) refreshProduct(); }, 180000);
setInterval(() => { if (!document.hidden) refreshDownloadCount(); }, downloadCacheTtl);

// Entrances replay on a fresh page load, once per element while scrolling.
if (!motionPreference.matches) {
  const opening = [...document.querySelectorAll('.site-header, .hero-copy > *, .hero-visual')];
  opening.forEach((element, index) => {
    const bounds = element.getBoundingClientRect();
    if (bounds.bottom <= 0 || bounds.top >= window.innerHeight * 0.92) return;
    element.style.setProperty('--entrance-delay', `${Math.min(index * 45, 300)}ms`);
    element.classList.add('page-entrance');
    element.addEventListener('animationend', event => {
      if (event.target === element) element.classList.remove('page-entrance');
    });
  });
  const sections = [...document.querySelectorAll('.hero-visual, .qualities > div, .turbo-card, .section-intro, .mode-details, .display-care, .purchase-copy, .purchase-card, .site-footer > *')];
  const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-revealed');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -24px 0px' }) : null;
  if (observer) sections.forEach((section, index) => {
    if (section.getBoundingClientRect().top < window.innerHeight * 0.92) return;
    section.style.setProperty('--reveal-delay', `${Math.min(index % 3 * 55, 110)}ms`);
    section.classList.add('scroll-reveal');
    observer.observe(section);
  });
  document.addEventListener('focusin', event => {
    const section = event.target.closest('.scroll-reveal, .page-entrance');
    if (!section) return;
    section.classList.remove('page-entrance');
    section.classList.add('is-revealed');
    observer?.unobserve(section);
  });
  motionPreference.addEventListener('change', event => {
    if (!event.matches) return;
    observer?.disconnect();
    opening.forEach(element => element.classList.remove('page-entrance'));
    sections.forEach(section => section.classList.add('is-revealed'));
  });
}
