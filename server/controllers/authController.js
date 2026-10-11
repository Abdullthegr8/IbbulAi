import crypto from 'node:crypto';
import { signToken } from '../middleware/auth.js';

// Constant-time comparison so response timing doesn't leak the credentials
function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

// Admin login — credentials come from ADMIN_USERNAME / ADMIN_PASSWORD in .env
export async function adminLogin(req, res) {
  const { username, password } = req.body || {};
  const expectedUser = process.env.ADMIN_USERNAME;
  const expectedPass = process.env.ADMIN_PASSWORD;

  if (!expectedUser || !expectedPass) {
    return res.status(503).json({ error: 'Admin login is not configured on the server' });
  }
  const userOk = safeEqual(username ?? '', expectedUser);
  const passOk = safeEqual(password ?? '', expectedPass);
  if (!userOk || !passOk) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const user = { id: `admin:${expectedUser}`, name: 'Administrator', role: 'admin', identifier: expectedUser };
  const token = signToken({ sub: user.id, role: user.role, name: user.name, identifier: user.identifier });
  res.json({ token, user: { ...user, username: expectedUser } });
}
