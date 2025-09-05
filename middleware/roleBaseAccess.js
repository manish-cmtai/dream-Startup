import admin from "firebase-admin";
import { adminDb } from "../config/db.js";
import { verifyToken as verifyJWT } from "../util/auth.js";

export const ROLES = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  EDITOR: "editor",
  USER: "user",
};

export const PERMISSIONS = {
  [ROLES.SUPER_ADMIN]: ["*"],
  [ROLES.ADMIN]: [
    "services:create",
    "services:read",
    "services:update",
    "services:delete",
    "blog:create",
    "blog:read",
    "blog:update",
    "blog:delete",
    "training:create",
    "training:read",
    "training:update",
    "training:delete",
    "contact:read",
    "contact:update",
    "contact:delete",
  ],
  [ROLES.EDITOR]: [
    "services:create",
    "services:read",
    "services:update",
    "blog:create",
    "blog:read",
    "blog:update",
    "training:create",
    "training:read",
    "training:update",
    "contact:read",
  ],
  [ROLES.USER]: [
    "services:read",
    "blog:read",
    "training:read",
    "contact:create",
  ],
};

// Extract token from headers or cookies
const extractToken = (req) => {
  if (req.headers.authorization?.startsWith("Bearer")) {
    return req.headers.authorization.split(" ")[1];
  }
  if (req.cookies?.token) {
    return req.cookies.token;
  }
  return null;
};

// Custom JWT authentication
export const authenticate = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ error: "No token provided" });

    const decoded = verifyJWT(token);

    // ✅ Always fallback to email if uid is missing
    const userId = decoded.uid || decoded.email;
    if (!userId) {
      return res
        .status(401)
        .json({ error: "Invalid token payload (no uid/email)" });
    }

    const userRef = adminDb.collection("users").doc(userId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return res.status(404).json({ error: "User not found" });
    }

    const userData = userSnap.data();
    if (userData.isActive === false) {
      return res.status(401).json({ error: "User account is disabled" });
    }

    req.user = {
      uid: userId,
      email: decoded.email,
      role: userData.role || ROLES.USER,
      ...userData,
    };

    next();
  } catch (error) {
    console.error("🔴 Auth error:", error.message);
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired" });
    }
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ error: "Invalid token" });
    }
    res
      .status(401)
      .json({ error: "Authentication failed", details: error.message });
  }
};

// Firebase ID Token verification
export const verifyFirebaseToken = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token)
      return res.status(401).json({ error: "No Firebase token provided" });

    const decodedToken = await admin.auth().verifyIdToken(token);

    const userId = decodedToken.uid || decodedToken.email;
    if (!userId) {
      return res.status(401).json({ error: "Invalid Firebase token payload" });
    }

    const userRef = adminDb.collection("users").doc(userId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return res.status(404).json({ error: "User not found" });
    }

    req.user = {
      uid: userId,
      email: decodedToken.email,
      role: userSnap.data().role || ROLES.USER,
    };

    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid Firebase token" });
  }
};

// RBAC permission check
export const checkPermission = (permission) => {
  return (req, res, next) => {
    const userRole = req.user.role;
    const allowed = PERMISSIONS[userRole] || [];
    if (allowed.includes("*") || allowed.includes(permission)) {
      return next();
    }
    res.status(403).json({ error: "Insufficient permissions" });
  };
};

// Optional authentication (doesn’t fail if no token)
export const optionalAuth = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (token) {
      const decoded = verifyJWT(token);
      const userId = decoded.uid || decoded.email;
      if (userId) {
        const userSnap = await adminDb.collection("users").doc(userId).get();
        if (userSnap.exists) {
          req.user = {
            uid: userId,
            email: decoded.email,
            role: userSnap.data().role || ROLES.USER,
            ...userSnap.data(),
          };
        }
      }
    }
    next();
  } catch {
    next(); // ignore errors
  }
};

// Backward compatibility
export const verifyToken = authenticate;
