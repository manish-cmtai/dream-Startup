import jwt from 'jsonwebtoken';
import { adminDb, admin } from '../config/db.js';
import { verifyToken as verifyJWT } from '../util/auth.js';

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  EDITOR: 'editor',
  USER: 'user'
};

export const PERMISSIONS = {
  [ROLES.SUPER_ADMIN]: ['*'],
  [ROLES.ADMIN]: [
    // 'services:create', 'services:read', 'services:update', 'services:delete',
    // 'blog:create', 'blog:read', 'blog:update', 'blog:delete',
    // 'training:create', 'training:read', 'training:update', 'training:delete',
    // 'contact:read', 'contact:update', 'contact:delete',
    '*'
 
  ],
  [ROLES.EDITOR]: [
    'services:create', 'services:read', 'services:update',
    'blog:create', 'blog:read', 'blog:update',
    'training:create', 'training:read', 'training:update',
    'contact:read'
  ],
  [ROLES.USER]: [
    'services:read', 'blog:read', 'training:read', 'contact:create'
  ]
};

// JWT-based authentication middleware
export const authenticate = async (req, res, next) => {
  try {
    let token;

    // // Check for token in header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    // Check for token in cookies
     if (req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Verify token
    const decoded = verifyJWT(token);

    
    
    // Get user from database using Admin SDK
    const userDoc = await adminDb.collection('users').doc(decoded.email).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();
    
    // Check if user is active
    if (!userData.isActive) {
      return res.status(401).json({ error: 'User account is disabled' });
    }


    req.user = {
      email: decoded.email,
      ...userData
    };

    next();
  } catch (error) {
    console.error('❌ Authentication error:', error);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    res.status(401).json({ error: 'Authentication failed' });
  }
};

export const checkPermission = (permission) => {
  return (req, res, next) => {
    const userRole = req.user.role;
    const userPermissions = PERMISSIONS[userRole];

    if (userPermissions.includes('*') || userPermissions.includes(permission)) {
      next();
    } else {
      res.status(403).json({ error: 'Insufficient permissions' });
    }
  };
};

// For backward compatibility
export const verifyToken = authenticate;
