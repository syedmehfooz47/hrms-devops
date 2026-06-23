const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { authenticate, authorize } = require("../middleware/auth");

router.use(authenticate);

// GET ALL EMPLOYEES (with search, status filter, and pagination)
router.get("/", async (req, res) => {
  try {
    const { q, status, page, limit } = req.query;
    
    let queryText = `
      SELECT e.*, d.name AS department_name, 
             u.name AS user_name, u.email AS user_email, u.phone AS user_phone, u.avatar_url AS user_avatar_url
      FROM employees e
      LEFT JOIN users u ON e.user_id = u.id
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE 1=1
    `;
    const queryParams = [];
    let paramIndex = 1;

    if (status && status !== "all") {
      queryText += ` AND e.status = $${paramIndex}`;
      queryParams.push(status);
      paramIndex++;
    }

    if (q) {
      queryText += ` AND (
        e.name ILIKE $${paramIndex} OR 
        e.email ILIKE $${paramIndex} OR 
        e.employee_code ILIKE $${paramIndex} OR 
        e.designation ILIKE $${paramIndex} OR 
        d.name ILIKE $${paramIndex}
      )`;
      queryParams.push(`%${q}%`);
      paramIndex++;
    }

    queryText += " ORDER BY e.id DESC";

    if (limit) {
      const parsedLimit = parseInt(limit);
      const parsedPage = parseInt(page) || 1;
      const offset = (parsedPage - 1) * parsedLimit;
      
      queryText += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      queryParams.push(parsedLimit, offset);
    }

    const result = await pool.query(queryText, queryParams);

    const isHrOrAdmin = req.user.role === "admin" || req.user.role === "hr_manager";
    const formattedEmployees = result.rows.map((row) => {
      const emp = { ...row };
      if (!isHrOrAdmin) {
        delete emp.salary_basic;
      }
      return {
        ...emp,
        profiles: {
          id: row.user_id,
          full_name: row.name || row.user_name,
          email: row.email || row.user_email,
          phone: row.phone || row.user_phone,
          avatar_url: row.avatar_url || row.user_avatar_url,
        },
        departments: row.department_id ? {
          id: row.department_id,
          name: row.department_name || row.department,
        } : null,
      };
    });

    res.json(formattedEmployees);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET EMPLOYEE BY ID
router.get("/:id", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.*, d.name AS department_name, 
              u.name AS user_name, u.email AS user_email, u.phone AS user_phone, u.avatar_url AS user_avatar_url
       FROM employees e
       LEFT JOIN users u ON e.user_id = u.id
       LEFT JOIN departments d ON e.department_id = d.id
       WHERE e.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const row = result.rows[0];
    const isHrOrAdmin = req.user.role === "admin" || req.user.role === "hr_manager";
    const isSelf = String(row.user_id) === String(req.user.id);

    const employee = {
      ...row,
      profiles: {
        id: row.user_id,
        full_name: row.name || row.user_name,
        email: row.email || row.user_email,
        phone: row.phone || row.user_phone,
        avatar_url: row.avatar_url || row.user_avatar_url,
      },
      departments: row.department_id ? {
        id: row.department_id,
        name: row.department_name || row.department,
      } : null,
    };

    if (!isHrOrAdmin && !isSelf) {
      delete employee.salary_basic;
    }

    res.json(employee);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// CREATE EMPLOYEE
router.post("/", authorize("admin", "hr_manager"), async (req, res) => {
  try {
    const {
      user_id,
      profile_id,
      employee_code,
      name,
      email,
      department_id,
      department,
      designation,
      employment_type,
      status,
      date_of_joining,
      salary_basic,
      phone,
    } = req.body;

    const finalUserId = user_id || profile_id || null;
    let finalName = name;
    let finalEmail = email;
    let finalPhone = phone;

    // If user_id is provided, fetch missing info from users table
    if (finalUserId) {
      const userRes = await pool.query("SELECT name, email, phone FROM users WHERE id = $1", [finalUserId]);
      if (userRes.rows.length > 0) {
        if (!finalName) finalName = userRes.rows[0].name;
        if (!finalEmail) finalEmail = userRes.rows[0].email;
        if (!finalPhone) finalPhone = userRes.rows[0].phone;
      }
    }

    const finalCode = employee_code || ("EMP-" + Math.floor(100000 + Math.random() * 900000));
    const finalStatus = status || "active";
    const finalType = employment_type || "full_time";

    const result = await pool.query(
      `INSERT INTO employees
       (user_id, employee_code, name, email, department_id, department, designation, employment_type, status, date_of_joining, salary_basic, phone)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        finalUserId,
        finalCode,
        finalName || "",
        finalEmail || "",
        department_id || null,
        department || null,
        designation || null,
        finalType,
        finalStatus,
        date_of_joining || null,
        salary_basic ? parseFloat(salary_basic) : 0,
        finalPhone || null,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// UPDATE EMPLOYEE
router.put("/:id", async (req, res) => {
  try {
    const isHrOrAdmin = req.user.role === "admin" || req.user.role === "hr_manager";

    const currentEmp = await pool.query("SELECT * FROM employees WHERE id = $1", [req.params.id]);
    if (currentEmp.rows.length === 0) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const emp = currentEmp.rows[0];
    const isSelf = String(emp.user_id) === String(req.user.id);

    if (!isHrOrAdmin && !isSelf) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    const {
      user_id,
      profile_id,
      employee_code,
      name,
      email,
      department_id,
      department,
      designation,
      employment_type,
      status,
      date_of_joining,
      salary_basic,
      phone,
    } = req.body;

    // Prevent non-HR/Admin users from changing role-restricted fields
    const finalUserId = isHrOrAdmin ? (user_id || profile_id) : emp.user_id;
    const finalCode = isHrOrAdmin ? employee_code : emp.employee_code;
    const finalDeptId = isHrOrAdmin ? department_id : emp.department_id;
    const finalDept = isHrOrAdmin ? department : emp.department;
    const finalDesignation = isHrOrAdmin ? designation : emp.designation;
    const finalType = isHrOrAdmin ? employment_type : emp.employment_type;
    const finalStatus = isHrOrAdmin ? status : emp.status;
    const finalDateOfJoining = isHrOrAdmin ? date_of_joining : emp.date_of_joining;
    const finalSalaryBasic = isHrOrAdmin ? salary_basic : emp.salary_basic;

    const result = await pool.query(
      `UPDATE employees
       SET
         user_id = COALESCE($1, user_id),
         employee_code = COALESCE($2, employee_code),
         name = COALESCE($3, name),
         email = COALESCE($4, email),
         department_id = $5,
         department = $6,
         designation = COALESCE($7, designation),
         employment_type = COALESCE($8, employment_type),
         status = COALESCE($9, status),
         date_of_joining = $10,
         salary_basic = COALESCE($11, salary_basic),
         phone = COALESCE($12, phone)
       WHERE id = $13
       RETURNING *`,
      [
        finalUserId !== undefined ? finalUserId : emp.user_id,
        finalCode !== undefined ? finalCode : emp.employee_code,
        name !== undefined ? name : emp.name,
        email !== undefined ? email : emp.email,
        finalDeptId !== undefined ? finalDeptId : emp.department_id,
        finalDept !== undefined ? finalDept : emp.department,
        finalDesignation !== undefined ? finalDesignation : emp.designation,
        finalType !== undefined ? finalType : emp.employment_type,
        finalStatus !== undefined ? finalStatus : emp.status,
        finalDateOfJoining !== undefined ? finalDateOfJoining : emp.date_of_joining,
        finalSalaryBasic !== undefined ? (finalSalaryBasic ? parseFloat(finalSalaryBasic) : 0) : emp.salary_basic,
        phone !== undefined ? phone : emp.phone,
        req.params.id,
      ]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE EMPLOYEE
router.delete("/:id", authorize("admin", "hr_manager"), async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM employees WHERE id = $1 RETURNING *",
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Employee not found" });
    }

    res.json({
      success: true,
      message: "Employee deleted successfully",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;