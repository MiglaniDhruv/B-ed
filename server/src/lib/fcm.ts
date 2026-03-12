// lib/fcm.ts
// Firebase FCM (Push Notifications) - यह Firebase रहेगा


import admin from "firebase-admin";
import { storage } from "../storage.js";

export async function broadcastPush(
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<void> {
  try {
    // ✅ MongoDB से सभी FCM tokens लाओ
    const tokens = await storage.getAllFcmTokens();
    if (!tokens || tokens.length === 0) return;

    const messaging = admin.messaging();

    const batchSize = 500;
    for (let i = 0; i < tokens.length; i += batchSize) {
      const batch = tokens.slice(i, i + batchSize);
      try {
        const response = await messaging.sendEachForMulticast({
          tokens: batch,
          notification: { title, body },
          data: data
            ? Object.fromEntries(
                Object.entries(data).map(([k, v]) => [k, String(v)]),
              )
            : undefined,
          android: {
            priority: "high",
            notification: { sound: "default" },
          },
          apns: {
            payload: {
              aps: { sound: "default" },
            },
          },
        });

        const invalidTokens: string[] = [];
        response.responses.forEach((resp, idx) => {
          if (
            !resp.success &&
            (resp.error?.code === "messaging/invalid-registration-token" ||
              resp.error?.code ===
                "messaging/registration-token-not-registered")
          ) {
            invalidTokens.push(batch[idx]);
          }
        });

        if (invalidTokens.length > 0) {
          await Promise.all(
            invalidTokens.map((t) => storage.removeFcmToken(t)),
          );
          console.log(`🗑️ Removed ${invalidTokens.length} invalid FCM tokens`);
        }

        console.log(
          `📱 Push sent: ${response.successCount} success, ${response.failureCount} failed`,
        );
      } catch (err) {
        console.error("FCM batch error:", err);
      }
    }
  } catch (err) {
    console.error("broadcastPush error:", err);
  }
}

export async function saveFcmToken(
  userId: string,
  token: string,
): Promise<void> {
  await storage.saveFcmToken(userId, token);
}

export async function removeFcmToken(token: string): Promise<void> {
  await storage.removeFcmToken(token);
}
