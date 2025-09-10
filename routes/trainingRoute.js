import express from 'express';
import { adminDb } from '../config/db.js';
import Training from '../models/trainingModel.js';
import { verifyToken, checkPermission, authenticate } from '../middleware/roleBaseAccess.js';

const router = express.Router();

// Get all training content (public)
router.get('/', async (req, res) => {
  try {
    const { category, level, limit: limitParam = 10, page = 1 } = req.query;
  const trainingRef = adminDb.collection('training');
  let queryRef = trainingRef.where('isActive', '==', true);
    
    if (category) {
      constraints.push(where('category', '==', category));
    }

    if (level) {
      constraints.push(where('level', '==', level));
    }

  queryRef = queryRef.orderBy('timestamp', 'desc').limit(parseInt(limitParam));
  const querySnapshot = await queryRef.get();
  const trainings = [];
  querySnapshot.forEach((d) => trainings.push({ id: d.id, ...d.data() }));

    res.json({ 
      trainings, 
      page: parseInt(page), 
      limit: parseInt(limitParam),
      total: trainings.length 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// Get single training (public)
router.get('/:id', async (req, res) => {
  try {
    const docSnap = await adminDb.collection('training').doc(req.params.id).get();
    if (!docSnap.exists || !docSnap.data().isActive) {
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

  const docRef = await adminDb.collection('training').add({ ...training, createdBy: req.user.email, timestamp: new Date() });
  res.status(201).json({ id: docRef.id, message: 'Training content created successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update training content
router.put('/:id', authenticate, checkPermission('training:update'), async (req, res) => {
  try {
    const training = new Training(req.body);
    training.validate();

  await adminDb.collection('training').doc(req.params.id).update({ ...training, updatedBy: req.user.email, updatedAt: new Date() });

    res.json({ message: 'Training content updated successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete training (soft delete)
router.delete('/:id', authenticate, checkPermission('training:delete'), async (req, res) => {
  try {
  await adminDb.collection('training').doc(req.params.id).update({ isActive: false, deletedBy: req.user.email, deletedAt: new Date() });

    res.json({ message: 'Training content deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
