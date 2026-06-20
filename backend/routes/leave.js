const express = require("express");
const router = express.Router();
const pool = require("../config/db");

// Get all leave requests
router.get("/", async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM leave_requests ORDER BY id"
  );

  res.json(result.rows);
});

// Apply leave
router.post("/", async (req, res) => {
  const {
    employee_id,
    leave_type,
    start_date,
    end_date,
    status
  } = req.body;

  const result = await pool.query(
    `INSERT INTO leave_requests
    (employee_id,leave_type,start_date,end_date,status)
    VALUES($1,$2,$3,$4,$5)
    RETURNING *`,
    [
      employee_id,
      leave_type,
      start_date,
      end_date,
      status
    ]
  );

  res.json(result.rows[0]);
});

module.exports = router;