const { loadTenant } = require('./_lib/tenant');
const { computeSlots } = require('./_lib/availability');
const { findService } = require('./_lib/services');

module.exports = async (req, res) => {
  try {
    const { tenant: tenantSlug, gender, service: serviceSlug, date } = req.query || {};
    if (!tenantSlug || !gender || !serviceSlug || !date) {
      res.status(400).json({ error: 'Parâmetros em falta.' });
      return;
    }

    const { config, services } = loadTenant(tenantSlug);
    const service = findService(services, gender, serviceSlug);
    if (!service) {
      res.status(404).json({ error: 'Serviço não encontrado.' });
      return;
    }

    const slots = await computeSlots({ tenantConfig: config, dateStr: date, durationMin: service.duration_min });
    res.status(200).json({
      slots,
      service: { name: service.name, price: service.price, duration_min: service.duration_min },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao calcular disponibilidade. Tente novamente.' });
  }
};
