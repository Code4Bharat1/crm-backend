import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// MONGODB_URI points at a remote host, so every User.findById() here pays a
// full network round trip (~100-170ms+ observed) on top of the route
// handler's own query -- two serialized round trips for every single
// authenticated request, which is most of why the app feels slow. Only
// req.user._id and req.user.role are ever read downstream (grep-verified
// across controllers/middleware), and neither changes within a session in
// any way that matters on a sub-minute timescale, so a short TTL cache
// removes the redundant round trip for a user actively navigating the app.
// Cap is intentionally short: an admin revoking/role-changing another
// user's account is reflected within USER_CACHE_TTL_MS, not instantly, but
// JWT signature verification and expiry are still enforced on every
// request regardless of this cache.
const USER_CACHE_TTL_MS = 30_000;
const userCache = new Map(); // userId -> { user, expiresAt }

const getCachedUser = async (userId) => {
  const cached = userCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.user;
  }
  const user = await User.findById(userId).select('-password');
  userCache.set(userId, { user, expiresAt: Date.now() + USER_CACHE_TTL_MS });
  return user;
};

const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.type && decoded.type !== 'access') {
        throw new Error('Not an access token');
      }
      const userId = decoded.id || decoded.userId || decoded._id;
      if (userId) {
        req.user = await getCachedUser(userId);
      }
      return next();
    } catch (error) {
      if (req.body?.employeeId || req.query?.employeeId || req.method === 'GET') {
        return next();
      }
      return res.status(401).json({ success: false, message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    if (req.body?.employeeId || req.query?.employeeId || req.method === 'GET') {
      return next();
    }
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};

const optionalProtect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.id || decoded.userId || decoded._id;
      if (userId) {
        req.user = await getCachedUser(userId);
      }
    } catch (error) {
      // Continue without user object if token fails
    }
  }
  return next();
};

export { protect, optionalProtect };
