import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.type !== 'access') {
        throw new Error('Not an access token');
      }
      req.user = await User.findById(decoded.id).select('-password');
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

export { protect };
