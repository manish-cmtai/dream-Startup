import express from 'express';
import { adminDb } from '../config/db.js';
import Contact from '../models/contactModel.js';
import { checkPermission, authenticate } from '../middleware/roleBaseAccess.js';

const router = express.Router();

// Submit contact form (public)
router.post('/', async (req, res) => {
  try {
    const contact = new Contact(req.body);
    contact.validate();

    const docRef = await adminDb.collection('contacts').add({ 
      ...contact.toObject(), 
      timestamp: new Date() 
    });
    
    res.status(201).json({ 
      id: docRef.id, 
      message: 'Contact form submitted successfully' 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get contacts with pagination and filters (admin only)
router.get('/', authenticate, checkPermission('contact:read'), async (req, res) => {
  try {
    const { 
      status, 
      search, 
      limit: limitParam = 10, 
      page = 1 
    } = req.query;
    
    const limit = parseInt(limitParam);
    const currentPage = parseInt(page);

    let queryRef = adminDb.collection('contacts');

    // Build constraints for Firebase queries
    if (status) {
      queryRef = queryRef.where('status', '==', status);
    }

    let results = [];
    const snapshot = await queryRef.orderBy('timestamp', 'desc').get();
    
    snapshot.forEach((doc) => {
      const data = { id: doc.id, ...doc.data() };

      // Apply search filter if provided
      if (search) {
        const searchLower = search.toLowerCase();
        const matchesName = data.name?.toLowerCase().includes(searchLower);
        const matchesEmail = data.email?.toLowerCase().includes(searchLower);
        const matchesPhone = data.phoneNumber?.toLowerCase().includes(searchLower);
        const matchesMessage = data.message?.toLowerCase().includes(searchLower);
        
        if (matchesName || matchesEmail || matchesPhone || matchesMessage) {
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
      contacts: paginatedResults,
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

// Get single contact by ID (admin only)
router.get('/:id', authenticate, checkPermission('contact:read'), async (req, res) => {
  try {
    const docSnap = await adminDb.collection('contacts').doc(req.params.id).get();
    
    if (!docSnap.exists) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    res.json({ id: docSnap.id, ...docSnap.data() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update contact status
router.patch('/:id/status', authenticate, checkPermission('contact:update'), async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'in_progress', 'resolved', 'closed'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    await adminDb.collection('contacts').doc(req.params.id).update({
      status,
      updatedBy: req.user.uid,
      updatedAt: new Date()
    });

    res.json({ message: 'Contact status updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete contact (admin only)
router.delete('/:id', authenticate, checkPermission('contact:delete'), async (req, res) => {
  try {
    await adminDb.collection('contacts').doc(req.params.id).delete();
    res.json({ message: 'Contact deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
