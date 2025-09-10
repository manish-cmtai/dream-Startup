import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

let adminDb, adminStorage;

try {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is missing');
  }

  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  
  // Fix escaped newlines in private key
  if (serviceAccount && serviceAccount.private_key && serviceAccount.private_key.includes('\\n')) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  }
  
  // Validate service account
  console.log('🔑 Service Account Info:');
  console.log('- Project ID from SA:', serviceAccount.project_id);
  console.log('- Client Email:', serviceAccount.client_email);

  // Initialize Firebase Admin (check if already initialized)
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id, // Explicitly set project ID
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET
    });
    console.log('✅ Firebase Admin initialized');
  }

  // Initialize Admin services
  adminDb = admin.firestore();
  adminStorage = admin.storage();
  
  console.log('✅ Admin Firestore initialized');
  console.log('✅ Admin Storage initialized');

} catch (error) {
  console.error('❌ Firebase Admin initialization error:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}

export { admin, adminDb, adminStorage };
