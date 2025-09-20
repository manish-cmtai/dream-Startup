import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import dotenv from "dotenv";

dotenv.config();

// Generate JWT token
export const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
};

// Verify JWT token
export const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

// Hash password
export const hashPassword = async (password) => {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
};

// Compare password
export const comparePassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

// Create cookie options
export const createCookieOptions = () => {
  const isProduction = process.env.NODE_ENV === "production";

  return {
    expires: new Date(
      Date.now() +
        (process.env.JWT_COOKIE_EXPIRES_IN || 7) * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    domain: isProduction ? process.env.COOKIE_DOMAIN : undefined,
  };
};

// Send token response
export const sendTokenResponse = (user, statusCode, res) => {
  const token = generateToken({
    email: user.email,
    role: user.role,
  });

  const cookieOptions = createCookieOptions();

  res.cookie("token", token, cookieOptions);
  return res.status(statusCode).json({
    success: true,
    token,
    user: {
      email: user.email,
      role: user.role,
    },
  });
};
