// server/lib/fcm.ts
// Sends Firebase Cloud Messaging push notifications to student devices.
// Uses the Firebase Admin SDK which is already initialised in firebase.ts.

import admin from "firebase-admin";
import { getFirestore } from "../firebase.js";

// ✅ FIXED: directly use admin.messaging() instead of require("firebase-admin")
// The old getMessaging() used require() which fails in ESM projects and
// returned null silently — causing all notifications to be dropped.
function getMessaging() {
  try {
    return admin.messaging();
  } catch (e) {
    console.warn("FCM: admin.messaging() not available. Is Firebase initialized?", e);
    return null;
  }
}

// ─── Store / remove FCM tokens ────────────────────────────────────────────────
export async function saveFcmToken(studentId: string, token: string): Promise<void> {
  const db = getFirestore();
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
  for (let i = 0; i < studentIds.length; i += 30) {
    const snap = await db
      .collection("fcmTokens")
      .where("studentId", "in", studentIds.slice(i, i + 30))
      .get();
    snap.docs.forEach((d) => tokens.push(d.data().token as string));
  }
  return [...new Set(tokens)];
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
  if (tokens.length === 0) {
    console.warn("FCM: broadcastPush called but no tokens found in Firestore.");
    return;
  }
  console.log(`FCM: broadcasting to ${tokens.length} token(s)...`);
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
  for (let i = 0; i < tokens.length; i += 500) {
    const chunk = tokens.slice(i, i + 500);
    try {
      const result = await messaging.sendEachForMulticast({
        tokens: chunk,

        // ✅ "notification" block tells Android OS to show a system tray
        // notification even when the app is killed.
        notification: {
          title,
          body,
        },

        // ✅ All data values MUST be strings for FCM data payloads.
        data: {
          ...(data
            ? Object.fromEntries(
                Object.entries(data).map(([k, v]) => [k, String(v)])
              )
            : {}),
          title,
          body,
        },

        android: {
          priority: "high",
          notification: {
            channelId: "default",
            sound: "default",
            defaultVibrateTimings: true,
            notificationPriority: "PRIORITY_MAX",
            visibility: "PUBLIC",
          },
        },

        apns: {
          headers: {
            "apns-priority": "10",
          },
          payload: {
            aps: {
              sound: "default",
              badge: 1,
              "content-available": 1,
            },
          },
        },
      });

      // ─── Clean up stale / invalid tokens ──────────────────────────────
      const db = getFirestore();
      const badTokens: string[] = [];

      result.responses.forEach((resp: any, idx: number) => {
        if (!resp.success) {
          const code = resp.error?.code;
          console.warn(`FCM: token[${idx}] failed — ${code}: ${resp.error?.message}`);
          if (
            code === "messaging/registration-token-not-registered" ||
            code === "messaging/invalid-registration-token"
          ) {
            badTokens.push(chunk[idx]);
          }
        }
      });

      if (badTokens.length > 0) {
        await Promise.all(
          badTokens.map(async (bad) => {
            const snap = await db.collection("fcmTokens").where("token", "==", bad).get();
            if (!snap.empty) {
              const batch = db.batch();
              snap.docs.forEach((d) => batch.delete(d.ref));
              await batch.commit();
            }
          }),
        );
        console.log(`FCM: removed ${badTokens.length} invalid token(s)`);
      }

      console.log(
        `FCM: chunk [${i}–${i + chunk.length}] — ` +
        `${result.successCount} ok, ${result.failureCount} failed`,
      );
    } catch (err) {
      console.error("FCM send error:", err);
    }
  }
}