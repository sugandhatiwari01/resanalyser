import os
import json
import re
from groq import Groq
from dotenv import load_dotenv

load_dotenv()
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

def extract_skills_fallback(text: str):
    """Fallback skill extraction using regex pattern matching"""
    common_skills = {
        "technical_skills": [
            "python", "javascript", "java", "c++", "csharp", "ruby", "go", "rust",
            "typescript", "php", "swift", "kotlin", "scala", "r", "matlab", "perl",
            "html", "css", "sql", "nosql", "json", "xml", "graphql",
            "react", "vue", "angular", "svelte", "next.js", "nuxt",
            "node.js", "express", "fastapi", "django", "flask", "spring",
            "kubernetes", "docker", "jenkins", "git", "gitlab", "github",
            "aws", "azure", "gcp", "heroku", "vercel", "netlify",
            "tensorflow", "pytorch", "keras", "scikit-learn", "pandas", "numpy",
            "mongodb", "postgresql", "mysql", "redis", "elasticsearch",
            "rest api", "graphql api", "microservices", "api design"
        ],
        "tools": [
            "git", "docker", "kubernetes", "jenkins", "gitlab", "github",
            "jira", "confluence", "slack", "trello", "asana",
            "vs code", "intellij", "eclipse", "sublime", "atom",
            "webpack", "babel", "eslint", "prettier", "npm", "yarn", "pip"
        ],
        "generic_categories": [
            "web development", "backend development", "frontend development",
            "full stack development", "mobile development", "devops",
            "database design", "system design", "software architecture",
            "testing", "ci/cd", "agile", "scrum"
        ]
    }

    text_lower = text.lower()
    found_skills = {
        "technical_skills": [],
        "tools": [],
        "generic_categories": []
    }

    for category, skills in common_skills.items():
        for skill in skills:
            if skill in text_lower:
                found_skills[category].append(skill)

    return found_skills

def extract_skills_from_text(text: str):
    text = text[:6000]  # prevent timeout on long resumes

    prompt = f"""
You are a strict ATS skill extraction engine.

CRITICAL RULES:
1. Extract ONLY skills explicitly supported by the text.
2. ALSO extract GENERIC CATEGORIES when clearly implied by evidence.
   Examples:
   - MySQL, MongoDB → category: "databases"
   - REST APIs, API development → category: "apis"
   - Backend projects → category: "backend development"
3. DO NOT invent technologies.
4. DO NOT assume specific tools (e.g., do NOT output Django unless written).
5. Split grouped skills into atomic items:
   "frameworks (Django, Flask)" → ["django", "flask"]
6. Be evidence-grounded only.

Return ONLY valid JSON:
{{
  "technical_skills": [],
  "generic_categories": [],
  "tools": []
}}

Text:
{text}
"""

    try:
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=600
        )

        content = response.choices[0].message.content.strip()

        # Remove ```json wrappers if model adds them
        content = re.sub(r"```json", "", content)
        content = re.sub(r"```", "", content).strip()

        try:
            return json.loads(content)
        except Exception:
            # Fallback to pattern matching
            print("Warning: Could not parse AI response, using fallback extraction")
            return extract_skills_fallback(text)
    except Exception as e:
        # API error - use fallback
        print(f"Warning: Groq API failed ({str(e)}), using fallback skill extraction")
        return extract_skills_fallback(text)
