import { adminDb } from '../config/db.js';
import Service from '../models/serviceModel.js';

export const getServices= async (req, res) => {
  try {
    const { category, tags, limit: limitParam = 10, page = 1 } = req.query;
  const servicesRef = adminDb.collection('services');
  let queryRef = servicesRef;

    // Build query constraints
    const constraints = [];
    
    if (category) {
      constraints.push(where('category', '==', category));
    }

    if (tags) {
      const tagArray = tags.split(',');
      constraints.push(where('tags', 'array-contains-any', tagArray));
    }

    constraints.push(orderBy('timestamp', 'desc'));
    constraints.push(limit(parseInt(limitParam)));

  // Apply ordering and limit
  queryRef = queryRef.orderBy('timestamp', 'desc').limit(parseInt(limitParam));
  const querySnapshot = await queryRef.get();
  const services = [];
  querySnapshot.forEach((d) => services.push({ id: d.id, ...d.data() }));

    res.json({ 
      services, 
      page: parseInt(page), 
      limit: parseInt(limitParam),
      total: services.length 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
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

  const docRef = await adminDb.collection('services').add({ ...service, createdBy: req.user.uid, timestamp: new Date() });
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