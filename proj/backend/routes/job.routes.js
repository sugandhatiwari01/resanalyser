const express = require("express");
const router = express.Router();

const SKILLS = [
  "python", "java", "c++", "javascript", "react",
  "node", "express", "mongodb", "sql",
  "html", "css", "git", "docker"
];

const SKILL_ALIASES = {
  "javascript": ["javascript", "java script", "js", "ecmascript"],
  "react": ["react", "reactjs", "react.js"],
  "node": ["node", "nodejs", "node.js"],
  "express": ["express", "expressjs", "express.js"],
  "mongodb": ["mongodb", "mongo db", "mongo"],
  "sql": ["sql", "mysql", "postgresql", "postgres", "sqlite"],
  "html": ["html", "html5"],
  "css": ["css", "css3"],
  "python": ["python"],
  "java": ["java"],
  "c++": ["c++", "cpp", "c plus plus"],
  "git": ["git", "github", "gitlab"],
  "docker": ["docker", "container", "containers"],
  "rest api": ["rest", "rest api", "restful", "api integration", "apis"],
  "typescript": ["typescript", "ts"],
};

function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/\n/g, " ")
    .replace(/[()]/g, " ")
    .replace(/[,/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractSkillsFromText(text) {
  const normalized = normalizeText(text);
  const found = new Set();

  for (const [canonical, aliases] of Object.entries(SKILL_ALIASES)) {
    for (const alias of aliases) {
      // regex word boundary matching (works better than includes)
      const pattern = new RegExp(`\\b${alias.replace(".", "\\.")}\\b`, "i");
      if (pattern.test(normalized)) {
        found.add(canonical);
        break;
      }
    }
  }

  return Array.from(found);
}

router.post("/extract-skills", (req, res) => {
  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ error: "No job description text provided" });
  }

  const skills = extractSkillsFromText(text);

  res.json({ skills });
});

module.exports = router;
