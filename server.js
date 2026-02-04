const express = require("express");
const cors = require("cors");
const path = require("path");
const apiRoutes = require("./backend/routes/apiRoutes");
const fs = require("fs");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, "public")));

// IMPORTANT: Use /tmp for serverless file storage
const dirs = ["/tmp/uploads", "/tmp/outputs"];

dirs.forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// API Routes
app.use("/api", apiRoutes);

// Health check route (important for debugging Vercel)
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", server: "running" });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("ERROR:", err);
  res.status(500).json({
    error: "Internal Server Error",
    message: err.message || "Something went wrong"
  });
});

// ❌ DO NOT USE app.listen() ON VERCEL
// Instead export the app as a serverless handler

module.exports = app;
