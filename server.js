const express = require("express");
const cors = require("cors");
const path = require("path");
const apiRoutes = require("./backend/routes/apiRoutes");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Create required directories if they don't exist
const dirs = ["uploads", "outputs"];
dirs.forEach((dir) => {
  const dirPath = path.join(__dirname, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath);
  }
});

// Routes
app.use("/api", apiRoutes);

// Error Handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res
    .status(500)
    .json({ error: "Something went wrong!", details: err.message });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
