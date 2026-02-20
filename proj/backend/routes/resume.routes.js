const express = require("express");
const router = express.Router();
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");

// memory storage (no disk save)
const upload = multer({ storage: multer.memoryStorage() });

router.post("/parse-pdf", upload.single("file"), async (req, res) => {  try {
    if (!req.file) {
      return res.status(400).json({ error: "No PDF file uploaded" });
    }

    // Create FormData to send to Flask
    const formData = new FormData();
    formData.append("file", req.file.buffer, req.file.originalname);

    // Send to Flask AI service
    const flaskResponse = await axios.post(
      "http://127.0.0.1:8000/analyze-pdf",
      formData,
      {
        headers: formData.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    );

    // Return Flask result to frontend
    res.json(flaskResponse.data);

  } catch (error) {
    console.error("PDF Proxy Error:", error.message);
    res.status(500).json({ error: "PDF parsing failed at proxy" });
  }
});
router.post("/match-pdf-jd", upload.any(), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No PDF uploaded" });
    }

    const file = req.files[0];
    const jd = req.body.jd;

    if (!jd) {
      return res.status(400).json({ error: "Job Description is required" });
    }

    const formData = new FormData();
    formData.append("file", file.buffer, file.originalname);
    formData.append("jd", jd);

    const flaskResponse = await axios.post(
      "http://127.0.0.1:8000/match-pdf-jd",
      formData,
      {
        headers: formData.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    );

    res.json(flaskResponse.data);

  } catch (error) {
    console.error("JD Match Proxy Error:", error.message);
    res.status(500).json({ error: "JD matching failed" });
  }
});

module.exports = router;