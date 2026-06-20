const express = require("express");
const router = express.Router();
const pool = require("../config/db");

// GET all departments
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM departments ORDER BY id"
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: err.message,
    });
  }
});

// GET department by id
router.get("/:id", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM departments WHERE id = $1",
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Department not found",
      });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: err.message,
    });
  }
});

// CREATE department
router.post("/", async (req, res) => {
  try {
    const { name } = req.body;

    const result = await pool.query(
      "INSERT INTO departments(name) VALUES($1) RETURNING *",
      [name]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: err.message,
    });
  }
});

// UPDATE department
router.put("/:id", async (req, res) => {
  try {
    const { name } = req.body;

    const result = await pool.query(
      "UPDATE departments SET name=$1 WHERE id=$2 RETURNING *",
      [name, req.params.id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: err.message,
    });
  }
});

// DELETE department
router.delete("/:id", async (req, res) => {
  try {
    await pool.query(
      "DELETE FROM departments WHERE id=$1",
      [req.params.id]
    );

    res.json({
      message: "Department deleted successfully",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: err.message,
    });
  }
});

module.exports = router;