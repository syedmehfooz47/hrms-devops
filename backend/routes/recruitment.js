const express = require("express");
const router = express.Router();
const pool = require("../config/db");

// Get candidates
router.get("/", async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM recruitment ORDER BY id"
  );

  res.json(result.rows);
});

// Add candidate
router.post("/", async (req, res) => {
  const {
    candidate_name,
    email,
    position,
    status
  } = req.body;

  const result = await pool.query(
    `INSERT INTO recruitment
    (candidate_name,email,position,status)
    VALUES($1,$2,$3,$4)
    RETURNING *`,
    [
      candidate_name,
      email,
      position,
      status
    ]
  );

  res.json(result.rows[0]);
});

module.exports = router;