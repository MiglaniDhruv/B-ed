import admin from "firebase-admin";

let initialized = false;

export function initFirebase() {
  if (initialized) return;

  // Get service account from ENV
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (!serviceAccountJson) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT is not set in environment variables"
    );
  }

  let serviceAccount: any;

  try {
    serviceAccount = JSON.parse(serviceAccountJson);
  } catch (err) {
    console.error("Invalid FIREBASE_SERVICE_ACCOUNT JSON");
    throw err;
  }

  const storageBucket =
    process.env.FIREBASE_STORAGE_BUCKET ||
    `${serviceAccount.project_id}.firebasestorage.app`;

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket,
  });

  initialized = true;

  console.log("Firebase initialized with project:", serviceAccount.project_id);
  console.log("Storage bucket:", storageBucket);
}

export function getFirestore() {
  return admin.firestore();
}

export function getStorage() {
  return admin.storage().bucket();
}