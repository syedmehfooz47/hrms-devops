require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const authRoutes = require("./routes/auth");
const employeeRoutes = require("./routes/employees");
const departmentRoutes = require("./routes/departments");
const attendanceRoutes = require("./routes/attendance");
const leaveRoutes = require("./routes/leave");
const payrollRoutes = require("./routes/payroll");
const recruitmentRoutes = require("./routes/recruitment");
const performanceRoutes = require("./routes/performance");
const documentsRoutes = require("./routes/documents");
const dashboardRoutes = require("./routes/dashboard");
const notificationRoutes = require("./routes/notifications");
const userRoutes = require("./routes/users");
const chatRoutes = require("./routes/chat");
const aiRoutes = require("./routes/ai");

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Secure file uploads — require valid JWT token to access uploaded files
const jwt = require("jsonwebtoken");
app.use("/uploads", (req, res, next) => {
  const authHeader = req.headers.authorization;
  const tokenFromQuery = req.query.token; // fallback for download links
  const token = authHeader ? authHeader.split(" ")[1] : tokenFromQuery;
  if (!token) {
    return res.status(401).json({ message: "Authentication required to access files" });
  }
  try {
    const SECRET = process.env.JWT_SECRET || "hrms_secret_key_2024_pulse";
    jwt.verify(token, SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}, express.static(path.join(__dirname, "uploads")));

// Home Route
app.get("/", (req, res) => {
  res.json({ message: "Pulse HRMS Backend Running", version: "2.0" });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/leave", leaveRoutes);
app.use("/api/payroll", payrollRoutes);
app.use("/api/recruitment", recruitmentRoutes);
app.use("/api/performance", performanceRoutes);
app.use("/api/documents", documentsRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/users", userRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/ai", aiRoutes);

// Centralized error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Pulse HRMS Backend running on port ${PORT}`);
  });
}

module.exports = app;