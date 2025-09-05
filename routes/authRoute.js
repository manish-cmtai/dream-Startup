import express from 'express';
import { adminDb } from '../config/db.js';
import { ROLES, authenticate, checkPermission } from '../middleware/roleBaseAccess.js';
import { 
  hashPassword, 
  comparePassword, 
  sendTokenResponse 
} from '../util/auth.js';
import User from '../models/userModel.js';

const router = express.Router();

// Register user
router.post('/create', async (req, res) => {
  try {
    const { name, phone, email, password, role = ROLES.USER } = req.body;
if(!req.body){
  res.status(400).json({error: "Please provide all the details"});
}
    // Check if user already exists (server-side)
    const userRef = adminDb.collection('users').doc(email);
    const existingUserSnap = await userRef.get();
    if (existingUserSnap.exists) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Create and validate user
    const userData = {
      name,
      phone,
      email,
      password: await hashPassword(password),
      role,
      uid: email
    };

    const user = new User(userData);
    user.validate();

  await userRef.set({ ...user });

    // Send token response
    sendTokenResponse(user, 201, res);
  } catch (error) {
    console.log(error);
    
    res.status(400).json({ error: error.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Get user from database
    const userRef = adminDb.collection('users').doc(email);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const userData = userSnap.data();

    // Check if user is active
    if (!userData.isActive) {
      return res.status(401).json({ error: 'Account is disabled' });
    }

    // Compare password
    const isPasswordValid = await comparePassword(password, userData.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
  await userRef.update({ updatedAt: new Date() });

    // Send token response
    sendTokenResponse(userData, 200, res);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get current user
router.get('/me', authenticate, async (req, res) => {
  try {
    const userRef = adminDb.collection('users').doc(req.user.uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userSnap.data();
    delete userData.password; // Don't send password

    res.json({
      success: true,
      user: userData
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update user profile
router.patch('/profile', authenticate, async (req, res) => {
  try {
    const { name, phone } = req.body;
  const userRef = adminDb.collection('users').doc(req.user.uid);
  const updateData = { updatedAt: new Date() };

    if (name) updateData.name = name;
    if (phone) updateData.phone = phone;

  await userRef.update(updateData);

    res.json({ success: true, message: 'Profile updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create user (Admin only)
router.post('/create-user', authenticate, checkPermission('admin:create'), async (req, res) => {
  try {
    const { name, phone, email, password, role = ROLES.USER } = req.body;

    const userData = {
      name,
      phone,
      email,
      password: await hashPassword(password),
      role,
      uid: email,
      createdBy: req.user.uid
    };

    const user = new User(userData);
    user.validate();

  const userRef = adminDb.collection('users').doc(email);
  await userRef.set({ ...user });

    res.status(201).json({ success: true, message: 'User created successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update user role (Admin only)
router.patch('/update-role/:uid', authenticate, checkPermission('admin:update'), async (req, res) => {
  try {
    const { role } = req.body;
    const { uid } = req.params;

    if (!Object.values(ROLES).includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

  const userRef = adminDb.collection('users').doc(uid);
  await userRef.update({ role, updatedAt: new Date(), updatedBy: req.user.uid });

    res.json({ success: true, message: 'User role updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Logout
router.post('/logout', (req, res) => {
  res
    .cookie('token', 'logged-out', {
      expires: new Date(Date.now() + 10 * 1000),
      httpOnly: true
    })
    .status(200)
    .json({ success: true, message: 'Logged out successfully' });
});

export default router;
