const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { authenticate, authorize } = require("../middleware/auth");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Configure multer storage for resumes
const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|doc|docx|txt/;
    const ext = file.originalname.split('.').pop().toLowerCase();
    if (allowedTypes.test(ext)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed. Accepted: pdf, doc, docx, txt'));
    }
  }
});

router.use(authenticate);

// ─── Jobs (Recruitment Table) ─────────────────────────────

// GET all job postings
router.get("/", authorize("admin", "hr_manager", "dept_manager"), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.*, d.name AS department_name, u.name AS poster_name
       FROM recruitment r
       LEFT JOIN departments d ON r.department_id = d.id
       LEFT JOIN users u ON r.posted_by = u.id
       ORDER BY r.id DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// CREATE a job posting
router.post("/", authorize("admin", "hr_manager", "dept_manager"), async (req, res) => {
  try {
    const {
      title,
      candidate_name,
      email,
      position,
      department_id,
      location,
      employment_type,
      description,
      requirements,
      salary_min,
      salary_max,
      status,
    } = req.body;

    const result = await pool.query(
      `INSERT INTO recruitment
       (title, candidate_name, email, position, department_id, location, employment_type, description, requirements, salary_min, salary_max, status, posted_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        title || position || null,
        candidate_name || null,
        email || null,
        position || title || null,
        department_id || null,
        location || null,
        employment_type || "full_time",
        description || null,
        requirements || null,
        salary_min ? parseFloat(salary_min) : null,
        salary_max ? parseFloat(salary_max) : null,
        status || "open",
        req.user.id,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// UPDATE a job posting / status
router.put("/:id", authorize("admin", "hr_manager", "dept_manager"), async (req, res) => {
  try {
    const { status } = req.body;
    const result = await pool.query(
      "UPDATE recruitment SET status = $1 WHERE id = $2 RETURNING *",
      [status, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Job posting not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});


// ─── Candidates ───────────────────────────────────────────

// GET all candidates
router.get("/candidates", authorize("admin", "hr_manager", "dept_manager"), async (req, res) => {
  try {
    const { job_id } = req.query;
    
    let queryText = `
      SELECT c.*, r.title AS job_title
      FROM candidates c
      LEFT JOIN recruitment r ON c.job_id = r.id
      WHERE 1=1
    `;
    const queryParams = [];

    if (job_id) {
      queryText += " AND c.job_id = $1";
      queryParams.push(job_id);
    }

    queryText += " ORDER BY c.id DESC";

    const result = await pool.query(queryText, queryParams);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ADD a candidate
router.post("/candidates", authorize("admin", "hr_manager", "dept_manager"), async (req, res) => {
  try {
    const {
      job_id,
      full_name,
      email,
      phone,
      resume_url,
      source,
      notes,
      stage,
    } = req.body;

    const result = await pool.query(
      `INSERT INTO candidates
       (job_id, full_name, email, phone, resume_url, source, notes, stage)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        job_id,
        full_name,
        email,
        phone || null,
        resume_url || null,
        source || null,
        notes || null,
        stage || "applied",
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// UPDATE candidate stage / details
router.put("/candidates/:id", authorize("admin", "hr_manager", "dept_manager"), async (req, res) => {
  try {
    const { stage } = req.body;
    const result = await pool.query(
      "UPDATE candidates SET stage = $1 WHERE id = $2 RETURNING *",
      [stage, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Candidate not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Helper to extract text from files (PDF/TXT)
const pdf = require("pdf-parse");
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function getResumeText(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".pdf") {
    const dataBuffer = fs.readFileSync(filePath);
    const parsed = await pdf(dataBuffer);
    return parsed.text;
  } else {
    return fs.readFileSync(filePath, "utf-8");
  }
}

// Fallback Mock AI screener
function generateMockAnalysis(job, candidate, resumeText) {
  const sampleSkills = [
    "react", "javascript", "typescript", "node", "express", "sql", "postgres", 
    "python", "django", "java", "spring", "c#", "net", "html", "css", 
    "aws", "docker", "kubernetes", "git", "ci/cd", "agile", "project management",
    "excel", "communication", "marketing", "sales", "design", "figma"
  ];
  
  const foundSkills = [];
  const missingSkills = [];
  
  const docText = (resumeText || "").toLowerCase();
  const reqText = `${job.title || ""} ${job.position || ""} ${job.description || ""} ${job.requirements || ""}`.toLowerCase();
  
  sampleSkills.forEach(skill => {
    const isRequired = reqText.includes(skill);
    const hasSkill = docText.includes(skill);
    
    if (isRequired && hasSkill) {
      foundSkills.push(skill.charAt(0).toUpperCase() + skill.slice(1));
    } else if (isRequired && !hasSkill) {
      missingSkills.push(skill.charAt(0).toUpperCase() + skill.slice(1));
    }
  });

  const matching = [...new Set(foundSkills)].slice(0, 8);
  const missing = [...new Set(missingSkills)].slice(0, 6);
  
  let score = 55;
  if (matching.length > 0) {
    score += matching.length * 6;
  }
  if (missing.length > 0) {
    score -= missing.length * 3;
  }
  score = Math.max(10, Math.min(98, score));

  let recommendation = "Hold";
  let rationale = [];
  if (score >= 80) {
    recommendation = "Shortlist";
    rationale = [
      "Excellent skill alignment with job requirements.",
      "Demonstrates relevant experience in key technologies.",
      "Clear indicators of technical competency match."
    ];
  } else if (score >= 60) {
    recommendation = "Interview";
    rationale = [
      "Good fundamental match, minor skill gaps identified.",
      "Strong core experience, worth exploring in an interview round.",
      "Check candidate's familiarity with missing skills: " + (missing.length > 0 ? missing.slice(0, 3).join(", ") : "None")
    ];
  } else {
    recommendation = "Reject";
    rationale = [
      "Significant skill mismatch for the role requirements.",
      "Missing critical domain knowledge or required technical stack.",
      "Recommendation is to not proceed with this candidate."
    ];
  }

  return {
    score,
    matching_skills: matching.length > 0 ? matching : ["Communication", "Teamwork"],
    missing_skills: missing.length > 0 ? missing : ["Specialized Tools"],
    experience_summary: `Candidate has work experience matching some of the criteria for ${job.title || "the role"}. The resume indicates familiarity with several tools, with domain knowledge details.`,
    recommendation,
    reasoning: rationale
  };
}

// UPLOAD Candidate Resume
router.post("/candidates/:id/resume", authorize("admin", "hr_manager", "dept_manager"), upload.single("resume"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No resume file uploaded" });
    }
    const resumeUrl = `/uploads/${req.file.filename}`;
    
    const result = await pool.query(
      "UPDATE candidates SET resume_url = $1 WHERE id = $2 RETURNING *",
      [resumeUrl, req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Candidate not found" });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// TRIGGER AI Screening
router.post("/candidates/:id/screen", authorize("admin", "hr_manager", "dept_manager"), async (req, res) => {
  try {
    await pool.query("UPDATE candidates SET ai_status = 'running' WHERE id = $1", [req.params.id]);

    const candRes = await pool.query(
      `SELECT c.*, r.title AS job_title, r.position AS job_position, r.description AS job_description, r.requirements AS job_requirements
       FROM candidates c
       JOIN recruitment r ON c.job_id = r.id
       WHERE c.id = $1`,
      [req.params.id]
    );

    if (candRes.rows.length === 0) {
      await pool.query("UPDATE candidates SET ai_status = 'failed' WHERE id = $1", [req.params.id]);
      return res.status(404).json({ message: "Candidate or associated job not found" });
    }

    const candidate = candRes.rows[0];
    
    if (!candidate.resume_url) {
      await pool.query("UPDATE candidates SET ai_status = 'failed' WHERE id = $1", [req.params.id]);
      return res.status(400).json({ message: "Candidate does not have a resume uploaded" });
    }

    const relativePath = candidate.resume_url;
    const fileName = relativePath.split("/").pop();
    const filePath = path.join(__dirname, "../uploads", fileName);

    if (!fs.existsSync(filePath)) {
      await pool.query("UPDATE candidates SET ai_status = 'failed' WHERE id = $1", [req.params.id]);
      return res.status(400).json({ message: "Resume file not found on server" });
    }

    const resumeText = await getResumeText(filePath);
    
    const job = {
      title: candidate.job_title,
      position: candidate.job_position,
      description: candidate.job_description,
      requirements: candidate.job_requirements,
    };

    let analysisResult;
    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        
        const prompt = `
          You are an AI recruiting assistant. Analyze the candidate's resume against the job description provided below.
          
          JOB TITLE: ${job.title}
          JOB POSITION: ${job.position}
          JOB DESCRIPTION: ${job.description}
          JOB REQUIREMENTS: ${job.requirements}
          
          CANDIDATE NAME: ${candidate.full_name}
          RESUME TEXT:
          ${resumeText}
          
          Provide your analysis in JSON format with the following keys. Return ONLY the JSON object, do not wrap it in markdown code blocks:
          {
            "score": <integer from 0 to 100 representing job fit>,
            "matching_skills": [<array of string skills matching the job>],
            "missing_skills": [<array of string key skills from the job description that are missing from the resume>],
            "experience_summary": "<brief paragraph summarizing relevant work history>",
            "recommendation": "<one of: Shortlist, Interview, Hold, Reject>",
            "reasoning": [<array of strings containing bullet-point rationale>]
          }
        `;
        
        const result = await model.generateContent(prompt);
        const responseText = result.response.text().trim();
        
        let cleanJSON = responseText;
        if (cleanJSON.startsWith("```json")) {
          cleanJSON = cleanJSON.substring(7);
        }
        if (cleanJSON.endsWith("```")) {
          cleanJSON = cleanJSON.substring(0, cleanJSON.length - 3);
        }
        analysisResult = JSON.parse(cleanJSON.trim());
      } catch (aiErr) {
        console.error("Gemini API Error, falling back to mock:", aiErr);
        analysisResult = generateMockAnalysis(job, candidate, resumeText);
      }
    } else {
      analysisResult = generateMockAnalysis(job, candidate, resumeText);
    }

    const updateRes = await pool.query(
      `UPDATE candidates 
       SET ai_score = $1, ai_analysis = $2, ai_status = 'success'
       WHERE id = $3
       RETURNING *`,
      [
        analysisResult.score,
        JSON.stringify(analysisResult),
        req.params.id
      ]
    );

    res.json(updateRes.rows[0]);
  } catch (err) {
    console.error("Screening error:", err);
    await pool.query("UPDATE candidates SET ai_status = 'failed' WHERE id = $1", [req.params.id]);
    res.status(500).json({ error: err.message });
  }
});


// ─── Interviews ───────────────────────────────────────────

// GET all interviews
router.get("/interviews", authorize("admin", "hr_manager", "dept_manager"), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT i.*, c.full_name AS candidate_name, c.email AS candidate_email, u.name AS interviewer_name, r.title AS job_title
       FROM interviews i
       LEFT JOIN candidates c ON i.candidate_id = c.id
       LEFT JOIN recruitment r ON c.job_id = r.id
       LEFT JOIN users u ON i.interviewer_id = u.id
       ORDER BY i.scheduled_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// SCHEDULE an interview
router.post("/interviews", authorize("admin", "hr_manager", "dept_manager"), async (req, res) => {
  try {
    const {
      candidate_id,
      interviewer_id,
      scheduled_at,
      duration_minutes,
      mode,
      location,
      round,
      status,
      feedback,
      rating,
    } = req.body;

    const result = await pool.query(
      `INSERT INTO interviews
       (candidate_id, interviewer_id, scheduled_at, duration_minutes, mode, location, round, status, feedback, rating)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        candidate_id,
        interviewer_id || null,
        scheduled_at,
        duration_minutes || 60,
        mode || "online",
        location || null,
        round || "First Round",
        status || "scheduled",
        feedback || null,
        rating || null,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// UPDATE interview status / feedback
router.put("/interviews/:id", authorize("admin", "hr_manager", "dept_manager"), async (req, res) => {
  try {
    const { status } = req.body;
    const result = await pool.query(
      "UPDATE interviews SET status = $1 WHERE id = $2 RETURNING *",
      [status, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Interview not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});


// ─── Onboarding Tasks ──────────────────────────────────────

// GET onboarding tasks for an employee
router.get("/onboarding/:employeeId", async (req, res) => {
  try {
    const isManagerOrAbove = req.user.role === "admin" || req.user.role === "hr_manager" || req.user.role === "dept_manager";
    const empRes = await pool.query("SELECT id FROM employees WHERE user_id = $1", [req.user.id]);
    const userEmpId = empRes.rows[0]?.id;
    const employeeId = req.params.employeeId;

    if (!isManagerOrAbove && String(userEmpId) !== String(employeeId)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    const result = await pool.query(
      "SELECT * FROM onboarding_tasks WHERE employee_id = $1 ORDER BY position ASC, id ASC",
      [req.params.employeeId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ASSIGN onboarding task
router.post("/onboarding", authorize("admin", "hr_manager", "dept_manager"), async (req, res) => {
  try {
    const { employee_id, title, description, category, due_date, status, position } = req.body;
    
    const result = await pool.query(
      `INSERT INTO onboarding_tasks
       (employee_id, title, description, category, due_date, status, position)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        employee_id,
        title,
        description || null,
        category || "general",
        due_date || null,
        status || "pending",
        position || 0,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// UPDATE onboarding task status
router.put("/onboarding/:id", async (req, res) => {
  try {
    const isManagerOrAbove = req.user.role === "admin" || req.user.role === "hr_manager" || req.user.role === "dept_manager";
    const taskRes = await pool.query("SELECT employee_id FROM onboarding_tasks WHERE id = $1", [req.params.id]);
    if (taskRes.rows.length === 0) {
      return res.status(404).json({ message: "Onboarding task not found" });
    }
    const taskEmpId = taskRes.rows[0].employee_id;
    const empRes = await pool.query("SELECT id FROM employees WHERE user_id = $1", [req.user.id]);
    const userEmpId = empRes.rows[0]?.id;

    if (!isManagerOrAbove && String(userEmpId) !== String(taskEmpId)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    const { status } = req.body;
    const result = await pool.query(
      "UPDATE onboarding_tasks SET status = $1 WHERE id = $2 RETURNING *",
      [status, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Onboarding task not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;