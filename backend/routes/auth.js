const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

const SECRET = process.env.JWT_SECRET || "hrms_secret_key_2024_pulse";

// Register
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role, phone } = req.body;
    const userRole = role || "employee";

    // Check if user already exists
    const checkUser = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (checkUser.rows.length > 0) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (name, email, password, role, phone)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, role, phone, avatar_url`,
      [name, email, hashedPassword, userRole, phone || null]
    );

    const user = result.rows[0];

    // If role is employee (or not admin), automatically create an employee record
    if (userRole !== "admin") {
      const empCode = "EMP-" + Math.floor(100000 + Math.random() * 900000);
      await pool.query(
        `INSERT INTO employees (user_id, employee_code, name, email, phone, status)
         VALUES ($1, $2, $3, $4, $5, 'active')`,
        [user.id, empCode, user.name, user.email, user.phone]
      );
    }

    res.status(201).json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);

    if (result.rows.length === 0) {
      return res.status(400).json({ message: "User not found" });
    }

    const user = result.rows[0];

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ message: "Invalid Password" });
    }

    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
      },
      SECRET,
      {
        expiresIn: "1d",
      }
    );

    // Remove password before sending user object
    delete user.password;

    res.json({
      token,
      user,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Get Current User (Me)
router.get("/me", authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, email, role, phone, avatar_url, created_at FROM users WHERE id = $1",
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = result.rows[0];

    res.json({
      ...user,
      user, // nested for backward compatibility
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;