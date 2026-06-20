const express = require("express");
const router = express.Router();
const pool = require("../config/db");

// Get payroll
router.get("/", async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM payroll ORDER BY id"
  );

  res.json(result.rows);
});

// Add payroll
router.post("/", async (req, res) => {
  const {
    employee_id,
    basic_salary,
    tax,
    net_salary
  } = req.body;

  const result = await pool.query(
    `INSERT INTO payroll
    (employee_id,basic_salary,tax,net_salary)
    VALUES($1,$2,$3,$4)
    RETURNING *`,
    [
      employee_id,
      basic_salary,
      tax,
      net_salary
    ]
  );

  res.json(result.rows[0]);
});

module.exports = router;