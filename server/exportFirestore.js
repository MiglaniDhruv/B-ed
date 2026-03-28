import admin from "firebase-admin";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

// 🔹 Firebase service account from .env
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 🔹 Collections list
const collections = [
  "categories",
  "fcmTokens",
  "globalNotifications",
  "notices",
  "passwordResetTokens",
  "questions",
  "quizAttempts",
  "quizQuestions",
  "quizzes",
  "semesters",
  "students",
  "studyMaterials",
  "subjects",
  "units",
  "users"
];

// 🔹 Create backup folder if not exists
if (!fs.existsSync("./backup")) {
  fs.mkdirSync("./backup");
}

// 🔹 Export function
async function exportData() {
  try {

    for (const col of collections) {

      console.log(`Exporting ${col}...`);

      const snapshot = await db.collection(col).get();

      const data = snapshot.docs.map(doc => ({
        _id: doc.id,
        ...doc.data()
      }));

      fs.writeFileSync(
        `./backup/${col}.json`,
        JSON.stringify(data, null, 2)
      );

      console.log(`✅ ${col} exported (${data.length} documents)`);

    }

    console.log("🎉 All collections exported successfully");

  } catch (error) {

    console.error("❌ Export failed:", error);

  }
}

// 🔹 Run export
exportData();