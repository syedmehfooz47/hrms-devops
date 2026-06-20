const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const auth = require("../middleware/auth");

// Protected Dashboard Route
router.get("/", auth, async (req, res) => {
  try {
    const employees = await pool.query(
      "SELECT COUNT(*) FROM employees"
    );

    const departments = await pool.query(
      "SELECT COUNT(*) FROM departments"
    );

    const attendance = await pool.query(
      "SELECT COUNT(*) FROM attendance"
    );

    const leaveRequests = await pool.query(
      "SELECT COUNT(*) FROM leave_requests"
    );

    const payroll = await pool.query(
      "SELECT COUNT(*) FROM payroll"
    );

    const recruitment = await pool.query(
      "SELECT COUNT(*) FROM recruitment"
    );

    const performance = await pool.query(
      "SELECT COUNT(*) FROM performance_reviews"
    );

    const documents = await pool.query(
      "SELECT COUNT(*) FROM documents"
    );

    res.status(200).json({
      success: true,
      user: req.user,

      dashboard: {
        employees: parseInt(employees.rows[0].count),
        departments: parseInt(departments.rows[0].count),
        attendance: parseInt(attendance.rows[0].count),
        leaveRequests: parseInt(leaveRequests.rows[0].count),
        payrollRecords: parseInt(payroll.rows[0].count),
        recruitmentRecords: parseInt(recruitment.rows[0].count),
        performanceReviews: parseInt(performance.rows[0].count),
        documents: parseInt(documents.rows[0].count)
      }
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;