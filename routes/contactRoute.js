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

    const docRef = await adminDb.collection('contacts').add({ ...contact.toObject(), timestamp: new Date() });
    
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
    const { status, limit = 10, pageToken } = req.query;
    const pageSize = parseInt(limit, 10) || 10;

    let queryRef = adminDb.collection('contacts').orderBy('timestamp', 'desc');

    if (status) {
      queryRef = queryRef.where('status', '==', status);
    }

    if (pageToken) {
      // Get the document snapshot for the pageToken cursor
      const snapshotForToken = await adminDb.collection('contacts').doc(pageToken).get();
      if (!snapshotForToken.exists) {
        return res.status(400).json({ error: 'Invalid page token' });
      }
      queryRef = queryRef.startAfter(snapshotForToken);
    }

    // Limit the results to pageSize
    const querySnapshot = await queryRef.limit(pageSize).get();

    const contacts = [];
    querySnapshot.forEach(doc => contacts.push({ id: doc.id, ...doc.data() }));

    // Determine nextPageToken
    let nextPageToken = null;
    if (contacts.length === pageSize) {
      nextPageToken = querySnapshot.docs[contacts.length - 1].id;
    }

    res.json({
      contacts,
      limit: pageSize,
      nextPageToken
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update contact status
router.patch('/:id/status', authenticate, checkPermission('contact:read'), async (req, res) => {
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

export default router;
