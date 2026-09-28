const range = document.querySelector('#boost-range');
const output = document.querySelector('#boost-output');
const toggle = document.querySelector('#boost-switch');
const image = document.querySelector('#preview-image');
const stateLabel = document.querySelector('#boost-state');
const dialog = document.querySelector('#availability-dialog');
let product = { downloadAvailable: false, checkoutAvailable: false, downloads: 0, price: 14.99, currency: 'BRL' };
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
  { src: '/assets/ocean-sunrise.webp', alt: 'Sol dourado no horizonte sobre as ondas de um oceano azul.', name: 'Pôr do sol', base: 0.715, step: 0.008 },
  { src: '/assets/night-lake.webp', alt: 'Lago de montanha à noite, com reflexos da lua e uma pequena cabana iluminada.', name: 'Cena escura', base: 0.56, step: 0.01 },
  { src: '/assets/snow-day.webp', alt: 'Montanhas cobertas de neve sob o sol, com texturas claras e céu azul.', name: 'Cena clara', base: 0.82, step: 0.0036 }
];
let currentScene = 0;
let sceneRequest = 0;

function updatePreview() {
  const active = toggle.getAttribute('aria-checked') === 'true';
  const boost = active ? Number(range.value) : 0;
  output.replaceChildren(document.createTextNode(String(boost)), Object.assign(document.createElement('span'), { textContent: '%' }));
  image.style.filter = `brightness(${scenes[currentScene].base + boost * scenes[currentScene].step})`;
  range.style.setProperty('--progress', `${range.value}%`);
  range.setAttribute('aria-valuetext', `${boost} por cento`);
  range.disabled = !active;
  stateLabel.textContent = !active || boost === 0 ? 'Sem boost' : boost < 35 ? 'Brilho suave' : boost < 80 ? 'Luz na medida' : 'Mais luz';
}
range.addEventListener('input', updatePreview);
toggle.addEventListener('click', () => {
  toggle.setAttribute('aria-checked', String(toggle.getAttribute('aria-checked') !== 'true'));
  updatePreview();
});
updatePreview();

