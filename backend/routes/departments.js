const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { authenticate, authorize } = require("../middleware/auth");

router.use(authenticate);

// GET all departments
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM departments ORDER BY name ASC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
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
      return res.status(404).json({ message: "Department not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// CREATE department
router.post("/", authorize("admin", "hr_manager"), async (req, res) => {
  try {
    const { name, description } = req.body;

    const result = await pool.query(
      "INSERT INTO departments(name, description) VALUES($1, $2) RETURNING *",
      [name, description || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// UPDATE department
router.put("/:id", authorize("admin", "hr_manager"), async (req, res) => {
  try {
    const { name, description } = req.body;

    const result = await pool.query(
      "UPDATE departments SET name=$1, description=$2 WHERE id=$3 RETURNING *",
      [name, description || null, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Department not found" });
    }

    // Sync denormalized department name in employees table
    await pool.query(
      "UPDATE employees SET department = $1 WHERE department_id = $2",
      [name, req.params.id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE department
router.delete("/:id", authorize("admin", "hr_manager"), async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM departments WHERE id=$1 RETURNING *",
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Department not found" });
    }

    // Clear denormalized department name for orphaned employees
    await pool.query(
      "UPDATE employees SET department = NULL WHERE department_id IS NULL"
    );

    res.json({
      success: true,
      message: "Department deleted successfully",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;