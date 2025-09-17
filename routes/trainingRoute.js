import express from 'express';
import { adminDb } from '../config/db.js';
import Training from '../models/trainingModel.js';
import { checkPermission, authenticate } from '../middleware/roleBaseAccess.js';

const router = express.Router();

// Get all training content (public)
router.get('/', async (req, res) => {
  try {
    const { 
      category, 
      level, 
      search, 
      limit: limitParam = 10, 
      page = 1 
    } = req.query;
    
    const limit = parseInt(limitParam);
    const currentPage = parseInt(page);

    let queryRef = adminDb.collection('training');

    // Build constraints for Firebase queries
    if (category) {
      queryRef = queryRef.where('category', '==', category);
    }

    if (level) {
      queryRef = queryRef.where('level', '==', level);
    }

    let results = [];
    const snapshot = await queryRef.orderBy('timestamp', 'desc').get();
    
    snapshot.forEach((doc) => {
      const data = { id: doc.id, ...doc.data() };
      
      // Only show active training content for public access
      if (!data.isActive) return;

      // Apply search filter if provided
      if (search) {
        const searchLower = search.toLowerCase();
        const matchesTitle = data.title?.toLowerCase().includes(searchLower);
        const matchesDescription = data.description?.toLowerCase().includes(searchLower);
        const matchesCategory = data.category?.toLowerCase().includes(searchLower);
        const matchesLevel = data.level?.toLowerCase().includes(searchLower);
        
        if (matchesTitle || matchesDescription || matchesCategory || matchesLevel) {
          results.push(data);
        }
      } else {
        results.push(data);
      }
    });

    // Pagination logic
    const totalCount = results.length;
    const offset = (currentPage - 1) * limit;
    const paginatedResults = results.slice(offset, offset + limit);

    res.json({
      trainings: paginatedResults,
      pagination: {
        page: currentPage,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNextPage: currentPage * limit < totalCount,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all training content (admin only - includes inactive)
router.get('/admin', authenticate, checkPermission('training:read'), async (req, res) => {
  try {
    const { 
      category, 
      level, 
      isActive,
      search, 
      limit: limitParam = 10, 
      page = 1 
    } = req.query;
    
    const limit = parseInt(limitParam);
    const currentPage = parseInt(page);

    let queryRef = adminDb.collection('training');

    // Build constraints for Firebase queries
    if (category) {
      queryRef = queryRef.where('category', '==', category);
    }

    if (level) {
      queryRef = queryRef.where('level', '==', level);
    }

    if (isActive !== undefined) {
      queryRef = queryRef.where('isActive', '==', isActive === 'true');
    }

    let results = [];
    const snapshot = await queryRef.orderBy('timestamp', 'desc').get();
    
    snapshot.forEach((doc) => {
      const data = { id: doc.id, ...doc.data() };

      // Apply search filter if provided
      if (search) {
        const searchLower = search.toLowerCase();
        const matchesTitle = data.title?.toLowerCase().includes(searchLower);
        const matchesDescription = data.description?.toLowerCase().includes(searchLower);
        const matchesCategory = data.category?.toLowerCase().includes(searchLower);
        const matchesLevel = data.level?.toLowerCase().includes(searchLower);
        
        if (matchesTitle || matchesDescription || matchesCategory || matchesLevel) {
          results.push(data);
        }
      } else {
        results.push(data);
      }
    });

    // Pagination logic
    const totalCount = results.length;
    const offset = (currentPage - 1) * limit;
    const paginatedResults = results.slice(offset, offset + limit);

    res.json({
      trainings: paginatedResults,
      pagination: {
        page: currentPage,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNextPage: currentPage * limit < totalCount,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single training (public)
router.get('/:id', async (req, res) => {
  try {
    const docSnap = await adminDb.collection('training').doc(req.params.id).get();
    
    if (!docSnap.exists) {
      return res.status(404).json({ error: 'Training not found' });
    }

    const trainingData = docSnap.data();
    
    // For public access, only show active training
    if (!trainingData.isActive) {
      return res.status(404).json({ error: 'Training not found' });
    }

    res.json({ id: docSnap.id, ...trainingData });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single training for admin (includes inactive)
router.get('/admin/:id', authenticate, checkPermission('training:read'), async (req, res) => {
  try {
    const docSnap = await adminDb.collection('training').doc(req.params.id).get();
    
    if (!docSnap.exists) {
      return res.status(404).json({ error: 'Training not found' });
    }

    res.json({ id: docSnap.id, ...docSnap.data() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create training content
router.post('/', authenticate, checkPermission('training:create'), async (req, res) => {
  try {
    const training = new Training(req.body);
    training.validate();

    const docRef = await adminDb.collection('training').add({ 
      ...training, 
      createdBy: req.user.uid,
      createdByEmail: req.user.email, 
      timestamp: new Date() 
    });

    res.status(201).json({ 
      id: docRef.id, 
      message: 'Training content created successfully' 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update training content
router.put('/:id', authenticate, checkPermission('training:update'), async (req, res) => {
  try {
    // Check if training exists
    const existingDoc = await adminDb.collection('training').doc(req.params.id).get();
    if (!existingDoc.exists) {
      return res.status(404).json({ error: 'Training not found' });
    }

    const training = new Training(req.body);
    training.validate();

    await adminDb.collection('training').doc(req.params.id).update({ 
      ...training, 
      updatedBy: req.user.uid,
      updatedByEmail: req.user.email, 
      updatedAt: new Date() 
    });

    res.json({ message: 'Training content updated successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Toggle active status
router.patch('/:id/status', authenticate, checkPermission('training:update'), async (req, res) => {
  try {
    const { isActive } = req.body;
    
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ error: 'isActive must be a boolean' });
    }

    await adminDb.collection('training').doc(req.params.id).update({
      isActive,
      updatedBy: req.user.uid,
      updatedAt: new Date(),
      ...(!isActive && { deactivatedAt: new Date() }),
      ...(isActive && { reactivatedAt: new Date() })
    });

    res.json({ 
      message: `Training content ${isActive ? 'activated' : 'deactivated'} successfully` 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete training (soft delete)
router.delete('/:id', authenticate, checkPermission('training:delete'), async (req, res) => {
  try {
    // Check if training exists
    const existingDoc = await adminDb.collection('training').doc(req.params.id).get();
    if (!existingDoc.exists) {
      return res.status(404).json({ error: 'Training not found' });
    }

    await adminDb.collection('training').doc(req.params.id).update({ 
      isActive: false, 
      deletedBy: req.user.uid,
      deletedByEmail: req.user.email, 
      deletedAt: new Date() 
    });

    res.json({ message: 'Training content deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Hard delete training (permanent delete)
router.delete('/:id/permanent', authenticate, checkPermission('training:delete'), async (req, res) => {
  try {
    // Check if training exists
    const existingDoc = await adminDb.collection('training').doc(req.params.id).get();
    if (!existingDoc.exists) {
      return res.status(404).json({ error: 'Training not found' });
    }

    await adminDb.collection('training').doc(req.params.id).delete();
    res.json({ message: 'Training content permanently deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get training by category
router.get('/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const { limit: limitParam = 10, page = 1 } = req.query;
    
    const limit = parseInt(limitParam);
    const currentPage = parseInt(page);

    let results = [];
    const snapshot = await adminDb.collection('training')
      .where('category', '==', category)
      .where('isActive', '==', true)
      .orderBy('timestamp', 'desc')
      .get();
    
    snapshot.forEach((doc) => {
      results.push({ id: doc.id, ...doc.data() });
    });

    // Pagination logic
    const totalCount = results.length;
    const offset = (currentPage - 1) * limit;
    const paginatedResults = results.slice(offset, offset + limit);

    res.json({
      trainings: paginatedResults,
      category,
      pagination: {
        page: currentPage,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNextPage: currentPage * limit < totalCount,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get training by level
router.get('/level/:level', async (req, res) => {
  try {
    const { level } = req.params;
    const { limit: limitParam = 10, page = 1 } = req.query;
    
    const limit = parseInt(limitParam);
    const currentPage = parseInt(page);

    let results = [];
    const snapshot = await adminDb.collection('training')
      .where('level', '==', level)
      .where('isActive', '==', true)
      .orderBy('timestamp', 'desc')
      .get();
    
    snapshot.forEach((doc) => {
      results.push({ id: doc.id, ...doc.data() });
    });

    // Pagination logic
    const totalCount = results.length;
    const offset = (currentPage - 1) * limit;
    const paginatedResults = results.slice(offset, offset + limit);

    res.json({
      trainings: paginatedResults,
      level,
      pagination: {
        page: currentPage,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNextPage: currentPage * limit < totalCount,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
