const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { authenticate, authorize } = require("../middleware/auth");

router.use(authenticate);

// GET all leave requests
router.get("/", authorize("admin", "hr_manager", "dept_manager"), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT lr.*, e.name AS employee_name, e.employee_code, 
              u.name AS approver_name
       FROM leave_requests lr
       LEFT JOIN employees e ON lr.employee_id = e.id
       LEFT JOIN users u ON lr.approver_id = u.id
       ORDER BY lr.id DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET my leave requests (for logged-in user)
router.get("/my", async (req, res) => {
  try {
    // Find the employee record linked to the authenticated user
    const empRes = await pool.query("SELECT id FROM employees WHERE user_id = $1", [req.user.id]);
    if (empRes.rows.length === 0) {
      return res.status(404).json({ message: "Employee profile not found for this user" });
    }
    const employeeId = empRes.rows[0].id;

    const result = await pool.query(
      `SELECT lr.*, e.name AS employee_name, e.employee_code,
              u.name AS approver_name
       FROM leave_requests lr
       LEFT JOIN employees e ON lr.employee_id = e.id
       LEFT JOIN users u ON lr.approver_id = u.id
       WHERE lr.employee_id = $1
       ORDER BY lr.id DESC`,
      [employeeId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Helper: Ensure default leave balances exist for employee and year
async function ensureLeaveBalances(employeeId, year) {
  const defaults = [
    { type: "earned", allocated: 20 },
    { type: "casual", allocated: 10 },
    { type: "sick", allocated: 10 },
  ];

  for (const d of defaults) {
    await pool.query(
      `INSERT INTO leave_balances (employee_id, year, leave_type, allocated, used)
       VALUES ($1, $2, $3, $4, 0)
       ON CONFLICT (employee_id, year, leave_type) DO NOTHING`,
      [employeeId, year, d.type, d.allocated]
    );
  }
}

// GET leave balances for an employee
router.get("/balances/:employeeId", async (req, res) => {
  try {
    const isManagerOrAbove = req.user.role === "admin" || req.user.role === "hr_manager" || req.user.role === "dept_manager";
    const empRes = await pool.query("SELECT id FROM employees WHERE user_id = $1", [req.user.id]);
    const userEmpId = empRes.rows[0]?.id;
    const employeeId = req.params.employeeId;

    if (!isManagerOrAbove && String(userEmpId) !== String(employeeId)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    const year = parseInt(req.query.year) || new Date().getFullYear();

    await ensureLeaveBalances(employeeId, year);

    const result = await pool.query(
      "SELECT * FROM leave_balances WHERE employee_id = $1 AND year = $2",
      [employeeId, year]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Apply / Create leave request
router.post("/", async (req, res) => {
  try {
    const { employee_id, leave_type, start_date, end_date, reason } = req.body;

    // Ownership check: only HR/Admin can apply leave on behalf of others
    const isHrOrAdmin = req.user.role === "admin" || req.user.role === "hr_manager";
    if (!isHrOrAdmin) {
      const empRes = await pool.query("SELECT id FROM employees WHERE user_id = $1", [req.user.id]);
      const userEmpId = empRes.rows[0]?.id;
      if (String(userEmpId) !== String(employee_id)) {
        return res.status(403).json({ message: "You can only apply leave for yourself" });
      }
    }

    // Ensure default leave balances exist for the year of this leave request
    const start = new Date(start_date);
    const year = start.getFullYear();
    await ensureLeaveBalances(employee_id, year);

    const result = await pool.query(
      `INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, reason, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING *`,
      [employee_id, leave_type, start_date, end_date, reason || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Approve leave request
router.put("/:id/approve", authorize("admin", "hr_manager", "dept_manager"), async (req, res) => {
  try {
    const { approver_id, approver_note } = req.body;
    const finalApproverId = approver_id || req.user.id;

    // Fetch the leave request first
    const leaveRes = await pool.query("SELECT * FROM leave_requests WHERE id = $1", [req.params.id]);
    if (leaveRes.rows.length === 0) {
      return res.status(404).json({ message: "Leave request not found" });
    }

    const leave = leaveRes.rows[0];
    if (leave.status !== "pending") {
      return res.status(400).json({ message: `Leave request has already been ${leave.status}` });
    }

    // Calculate leave days
    const start = new Date(leave.start_date);
    const end = new Date(leave.end_date);
    const timeDiff = Math.abs(end.getTime() - start.getTime());
    const days = Math.ceil(timeDiff / (1000 * 60 * 60 * 24)) + 1;
    const year = start.getFullYear();

    // Ensure default leave balances exist for the year of this leave request
    await ensureLeaveBalances(leave.employee_id, year);

    // Check leave balance before approving
    const balanceRes = await pool.query(
      "SELECT allocated, used FROM leave_balances WHERE employee_id = $1 AND leave_type = $2 AND year = $3",
      [leave.employee_id, leave.leave_type, year]
    );
    if (balanceRes.rows.length > 0) {
      const balance = balanceRes.rows[0];
      const remaining = balance.allocated - balance.used;
      if (days > remaining) {
        return res.status(400).json({ message: `Insufficient leave balance. ${remaining} day(s) remaining for ${leave.leave_type}.` });
      }
    }

    // Update leave request status
    const result = await pool.query(
      `UPDATE leave_requests
       SET status = 'approved', approver_id = $1, approver_note = $2, decided_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [finalApproverId, approver_note || null, req.params.id]
    );

    // Increment used leave count in balances
    await pool.query(
      `UPDATE leave_balances
       SET used = used + $1
       WHERE employee_id = $2 AND leave_type = $3 AND year = $4`,
      [days, leave.employee_id, leave.leave_type, year]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Reject leave request
router.put("/:id/reject", authorize("admin", "hr_manager", "dept_manager"), async (req, res) => {
  try {
    const { approver_id, approver_note } = req.body;
    const finalApproverId = approver_id || req.user.id;

    // Check if exists
    const check = await pool.query("SELECT * FROM leave_requests WHERE id = $1", [req.params.id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ message: "Leave request not found" });
    }

    const leave = check.rows[0];
    if (leave.status === "rejected") {
      return res.status(400).json({ message: "Leave request has already been rejected" });
    }

    // If rejecting a previously approved leave, reverse the balance deduction
    if (leave.status === "approved") {
      const start = new Date(leave.start_date);
      const end = new Date(leave.end_date);
      const timeDiff = Math.abs(end.getTime() - start.getTime());
      const days = Math.ceil(timeDiff / (1000 * 60 * 60 * 24)) + 1;
      const year = start.getFullYear();

      await pool.query(
        `UPDATE leave_balances
         SET used = GREATEST(used - $1, 0)
         WHERE employee_id = $2 AND leave_type = $3 AND year = $4`,
        [days, leave.employee_id, leave.leave_type, year]
      );
    }

    const result = await pool.query(
      `UPDATE leave_requests
       SET status = 'rejected', approver_id = $1, approver_note = $2, decided_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [finalApproverId, approver_note || null, req.params.id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Cancel / Delete leave request
router.delete("/:id", async (req, res) => {
  try {
    const checkRes = await pool.query("SELECT * FROM leave_requests WHERE id = $1", [req.params.id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ message: "Leave request not found" });
    }
    const leaveReq = checkRes.rows[0];
    const isHrOrAdmin = req.user.role === "admin" || req.user.role === "hr_manager";

    const empRes = await pool.query("SELECT id FROM employees WHERE user_id = $1", [req.user.id]);
    const userEmpId = empRes.rows[0]?.id;

    if (!isHrOrAdmin && String(userEmpId) !== String(leaveReq.employee_id)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    if (!isHrOrAdmin && leaveReq.status !== "pending") {
      return res.status(400).json({ message: "Cannot cancel leave request that is already approved or rejected" });
    }

    // If deleting an approved leave, reverse the balance deduction
    if (leaveReq.status === "approved") {
      const start = new Date(leaveReq.start_date);
      const end = new Date(leaveReq.end_date);
      const timeDiff = Math.abs(end.getTime() - start.getTime());
      const days = Math.ceil(timeDiff / (1000 * 60 * 60 * 24)) + 1;
      const year = start.getFullYear();

      await pool.query(
        `UPDATE leave_balances
         SET used = GREATEST(used - $1, 0)
         WHERE employee_id = $2 AND leave_type = $3 AND year = $4`,
        [days, leaveReq.employee_id, leaveReq.leave_type, year]
      );
    }

    await pool.query(
      "DELETE FROM leave_requests WHERE id = $1 RETURNING *",
      [req.params.id]
    );

    res.json({ success: true, message: "Leave request cancelled/deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;