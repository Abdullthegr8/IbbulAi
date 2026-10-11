import jwt from 'jsonwebtoken';

/**
 * Token payload: { sub, role: 'admin' | 'staff' | 'student', name, identifier }
 * Admin tokens use the admin username as `sub`; user tokens use the users.id UUID.
 */
export function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

function readToken(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(header.slice(7), process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

// Sets req.user when a valid token is present; never rejects (guests allowed)
export function optionalAuth(req, res, next) {
  const payload = readToken(req);
  if (payload) req.user = { id: payload.sub, role: payload.role, name: payload.name, identifier: payload.identifier };
  next();
}

function requireRoles(...roles) {
  return (req, res, next) => {
    const payload = readToken(req);
    if (!payload) return res.status(401).json({ error: 'Authentication required' });
    if (roles.length && !roles.includes(payload.role)) {
      return res.status(403).json({ error: 'You do not have access to this resource' });
    }
    req.user = { id: payload.sub, role: payload.role, name: payload.name, identifier: payload.identifier };
    next();
  };
}

export const requireAuth         = requireRoles();
export const requireAdmin        = requireRoles('admin');
export const requireStaffOrAdmin = requireRoles('staff', 'admin');
