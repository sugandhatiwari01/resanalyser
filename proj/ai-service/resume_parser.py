import os
import json
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

def parse_resume(text: str):
    text = text[:7000]  # prevent timeout on long resumes

    prompt = f"""
You are an advanced ATS Resume Analyzer.

Analyze the resume and extract structured information.

STRICT INSTRUCTIONS:
- Extract ALL skills mentioned in the resume
- Categorize technical skills into:
  - languages
  - frameworks
  - databases
  - tools
- Detect soft skills separately
- Do NOT hallucinate skills
- Use only what exists in resume
- Return ONLY valid JSON

Return format:
{{
  "skills": {{
    "languages": [],
    "frameworks": [],
    "databases": [],
    "tools": []
  }},
  "soft_skills": [],
  "strengths": [],
  "summary": ""
}}

Resume:
{text}
"""

    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
        max_tokens=900
    )

    content = response.choices[0].message.content.strip()

    try:
        return json.loads(content)
    except:
        return {
            "skills": {
                "languages": [],
                "frameworks": [],
                "databases": [],
                "tools": []
            },
            "soft_skills": [],
            "strengths": [],
            "summary": "",
            "raw_output": content
        }