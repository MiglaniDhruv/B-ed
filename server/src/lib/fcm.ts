// server/lib/fcm.ts
// Sends Firebase Cloud Messaging push notifications to student devices.
// Uses the Firebase Admin SDK which is already initialised in firebase.ts.

import { getFirestore } from "../firebase.js";

// We re-use the Firebase Admin app already created in firebase.ts
// by importing admin lazily to avoid circular deps.
let _messaging: any = null;

function getMessaging() {
  if (_messaging) return _messaging;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const admin = require("firebase-admin");
    _messaging = admin.messaging();
  } catch (e) {
    console.warn("FCM: firebase-admin not available or not initialised yet.", e);
  }
  return _messaging;
}

// ─── Store / remove FCM tokens ────────────────────────────────────────────────
export async function saveFcmToken(studentId: string, token: string): Promise<void> {
  const db = getFirestore();
  // Upsert: one document per (studentId, token) pair
  const existing = await db
    .collection("fcmTokens")
    .where("studentId", "==", studentId)
    .where("token", "==", token)
    .limit(1)
    .get();
  if (existing.empty) {
    await db.collection("fcmTokens").add({
      studentId,
      token,
      createdAt: new Date(),
    });
  }
}

export async function removeFcmToken(token: string): Promise<void> {
  const db = getFirestore();
  const snap = await db.collection("fcmTokens").where("token", "==", token).get();
  const batch = db.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  if (!snap.empty) await batch.commit();
}

// ─── Get all tokens for a list of student IDs ─────────────────────────────────
async function getTokensForStudents(studentIds: string[]): Promise<string[]> {
  if (studentIds.length === 0) return [];
  const db = getFirestore();
  const tokens: string[] = [];
  // Firestore "in" query max 30 items
  for (let i = 0; i < studentIds.length; i += 30) {
    const snap = await db
      .collection("fcmTokens")
      .where("studentId", "in", studentIds.slice(i, i + 30))
      .get();
    snap.docs.forEach((d) => tokens.push(d.data().token as string));
  }
  return [...new Set(tokens)]; // deduplicate
}

// ─── Get ALL registered tokens (broadcast to every student) ──────────────────
async function getAllTokens(): Promise<string[]> {
  const db = getFirestore();
  const snap = await db.collection("fcmTokens").get();
  return [...new Set(snap.docs.map((d) => d.data().token as string))];
}

// ─── Send push to specific students ──────────────────────────────────────────
export async function sendPushToStudents(
  studentIds: string[],
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<void> {
  const messaging = getMessaging();
  if (!messaging) return;
  const tokens = await getTokensForStudents(studentIds);
  if (tokens.length === 0) return;
  await sendToTokens(messaging, tokens, title, body, data);
}

// ─── Broadcast push to ALL students ──────────────────────────────────────────
export async function broadcastPush(
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<void> {
  const messaging = getMessaging();
  if (!messaging) return;
  const tokens = await getAllTokens();
  if (tokens.length === 0) return;
  await sendToTokens(messaging, tokens, title, body, data);
}

// ─── Internal: batch send to token list ──────────────────────────────────────
async function sendToTokens(
  messaging: any,
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<void> {
  // FCM sendEachForMulticast supports max 500 tokens per call
  for (let i = 0; i < tokens.length; i += 500) {
    const chunk = tokens.slice(i, i + 500);
    try {
      const result = await messaging.sendEachForMulticast({
        tokens: chunk,
        notification: { title, body },
        data: data ?? {},
        android: {
          priority: "high",
          notification: {
            sound: "default",
            channelId: "default",
          },
        },
        apns: {
          payload: {
            aps: {
              sound: "default",
              badge: 1,
            },
          },
        },
      });

      // Clean up invalid tokens
      const db = getFirestore();
      const batch = db.batch();
      let hasBad = false;
      result.responses.forEach(async (resp: any, idx: number) => {
        if (!resp.success) {
          const code = resp.error?.code;
          if (
            code === "messaging/registration-token-not-registered" ||
            code === "messaging/invalid-registration-token"
          ) {
            const bad = chunk[idx];
            const snap = await db.collection("fcmTokens").where("token", "==", bad).get();
            snap.docs.forEach((d) => batch.delete(d.ref));
            hasBad = true;
          }
        }
      });
      if (hasBad) await batch.commit();
    } catch (err) {
      console.error("FCM send error:", err);
    }
  }
}