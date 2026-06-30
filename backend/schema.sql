-- Pulse HRMS - Complete PostgreSQL Schema
-- Run: psql -U postgres -d hrms -f schema.sql

-- Users (authentication)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'employee',
  phone VARCHAR(20),
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Departments
CREATE TABLE IF NOT EXISTS departments (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Employees
CREATE TABLE IF NOT EXISTS employees (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  employee_code VARCHAR(50) UNIQUE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  department VARCHAR(255),
  designation VARCHAR(255),
  employment_type VARCHAR(50) DEFAULT 'full_time',
  status VARCHAR(50) DEFAULT 'active',
  date_of_joining DATE,
  date_of_birth DATE,
  salary_basic NUMERIC(12,2) DEFAULT 0,
  phone VARCHAR(20),
  address TEXT,
  emergency_contact_name VARCHAR(255),
  emergency_contact_phone VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Attendance
CREATE TABLE IF NOT EXISTS attendance (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
  work_date DATE NOT NULL DEFAULT CURRENT_DATE,
  attendance_date DATE,
  check_in TIMESTAMP,
  check_out TIMESTAMP,
  status VARCHAR(20) DEFAULT 'present',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Leave Requests
CREATE TABLE IF NOT EXISTS leave_requests (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
  leave_type VARCHAR(50) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  approver_id INTEGER REFERENCES users(id),
  approver_note TEXT,
  decided_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Leave Balances
CREATE TABLE IF NOT EXISTS leave_balances (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  leave_type VARCHAR(50) NOT NULL,
  allocated INTEGER DEFAULT 0,
  used INTEGER DEFAULT 0,
  UNIQUE(employee_id, year, leave_type)
);

-- Payroll
CREATE TABLE IF NOT EXISTS payroll (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
  basic_salary NUMERIC(12,2) DEFAULT 0,
  hra NUMERIC(12,2) DEFAULT 0,
  allowances NUMERIC(12,2) DEFAULT 0,
  gross NUMERIC(12,2) DEFAULT 0,
  pf NUMERIC(12,2) DEFAULT 0,
  tax NUMERIC(12,2) DEFAULT 0,
  other_deductions NUMERIC(12,2) DEFAULT 0,
  net_salary NUMERIC(12,2) DEFAULT 0,
  month INTEGER,
  year INTEGER,
  status VARCHAR(20) DEFAULT 'draft',
  working_days INTEGER DEFAULT 30,
  paid_days INTEGER DEFAULT 30,
  processed_by INTEGER REFERENCES users(id),
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Recruitment / Job Postings
CREATE TABLE IF NOT EXISTS recruitment (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255),
  candidate_name VARCHAR(255),
  email VARCHAR(255),
  position VARCHAR(255),
  department_id INTEGER REFERENCES departments(id),
  location VARCHAR(255),
  employment_type VARCHAR(50) DEFAULT 'full_time',
  description TEXT,
  requirements TEXT,
  salary_min NUMERIC(12,2),
  salary_max NUMERIC(12,2),
  status VARCHAR(50) DEFAULT 'open',
  posted_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Candidates
CREATE TABLE IF NOT EXISTS candidates (
  id SERIAL PRIMARY KEY,
  job_id INTEGER REFERENCES recruitment(id) ON DELETE CASCADE,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  resume_url TEXT,
  source VARCHAR(255),
  notes TEXT,
  stage VARCHAR(50) DEFAULT 'applied',
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Interviews
CREATE TABLE IF NOT EXISTS interviews (
  id SERIAL PRIMARY KEY,
  candidate_id INTEGER REFERENCES candidates(id) ON DELETE CASCADE,
  interviewer_id INTEGER REFERENCES users(id),
  scheduled_at TIMESTAMP NOT NULL,
  duration_minutes INTEGER DEFAULT 60,
  mode VARCHAR(50),
  location VARCHAR(255),
  round VARCHAR(100),
  status VARCHAR(20) DEFAULT 'scheduled',
  feedback TEXT,
  rating INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Performance Reviews
CREATE TABLE IF NOT EXISTS performance_reviews (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
  reviewer_id INTEGER REFERENCES users(id),
  period_label VARCHAR(100),
  period_start DATE,
  period_end DATE,
  review_period VARCHAR(100),
  rating NUMERIC(3,1) DEFAULT 0,
  strengths TEXT,
  improvements TEXT,
  feedback TEXT,
  comments TEXT,
  status VARCHAR(20) DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Performance Goals
CREATE TABLE IF NOT EXISTS performance_goals (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  target_date DATE,
  progress INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'not_started',
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Documents
CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
  document_name VARCHAR(255) NOT NULL,
  document_type VARCHAR(100),
  category VARCHAR(100) DEFAULT 'other',
  file_path TEXT,
  mime_type VARCHAR(100),
  size_bytes INTEGER,
  uploaded_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Onboarding Tasks
CREATE TABLE IF NOT EXISTS onboarding_tasks (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  due_date DATE,
  status VARCHAR(20) DEFAULT 'pending',
  position INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  body TEXT,
  link VARCHAR(255),
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
