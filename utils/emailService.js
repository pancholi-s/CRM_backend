import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: process.env.SMTP_PORT || 587,
  secure: false, // Port 587 uses STARTTLS, so secure=false
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false, // Helps with Gmail's TLS setup
  },
});

transporter.verify((error, success) => {
  if (error) {
    console.error("SMTP connection failed:", error);
  } else {
    console.log("SMTP connection ready");
  }
});

console.log("Loaded SMTP_USER:", process.env.SMTP_USER);
console.log("Loaded SMTP_PASS:", process.env.SMTP_PASS ? "****" : "MISSING!");

export const sendPasswordResetEmail = async (to, name, resetLink) => {
  const mailOptions = {
    from: `"Hospital CRM Team" <${process.env.SMTP_USER}>`,
    to,
    subject: "Password Reset Request - Hospital CRM",
    html: `
            <h2>Password Reset Request</h2>
            <p>Hi ${name},</p>
            <p>We received a request to reset your password for your Hospital CRM account.</p>
            <p>Click the button below to reset your password. This link will expire in 15 minutes.</p>
            <a href="${resetLink}" style="
                display: inline-block;
                padding: 10px 20px;
                background-color: #007bff;
                color: white;
                text-decoration: none;
                border-radius: 5px;
                font-weight: bold;
            ">Reset Password</a>
            <p>If the button does not work, please copy and paste this link into your browser:</p>
            <p><a href="${resetLink}" style="word-break: break-all;">${resetLink}</a></p>
            <p style="color: red; font-weight: bold;">
                ⚠️ Important: Do not share this link with anyone, not even with hospital staff.
            </p>
            <p>If you did not request this, please ignore this email.</p>
            <p>Thank you,</p>
            <p>Hospital CRM Team</p>
        `,
  };

  try {
    const result = await transporter.sendMail(mailOptions);
    console.log(`Reset email sent to ${to}`);
    return result;
  } catch (err) {
    console.error(`Failed to send email to ${to}:`, err);
    throw new Error("Email sending failed");
  }
};