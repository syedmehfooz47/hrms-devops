const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { authenticate } = require("../middleware/auth");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

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

const upload = multer({ storage });

// GET all documents (optionally filtered by employee_id)
router.get("/", authenticate, async (req, res) => {
  try {
    const { employee_id } = req.query;

    let queryText = `
      SELECT d.*, e.name AS employee_name, u.name AS uploader_name
      FROM documents d
      LEFT JOIN employees e ON d.employee_id = e.id
      LEFT JOIN users u ON d.uploaded_by = u.id
      WHERE 1=1
    `;
    const queryParams = [];

    if (employee_id) {
      queryText += " AND d.employee_id = $1";
      queryParams.push(employee_id);
    }

    queryText += " ORDER BY d.id DESC";

    const result = await pool.query(queryText, queryParams);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// UPLOAD a document (handles multipart upload)
router.post("/upload", authenticate, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file was uploaded." });
    }

    const { employee_id, category } = req.body;
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
        employee_id ? parseInt(employee_id) : null,
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
    res.status(500).json({ error: err.message });
  }
});

// DOWNLOAD a document by id
router.get("/download/:id", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM documents WHERE id = $1", [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Document not found" });
    }

    const doc = result.rows[0];
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

// DELETE a document by id
router.delete("/:id", authenticate, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM documents WHERE id = $1", [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Document not found" });
    }

    const doc = result.rows[0];
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