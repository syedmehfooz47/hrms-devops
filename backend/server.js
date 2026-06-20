const express = require("express");
const cors = require("cors");
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
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.json());

// Home Route
app.get("/", (req, res) => {
  res.send("HRMS Backend Running");
});

// API Routes
app.use("/api/employees", employeeRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/leave", leaveRoutes);
app.use("/api/payroll", payrollRoutes);
app.use("/api/recruitment", recruitmentRoutes);
app.use("/api/performance", performanceRoutes);
app.use("/api/documents", documentsRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/auth", authRoutes);
const PORT = 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});