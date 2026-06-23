const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { authenticate } = require("../middleware/auth");

// GET all notifications for logged-in user
router.get("/", authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM notifications WHERE user_id = $1 ORDER BY id DESC",
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PUT mark single notification as read
router.put("/:id/read", authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      "UPDATE notifications SET read = TRUE WHERE id = $1 AND user_id = $2 RETURNING *",
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Notification not found or access denied" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PUT mark all notifications as read
router.put("/read-all", authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      "UPDATE notifications SET read = TRUE WHERE user_id = $1 RETURNING *",
      [req.user.id]
    );
    res.json({ success: true, message: `Marked ${result.rowCount} notifications as read` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
