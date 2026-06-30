const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { authenticate } = require("../middleware/auth");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET || "hrms_secret_key_2024_pulse";

// Configure multer storage
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
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|doc|docx|xls|xlsx|csv|txt|png|jpg|jpeg|gif|webp/;
    const ext = file.originalname.split('.').pop().toLowerCase();
    if (allowedTypes.test(ext)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed. Accepted: pdf, doc, docx, xls, xlsx, csv, txt, png, jpg, jpeg, gif, webp'));
    }
  }
});

// GET all documents (filtered by permissions and employee_id)
router.get("/", authenticate, async (req, res) => {
  try {
    const { employee_id } = req.query;
    const isHrOrAdmin = req.user.role === "admin" || req.user.role === "hr_manager";

    let finalEmpId = employee_id;
    if (!isHrOrAdmin) {
      // Force non-admin/HR users to only view their own employee documents
      const empRes = await pool.query("SELECT id FROM employees WHERE user_id = $1", [req.user.id]);
      const userEmpId = empRes.rows[0]?.id;
      if (!userEmpId) {
        return res.json([]);
      }
      finalEmpId = userEmpId;
    }

    let queryText = `
      SELECT d.*, e.name AS employee_name, u.name AS uploader_name
      FROM documents d
      LEFT JOIN employees e ON d.employee_id = e.id
      LEFT JOIN users u ON d.uploaded_by = u.id
      WHERE 1=1
    `;
    const queryParams = [];

    if (finalEmpId) {
      queryText += " AND d.employee_id = $1";
      queryParams.push(parseInt(finalEmpId));
    }

    queryText += " ORDER BY d.id DESC";

    const result = await pool.query(queryText, queryParams);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// UPLOAD a document (handles multipart upload and restricts uploads to authorized targets)
router.post("/upload", authenticate, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file was uploaded." });
    }

    const { employee_id, category } = req.body;
    const isHrOrAdmin = req.user.role === "admin" || req.user.role === "hr_manager";

    let finalEmpId = employee_id;
    if (!isHrOrAdmin) {
      const empRes = await pool.query("SELECT id FROM employees WHERE user_id = $1", [req.user.id]);
      const userEmpId = empRes.rows[0]?.id;
      if (!userEmpId) {
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(403).json({ message: "No employee profile found to upload documents" });
      }
      finalEmpId = userEmpId; // Force own employee profile target
    }

    const document_name = req.file.originalname;
    const document_type = req.file.mimetype;
    const file_path = `uploads/${req.file.filename}`;
    const size_bytes = req.file.size;
    const uploaded_by = req.user.id;

    const result = await pool.query(
      `INSERT INTO documents 
       (employee_id, document_name, document_type, category, file_path, mime_type, size_bytes, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        finalEmpId ? parseInt(finalEmpId) : null,
        document_name,
        document_type,
        category || "other",
        file_path,
        document_type,
        size_bytes,
        uploaded_by,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: err.message });
  }
});

// DOWNLOAD a document by id (requires valid token via header or query parameter)
router.get("/download/:id", async (req, res) => {
  try {
    let token = req.query.token;
    if (!token && req.headers.authorization) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({ message: "No token provided for document download" });
    }

    let user;
    try {
      user = jwt.verify(token, SECRET);
    } catch (err) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    const result = await pool.query("SELECT * FROM documents WHERE id = $1", [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Document not found" });
    }

    const doc = result.rows[0];
    const isHrOrAdmin = user.role === "admin" || user.role === "hr_manager";
    const isOwner = String(doc.uploaded_by) === String(user.id);
    
    let isSelfDoc = false;
    const empRes = await pool.query("SELECT id FROM employees WHERE user_id = $1", [user.id]);
    const userEmpId = empRes.rows[0]?.id;
    if (userEmpId && String(doc.employee_id) === String(userEmpId)) {
      isSelfDoc = true;
    }

    if (!isHrOrAdmin && !isOwner && !isSelfDoc) {
      return res.status(403).json({ message: "Insufficient permissions to download this document" });
    }

    const absolutePath = path.join(__dirname, "../", doc.file_path);

    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ message: "Physical file not found on disk" });
    }

    res.download(absolutePath, doc.document_name);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE a document by id (requires authorization check)
router.delete("/:id", authenticate, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM documents WHERE id = $1", [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Document not found" });
    }

    const doc = result.rows[0];
    const isHrOrAdmin = req.user.role === "admin" || req.user.role === "hr_manager";
    const isOwner = String(doc.uploaded_by) === String(req.user.id);
    
    let isSelfDoc = false;
    const empRes = await pool.query("SELECT id FROM employees WHERE user_id = $1", [req.user.id]);
    const userEmpId = empRes.rows[0]?.id;
    if (userEmpId && String(doc.employee_id) === String(userEmpId)) {
      isSelfDoc = true;
    }

    if (!isHrOrAdmin && !isOwner && !isSelfDoc) {
      return res.status(403).json({ message: "Insufficient permissions to delete this document" });
    }

    const absolutePath = path.join(__dirname, "../", doc.file_path);

    // Delete row from database
    await pool.query("DELETE FROM documents WHERE id = $1", [req.params.id]);

    // Delete file from disk if it exists
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }

    res.json({ success: true, message: "Document deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;