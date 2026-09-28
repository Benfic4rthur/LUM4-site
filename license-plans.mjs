const defaults = [{ devices: 1, price: 14.99 }, { devices: 2, price: 23.99 }, { devices: 3, price: 29.99 }];

function publicHttpsUrl(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

export function getLicensePlans(config, legacyCheckoutUrl = config.checkoutUrl) {
  return defaults.map(fallback => {
    const configured = Array.isArray(config.plans) ? config.plans.find(plan => plan?.devices === fallback.devices) : null;
    const price = configured?.price ?? (fallback.devices === 1 ? config.price : undefined) ?? fallback.price;
    if (!Number.isFinite(price) || price < 0) throw new Error('Preço de licença inválido.');
    const checkoutUrl = publicHttpsUrl(configured?.checkoutUrl ?? (fallback.devices === 1 ? legacyCheckoutUrl : null));
    return { devices: fallback.devices, price, checkoutUrl, checkoutAvailable: Boolean(checkoutUrl) };
  });
}
