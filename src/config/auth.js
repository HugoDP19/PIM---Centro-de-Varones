const secret = process.env.JWT_SECRET;
const seedPassword = process.env.SEED_PASSWORD;
if (!secret || Buffer.byteLength(secret) < 32) throw new Error('Configura JWT_SECRET con al menos 32 bytes');
if (!seedPassword || seedPassword.length < 12 || Buffer.byteLength(seedPassword) > 72) {
  throw new Error('Configura SEED_PASSWORD entre 12 caracteres y 72 bytes');
}
const origin = new URL(process.env.APP_ORIGIN || 'http://localhost:3000').origin;
const production = process.env.NODE_ENV === 'production';
if (production && !origin.startsWith('https://')) throw new Error('APP_ORIGIN debe usar HTTPS en producción');
module.exports = {
  secret, seedPassword, origin, ttl: 8 * 60 * 60,
  issuer: 'sice-local', audience: 'sice-web', cookieName: 'sice_session',
  cookieOptions: { httpOnly: true, sameSite: 'strict', secure: production, path: '/api' },
};
