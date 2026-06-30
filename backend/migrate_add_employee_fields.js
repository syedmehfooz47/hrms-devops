require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function migrate() {
  console.log("Starting migration...\n");

  // 1. Add missing columns to employees table
  const newColumns = [
    { name: "date_of_birth", type: "DATE" },
    { name: "address", type: "TEXT" },
    { name: "emergency_contact_name", type: "VARCHAR(255)" },
    { name: "emergency_contact_phone", type: "VARCHAR(20)" },
  ];

  for (const col of newColumns) {
    try {
      await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
      console.log(`✓ Added column employees.${col.name} (${col.type})`);
    } catch (err) {
      console.log(`  Column employees.${col.name} already exists or error: ${err.message}`);
    }
  }

  // 2. Add critical indexes
  const indexes = [
    { name: "idx_employees_user_id", table: "employees", column: "user_id" },
    { name: "idx_employees_status", table: "employees", column: "status" },
    { name: "idx_employees_department_id", table: "employees", column: "department_id" },
    { name: "idx_attendance_employee_id", table: "attendance", column: "employee_id" },
    { name: "idx_attendance_work_date", table: "attendance", column: "work_date" },
    { name: "idx_leave_requests_employee_id", table: "leave_requests", column: "employee_id" },
    { name: "idx_leave_requests_status", table: "leave_requests", column: "status" },
    { name: "idx_payroll_employee_id", table: "payroll", column: "employee_id" },
    { name: "idx_notifications_user_id", table: "notifications", column: "user_id" },
    { name: "idx_documents_employee_id", table: "documents", column: "employee_id" },
    { name: "idx_performance_reviews_employee_id", table: "performance_reviews", column: "employee_id" },
    { name: "idx_performance_goals_employee_id", table: "performance_goals", column: "employee_id" },
    { name: "idx_candidates_job_id", table: "candidates", column: "job_id" },
  ];

  for (const idx of indexes) {
    try {
      await pool.query(`CREATE INDEX IF NOT EXISTS ${idx.name} ON ${idx.table}(${idx.column})`);
      console.log(`✓ Created index ${idx.name} on ${idx.table}(${idx.column})`);
    } catch (err) {
      console.log(`  Index ${idx.name} skipped: ${err.message}`);
    }
  }

  // 3. Add AI columns if missing (from add_ai_columns.sql)
  const aiColumns = [
    { name: "ai_score", type: "INTEGER" },
    { name: "ai_analysis", type: "TEXT" },
    { name: "ai_status", type: "VARCHAR(50)" },
  ];

  for (const col of aiColumns) {
    try {
      await pool.query(`ALTER TABLE candidates ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
      console.log(`✓ Added column candidates.${col.name} (${col.type})`);
    } catch (err) {
      console.log(`  Column candidates.${col.name} skipped: ${err.message}`);
    }
  }

  console.log("\n✅ Migration complete!");
  process.exit(0);
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
