const express = require("express");
const router = express.Router();

router.post("/", (req, res) => {
  const { resumeSkills = [], jobSkills = [] } = req.body;

  const resumeSet = new Set(resumeSkills.map(s => s.toLowerCase()));
  const jobSet = new Set(jobSkills.map(s => s.toLowerCase()));

  const matched = [...jobSet].filter(skill => resumeSet.has(skill));
  const missing = [...jobSet].filter(skill => !resumeSet.has(skill));

  const matchScore =
    jobSet.size === 0 ? 0 : Math.round((matched.length / jobSet.size) * 100);

  res.json({
    matchScore,
    matchedSkills: matched,
    missingSkills: missing
  });
});

module.exports = router;
