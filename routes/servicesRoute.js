import express from 'express';

import { checkPermission, authenticate } from '../middleware/roleBaseAccess.js';
import { addService, deleteSrevice, getServices, getServicesById, updateService } from '../controllers/servicesContriller.js';

const router = express.Router();

// Get all services (public)
router.get('/', getServices);

// Get single service (public)
router.get('/:id',getServicesById);

// Create service (requires authentication and permission)
router.post('/', authenticate,checkPermission('services:create'), addService);

// Update service
router.put('/:id', authenticate, checkPermission('services:update'), updateService);

// Delete service
router.delete('/:id', authenticate, checkPermission('services:delete'), deleteSrevice);

export default router;
