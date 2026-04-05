// backend/routes/interview.js
// Thin proxy — all AI logic lives in the Python FastAPI service
// Node only handles: file forwarding, MongoDB persistence, auth

const express = require("express");
const router = express.Router();
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const Interview = require("../models/Interview");

const PYTHON_URL = process.env.INTERVIEW_SERVICE_URL || "http://localhost:8001";
const upload = multer({ dest: "uploads/audio/" });


// ── POST /api/interview/generate-questions ──────────────────
router.post("/generate-questions", async (req, res) => {
  const { resumeText, jobDescription, numQuestions = 5 } = req.body;
  if (!resumeText || !jobDescription)
    return res.status(400).json({ error: "resumeText and jobDescription required." });

  try {
    const { data } = await axios.post(`${PYTHON_URL}/generate-questions`, {
      resume_text: resumeText,
      job_description: jobDescription,
      num_questions: numQuestions,
    });
    res.json(data);
  } catch (err) {
    const msg = err.response?.data?.detail || err.message;
    res.status(500).json({ error: msg });
  }
});


// ── POST /api/interview/transcribe ──────────────────────────
// Receives audio from browser, forwards multipart to Python
router.post("/transcribe", upload.single("audio"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No audio file." });

  const form = new FormData();
  form.append("audio", fs.createReadStream(req.file.path), {
    filename: req.file.originalname || "answer.webm",
    contentType: req.file.mimetype || "audio/webm",
  });

  try {
    const { data } = await axios.post(`${PYTHON_URL}/transcribe`, form, {
      headers: form.getHeaders(),
      maxBodyLength: Infinity,
    });
    fs.unlinkSync(req.file.path);
    res.json(data);
  } catch (err) {
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    const msg = err.response?.data?.detail || err.message;
    res.status(500).json({ error: msg });
  }
});


// ── POST /api/interview/evaluate-answer ─────────────────────
router.post("/evaluate-answer", async (req, res) => {
  const { question, transcript, jobDescription } = req.body;
  if (!question || !transcript)
    return res.status(400).json({ error: "question and transcript required." });

  try {
    const { data } = await axios.post(`${PYTHON_URL}/evaluate-answer`, {
      question,
      transcript,
      job_description: jobDescription || "",
    });
    res.json(data);
  } catch (err) {
    const msg = err.response?.data?.detail || err.message;
    res.status(500).json({ error: msg });
  }
});


// ── POST /api/interview/save-report ─────────────────────────
router.post("/save-report", async (req, res) => {
  const { userId, jobDescription, questions, answers } = req.body;
  if (!questions || !answers)
    return res.status(400).json({ error: "questions and answers required." });

  try {
    // Get aggregate scores from Python
    const { data: scoreData } = await axios.post(`${PYTHON_URL}/aggregate-scores`, {
      answers,
      questions,
      job_description: jobDescription || "",
    });

    const report = new Interview({
      userId: userId || "anonymous",
      jobDescription,
      questions,
      answers,
      aggregateScore: scoreData,
      createdAt: new Date(),
    });
    await report.save();

    res.json({ reportId: report._id, aggregateScore: scoreData });
  } catch (err) {
    const msg = err.response?.data?.detail || err.message;
    res.status(500).json({ error: msg });
  }
});


// ── GET /api/interview/report/:id ───────────────────────────
router.get("/report/:reportId", async (req, res) => {
  try {
    const report = await Interview.findById(req.params.reportId);
    if (!report) return res.status(404).json({ error: "Report not found." });
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch report." });
  }
});


module.exports = router;
