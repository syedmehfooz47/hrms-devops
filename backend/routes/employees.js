const express = require("express");
const router = express.Router();
const pool = require("../config/db");

// GET ALL EMPLOYEES
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM employees ORDER BY id ASC"
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: err.message,
    });
  }
});

// GET EMPLOYEE BY ID
router.get("/:id", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM employees WHERE id = $1",
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Employee not found",
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

// CREATE EMPLOYEE
router.post("/", async (req, res) => {
  try {
    const {
      name,
      email,
      department,
      designation,
    } = req.body;

    const result = await pool.query(
      `INSERT INTO employees
      (name, email, department, designation)
      VALUES ($1, $2, $3, $4)
      RETURNING *`,
      [name, email, department, designation]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: err.message,
    });
  }
});

// UPDATE EMPLOYEE
router.put("/:id", async (req, res) => {
  try {
    const {
      name,
      email,
      department,
      designation,
    } = req.body;

    const result = await pool.query(
      `UPDATE employees
       SET
         name = $1,
         email = $2,
         department = $3,
         designation = $4
       WHERE id = $5
       RETURNING *`,
      [
        name,
        email,
        department,
        designation,
        req.params.id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Employee not found",
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

// DELETE EMPLOYEE
router.delete("/:id", async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM employees WHERE id = $1 RETURNING *",
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Employee not found",
      });
    }

    res.json({
      success: true,
      message: "Employee deleted successfully",
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: err.message,
    });
  }
});

module.exports = router;