import express from 'express';
import { adminDb } from '../config/db.js';
import Blog from '../models/blogModel.js';
import { checkPermission, authenticate } from '../middleware/roleBaseAccess.js';

const router = express.Router();

// Get published blogs (public)
router.get('/', async (req, res) => {
  try {
    const { 
      category, 
      tags, 
      author, 
      search, 
      limit: limitParam = 10, 
      page = 1 
    } = req.query;
    
    const limit = parseInt(limitParam);
    const currentPage = parseInt(page);

    let queryRef = adminDb.collection('blogs');

    // Build constraints for Firebase queries
    if (category) {
      queryRef = queryRef.where('category', '==', category);
    }

    if (author) {
      queryRef = queryRef.where('author', '==', author);
    }

    if (tags) {
      const tagArray = tags.split(',');
      queryRef = queryRef.where('tags', 'array-contains-any', tagArray);
    }

    let results = [];
    const snapshot = await queryRef.orderBy('timestamp', 'desc').get();
    
    snapshot.forEach((doc) => {
      const data = { id: doc.id, ...doc.data() };
      
      // Only show published blogs for public access
      if (!data.isPublished) return;

      // Apply search filter if provided
      if (search) {
        const searchLower = search.toLowerCase();
        const matchesTitle = data.title?.toLowerCase().includes(searchLower);
        const matchesContent = data.content?.toLowerCase().includes(searchLower);
        const matchesAuthor = data.author?.toLowerCase().includes(searchLower);
        const matchesCategory = data.category?.toLowerCase().includes(searchLower);
        
        if (matchesTitle || matchesContent || matchesAuthor || matchesCategory) {
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
      blogs: paginatedResults,
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

// Get all blogs (admin only - includes unpublished)
router.get('/admin', authenticate, checkPermission('blog:read'), async (req, res) => {
  try {
    const { 
      category, 
      tags, 
      author, 
      search, 
      isPublished,
      limit: limitParam = 10, 
      page = 1 
    } = req.query;
    
    const limit = parseInt(limitParam);
    const currentPage = parseInt(page);

    let queryRef = adminDb.collection('blogs');

    // Build constraints for Firebase queries
    if (category) {
      queryRef = queryRef.where('category', '==', category);
    }

    if (author) {
      queryRef = queryRef.where('author', '==', author);
    }

    if (tags) {
      const tagArray = tags.split(',');
      queryRef = queryRef.where('tags', 'array-contains-any', tagArray);
    }

    if (isPublished !== undefined) {
      queryRef = queryRef.where('isPublished', '==', isPublished === 'true');
    }

    let results = [];
    const snapshot = await queryRef.orderBy('timestamp', 'desc').get();
    
    snapshot.forEach((doc) => {
      const data = { id: doc.id, ...doc.data() };

      // Apply search filter if provided
      if (search) {
        const searchLower = search.toLowerCase();
        const matchesTitle = data.title?.toLowerCase().includes(searchLower);
        const matchesContent = data.content?.toLowerCase().includes(searchLower);
        const matchesAuthor = data.author?.toLowerCase().includes(searchLower);
        const matchesCategory = data.category?.toLowerCase().includes(searchLower);
        
        if (matchesTitle || matchesContent || matchesAuthor || matchesCategory) {
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
      blogs: paginatedResults,
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

// Get single blog post (public)
router.get('/:id', async (req, res) => {
  try {
    const docSnap = await adminDb.collection('blogs').doc(req.params.id).get();
    
    if (!docSnap.exists) {
      return res.status(404).json({ error: 'Blog post not found' });
    }

    const blogData = docSnap.data();
    
    // For public access, only show published blogs
    if (!blogData.isPublished) {
      return res.status(404).json({ error: 'Blog post not found' });
    }

    res.json({ id: docSnap.id, ...blogData });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single blog post for admin (includes unpublished)
router.get('/admin/:id', authenticate, checkPermission('blog:read'), async (req, res) => {
  try {
    const docSnap = await adminDb.collection('blogs').doc(req.params.id).get();
    
    if (!docSnap.exists) {
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

    const docRef = await adminDb.collection('blogs').add({ 
      ...blog, 
      createdBy: req.user.email,
      createdByEmail: req.user.email, 
      timestamp: new Date() 
    });

    res.status(201).json({ 
      id: docRef.id, 
      message: 'Blog post created successfully' 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update blog post
router.put('/:id', authenticate, checkPermission('blog:update'), async (req, res) => {
  try {
    // Check if blog exists
    const existingDoc = await adminDb.collection('blogs').doc(req.params.id).get();
    if (!existingDoc.exists) {
      return res.status(404).json({ error: 'Blog post not found' });
    }

    const blog = new Blog(req.body);
    blog.validate();

    await adminDb.collection('blogs').doc(req.params.id).update({ 
      ...blog, 
      updatedBy: req.user.email,
      updatedByEmail: req.user.email, 
      updatedAt: new Date() 
    });

    res.json({ message: 'Blog post updated successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Toggle publish status
router.patch('/:id/publish', authenticate, checkPermission('blog:update'), async (req, res) => {
  try {
    const { isPublished } = req.body;
    
    if (typeof isPublished !== 'boolean') {
      return res.status(400).json({ error: 'isPublished must be a boolean' });
    }

    await adminDb.collection('blogs').doc(req.params.id).update({
      isPublished,
      updatedBy: req.user.email,
      updatedAt: new Date(),
      ...(isPublished && { publishedAt: new Date() })
    });

    res.json({ 
      message: `Blog post ${isPublished ? 'published' : 'unpublished'} successfully` 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete blog post
router.delete('/:id', authenticate, checkPermission('blog:delete'), async (req, res) => {
  try {
    // Check if blog exists
    const existingDoc = await adminDb.collection('blogs').doc(req.params.id).get();
    if (!existingDoc.exists) {
      return res.status(404).json({ error: 'Blog post not found' });
    }

    await adminDb.collection('blogs').doc(req.params.id).delete();
    res.json({ message: 'Blog post deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
