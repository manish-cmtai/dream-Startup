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

  const docRef = await adminDb.collection('contacts').add({ ...contact, timestamp: new Date() });
    
    res.status(201).json({ 
      id: docRef.id, 
      message: 'Contact form submitted successfully' 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get all contacts (admin only)
router.get('/', authenticate, checkPermission('contact:read'), async (req, res) => {
  try {
    const { status, limit: limitParam = 10, page = 1 } = req.query;
    const contactsRef = adminDb.collection('contacts');
    let queryRef = contactsRef;
    if (status) {
      queryRef = queryRef.where('status', '==', status);
    }
    queryRef = queryRef.orderBy('timestamp', 'desc').limit(parseInt(limitParam));
    const querySnapshot = await queryRef.get();
    const contacts = [];
    querySnapshot.forEach((d) => contacts.push({ id: d.id, ...d.data() }));

    res.json({ 
      contacts, 
      page: parseInt(page), 
      limit: parseInt(limitParam),
      total: contacts.length 
    });
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

  await adminDb.collection('contacts').doc(req.params.id).update({ status, updatedBy: req.user.uid, updatedAt: new Date() });

    res.json({ message: 'Contact status updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
