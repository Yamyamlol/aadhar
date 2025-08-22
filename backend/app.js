import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import twilio from "twilio";
import User from "./models/userSchema.js";

dotenv.config();

const allowedOrigins = process.env.ALLOWED_ORIGINS.split(",");

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const verifySid = process.env.TWILIO_VERIFY_SID;
const client = twilio(accountSid, authToken);

const app = express();

// CORS setup
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URL)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.log("❌ MongoDB error:", err));

let mobileCache = "";

// Test endpoint
app.get("/test", (req, res) => {
  console.log("api hit");
  res.json({ message: "Server is working!", timestamp: new Date() });
});

// Send OTP
app.post("/send-otp", async (req, res) => {
  console.log("📨 Send OTP request received:", req.body);
  console.log("📨 Request origin:", req.get("Origin"));

  const { aadhaar } = req.body;

  if (!aadhaar) {
    return res
      .status(400)
      .json({ success: false, message: "Aadhaar number is required" });
  }

  try {
    const user = await User.findOne({ aadhaar });
    console.log("🔍 User search result:", user ? "Found" : "Not found");

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found in database" });
    }

    mobileCache = user.mobile.startsWith("+91")
      ? user.mobile
      : `+91${user.mobile}`;
    console.log("📱 Sending OTP to:", mobileCache);

    await client.verify.v2.services(verifySid).verifications.create({
      to: mobileCache,
      channel: "sms",
    });

    console.log("✅ OTP sent successfully");
    res.json({
      success: true,
      message: "OTP sent successfully",
      mobile: mobileCache,
    });
  } catch (err) {
    console.error("❌ Send OTP error:", err);
    res
      .status(500)
      .json({ success: false, message: "Server error: " + err.message });
  }
});

// Verify OTP
app.post("/verify-otp", async (req, res) => {
  console.log("🔐 Verify OTP request received:", req.body);
  console.log("🔐 Request origin:", req.get("Origin"));

  const { otp } = req.body;

  if (!otp) {
    return res.status(400).json({ success: false, message: "OTP is required" });
  }

  if (!mobileCache) {
    return res
      .status(400)
      .json({ success: false, message: "Please send OTP first" });
  }

  try {
    const verification_check = await client.verify.v2
      .services(verifySid)
      .verificationChecks.create({
        to: mobileCache,
        code: otp,
      });

    console.log("🔍 Verification result:", verification_check.status);

    if (verification_check.status === "approved") {
      res.json({
        success: true,
        message: "OTP verified successfully",
        mobile: mobileCache,
      });
    } else {
      res.status(400).json({ success: false, message: "Invalid OTP" });
    }
  } catch (err) {
    console.error("❌ Verify OTP error:", err);
    res
      .status(500)
      .json({ success: false, message: "Server error: " + err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🧪 Test endpoint: http://localhost:${PORT}/test`);
  console.log("🔧 Allowed origins:", allowedOrigins);
});
