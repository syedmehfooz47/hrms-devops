const express = require("express");
const router = express.Router();
const pool = require("../config/db");

// Get all reviews
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM performance_reviews ORDER BY id"
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});

// Add review
router.post("/", async (req, res) => {
  try {
    const {
      employee_id,
      review_period,
      rating,
      comments
    } = req.body;

    const result = await pool.query(
      `INSERT INTO performance_reviews
      (employee_id, review_period, rating, comments)
      VALUES ($1,$2,$3,$4)
      RETURNING *`,
      [
        employee_id,
        review_period,
        rating,
        comments
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});

module.exports = router;