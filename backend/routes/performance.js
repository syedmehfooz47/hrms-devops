const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { authenticate, authorize } = require("../middleware/auth");

router.use(authenticate);

// ─── Goals Endpoints ──────────────────────────────────────

// GET my goals (goals for a specific employee)
router.get("/goals/:employeeId", async (req, res) => {
  try {
    const isManagerOrAbove = req.user.role === "admin" || req.user.role === "hr_manager" || req.user.role === "dept_manager";
    const empRes = await pool.query("SELECT id FROM employees WHERE user_id = $1", [req.user.id]);
    const userEmpId = empRes.rows[0]?.id;
    const employeeId = req.params.employeeId;

    if (!isManagerOrAbove && String(userEmpId) !== String(employeeId)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    const result = await pool.query(
      `SELECT pg.*, e.name AS employee_name
       FROM performance_goals pg
       LEFT JOIN employees e ON pg.employee_id = e.id
       WHERE pg.employee_id = $1
       ORDER BY pg.id DESC`,
      [req.params.employeeId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// CREATE a performance goal
router.post("/goals", async (req, res) => {
  try {
    const { employee_id, title, description, category, target_date, progress, status } = req.body;
    const isManagerOrAbove = req.user.role === "admin" || req.user.role === "hr_manager" || req.user.role === "dept_manager";
    const empRes = await pool.query("SELECT id FROM employees WHERE user_id = $1", [req.user.id]);
    const userEmpId = empRes.rows[0]?.id;

    if (!isManagerOrAbove && String(userEmpId) !== String(employee_id)) {
      return res.status(403).json({ message: "Insufficient permissions to create goals for other employees" });
    }

    const result = await pool.query(
      `INSERT INTO performance_goals 
       (employee_id, title, description, category, target_date, progress, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        employee_id,
        title,
        description || null,
        category || "General",
        target_date || null,
        progress !== undefined ? parseInt(progress) : 0,
        status || "not_started",
        req.user.id,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// UPDATE a performance goal
router.put("/goals/:id", async (req, res) => {
  try {
    const isManagerOrAbove = req.user.role === "admin" || req.user.role === "hr_manager" || req.user.role === "dept_manager";
    const goalRes = await pool.query("SELECT employee_id FROM performance_goals WHERE id = $1", [req.params.id]);
    if (goalRes.rows.length === 0) {
      return res.status(404).json({ message: "Goal not found" });
    }
    const goalEmpId = goalRes.rows[0].employee_id;
    const empRes = await pool.query("SELECT id FROM employees WHERE user_id = $1", [req.user.id]);
    const userEmpId = empRes.rows[0]?.id;

    if (!isManagerOrAbove && String(userEmpId) !== String(goalEmpId)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    const { title, description, category, target_date, progress, status } = req.body;

    const result = await pool.query(
      `UPDATE performance_goals
       SET
         title = COALESCE($1, title),
         description = COALESCE($2, description),
         category = COALESCE($3, category),
         target_date = COALESCE($4, target_date),
         progress = COALESCE($5, progress),
         status = COALESCE($6, status)
       WHERE id = $7
       RETURNING *`,
      [
        title !== undefined ? title : null,
        description !== undefined ? description : null,
        category !== undefined ? category : null,
        target_date !== undefined ? target_date : null,
        progress !== undefined ? parseInt(progress) : null,
        status !== undefined ? status : null,
        req.params.id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Goal not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});


// ─── Reviews Endpoints ────────────────────────────────────

// GET all team reviews (or filter if necessary)
router.get("/reviews", authorize("admin", "hr_manager", "dept_manager"), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT pr.*, e.name AS employee_name, e.employee_code, u.name AS reviewer_name
       FROM performance_reviews pr
       LEFT JOIN employees e ON pr.employee_id = e.id
       LEFT JOIN users u ON pr.reviewer_id = u.id
       ORDER BY pr.id DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET my reviews (reviews for a specific employee)
router.get("/reviews/:employeeId", async (req, res) => {
  try {
    const isManagerOrAbove = req.user.role === "admin" || req.user.role === "hr_manager" || req.user.role === "dept_manager";
    const empRes = await pool.query("SELECT id FROM employees WHERE user_id = $1", [req.user.id]);
    const userEmpId = empRes.rows[0]?.id;
    const employeeId = req.params.employeeId;

    if (!isManagerOrAbove && String(userEmpId) !== String(employeeId)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    const result = await pool.query(
      `SELECT pr.*, e.name AS employee_name, u.name AS reviewer_name
       FROM performance_reviews pr
       LEFT JOIN employees e ON pr.employee_id = e.id
       LEFT JOIN users u ON pr.reviewer_id = u.id
       WHERE pr.employee_id = $1
       ORDER BY pr.id DESC`,
      [req.params.employeeId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// CREATE a performance review
router.post("/reviews", authorize("admin", "hr_manager", "dept_manager"), async (req, res) => {
  try {
    const {
      employee_id,
      period_label,
      period_start,
      period_end,
      review_period,
      rating,
      strengths,
      improvements,
      feedback,
      comments,
      status,
    } = req.body;

    const result = await pool.query(
      `INSERT INTO performance_reviews
       (employee_id, reviewer_id, period_label, period_start, period_end, review_period, rating, strengths, improvements, feedback, comments, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        employee_id,
        req.user.id,
        period_label || review_period || null,
        period_start || null,
        period_end || null,
        review_period || period_label || null,
        rating ? parseFloat(rating) : 0,
        strengths || null,
        improvements || null,
        feedback || null,
        comments || null,
        status || "draft",
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;