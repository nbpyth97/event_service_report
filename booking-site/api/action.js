const { renderPage } = require('./_lib/renderPage');
const { verifyBookingToken } = require('./_lib/token');
const { getBookingById } = require('./_lib/resolveBooking');
const { loadTenantByProjectId } = require('./_lib/tenant');
const { formatDateTime } = require('./_lib/formatDateTime');

function bookingDetails(booking, timezone) {
  return [
    { label: 'Cliente', value: booking.customer_name },
    { label: 'Serviço', value: booking.service },
    { label: 'Telefone', value: booking.customer_phone },
    { label: 'Quando', value: formatDateTime(booking.event_start_time, timezone) },
  ];
}

// Single page reached from one WhatsApp link, offering both actions - avoids
// sending two long, near-identical URLs in the same message (fragile to
// line-wrapping / partial taps on some WhatsApp clients).
module.exports = async (req, res) => {
  const { id, token } = req.query || {};

  if (!verifyBookingToken(id, token)) {
    res.status(403).send(renderPage({
      title: 'Link inválido',
      message: 'Este link não é válido.',
      showButton: false,
    }));
    return;
  }

  try {
    const booking = await getBookingById(id);
    if (!booking) {
      res.status(404).send(renderPage({ title: 'Não encontrado', message: 'Este pedido não existe.', showButton: false }));
      return;
    }
    if (booking.status !== 'pending') {
      res.status(200).send(renderPage({ title: 'Já processado', message: 'Este pedido já foi processado anteriormente.', showButton: false }));
      return;
    }
    const { config } = loadTenantByProjectId(booking.project_id);
    const qs = `id=${encodeURIComponent(id)}&token=${encodeURIComponent(token)}`;
    res.status(200).send(renderPage({
      title: 'Novo pedido de marcação',
      message: 'Confirmar ou recusar este pedido?',
      details: bookingDetails(booking, config.timezone),
      showButton: false,
      extraButtons: [
        { label: 'Confirmar marcação', actionUrl: `/api/confirm?${qs}`, variant: 'primary' },
        { label: 'Recusar marcação', actionUrl: `/api/decline?${qs}`, variant: 'danger' },
      ],
    }));
  } catch (err) {
    console.error(err);
    res.status(500).send(renderPage({ title: 'Erro', message: 'Ocorreu um erro ao carregar o pedido.', showButton: false }));
  }
};
