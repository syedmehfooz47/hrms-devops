const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { authenticate } = require("../middleware/auth");

// Helper: Get today's date in IST (UTC+5:30) to avoid timezone issues around midnight
function getTodayIST() {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + istOffset);
  return istDate.toISOString().slice(0, 10);
}

// GET dashboard statistics
router.get("/", authenticate, async (req, res) => {
  try {
    const todayStr = getTodayIST();
    const isHrOrAdmin = req.user.role === "admin" || req.user.role === "hr_manager" || req.user.role === "dept_manager";

    let employees, active, departments, leaveRequests, attendance, payroll, recruitment, performance, documents;

    if (isHrOrAdmin) {
      [employees, active, departments, leaveRequests, attendance, payroll, recruitment, performance, documents] = await Promise.all([
        pool.query("SELECT COUNT(*) FROM employees"),
        pool.query("SELECT COUNT(*) FROM employees WHERE status = 'active'"),
        pool.query("SELECT COUNT(*) FROM departments"),
        pool.query("SELECT COUNT(*) FROM leave_requests WHERE status = 'pending'"),
        pool.query("SELECT COUNT(DISTINCT employee_id) FROM attendance WHERE work_date = $1 OR attendance_date = $1", [todayStr]),
        pool.query("SELECT COUNT(*) FROM payroll"),
        pool.query("SELECT COUNT(*) FROM recruitment"),
        pool.query("SELECT COUNT(*) FROM performance_reviews"),
        pool.query("SELECT COUNT(*) FROM documents")
      ]);
    } else {
      const empRes = await pool.query("SELECT id, department_id FROM employees WHERE user_id = $1", [req.user.id]);
      const employeeId = empRes.rows[0]?.id || null;
      const departmentId = empRes.rows[0]?.department_id || null;

      [employees, active, departments, leaveRequests, attendance, payroll, recruitment, performance, documents] = await Promise.all([
        pool.query("SELECT COUNT(*) FROM employees WHERE id = $1", [employeeId]),
        pool.query("SELECT COUNT(*) FROM employees WHERE id = $1 AND status = 'active'", [employeeId]),
        pool.query("SELECT COUNT(*) FROM departments WHERE id = $1", [departmentId]),
        pool.query("SELECT COUNT(*) FROM leave_requests WHERE status = 'pending' AND employee_id = $1", [employeeId]),
        pool.query("SELECT COUNT(DISTINCT employee_id) FROM attendance WHERE employee_id = $1 AND (work_date = $2 OR attendance_date = $2)", [employeeId, todayStr]),
        pool.query("SELECT COUNT(*) FROM payroll WHERE employee_id = $1", [employeeId]),
        pool.query("SELECT 0 AS count"), // Employees don't see recruitment stats
        pool.query("SELECT COUNT(*) FROM performance_reviews WHERE employee_id = $1", [employeeId]),
        pool.query("SELECT COUNT(*) FROM documents WHERE employee_id = $1", [employeeId])
      ]);
    }

    res.status(200).json({
      success: true,
      user: req.user,

      dashboard: {
        employees: parseInt(employees.rows[0].count),
        activeEmployees: parseInt(active.rows[0].count),
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

// Get department breakdown
router.get("/dept-breakdown", authenticate, async (req, res) => {
  try {
    const isHrOrAdmin = req.user.role === "admin" || req.user.role === "hr_manager" || req.user.role === "dept_manager";
    let result;

    if (isHrOrAdmin) {
      result = await pool.query(`
        SELECT d.name, COUNT(e.id)::int AS value
        FROM departments d
        LEFT JOIN employees e ON e.department_id = d.id
        GROUP BY d.id, d.name
        ORDER BY d.name
      `);
    } else {
      const empRes = await pool.query("SELECT department_id FROM employees WHERE user_id = $1", [req.user.id]);
      const departmentId = empRes.rows[0]?.department_id || null;
      result = await pool.query(`
        SELECT d.name, COUNT(e.id)::int AS value
        FROM departments d
        LEFT JOIN employees e ON e.department_id = d.id
        WHERE d.id = $1
        GROUP BY d.id, d.name
      `, [departmentId]);
    }
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET recent leave requests (limit 5)
router.get("/recent-leave", authenticate, async (req, res) => {
  try {
    const isHrOrAdmin = req.user.role === "admin" || req.user.role === "hr_manager" || req.user.role === "dept_manager";
    let result;

    if (isHrOrAdmin) {
      const query = `
        SELECT lr.id, lr.leave_type, lr.start_date, lr.end_date, lr.status, lr.employee_id, lr.created_at,
               e.name AS employee_name
        FROM leave_requests lr
        LEFT JOIN employees e ON lr.employee_id = e.id
        ORDER BY lr.created_at DESC, lr.id DESC
        LIMIT 5
      `;
      result = await pool.query(query);
    } else {
      const empRes = await pool.query("SELECT id FROM employees WHERE user_id = $1", [req.user.id]);
      const employeeId = empRes.rows[0]?.id || null;
      const query = `
        SELECT lr.id, lr.leave_type, lr.start_date, lr.end_date, lr.status, lr.employee_id, lr.created_at,
               e.name AS employee_name
        FROM leave_requests lr
        LEFT JOIN employees e ON lr.employee_id = e.id
        WHERE lr.employee_id = $1
        ORDER BY lr.created_at DESC, lr.id DESC
        LIMIT 5
      `;
      result = await pool.query(query, [employeeId]);
    }

    const formatted = result.rows.map((row) => ({
      id: row.id,
      leave_type: row.leave_type,
      start_date: row.start_date,
      end_date: row.end_date,
      status: row.status,
      employee_id: row.employee_id,
      created_at: row.created_at,
      profiles: {
        full_name: row.employee_name,
      },
    }));

    res.json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;