const sceneButtons = [...document.querySelectorAll('[data-scene]')];
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
    image.src = scene.src;
    image.alt = scene.alt;
    sceneButtons.forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.scene) === index)));
    document.querySelector('#scene-position').textContent = `${index + 1} / ${scenes.length}`;
    document.querySelector('#scene-announcement').textContent = `Cena ${index + 1} de ${scenes.length}: ${scene.name}.`;
    updatePreview();
    if (!motionPreference.matches) image.animate([{ opacity: 0.75 }, { opacity: 1 }], { duration: 240, easing: 'ease-out' });
  } catch {
    document.querySelector('#scene-announcement').textContent = 'Não foi possível carregar essa cena. Tente novamente.';
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

const modes = {
  manual: { status: 'Implementado no app', title: 'O controle está com você.', description: 'Escolha o boost entre 0 e 100% da escala LUM4. O brilho muda suavemente, respeitando a capacidade da sua tela e um teto pensado para preservar a imagem.', extra: 'O brilho normal do macOS continua sob seu controle. Com HDR Protection ativado, o boost é limitado durante conteúdo HDR para ajudar a preservar seus detalhes.', note: 'Ajuste a intensidade. Encontre a sua luz.', icon: 'sun' },
  automatic: { status: 'Em desenvolvimento', title: 'A luz acompanha o seu dia.', description: 'O modo Automático vai combinar o brilho atual do Mac com seus horários e limites. Uma curva suave adapta o boost ao longo do dia, sem precisar de IA.', extra: 'Você poderá definir limites diferentes para o dia e a noite. As mudanças entre horários serão graduais, para manter a experiência confortável.', note: 'Brilho do Mac + seus horários. Tudo em harmonia.', icon: 'clock' },
  intelligent: { status: 'Em desenvolvimento', title: 'Uma luz que aprende com você.', description: 'A IA local vai reconhecer padrões nas correções que você repete e adaptar as preferências do Automático. Um ajuste isolado não vira regra: o aprendizado acontece quando há consistência.', extra: 'O modelo será baixado ao ativar o recurso e executado em momentos pontuais. Seu histórico ficará no Mac, com opções para pausar, redefinir ou apagar o aprendizado.', note: 'Aprende suas preferências. Respeita os limites da tela.', icon: 'shield' }
};
const tabs = [...document.querySelectorAll('[data-mode]')];
function selectMode(tab, focus = false) {
  const mode = modes[tab.dataset.mode];
  tabs.forEach(item => { item.setAttribute('aria-selected', String(item === tab)); item.tabIndex = item === tab ? 0 : -1; });
  document.querySelector('#mode-panel').setAttribute('aria-labelledby', tab.id);
  document.querySelector('#mode-title').textContent = mode.title;
  document.querySelector('#mode-description').textContent = mode.description;
  document.querySelector('#mode-extra').textContent = mode.extra;
  document.querySelector('#mode-note').textContent = mode.note;
  document.querySelector('#mode-note-icon use').setAttribute('href', `#i-${mode.icon}`);
  const status = document.querySelector('#mode-status');
  status.textContent = mode.status;
  status.classList.toggle('planned', tab.dataset.mode !== 'manual');
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

function showAvailability(type) {
  const purchase = type === 'checkout';
  document.querySelector('#dialog-title').textContent = purchase ? 'Sua nova luz está chegando.' : 'Mais luz, em breve.';
  document.querySelector('#dialog-description').textContent = purchase
    ? 'A compra do LUM4 será liberada no lançamento. O preço previsto é ' + new Intl.NumberFormat('pt-BR', { style: 'currency', currency: product.currency }).format(product.price) + '. Volte a esta página para adquirir sua licença quando as vendas estiverem disponíveis.'
    : 'A primeira versão pública do LUM4 está em preparação. O download será disponibilizado aqui no lançamento. O app foi pensado para macOS 26 ou mais recente e MacBook Pro com tela XDR compatível.';
  dialog.showModal();
}
document.querySelectorAll('[data-download]').forEach(link => link.addEventListener('click', event => {
  if (!product.downloadAvailable) { event.preventDefault(); showAvailability('download'); }
}));
document.querySelectorAll('[data-checkout]').forEach(link => link.addEventListener('click', event => {
  if (!product.checkoutAvailable) { event.preventDefault(); showAvailability('checkout'); }
}));
document.querySelector('#dialog-close').addEventListener('click', () => dialog.close());
document.querySelector('#dialog-done').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {
  const rect = dialog.getBoundingClientRect();
  if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
});

async function refreshProduct() {
  try {
    const response = await fetch('/api/product', { signal: AbortSignal.timeout(5000), cache: 'no-store' });
    if (!response.ok) throw new Error('Product unavailable');
    const data = await response.json();
    if (typeof data.downloadAvailable !== 'boolean' || typeof data.checkoutAvailable !== 'boolean' || !Number.isSafeInteger(data.downloads) || data.downloads < 0 || typeof data.price !== 'number') throw new Error('Invalid product');
    product = data;
    const formattedPrice = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: product.currency }).format(product.price);
    document.querySelectorAll('[data-price]').forEach(item => { item.textContent = formattedPrice; });
    document.querySelector('[data-download-count]').textContent = new Intl.NumberFormat('pt-BR').format(product.downloads);
    document.querySelector('[data-release-status]').textContent = product.downloadAvailable ? 'Download disponível' : 'Versão pública em breve';
    document.querySelector('[data-sale-status]').textContent = product.checkoutAvailable ? 'Disponível' : 'Em breve';
    document.querySelector('[data-checkout-note]').textContent = product.checkoutAvailable ? 'Você será direcionado para o pagamento.' : 'A compra será liberada no lançamento.';
  } catch {
    document.querySelector('[data-download-count]').textContent = '—';
    document.querySelector('[data-release-status]').textContent = 'Consulta indisponível';
  }
}
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
