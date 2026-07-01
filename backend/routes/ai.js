const express = require("express");
const router = express.Router();
const { authenticate, authorize } = require("../middleware/auth");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const pdf = require("pdf-parse");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Multer config — store in temp, clean up after processing
const uploadDir = path.join(__dirname, "../uploads/temp");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "screen_" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|txt|doc|docx/;
    const ext = file.originalname.split(".").pop().toLowerCase();
    if (allowedTypes.test(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, TXT, DOC, and DOCX files are accepted."));
    }
  },
});

// Helper — extract text from uploaded file
async function extractText(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".pdf") {
    const dataBuffer = fs.readFileSync(filePath);
    const parsed = await pdf(dataBuffer);
    return parsed.text;
  }
  // For .txt, .doc, .docx fallback to raw text
  return fs.readFileSync(filePath, "utf-8");
}

// Helper — clean up temp file
function cleanupFile(filePath) {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (e) {
    console.error("Temp file cleanup error:", e.message);
  }
}

// POST /api/ai/screen-resume
router.post(
  "/screen-resume",
  authenticate,
  authorize("admin", "hr_manager"),
  upload.single("resume"),
  async (req, res) => {
    let filePath = null;

    try {
      const { job_title, job_description } = req.body;

      if (!req.file) {
        return res.status(400).json({ success: false, message: "Please upload a resume file (PDF or TXT)." });
      }
      if (!job_title || !job_description) {
        cleanupFile(req.file.path);
        return res.status(400).json({ success: false, message: "Job title and description are required." });
      }

      filePath = req.file.path;

      // 1. Extract resume text
      const resumeText = await extractText(filePath);
      if (!resumeText || resumeText.trim().length < 20) {
        cleanupFile(filePath);
        return res.status(400).json({ success: false, message: "Could not extract enough text from the resume. Please try a different file." });
      }

      // 2. Call Gemini
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        cleanupFile(filePath);
        return res.status(500).json({ success: false, message: "Gemini API key is not configured on the server." });
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      const prompt = `You are an expert AI recruiting assistant. Analyze the candidate's resume against the job description provided.

JOB TITLE: ${job_title}
JOB DESCRIPTION:
${job_description}

RESUME TEXT:
${resumeText.substring(0, 8000)}

Provide your analysis as a valid JSON object with these exact keys. Return ONLY the JSON, no markdown fences, no extra text:
{
  "score": <integer 0-100 representing overall job fit>,
  "matching_skills": [<array of skills found in resume that match the job>],
  "missing_skills": [<array of important job skills NOT found in resume>],
  "experience_summary": "<one paragraph summarizing relevant work experience>",
  "recommendation": "<exactly one of: Shortlist, Interview, Hold, Reject>",
  "reasoning": [<array of 3-5 bullet-point strings explaining the recommendation>]
}`;

      const result = await model.generateContent(prompt);
      const responseText = result.response.text().trim();

      // Parse JSON (strip markdown fences if present)
      let cleanJSON = responseText;
      if (cleanJSON.startsWith("```json")) cleanJSON = cleanJSON.substring(7);
      if (cleanJSON.startsWith("```")) cleanJSON = cleanJSON.substring(3);
      if (cleanJSON.endsWith("```")) cleanJSON = cleanJSON.substring(0, cleanJSON.length - 3);
      cleanJSON = cleanJSON.trim();

      let analysis;
      try {
        analysis = JSON.parse(cleanJSON);
      } catch (parseErr) {
        console.error("AI response parse error:", parseErr.message, "\nRaw:", responseText);
        cleanupFile(filePath);
        return res.status(500).json({
          success: false,
          message: "The AI returned an unparseable response. Please try again.",
        });
      }

      // 3. Clean up and respond
      cleanupFile(filePath);

      res.json({
        success: true,
        analysis: {
          score: analysis.score || 0,
          matching_skills: analysis.matching_skills || [],
          missing_skills: analysis.missing_skills || [],
          experience_summary: analysis.experience_summary || "",
          recommendation: analysis.recommendation || "Hold",
          reasoning: analysis.reasoning || [],
        },
      });
    } catch (err) {
      if (filePath) cleanupFile(filePath);
      console.error("Resume screening error:", err);
      res.status(500).json({ success: false, message: "An error occurred during resume screening.", error: err.message });
    }
  }
);
// POST /api/ai/generate-jd
router.post(
  "/generate-jd",
  authenticate,
  authorize("admin", "hr_manager"),
  async (req, res) => {
    try {
      const { job_title, notes, department, employment_type } = req.body;

      if (!job_title || !job_title.trim()) {
        return res.status(400).json({ success: false, message: "Job title is required." });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ success: false, message: "Gemini API key is not configured on the server." });
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      const prompt = `You are an expert HR content writer. Generate a complete, professional job description based on the information below.

JOB TITLE: ${job_title.trim()}
${department ? `DEPARTMENT: ${department}` : ""}
${employment_type ? `EMPLOYMENT TYPE: ${employment_type}` : ""}
${notes ? `ADDITIONAL NOTES/BULLET POINTS FROM THE HIRING MANAGER:\n${notes}` : ""}

Generate a comprehensive and professional job description. Return ONLY a valid JSON object with these exact keys, no markdown fences, no extra text:
{
  "title": "<polished job title>",
  "summary": "<2-3 sentence role overview>",
  "responsibilities": ["<array of 6-8 key responsibility bullet points>"],
  "requirements": ["<array of 5-7 required qualifications and skills>"],
  "preferred": ["<array of 3-4 preferred/nice-to-have qualifications>"],
  "benefits": ["<array of 4-5 typical benefits/perks>"]
}`;

      const result = await model.generateContent(prompt);
      const responseText = result.response.text().trim();

      // Parse JSON (strip markdown fences if present)
      let cleanJSON = responseText;
      if (cleanJSON.startsWith("```json")) cleanJSON = cleanJSON.substring(7);
      if (cleanJSON.startsWith("```")) cleanJSON = cleanJSON.substring(3);
      if (cleanJSON.endsWith("```")) cleanJSON = cleanJSON.substring(0, cleanJSON.length - 3);
      cleanJSON = cleanJSON.trim();

      let jd;
      try {
        jd = JSON.parse(cleanJSON);
      } catch (parseErr) {
        console.error("AI JD parse error:", parseErr.message, "\nRaw:", responseText);
        return res.status(500).json({ success: false, message: "The AI returned an unparseable response. Please try again." });
      }

      res.json({
        success: true,
        jd: {
          title: jd.title || job_title,
          summary: jd.summary || "",
          responsibilities: jd.responsibilities || [],
          requirements: jd.requirements || [],
          preferred: jd.preferred || [],
          benefits: jd.benefits || [],
        },
      });
    } catch (err) {
      console.error("JD generation error:", err);
      res.status(500).json({ success: false, message: "An error occurred during JD generation.", error: err.message });
    }
  }
);

module.exports = router;
