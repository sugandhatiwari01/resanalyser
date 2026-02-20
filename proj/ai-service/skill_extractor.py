import os
import json
import re
from groq import Groq
from dotenv import load_dotenv

load_dotenv()
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

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
        # Safe fallback (never crash matcher)
        return {
            "technical_skills": [],
            "generic_categories": [],
            "tools": []
        }