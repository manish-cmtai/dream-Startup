import { adminDb } from '../config/db.js';
import Service from '../models/serviceModel.js';

export const getServices = async (req, res) => {
  try {
    const { category, tags, limit: limitParam = 10, page = 1 } = req.query;
    const limit = parseInt(limitParam);
    const currentPage = parseInt(page);

    let queryRef = adminDb.collection('services');

    // Build constraints array for Firebase queries
    if (category) {
      queryRef = queryRef.where('category', '==', category);
    }
    if (tags) {
      const tagArray = tags.split(',');
      queryRef = queryRef.where('tags', 'array-contains-any', tagArray);
    }

    // Get total count for pagination meta
    const totalSnapshot = await queryRef.get();
    const totalCount = totalSnapshot.size;

    // Apply ordering and limit
    queryRef = queryRef.orderBy('timestamp', 'desc');

    // Firestore does NOT support offset(), so we manually calculate offset
    // WARNING: Offset makes queries less performant on large data sets
    const offset = (currentPage - 1) * limit;

    let results = [];

    if (offset > 0) {
      // Fetch cursor document for startAfter
      const offsetQuery = queryRef.limit(offset);
      const offsetSnapshot = await offsetQuery.get();
      if (!offsetSnapshot.empty) {
        const lastDoc = offsetSnapshot.docs[offsetSnapshot.docs.length - 1];
        queryRef = queryRef.startAfter(lastDoc);
      }
    }

    queryRef = queryRef.limit(limit);

    const snapshot = await queryRef.get();
    snapshot.forEach(doc => {
      results.push({ id: doc.id, ...doc.data() });
    });

    // Determine if there is a next page
    const hasNextPage = (currentPage * limit) < totalCount;

    res.json({
      services: results,
      page: currentPage,
      limit,
      totalCount,
      hasNextPage
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getServicesById= async (req, res) => {
  try {
    const docSnap = await adminDb.collection('services').doc(req.params.id).get();
    if (!docSnap.exists) {
      return res.status(404).json({ error: 'Service not found' });
    }
    res.json({ id: docSnap.id, ...docSnap.data() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export const addService=async (req, res) => {
  try {
    const service = new Service(req.body);
    service.validate();

  const docRef = await adminDb.collection('services').add({ ...service, createdBy: req.user.email, timestamp: new Date() });
  res.status(201).json({ id: docRef.id, message: 'Service created successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}
export const updateService=async (req, res) => {
  try {
    const service = new Service(req.body);
    service.validate();

  await adminDb.collection('services').doc(req.params.id).update({ ...service, updatedBy: req.user.uid, updatedAt: new Date() });

    res.json({ message: 'Service updated successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}
export const deleteSrevice=async (req, res) => {
  try {
  await adminDb.collection('services').doc(req.params.id).delete();
    res.json({ message: 'Service deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}