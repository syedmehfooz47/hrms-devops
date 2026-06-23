const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { authenticate, authorize } = require("../middleware/auth");

router.use(authenticate);

// Get all payroll records
router.get("/", authorize("admin", "hr_manager"), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, e.employee_code, e.designation, e.name AS employee_name, e.email AS employee_email
      FROM payroll p
      JOIN employees e ON p.employee_id = e.id
      ORDER BY p.year DESC, p.month DESC, p.id DESC
    `);
    
    const formatted = result.rows.map(row => ({
      ...row,
      basic: Number(row.basic_salary),
      net: Number(row.net_salary),
      employees: {
        employee_code: row.employee_code,
        designation: row.designation,
        profiles: {
          full_name: row.employee_name,
          email: row.employee_email
        }
      }
    }));
    
    res.json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Get payslips for a specific employee
router.get("/slips/:employeeId", async (req, res) => {
  try {
    const isHrOrAdmin = req.user.role === "admin" || req.user.role === "hr_manager";
    const empRes = await pool.query("SELECT id FROM employees WHERE user_id = $1", [req.user.id]);
    const userEmpId = empRes.rows[0]?.id;
    const employeeId = req.params.employeeId;

    if (!isHrOrAdmin && String(userEmpId) !== String(employeeId)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    const result = await pool.query(
      `SELECT p.*, e.employee_code, e.designation, e.name AS employee_name, e.email AS employee_email
       FROM payroll p
       JOIN employees e ON p.employee_id = e.id
       WHERE p.employee_id = $1
       ORDER BY p.year DESC, p.month DESC`,
      [req.params.employeeId]
    );

    const formatted = result.rows.map(row => ({
      ...row,
      basic: Number(row.basic_salary),
      net: Number(row.net_salary),
      employees: {
        employee_code: row.employee_code,
        designation: row.designation,
        profiles: {
          full_name: row.employee_name,
          email: row.employee_email
        }
      }
    }));

    res.json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Generate payroll for a month & year
router.post("/generate", authorize("admin", "hr_manager"), async (req, res) => {
  try {
    const { month, year } = req.body;
    if (!month || !year) {
      return res.status(400).json({ message: "Month and year are required" });
    }

    const empRes = await pool.query(
      "SELECT id, salary_basic FROM employees WHERE status = 'active'"
    );

    if (empRes.rows.length === 0) {
      return res.status(400).json({ message: "No active employees found" });
    }

    const workingDays = new Date(year, month, 0).getDate();

    // Check if payroll already generated for this month & year
    const checkRes = await pool.query(
      "SELECT id FROM payroll WHERE month = $1 AND year = $2",
      [month, year]
    );

    if (checkRes.rows.length > 0) {
      return res.status(400).json({ message: "Payroll already generated for this period" });
    }

    const processedBy = req.user.id;

    for (const emp of empRes.rows) {
      const basicSalary = Number(emp.salary_basic || 0);
      const hra = basicSalary * 0.40;
      const allowances = basicSalary * 0.15;
      const gross = basicSalary + hra + allowances;
      const pf = basicSalary * 0.12;
      const tax = gross > 50000 ? gross * 0.10 : 0;
      const netSalary = gross - pf - tax;

      await pool.query(
        `INSERT INTO payroll 
         (employee_id, basic_salary, hra, allowances, gross, pf, tax, other_deductions, net_salary, month, year, status, working_days, paid_days, processed_by, processed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 0, $8, $9, $10, 'draft', $11, $11, $12, CURRENT_TIMESTAMP)`,
        [
          emp.id,
          basicSalary,
          hra,
          allowances,
          gross,
          pf,
          tax,
          netSalary,
          month,
          year,
          workingDays,
          processedBy
        ]
      );
    }

    res.status(201).json({ success: true, message: `Payroll generated for ${empRes.rows.length} employees` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Update payroll status (Process/Pay)
router.put("/:id", authorize("admin", "hr_manager"), async (req, res) => {
  try {
    const { status } = req.body;
    const processedBy = req.user.id;

    const result = await pool.query(
      `UPDATE payroll
       SET status = $1, processed_by = $2, processed_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [status, processedBy, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Payroll record not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;