import os
import json
import re
from groq import Groq
from dotenv import load_dotenv
from skill_extractor import extract_skills_from_text

load_dotenv()
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

def normalize_list(skills):
    cleaned = []
    for s in skills:
        if s and isinstance(s, str):
            s = s.lower().strip()
            s = re.sub(r"[^\w\s]", "", s)  # remove punctuation
            if s:
                cleaned.append(s)
    return list(set(cleaned))


def is_directional_match(jd_skill, resume_skills):
    """
    Directional ATS Logic:
    ✔ Generic JD → Specific Resume = MATCH
    ❌ Specific JD → Generic Resume = NO MATCH
    ✔ Exact matches allowed
    """

    jd = jd_skill.lower().strip()

    for res in resume_skills:
        r = res.lower().strip()

        # 1️⃣ Exact match
        if jd == r:
            return True

        # 2️⃣ Generic JD → Specific Resume (ALLOW)
        # Example: "databases" matches "mysql"
        if jd in r:
            return True

        # 3️⃣ Specific JD → Generic Resume (BLOCK)
        # Example: "django" should NOT match "frameworks"
        if r in jd:
            continue

    return False


def match_resume_with_jd(resume_text: str, jd_text: str):
    # 🔹 Step 1: Extract skills (AI but strict)
    resume_data = extract_skills_from_text(resume_text)
    jd_data = extract_skills_from_text(jd_text)

    # 🔹 Step 2: Combine atomic + category skills (NO manual mapping)
    resume_skills = normalize_list(
        resume_data.get("technical_skills", []) +
        resume_data.get("tools", []) +
        resume_data.get("generic_categories", [])
    )

    jd_skills = normalize_list(
        jd_data.get("technical_skills", []) +
        jd_data.get("tools", []) +
        jd_data.get("generic_categories", [])
    )

    # Debug (optional but useful)
    print("RESUME SKILLS:", resume_skills)
    print("JD SKILLS:", jd_skills)

    # 🔹 Step 3: Directional Deterministic Matching
    matched = []
    missing = []

    for jd_skill in jd_skills:
        if is_directional_match(jd_skill, resume_skills):
            matched.append(jd_skill)
        else:
            missing.append(jd_skill)

    # 🔹 Step 4: Mathematical Score (NOT AI guessed)
    if len(jd_skills) == 0:
        match_score = 0
    else:
        match_score = round((len(matched) / len(jd_skills)) * 100)

    # 🔹 Step 5: Structured ATS Reasoning (with fallback)
    reasoning_prompt = f"""
You are an ATS evaluation assistant.

STRICT RULES:
- Use ONLY the provided matched and missing skills
- Do NOT invent personality traits
- Do NOT assume unmentioned technologies
- Be constructive and professional
- Keep output concise

Match Score: {match_score}%
Matched Skills: {matched}
Missing Skills: {missing}

Return ONLY valid JSON:
{{
  "strengths": [],
  "weaknesses": [],
  "final_verdict": ""
}}
"""

    reasoning = {
        "strengths": [],
        "weaknesses": [],
        "final_verdict": ""
    }
    
    try:
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": reasoning_prompt}],
            temperature=0.2,
            max_tokens=300
        )

        content = response.choices[0].message.content.strip()
        content = re.sub(r"```json", "", content)
        content = re.sub(r"```", "", content).strip()

        try:
            reasoning = json.loads(content)
        except:
            reasoning = {
                "strengths": [],
                "weaknesses": [],
                "final_verdict": content
            }
    except Exception as e:
        # Fallback: Generate basic verdict without API
        print(f"Warning: Could not call Groq API: {str(e)}")
        strengths = matched if matched else ["No skills matched"]
        weaknesses = missing if missing else ["All required skills are present"]
        
        if match_score >= 80:
            verdict = f"Strong match ({match_score}%). Candidate has most required skills."
        elif match_score >= 50:
            verdict = f"Moderate match ({match_score}%). Candidate has some experience with required skills."
        else:
            verdict = f"Weak match ({match_score}%). Candidate is missing significant skills."
            
        reasoning = {
            "strengths": strengths,
            "weaknesses": weaknesses,
            "final_verdict": verdict
        }

    return {
        "match_score": match_score,
        "matched_skills": matched,
        "missing_skills": missing,
        "strengths": reasoning.get("strengths", []),
        "weaknesses": reasoning.get("weaknesses", []),
        "final_verdict": reasoning.get("final_verdict", "")
    }