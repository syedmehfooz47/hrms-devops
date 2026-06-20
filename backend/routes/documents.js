const express = require("express");
const router = express.Router();
const pool = require("../config/db");

// Get all documents
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM documents ORDER BY id"
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});

// Add document
router.post("/", async (req, res) => {
  try {
    const {
      employee_id,
      document_name,
      document_type
    } = req.body;

    const result = await pool.query(
      `INSERT INTO documents
      (employee_id, document_name, document_type)
      VALUES ($1,$2,$3)
      RETURNING *`,
      [
        employee_id,
        document_name,
        document_type
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