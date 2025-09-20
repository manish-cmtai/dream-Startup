import { adminDb } from "../config/db.js";
import Service from "../models/serviceModel.js";

export const getServices = async (req, res) => {
  try {
    const {
      category,
      tags,
      search,
      limit: limitParam = 10,
      page = 1,
    } = req.query;
    const limit = parseInt(limitParam);
    const currentPage = parseInt(page);

    let queryRef = adminDb.collection("services");

    // Build constraints array for Firebase queries
    if (category) {
      queryRef = queryRef.where("category", "==", category);
    }
    if (tags) {
      const tagArray = tags.split(",");
      queryRef = queryRef.where("tags", "array-contains-any", tagArray);
    }

    let results = [];
    const snapshot = await queryRef.orderBy("timestamp", "desc").get();

    snapshot.forEach((doc) => {
      const data = { id: doc.id, ...doc.data() };

      // Apply search filter if provided
      if (search) {
        const searchLower = search.toLowerCase();
        const matchesName = data.name?.toLowerCase().includes(searchLower);
        const matchesDescription = data.shortDescription
          ?.toLowerCase()
          .includes(searchLower);
        const matchesCategory = data.category
          ?.toLowerCase()
          .includes(searchLower);

        if (matchesName || matchesDescription || matchesCategory) {
          results.push(data);
        }
      } else {
        results.push(data);
      }
    });

    // Determine if there is a next page
    const totalCount = results.length;
    const offset = (currentPage - 1) * limit;
    const paginatedResults = results.slice(offset, offset + limit);

    res.json({
      services: paginatedResults,
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
};

export const getServicesById = async (req, res) => {
  try {
    const docSnap = await adminDb
      .collection("services")
      .doc(req.params.id)
      .get();
    if (!docSnap.exists) {
      return res.status(404).json({ error: "Service not found" });
    }
    res.json({ id: docSnap.id, ...docSnap.data() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const addService = async (req, res) => {
  try {
    const service = new Service(req.body);
    service.validate();

    const docRef = await adminDb
      .collection("services")
      .add({ ...service, createdBy: req.user.email, timestamp: new Date() });
    res
      .status(201)
      .json({ id: docRef.id, message: "Service created successfully" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
export const updateService = async (req, res) => {
  try {
    const service = new Service(req.body);
    service.validate();

    await adminDb
      .collection("services")
      .doc(req.params.id)
      .update({ ...service, updatedBy: req.user.email, updatedAt: new Date() });

    res.json({ message: "Service updated successfully" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
export const deleteSrevice = async (req, res) => {
  try {
    await adminDb.collection("services").doc(req.params.id).delete();
    res.json({ message: "Service deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
