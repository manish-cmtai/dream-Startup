import express from 'express';
import { adminDb, admin } from '../config/db.js';
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

    console.log('📝 Registration attempt for:', email);

    // Check if user already exists using Admin SDK
    const userDoc = await adminDb.collection('users').doc(email).get();
    
    if (userDoc.exists) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Create and validate user
    const userData = {
      name,
      phone,
      email,
      password: await hashPassword(password),
      role,
    };

    const user = new User(userData);
    user.validate();

    // Save using Admin SDK
    await adminDb.collection('users').doc(email).set({
      ...user,
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now()
    });

    console.log('✅ User registered successfully:', email);
    
    // Send token response
    sendTokenResponse(user, 201, res);
  } catch (error) {
    console.error('❌ Registration error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('🔐 Login attempt for:', email);

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Get user from database using Admin SDK
    const userDoc = await adminDb.collection('users').doc(email).get();
    
    if (!userDoc.exists) {
      console.log('❌ User not found:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const userData = userDoc.data();

    // Check if user is active
    if (!userData.isActive) {
      return res.status(401).json({ error: 'Account is disabled' });
    }

    // Compare password
    const isPasswordValid = await comparePassword(password, userData.password);
    
    if (!isPasswordValid) {
      console.log('❌ Invalid password for:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login using Admin SDK
    await adminDb.collection('users').doc(email).update({
      lastLogin: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now()
    });

    console.log('✅ User logged in successfully:', email);

    // Send token response
    sendTokenResponse(userData, 200, res);
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get current user
router.get('/me', authenticate, async (req, res) => {
  try {
    const userDoc = await adminDb.collection('users').doc(req.user.email).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();
    delete userData.password; // Don't send password

    res.json({
      success: true,
      user: userData
    });
  } catch (error) {
    console.error('❌ Get user error:', error);
    res.status(500).json({ error: "error" });
  }
});

// Update user profile
router.patch('/updateUser', authenticate, async (req, res) => {
  try {
    const { name, phone } = req.body;

    const updateData = {
      updatedAt: admin.firestore.Timestamp.now()
    };

    if (name) updateData.name = name;
    if (phone) updateData.phone = phone;

    await adminDb.collection('users').doc(req.user.email).update(updateData);

    res.json({ success: true, message: 'Profile updated successfully' });
  } catch (error) {
    console.error('❌ Update profile error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all users (Admin only)
router.get('/users', authenticate, checkPermission('admin:read'), async (req, res) => {
  try {
    const { limit = 10, page = 1 } = req.query;
    
    let query = adminDb.collection('users')
      .orderBy('createdAt', 'desc')
      .limit(parseInt(limit));

    const snapshot = await query.get();
    
    const users = [];
    snapshot.forEach(doc => {
      const userData = doc.data();
      delete userData.password; // Don't send passwords
      users.push({ id: doc.id, ...userData });
    });

    res.json({
      success: true,
      users,
      page: parseInt(page),
      limit: parseInt(limit),
      total: users.length
    });
  } catch (error) {
    console.error('❌ Get users error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create user (Admin only)
router.post('/create-user', authenticate, checkPermission('*'), async (req, res) => {
  try {
    const { name, phone, email, password, role = ROLES.USER } = req.body;

    // Check if user already exists
    const existingUser = await adminDb.collection('users').doc(email).get();
    if (existingUser.exists) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const userData = {
      name,
      phone,
      email,
      password: await hashPassword(password),
      role,
      createdBy: req.user.email
    };

    const user = new User(userData);
    user.validate();

    await adminDb.collection('users').doc(email).set({
      ...user,
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now()
    });

    console.log('✅ User created by admin:', email);
    res.status(201).json({ success: true, message: 'User created successfully' });
  } catch (error) {
    console.error('❌ Create user error:', error);
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

    await adminDb.collection('users').doc(uid).update({
      role,
      updatedAt: admin.firestore.Timestamp.now(),
      updatedBy: req.user.email
    });

    console.log('✅ Role updated for user:', uid, 'to:', role);
    res.json({ success: true, message: 'User role updated successfully' });
  } catch (error) {
    console.error('❌ Update role error:', error);
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
