# Pulse HRMS — Complete User Manual

Pulse HRMS is a modern, self-hosted Human Resource Management System built with a Node/Express.js backend, TanStack Start/Start-Vite frontend, and a PostgreSQL database.

---

## 1. Project Architecture

The application runs as two separate decoupled services:
* **Backend API Server**: Runs on `http://localhost:5000` using Node.js, Express, and PostgreSQL. Handles authentication, databases, business logic, file storage, and AI processing.
* **Frontend Client**: Runs on `http://localhost:8081` (defaulting to this port if 8080 is in use) using React, TanStack Start, TanStack Router, TanStack Query, and Tailwind CSS v4.

---

## 2. Role-Based Access Control (RBAC)

The application enforces strict permission checks on both the client (hiding sidebar menu items and route blockades) and the server (API endpoint guards).

### System Roles
1. **Admin**:
   - Has full access to read and modify all modules.
   - Can register/edit/delete employees, departments, and payroll runs.
   - Automatically assigned to the very first user who signs up in the system.
2. **HR Manager (`hr_manager`)**:
   - Access to employees, departments, recruitment, payroll, leave, documents, and performance reviews.
   - Can generate monthly payroll runs.
3. **Department Manager (`dept_manager`)**:
   - Can access candidate pipeline, job postings, and interviews in Recruitment.
   - Can view the team's attendance board and approve/reject department leave requests.
   - Can assign goals and write performance reviews.
4. **Employee (`employee`)**:
   - Limited view. Can clock in/out, view own logs, and run attendance reports.
   - Can view own payslips.
   - Can apply for leave and cancel own pending requests.
   - Can create and track own performance goals.

> NOTE: **Signup Rule**: The first account created automatically receives the **Admin** role. Subsequent accounts default to the **Employee** role. Admin/HR can update any user's role by editing their profile details.

---

## 3. AI Resume Screener & Parser

The Recruitment module features an integrated AI Resume Screener that analyzes candidate files.

### Configuration
1. To use **real AI analysis**, add your Gemini API Key to `backend/.env`:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```
2. If no key is set, the system automatically runs in **Simulated AI Fallback Mode**. This mode performs real keyword-match analysis on the resume contents against the job description to calculate a match score, recommendations, and missing requirements, meaning it works immediately out-of-the-box!

### How to Use
1. Go to **Recruitment & Onboarding** > **Jobs** tab.
2. Click **Candidate** under a job posting.
3. Enter candidate info and select a Resume file (`.pdf` or `.txt`).
4. Click **Add**. The candidate is created and the AI screening begins automatically.
5. In the **Pipeline** tab, look for the score badge (e.g. `85% Match`) and click **View AI Report** to read the full analysis.

---

## 4. Setup & Running Instructions

### Prerequisites
* **PostgreSQL** installed and running locally.
* **Node.js** (v18+) installed.

### Step-by-Step Setup

#### 1. Setup the Database
Create a PostgreSQL database named `hrms`. From your terminal:
```bash
# Connect to PostgreSQL and create database
psql -U postgres -c "CREATE DATABASE hrms;"

# Run the database schema to load all 15 tables
psql -U postgres -d hrms -f backend/schema.sql

# Update the candidates table with AI fields
psql -U postgres -d hrms -f backend/add_ai_columns.sql
```

#### 2. Configure Environment Variables
Create or open the `backend/.env` file and verify the variables match your database credentials:
```env
DB_USER=postgres
DB_HOST=localhost
DB_NAME=hrms
DB_PASSWORD=Likith
DB_PORT=5432
JWT_SECRET=hrms_secret_key_2024_pulse
PORT=5000
GEMINI_API_KEY=optional_gemini_key_here
```

#### 3. Run the Backend Server
Navigate to the `backend/` folder, install packages, and start the development server:
```bash
cd backend
npm install
npm run dev # Runs nodemon server.js
```
The console will display `Pulse HRMS Backend running on port 5000`.

#### 4. Run the Frontend App
Open a new terminal window in the root directory:
```bash
npm install
npm run dev
```
Open `http://localhost:8081` in your browser.

---

## 5. Troubleshooting & Checks
* **First Login showing as Employee?**
  If you signed up prior to database configuration, your role might be default. You can update your role to Admin directly in psql:
  ```sql
  UPDATE users SET role = 'admin' WHERE email = 'your-email@domain.com';
  ```
* **Vite Port Conflicts**: If port 8080 is in use, Vite will automatically select `8081`. Ensure your browser connects to the port output by the console.
* **Upload Folder**: Files are saved in `backend/uploads/` on the server and are statically served. Make sure this folder is writable.
