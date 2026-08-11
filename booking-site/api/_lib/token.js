const crypto = require('crypto');

function signBookingId(id) {
  return crypto.createHmac('sha256', process.env.BOOKING_TOKEN_SECRET).update(id).digest('hex');
}

function verifyBookingToken(id, token) {
  if (!id || !token) return false;
  const expected = signBookingId(id);
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(String(token), 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = { signBookingId, verifyBookingToken };
