import bcrypt from "bcryptjs";
import { UserModel } from "./model/model.js";

export async function seedDatabase() {
  
  const existing = await UserModel.findOne({ email: "dhruv.06.2001@gmail.com" }).lean();
  if (existing) {
    console.log("✅ Database already seeded, skipping...");
    return;
  }

  const adminPassword = await bcrypt.hash("dhruv2003", 12);

  await UserModel.create({
    username: "admin",
    email: "dhruv.06.2001@gmail.com",
    password: adminPassword,
    displayName: "Admin",
    darkMode: false,
  });

  console.log("✅ Database seeded successfully!");
  console.log("📧 Admin login: admin@bed.com");
  console.log("🔑 Admin password: admin123");
  console.log("⚠️ first login after password changes");
}