# Pulse HRMS

Pulse HRMS is a modern, self-hosted Human Resource Management System built with a robust **PERN stack** (PostgreSQL, Express, React, Node.js). It features an integrated AI-powered resume screener, comprehensive employee management, payroll processing, and interactive analytics dashboards.

## 🚀 Features

*   **Role-Based Access Control (RBAC):** Strict multi-tier authorization across four system roles: Admin, HR Manager, Department Manager, and Employee.
*   **AI Resume Screener:** Powered by Google Gemini API and `pdf-parse`, automatically analyzes candidate resumes (PDF/TXT) against job requirements to compute match scores, identify missing skills, and provide hiring recommendations. Includes a simulated fallback mode if no API key is provided.
*   **Interactive Analytics:** Real-time dashboards built with Recharts and Tailwind CSS v4 to visualize attendance, payroll distributions, and recruitment funnels.
*   **Automated Reporting:** Client-side export capabilities using `jsPDF` and `SheetJS (XLSX)` for dynamic generation of PDF payslips and Excel data summaries.
*   **Comprehensive HR Modules:**
    *   **Recruitment & Onboarding:** Job postings, candidate pipeline, and onboarding task tracking.
    *   **Employee Management:** Department structuring, goal assignments, and performance reviews.
    *   **Time & Leave:** Attendance clock-in/out, leave requests, and leave balance tracking.
    *   **Payroll:** Monthly payroll runs and automated tax/deduction calculations.

## 🛠️ Tech Stack

### Frontend
*   **React 19**
*   **TanStack Start** (Full-stack React framework)
*   **TanStack Router & Query**
*   **Tailwind CSS v4** & **Radix UI** (Shadcn/ui)
*   **Recharts** (Data visualization)
*   **jsPDF & SheetJS** (Report generation)

### Backend
*   **Node.js & Express.js**
*   **PostgreSQL** (Relational database with 15+ tables)
*   **JSON Web Tokens (JWT)** (Authentication & Authorization)
*   **Google Gemini API** (`@google/generative-ai`)
*   **Multer & pdf-parse** (File uploads and resume parsing)

## 📦 Project Architecture

The application runs as two decoupled services:
*   **Backend API Server:** Runs on `http://localhost:5000`. Handles authentication, database operations, file storage, and AI processing.
*   **Frontend Client:** Runs on `http://localhost:8081` (or 8080).

## ⚙️ Setup & Installation

### Prerequisites
*   Node.js (v18+)
*   PostgreSQL installed and running locally

### 1. Database Setup
Create a PostgreSQL database named `hrms` and run the provided schema scripts:
```bash
# Connect to PostgreSQL and create database
psql -U postgres -c "CREATE DATABASE hrms;"

# Run the database schema to load all tables
psql -U postgres -d hrms -f backend/schema.sql

# Update the candidates table with AI fields
psql -U postgres -d hrms -f backend/add_ai_columns.sql
```

### 2. Backend Configuration
Create a `.env` file in the `backend/` directory:
```env
DB_USER=postgres
DB_HOST=localhost
DB_NAME=hrms
DB_PASSWORD=your_database_password
DB_PORT=5432
JWT_SECRET=your_jwt_secret_key
PORT=5000
GEMINI_API_KEY=your_gemini_api_key_here # Optional: For real AI analysis
```

Start the backend server:
```bash
cd backend
npm install
npm run dev
```

### 3. Frontend Configuration
Open a new terminal in the root directory:
```bash
npm install
npm run dev
```
Access the application at `http://localhost:8081`.

## 📝 User Roles

1.  **Admin:** Full system access. Automatically assigned to the first registered user.
2.  **HR Manager:** Access to employees, departments, recruitment, payroll, leave, and documents.
3.  **Department Manager:** Access to team attendance, leave approvals, recruitment pipelines, and performance reviews.
4.  **Employee:** Can view own logs, apply for leave, clock in/out, and track personal goals.

*Note: You can manually upgrade a user to an Admin directly in the database:*
```sql
UPDATE users SET role = 'admin' WHERE email = 'your-email@domain.com';
```
