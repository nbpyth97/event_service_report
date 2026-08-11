const { renderPage } = require('./_lib/renderPage');
const { verifyBookingToken } = require('./_lib/token');
const { resolveBooking, getBookingById } = require('./_lib/resolveBooking');
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

module.exports = async (req, res) => {
  // The confirm/decline buttons are plain <form method="POST" action="...?id=&token=">
  // with no hidden inputs, so on POST the id/token live in the query string,
  // not the body - always check both rather than assuming one or the other.
  const params = { ...(req.query || {}), ...(req.body || {}) };
  const { id, token } = params;

  if (!verifyBookingToken(id, token)) {
    res.status(403).send(renderPage({
      title: 'Link inválido',
      message: 'Este link não é válido.',
      showButton: false,
    }));
    return;
  }

  if (req.method === 'GET') {
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
      res.status(200).send(renderPage({
        title: 'Recusar marcação',
        message: 'Tem a certeza que quer recusar este pedido de marcação?',
        details: bookingDetails(booking, config.timezone),
        showButton: true,
        buttonLabel: 'Recusar marcação',
        actionUrl: `/api/decline?id=${encodeURIComponent(id)}&token=${encodeURIComponent(token)}`,
      }));
    } catch (err) {
      console.error(err);
      res.status(500).send(renderPage({ title: 'Erro', message: 'Ocorreu um erro ao carregar o pedido.', showButton: false }));
    }
    return;
  }

  try {
    const result = await resolveBooking(id, 'declined');
    if (result.alreadyHandled) {
      res.status(200).send(renderPage({
        title: 'Já processado',
        message: 'Este pedido já foi processado anteriormente.',
        showButton: false,
      }));
      return;
    }
    const { config } = loadTenantByProjectId(result.booking.project_id);
    res.status(200).send(renderPage({
      title: 'Marcação recusada',
      message: 'O pedido foi recusado. A cliente vai ser avisada.',
      details: bookingDetails(result.booking, config.timezone),
      showButton: false,
    }));
  } catch (err) {
    console.error(err);
    res.status(500).send(renderPage({
      title: 'Erro',
      message: 'Ocorreu um erro ao processar o pedido. Tente novamente.',
      showButton: false,
    }));
  }
};
