export function slugify(str) {
  return String(str)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function listServices(servicesConfig) {
  const out = [];
  for (const [key, gender] of [['women', 'mulher'], ['men', 'homem']]) {
    for (const [name, data] of Object.entries(servicesConfig[key] || {})) {
      out.push({ gender, name, slug: slugify(name), price: data.price, duration_min: data.duration_min });
    }
  }
  return out;
}

export function findService(servicesConfig, gender, slug) {
  return listServices(servicesConfig).find((s) => s.gender === gender && s.slug === slug);
}
