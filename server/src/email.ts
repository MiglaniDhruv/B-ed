import dotenv from "dotenv";
dotenv.config();

import nodemailer from "nodemailer";

const SMTP_EMAIL = process.env.SMTP_EMAIL;
const SMTP_PASSWORD = process.env.SMTP_PASSWORD;
const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587", 10);

function getTransporter() {
  if (!SMTP_EMAIL || !SMTP_PASSWORD) {
    return null;
  }
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_EMAIL,
      pass: SMTP_PASSWORD,
    },
  });
}

export async function sendPasswordResetEmail(toEmail: string, resetLink: string): Promise<boolean> {
  const transporter = getTransporter();
  if (!transporter) {
    console.error("SMTP not configured. Set SMTP_EMAIL and SMTP_PASSWORD.");
    return false;
  }

  try {
    await transporter.sendMail({
      from: `"B.Ed Portal" <${SMTP_EMAIL}>`,
      to: toEmail,
      subject: "Password Reset - B.Ed Admin Portal",
      html: `
        <div style="font-family: 'Segoe UI', system-ui, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 0;">
          <div style="background: linear-gradient(135deg, #3B82F6, #9333EA); padding: 32px; border-radius: 16px 16px 0 0; text-align: center;">
            <h1 style="color: #fff; margin: 0; font-size: 24px;">B.Ed Admin Portal</h1>
          </div>
          <div style="background: #ffffff; padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 16px 16px;">
            <h2 style="color: #1e293b; margin-top: 0;">Password Reset Request</h2>
            <p style="color: #475569; line-height: 1.6;">
              We received a request to reset your password. Click the button below to set a new password.
            </p>
            <div style="text-align: center; margin: 28px 0;">
              <a href="${resetLink}" style="display: inline-block; background: linear-gradient(135deg, #3B82F6, #9333EA); color: #fff; text-decoration: none; padding: 14px 36px; border-radius: 10px; font-weight: 600; font-size: 16px;">
                Reset Password
              </a>
            </div>
            <p style="color: #94a3b8; font-size: 13px; line-height: 1.5;">
              This link will expire in 1 hour. If you didn't request this, you can safely ignore this email.
            </p>
          </div>
        </div>
      `,
    });
    console.log("✅ Email sent successfully to:", toEmail);
    return true;
  } catch (err) {
    console.error("❌ Failed to send reset email:", err);
    return false;
  }
}