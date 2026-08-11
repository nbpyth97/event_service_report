// Converts a wall-clock date+time in a named IANA timezone to a UTC Date,
// without pulling in a date library. Standard "guess and correct" approach:
// treat the wall-clock numbers as UTC, see what that instant renders as in
// the target timezone, then shift by the difference.
function zonedTimeToUtc(dateStr, timeStr, timeZone) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);

  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute));

  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = Object.fromEntries(fmt.formatToParts(guess).map((p) => [p.type, p.value]));
  const renderedAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );

  const diff = guess.getTime() - renderedAsUtc;
  return new Date(guess.getTime() + diff);
}

module.exports = { zonedTimeToUtc };
