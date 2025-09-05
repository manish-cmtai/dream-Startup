import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config(); // Load environment variables

// Your web app's Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase once
const app = initializeApp(firebaseConfig);

// Initialize Firestore
const db = getFirestore(app);

// Firebase Admin SDK - Parse service account from environment variable
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

// Some deployment environments escape newlines in the private key. Ensure real newlines.
if (serviceAccount && serviceAccount.private_key && serviceAccount.private_key.includes('\\n')) {
  serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
}

// Initialize Firebase Admin (check if already initialized)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET // Using the storage bucket from environment variables
  });
}

// Initialize Admin Storage
const adminStorage = admin.storage();

// Initialize Admin Firestore (server-side)
const adminDb = admin.firestore();

export { app, db, adminStorage, adminDb };
