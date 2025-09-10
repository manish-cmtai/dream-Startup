import express from 'express';
import { adminDb } from '../config/db.js';
import Blog from '../models/blogModel.js';
import {  checkPermission, authenticate } from '../middleware/roleBaseAccess.js';

const router = express.Router();

// Get published blogs (public)
router.get('/', async (req, res) => {
  try {
    const { category, tags, author, limit: limitParam = 10, page = 1 } = req.query;
  const blogsRef = adminDb.collection('blogs');
  let queryRef = blogsRef.where('isPublished', '==', true);

    if (category) {
      constraints.push(where('category', '==', category));
    }

    if (author) {
      constraints.push(where('author', '==', author));
    }

    if (tags) {
      const tagArray = tags.split(',');
      constraints.push(where('tags', 'array-contains-any', tagArray));
    }

  // Apply ordering and limit
  queryRef = queryRef.orderBy('timestamp', 'desc').limit(parseInt(limitParam));
  const querySnapshot = await queryRef.get();
  const blogs = [];
  querySnapshot.forEach((d) => blogs.push({ id: d.id, ...d.data() }));

    res.json({ 
      blogs, 
      page: parseInt(page), 
      limit: parseInt(limitParam),
      total: blogs.length 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single blog post (public)
router.get('/:id', async (req, res) => {
  try {
    const docSnap = await adminDb.collection('blogs').doc(req.params.id).get();
    if (!docSnap.exists || !docSnap.data().isPublished) {
      return res.status(404).json({ error: 'Blog post not found' });
    }
    res.json({ id: docSnap.id, ...docSnap.data() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create blog post
router.post('/', authenticate, checkPermission('blog:create'), async (req, res) => {
  try {
    const blog = new Blog(req.body);
    blog.validate();

  const docRef = await adminDb.collection('blogs').add({ ...blog, createdBy: req.user.email, timestamp: new Date() });
  res.status(201).json({ id: docRef.id, message: 'Blog post created successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update blog post
router.put('/:id',authenticate, checkPermission('blog:update'), async (req, res) => {
  try {
    const blog = new Blog(req.body);
    blog.validate();

  await adminDb.collection('blogs').doc(req.params.id).update({ ...blog, updatedBy: req.user.email, updatedAt: new Date() });

    res.json({ message: 'Blog post updated successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete blog post
router.delete('/:id',authenticate, checkPermission('blog:delete'), async (req, res) => {
  try {
  await adminDb.collection('blogs').doc(req.params.id).delete();
    res.json({ message: 'Blog post deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
