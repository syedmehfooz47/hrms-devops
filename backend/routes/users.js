const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { authenticate } = require("../middleware/auth");

// GET all user profiles
router.get("/profiles", authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, email, role, phone, avatar_url, created_at FROM users ORDER BY name ASC"
    );
    
    // Map 'name' to 'full_name' for compatibility
    const profiles = result.rows.map((row) => ({
      ...row,
      full_name: row.name,
    }));
    
    res.json(profiles);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET single user profile by id
router.get("/profile/:id", authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, email, role, phone, avatar_url, created_at FROM users WHERE id = $1",
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const row = result.rows[0];
    const profile = {
      ...row,
      full_name: row.name,
    };

    res.json(profile);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// UPDATE user profile by id
router.put("/profile/:id", authenticate, async (req, res) => {
  try {
    const { name, full_name, email, phone, avatar_url, role } = req.body;
    const finalName = name || full_name;

    // Fetch existing user details
    const checkUser = await pool.query("SELECT * FROM users WHERE id = $1", [req.params.id]);
    if (checkUser.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = checkUser.rows[0];
    const isHrOrAdmin = req.user.role === "admin" || req.user.role === "hr_manager";
    const isSelf = String(req.params.id) === String(req.user.id);

    if (!isHrOrAdmin && !isSelf) {
      return res.status(403).json({ message: "Insufficient permissions to update this profile" });
    }

    // Role updates can only be done by HR or Admin
    let finalRole = user.role;
    if (role !== undefined && role !== user.role) {
      if (!isHrOrAdmin) {
        return res.status(403).json({ message: "Only Admin or HR can update user roles" });
      }
      finalRole = role;
    }

    const result = await pool.query(
      `UPDATE users
       SET
         name = COALESCE($1, name),
         email = COALESCE($2, email),
         phone = COALESCE($3, phone),
         avatar_url = COALESCE($4, avatar_url),
         role = COALESCE($5, role)
       WHERE id = $6
       RETURNING id, name, email, role, phone, avatar_url, created_at`,
      [
        finalName || null,
        email || null,
        phone || null,
        avatar_url || null,
        finalRole,
        req.params.id,
      ]
    );

    const updatedRow = result.rows[0];
    
    // Also update matching employee record name/email/phone if exists
    await pool.query(
      `UPDATE employees
       SET
         name = COALESCE($1, name),
         email = COALESCE($2, email),
         phone = COALESCE($3, phone)
       WHERE user_id = $4`,
      [updatedRow.name, updatedRow.email, updatedRow.phone, req.params.id]
    );

    res.json({
      ...updatedRow,
      full_name: updatedRow.name,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
