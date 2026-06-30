const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { authenticate, authorize } = require("../middleware/auth");

router.use(authenticate);

// Helper: Get today's date in IST (UTC+5:30) to avoid timezone issues around midnight
function getTodayIST() {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + istOffset);
  return istDate.toISOString().slice(0, 10);
}

// GET all attendance (with optional filters: employee_id, date, month, year)
router.get("/", async (req, res) => {
  try {
    let { employee_id, date, month, year } = req.query;
    const isManagerOrAbove = req.user.role === "admin" || req.user.role === "hr_manager" || req.user.role === "dept_manager";

    const empRes = await pool.query("SELECT id FROM employees WHERE user_id = $1", [req.user.id]);
    const userEmpId = empRes.rows[0]?.id;

    if (!isManagerOrAbove) {
      if (!userEmpId) {
        return res.json([]);
      }
      employee_id = userEmpId;
    }
    
    let queryText = `
      SELECT a.*, e.name AS employee_name, e.employee_code
      FROM attendance a
      LEFT JOIN employees e ON a.employee_id = e.id
      WHERE 1=1
    `;
    const queryParams = [];
    let paramIndex = 1;

    if (employee_id) {
      queryText += ` AND a.employee_id = $${paramIndex}`;
      queryParams.push(employee_id);
      paramIndex++;
    }

    if (date) {
      queryText += ` AND (a.work_date = $${paramIndex} OR a.attendance_date = $${paramIndex})`;
      queryParams.push(date);
      paramIndex++;
    }

    if (month) {
      queryText += ` AND EXTRACT(MONTH FROM COALESCE(a.attendance_date, a.work_date)) = $${paramIndex}`;
      queryParams.push(parseInt(month));
      paramIndex++;
    }

    if (year) {
      queryText += ` AND EXTRACT(YEAR FROM COALESCE(a.attendance_date, a.work_date)) = $${paramIndex}`;
      queryParams.push(parseInt(year));
      paramIndex++;
    }

    queryText += " ORDER BY a.work_date DESC, a.id DESC";

    const result = await pool.query(queryText, queryParams);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET team attendance for a specific date
router.get("/team", authorize("admin", "hr_manager", "dept_manager"), async (req, res) => {
  try {
    const date = req.query.date || getTodayIST();
    
    const result = await pool.query(
      `SELECT a.*, e.name AS employee_name, e.email AS employee_email, e.employee_code
       FROM attendance a
       JOIN employees e ON a.employee_id = e.id
       WHERE a.work_date = $1 OR a.attendance_date = $1`,
      [date]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET today's attendance for a specific employee
router.get("/today/:employeeId", async (req, res) => {
  try {
    const isManagerOrAbove = req.user.role === "admin" || req.user.role === "hr_manager" || req.user.role === "dept_manager";
    const empRes = await pool.query("SELECT id FROM employees WHERE user_id = $1", [req.user.id]);
    const userEmpId = empRes.rows[0]?.id;

    if (!isManagerOrAbove && String(userEmpId) !== String(req.params.employeeId)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    const today = getTodayIST();
    const result = await pool.query(
      `SELECT * FROM attendance 
       WHERE employee_id = $1 AND (work_date = $2 OR attendance_date = $2)
       LIMIT 1`,
      [req.params.employeeId, today]
    );

    if (result.rows.length === 0) {
      return res.json(null); // return null to match client expectations
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET monthly attendance for an employee
router.get("/month/:employeeId", async (req, res) => {
  try {
    const isManagerOrAbove = req.user.role === "admin" || req.user.role === "hr_manager" || req.user.role === "dept_manager";
    const empRes = await pool.query("SELECT id FROM employees WHERE user_id = $1", [req.user.id]);
    const userEmpId = empRes.rows[0]?.id;

    if (!isManagerOrAbove && String(userEmpId) !== String(req.params.employeeId)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year) || new Date().getFullYear();

    const result = await pool.query(
      `SELECT * FROM attendance 
       WHERE employee_id = $1 
         AND EXTRACT(MONTH FROM COALESCE(attendance_date, work_date)) = $2
         AND EXTRACT(YEAR FROM COALESCE(attendance_date, work_date)) = $3
       ORDER BY COALESCE(attendance_date, work_date) DESC`,
      [req.params.employeeId, month, year]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST checkin (check in for today)
router.post("/checkin", async (req, res) => {
  try {
    const { employee_id } = req.body;
    const isHrOrAdmin = req.user.role === "admin" || req.user.role === "hr_manager";
    const empRes = await pool.query("SELECT id FROM employees WHERE user_id = $1", [req.user.id]);
    const userEmpId = empRes.rows[0]?.id;

    if (!isHrOrAdmin && String(userEmpId) !== String(employee_id)) {
      return res.status(403).json({ message: "Insufficient permissions to check in other employees" });
    }
    const today = getTodayIST();

    // Check if check-in already exists
    const check = await pool.query(
      "SELECT * FROM attendance WHERE employee_id = $1 AND (work_date = $2 OR attendance_date = $2)",
      [employee_id, today]
    );

    if (check.rows.length > 0) {
      return res.status(400).json({ message: "Already checked in for today", record: check.rows[0] });
    }

    const result = await pool.query(
      `INSERT INTO attendance (employee_id, work_date, attendance_date, check_in, status)
       VALUES ($1, $2, $2, CURRENT_TIMESTAMP, 'present')
       RETURNING *`,
      [employee_id, today]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PUT checkout (check out by attendance record ID)
router.put("/checkout/:id", async (req, res) => {
  try {
    const isHrOrAdmin = req.user.role === "admin" || req.user.role === "hr_manager";
    const attRes = await pool.query("SELECT employee_id FROM attendance WHERE id = $1", [req.params.id]);
    if (attRes.rows.length === 0) {
      return res.status(404).json({ message: "Attendance record not found" });
    }
    const attEmpId = attRes.rows[0].employee_id;
    const empRes = await pool.query("SELECT id FROM employees WHERE user_id = $1", [req.user.id]);
    const userEmpId = empRes.rows[0]?.id;

    if (!isHrOrAdmin && String(userEmpId) !== String(attEmpId)) {
      return res.status(403).json({ message: "Insufficient permissions to check out other employees" });
    }
    const result = await pool.query(
      `UPDATE attendance 
       SET check_out = CURRENT_TIMESTAMP 
       WHERE id = $1 
       RETURNING *`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Attendance record not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST Mark / Add attendance manually
router.post("/", authorize("admin", "hr_manager"), async (req, res) => {
  try {
    const { employee_id, attendance_date, status } = req.body;
    
    // Check if record exists for this date
    const check = await pool.query(
      "SELECT * FROM attendance WHERE employee_id = $1 AND (work_date = $2 OR attendance_date = $2)",
      [employee_id, attendance_date]
    );

    let result;
    if (check.rows.length > 0) {
      // Update existing record
      result = await pool.query(
        "UPDATE attendance SET status = $1 WHERE id = $2 RETURNING *",
        [status, check.rows[0].id]
      );
    } else {
      // Insert new record
      result = await pool.query(
        `INSERT INTO attendance (employee_id, work_date, attendance_date, status)
         VALUES ($1, $2, $2, $3)
         RETURNING *`,
        [employee_id, attendance_date, status]
      );
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PUT update attendance
router.put("/:id", authorize("admin", "hr_manager"), async (req, res) => {
  try {
    const { status, check_in, check_out, work_date } = req.body;

    const result = await pool.query(
      `UPDATE attendance
       SET 
         status = COALESCE($1, status),
         check_in = COALESCE($2, check_in),
         check_out = COALESCE($3, check_out),
         work_date = COALESCE($4, work_date),
         attendance_date = COALESCE($4, attendance_date)
       WHERE id = $5
       RETURNING *`,
      [status, check_in, check_out, work_date, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Attendance record not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE attendance
router.delete("/:id", authorize("admin", "hr_manager"), async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM attendance WHERE id = $1 RETURNING *",
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Attendance record not found" });
    }

    res.json({ success: true, message: "Attendance record deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;