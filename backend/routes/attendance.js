const express = require("express");
const router = express.Router();
const pool = require("../config/db");

// Get all attendance
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM attendance ORDER BY id"
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: err.message
    });
  }
});

// Add attendance
router.post("/", async (req, res) => {
  try {
    const { employee_id, attendance_date, status } = req.body;

    const result = await pool.query(
      `INSERT INTO attendance
      (employee_id, attendance_date, status)
      VALUES ($1, $2, $3)
      RETURNING *`,
      [employee_id, attendance_date, status]
    );

    res.json(result.rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: err.message
    });
  }
});

module.exports = router;