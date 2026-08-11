function formatDateTime(dateLike, timeZone) {
  if (!dateLike) return '--';
  const d = new Date(dateLike);
  const formatted = new Intl.DateTimeFormat('pt-PT', {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
  return formatted;
}

module.exports = { formatDateTime };
