import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import User from "./models/userSchema.js";
import twilio from "twilio";
import dotenv from "dotenv";
dotenv.config(); // <- Load .env first

const allowedOrigins = process.env.allowedOrigins
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const verifySid = process.env.TWILIO_VERIFY_SID;
const client = twilio(accountSid, authToken);

const app = express();

app.use(cors());
// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB connection
const MONGO_URL = process.env.MONGO_URL;

mongoose
  .connect(MONGO_URL)
  .then(() => console.log("✅ Connected to MongoDB Atlas"))
  .catch((err) => console.log("❌ MongoDB error:", err));

let mobileCache = "";

// Test endpoint to verify server is working
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
    return res.status(400).json({
      success: false,
      message: "Aadhaar number is required",
    });
  }

  try {
    const user = await User.findOne({ aadhaar });
    console.log("🔍 User search result:", user ? "Found" : "Not found");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found in database",
      });
    }

    mobileCache = user.mobile.startsWith("+91")
      ? user.mobile
      : `+91${user.mobile}`;
    console.log("📱 Sending OTP to:", mobileCache);

    await client.verify.v2
      .services(verifySid)
      .verifications.create({ to: mobileCache, channel: "sms" });

    console.log("✅ OTP sent successfully");

    res.json({
      success: true,
      message: "OTP sent successfully",
      mobile: mobileCache,
    });
  } catch (err) {
    console.error("❌ Send OTP error:", err);
    res.status(500).json({
      success: false,
      message: "Server error: " + err.message,
    });
  }
});

// Verify OTP
app.post("/verify-otp", async (req, res) => {
  console.log("🔐 Verify OTP request received:", req.body);
  console.log("🔐 Request origin:", req.get("Origin"));

  const { otp } = req.body;

  if (!otp) {
    return res.status(400).json({
      success: false,
      message: "OTP is required",
    });
  }

  if (!mobileCache) {
    return res.status(400).json({
      success: false,
      message: "Please send OTP first",
    });
  }

  try {
    const verification_check = await client.verify.v2
      .services(verifySid)
      .verificationChecks.create({ to: mobileCache, code: otp });

    console.log("🔍 Verification result:", verification_check.status);

    if (verification_check.status === "approved") {
      res.json({
        success: true,
        message: "OTP verified successfully",
        mobile: mobileCache,
      });
    } else {
      res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }
  } catch (err) {
    console.error("❌ Verify OTP error:", err);
    res.status(500).json({
      success: false,
      message: "Server error: " + err.message,
    });
  }
});

app.listen(3000, () => {
  console.log("🚀 Server running on http://localhost:5000");
  console.log("🧪 Test endpoint: http://localhost:5000/test");
  console.log("🔧 Allowed origins:", allowedOrigins);
});
