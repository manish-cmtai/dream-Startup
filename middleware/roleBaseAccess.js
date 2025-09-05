import jwt from 'jsonwebtoken';
import admin from 'firebase-admin';
import { adminDb } from '../config/db.js';
import { verifyToken as verifyJWT } from '../util/auth.js';

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  EDITOR: 'editor',
  USER: 'user'
};

export const PERMISSIONS = {
  [ROLES.SUPER_ADMIN]: ['*'], // All permissions
  [ROLES.ADMIN]: [
    'services:create', 'services:read', 'services:update', 'services:delete',
    'blog:create', 'blog:read', 'blog:update', 'blog:delete',
    'training:create', 'training:read', 'training:update', 'training:delete',
    'contact:read', 'contact:update', 'contact:delete'
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

    // Check for token in header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    // Check for token in cookies
    else if (req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Verify token
    const decoded = verifyJWT(token);
    
    // Get user from server-side Firestore using Admin SDK
    const userSnap = await adminDb.collection('users').doc(decoded.uid).get();
    if (!userSnap.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userSnap.data();
    
    // Check if user is active
    if (!userData.isActive) {
      return res.status(401).json({ error: 'User account is disabled' });
    }

    req.user = {
      uid: decoded.uid,
      email: decoded.email,
      role: userData.role || ROLES.USER,
      ...userData
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    res.status(401).json({ error: 'Authentication failed' });
  }
};

// Legacy Firebase token verification (for compatibility)
export const verifyFirebaseToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No Firebase token provided' });
    }

    const decodedToken = await admin.auth().verifyIdToken(token);
    const userSnap = await adminDb.collection('users').doc(decodedToken.uid).get();
    if (!userSnap.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      role: userSnap.data().role || ROLES.USER
    };

    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid Firebase token' });
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

// Optional authentication (doesn't fail if no token)
export const optionalAuth = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies.token) {
      token = req.cookies.token;
    }

    if (token) {
        const decoded = verifyJWT(token);
        const userSnap = await adminDb.collection('users').doc(decoded.uid).get();
        if (userSnap.exists) {
          req.user = {
            uid: decoded.uid,
            email: decoded.email,
            role: userSnap.data().role || ROLES.USER,
            ...userSnap.data()
          };
        }
    }

    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

// For backward compatibility
export const verifyToken = authenticate;
