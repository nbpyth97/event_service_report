const TENANTS = {
  anabela: {
    config: require('../../tenant-config/anabela/config.json'),
    services: require('../../tenant-config/anabela/services.json'),
  },
};

function loadTenant(slug) {
  const tenant = TENANTS[slug];
  if (!tenant) throw new Error(`Tenant desconhecido: ${slug}`);
  return tenant;
}

function loadTenantByProjectId(projectId) {
  for (const slug of Object.keys(TENANTS)) {
    if (String(TENANTS[slug].config.project_id) === String(projectId)) {
      return { slug, ...TENANTS[slug] };
    }
  }
  throw new Error(`Nenhum tenant encontrado para project_id ${projectId}`);
}

module.exports = { loadTenant, loadTenantByProjectId };
