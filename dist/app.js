const range = document.querySelector('#boost-range');
const output = document.querySelector('#boost-output');
const toggle = document.querySelector('#boost-switch');
const image = document.querySelector('#preview-image');
const stateLabel = document.querySelector('#boost-state');
const dialog = document.querySelector('#availability-dialog');
const staticHosting = document.documentElement.dataset.hosting === 'static';
let product = { downloadAvailable: false, checkoutAvailable: false, downloads: staticHosting ? null : 0, price: 14.99, currency: 'BRL', plans: [{ devices: 1, price: 14.99, checkoutAvailable: false }, { devices: 2, price: 23.99, checkoutAvailable: false }, { devices: 3, price: 29.99, checkoutAvailable: false }] };
let selectedDevices = 1;
let productLoaded = false;
let productUnavailable = false;
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
function translateStatic() {
  document.documentElement.lang = copy().locale;
  const bindings = [
    ['data-i18n', null], ['data-i18n-html', 'html'],
    ['data-i18n-aria-label', 'aria-label'], ['data-i18n-aria-roledescription', 'aria-roledescription'],
    ['data-i18n-content', 'content']
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
}
translateStatic();
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
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
document.querySelectorAll('[data-download]').forEach(link => link.addEventListener('click', event => {
  if (!product.downloadAvailable) { event.preventDefault(); showAvailability('download'); }
}));
document.querySelectorAll('[data-checkout]').forEach(link => link.addEventListener('click', event => {
  if (!selectedPlan().checkoutAvailable) { event.preventDefault(); showAvailability('checkout'); }
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

function renderProduct() {
  const plan = selectedPlan();
  document.querySelectorAll('[data-plan-price]').forEach(item => {
    item.textContent = formattedPrice(product.plans.find(option => option.devices === Number(item.dataset.planPrice)).price);
  });
  document.querySelectorAll('[data-checkout]').forEach(link => {
    link.href = staticHosting && plan.checkoutAvailable ? plan.checkoutUrl : `/api/checkout?devices=${selectedDevices}`;
  });
  const separatePrice = Math.round(product.plans[0].price * 100) * 3;
  const savings = Math.max(0, separatePrice - Math.round(product.plans[2].price * 100));
  const badge = document.querySelector('[data-plan-savings-badge]');
  badge.hidden = savings === 0;
  badge.textContent = `−${new Intl.NumberFormat(copy().locale, { style: 'percent', maximumFractionDigits: 0 }).format(separatePrice ? savings / separatePrice : 0)}`;
  document.querySelector('[data-plan-savings-copy]').textContent = savings > 0 ? message('tripleSavings', { savings: formattedPrice(savings / 100) }) : copy().strings['purchase.caption'];
  document.querySelector('[data-plan-savings-basis]').hidden = savings === 0;
  document.querySelector('[data-download-count]').textContent = productUnavailable || product.downloads === null ? '—' : new Intl.NumberFormat(copy().locale).format(product.downloads);
  document.querySelector('[data-download-unit]').textContent = message(productLoaded && product.downloads === 1 ? 'downloadOne' : 'downloadOther');
  document.querySelector('[data-release-status]').textContent = message(productUnavailable ? 'downloadUnavailable' : product.downloadAvailable ? 'downloadReady' : 'downloadSoon');
  document.querySelector('[data-sale-status]').textContent = message(plan.checkoutAvailable ? 'saleReady' : 'saleSoon');
  document.querySelector('[data-checkout-note]').textContent = message(plan.checkoutAvailable ? 'checkoutReady' : 'checkoutSoon', { devices: selectedDevices, deviceLabel: message(selectedDevices === 1 ? 'deviceOne' : 'deviceOther') });
  if (dialog.open) updateDialog();
}
async function refreshProduct() {
  try {
    const response = await fetch(staticHosting ? '/product.json?v=plans1' : '/api/product', { signal: AbortSignal.timeout(5000), cache: 'no-store' });
    if (!response.ok) throw new Error('Product unavailable');
    const data = await response.json();
    const validCount = Number.isSafeInteger(data.downloads) && data.downloads >= 0 || staticHosting && data.downloads === null;
    if (typeof data.downloadAvailable !== 'boolean' || typeof data.checkoutAvailable !== 'boolean' || !validCount || !Number.isFinite(data.price) || data.price < 0 || typeof data.currency !== 'string' || !/^[A-Z]{3}$/.test(data.currency)) throw new Error('Invalid product');
    if (!Array.isArray(data.plans) || data.plans.length !== 3 || !data.plans.every((plan, index) => plan?.devices === index + 1 && Number.isFinite(plan.price) && plan.price >= 0 && typeof plan.checkoutAvailable === 'boolean')) throw new Error('Invalid license plans');
    if (staticHosting) {
      for (const plan of data.plans) {
        if (!plan.checkoutAvailable) continue;
        const target = new URL(plan.checkoutUrl);
        if (target.protocol !== 'https:' || target.username || target.password) throw new Error('Invalid plan link');
      }
      for (const [key, flag, selector] of [['downloadUrl', 'downloadAvailable', '[data-download]']]) {
        if (!data[flag]) continue;
        const target = new URL(data[key]);
        if (target.protocol !== 'https:' || target.username || target.password) throw new Error('Invalid public link');
        document.querySelectorAll(selector).forEach(link => { link.href = target.href; });
      }
    }
    product = data;
    productLoaded = true;
    productUnavailable = false;
  } catch {
    productUnavailable = true;
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
refreshProduct();
window.addEventListener('focus', refreshProduct);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshProduct(); });
setInterval(() => { if (!document.hidden) refreshProduct(); }, 180000);

// One-time, lightweight entrances for sections below the viewport.
if ('IntersectionObserver' in window && !motionPreference.matches) {
  const sections = [...document.querySelectorAll('.qualities > div, .section-intro, .mode-details, .purchase-copy, .purchase-card')];
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-revealed');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -24px 0px' });
  sections.forEach((section, index) => {
    if (section.getBoundingClientRect().top < window.innerHeight * 0.85) return;
    section.style.setProperty('--reveal-delay', `${Math.min(index % 3 * 55, 110)}ms`);
    section.classList.add('scroll-reveal');
    observer.observe(section);
  });
  motionPreference.addEventListener('change', event => {
    if (!event.matches) return;
    observer.disconnect();
    sections.forEach(section => section.classList.add('is-revealed'));
  });
}
