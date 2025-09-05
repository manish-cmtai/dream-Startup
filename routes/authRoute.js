import express from "express";
import { adminDb } from "../config/db.js";
import {
  ROLES,
  authenticate,
  checkPermission,
} from "../middleware/roleBaseAccess.js";
import {
  hashPassword,
  comparePassword,
  sendTokenResponse,
} from "../util/auth.js";

const router = express.Router();

// Register user
router.post("/create", async (req, res) => {
  try {
    const { name, phone, email, password, role = ROLES.USER } = req.body;

    if (!name || !phone || !email || !password) {
      return res.status(400).json({ error: "Please provide all the details" });
    }

    const userRef = adminDb.collection("users").doc(email); // using email as ID
    const existingUserSnap = await userRef.get();

    if (existingUserSnap.exists) {
      return res.status(400).json({ error: "User already exists" });
    }

    const userData = {
      uid: email, // still using email as UID for now
      name,
      phone,
      email,
      password: await hashPassword(password),
      role,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await userRef.set(userData);

    // Return token + user (without password)
    sendTokenResponse(userData, 201, res);
  } catch (error) {
    console.error("Register error:", error);
    res.status(400).json({ error: error.message });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const userRef = adminDb.collection("users").doc(email);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const userData = userSnap.data();

    if (!userData.isActive) {
      return res.status(401).json({ error: "Account is disabled" });
    }

    const isPasswordValid = await comparePassword(password, userData.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    await userRef.update({ updatedAt: new Date() });

    sendTokenResponse(userData, 200, res);
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get current user
router.get("/me", authenticate, async (req, res) => {
  try {
    const userRef = adminDb.collection("users").doc(req.user.uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return res.status(404).json({ error: "User not found" });
    }

    const userData = userSnap.data();
    delete userData.password;

    res.json({ success: true, user: userData });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update profile
router.patch("/profile", authenticate, async (req, res) => {
  try {
    const { name, phone } = req.body;
    const updateData = { updatedAt: new Date() };

    if (name) updateData.name = name;
    if (phone) updateData.phone = phone;

    const userRef = adminDb.collection("users").doc(req.user.uid);
    await userRef.update(updateData);

    res.json({ success: true, message: "Profile updated successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: create user
router.post(
  "/create-user",
  authenticate,
  checkPermission("admin:create"),
  async (req, res) => {
    try {
      const { name, phone, email, password, role = ROLES.USER } = req.body;

      if (!name || !phone || !email || !password) {
        return res
          .status(400)
          .json({ error: "Please provide all the details" });
      }

      const userData = {
        uid: email,
        name,
        phone,
        email,
        password: await hashPassword(password),
        role,
        isActive: true,
        createdAt: new Date(),
        createdBy: req.user.uid,
      };

      const userRef = adminDb.collection("users").doc(email);
      await userRef.set(userData);

      res
        .status(201)
        .json({ success: true, message: "User created successfully" });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
);

// Admin: update role
router.patch(
  "/update-role/:uid",
  authenticate,
  checkPermission("admin:update"),
  async (req, res) => {
    try {
      const { role } = req.body;
      const { uid } = req.params;

      if (!Object.values(ROLES).includes(role)) {
        return res.status(400).json({ error: "Invalid role" });
      }

      const userRef = adminDb.collection("users").doc(uid);
      await userRef.update({
        role,
        updatedAt: new Date(),
        updatedBy: req.user.uid,
      });

      res.json({ success: true, message: "User role updated successfully" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Logout
router.post("/logout", (req, res) => {
  res
    .cookie("token", "logged-out", {
      expires: new Date(Date.now() + 10 * 1000),
      httpOnly: true,
    })
    .status(200)
    .json({ success: true, message: "Logged out successfully" });
});

export default router;
