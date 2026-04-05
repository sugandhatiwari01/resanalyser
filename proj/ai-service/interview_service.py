# python_service/interview_service.py
# FastAPI microservice for Mock Interview Module
# Handles: question generation, Whisper transcription, answer evaluation
# Run with: uvicorn interview_service:app --reload --port 8000

import os
import tempfile
import json
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from groq import Groq
from dotenv import load_dotenv
load_dotenv()
app = FastAPI(title="Resume Analyser - Interview Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten in production
    allow_methods=["*"],
    allow_headers=["*"],
)

client = Groq(api_key=os.environ.get("GROQ_API_KEY"))
LLM_MODEL = "llama-3.1-8b-instant"
WHISPER_MODEL = "whisper-large-v3"


# ─────────────────────────────────────────────────────────────
# Pydantic schemas
# ─────────────────────────────────────────────────────────────

class GenerateQuestionsRequest(BaseModel):
    resume_text: str
    job_description: str
    num_questions: Optional[int] = 5


class EvaluateAnswerRequest(BaseModel):
    question: str
    transcript: str
    job_description: Optional[str] = ""


class SaveReportRequest(BaseModel):
    user_id: Optional[str] = "anonymous"
    job_description: Optional[str] = ""
    questions: list
    answers: list


# ─────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────

def parse_json_response(raw: str) -> dict | list:
    """Strip markdown fences and parse JSON safely."""
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("```")[1]
        if cleaned.startswith("json"):
            cleaned = cleaned[4:]
    cleaned = cleaned.strip()
    return json.loads(cleaned)


def groq_chat(prompt: str, temperature: float = 0.7) -> str:
    completion = client.chat.completions.create(
        model=LLM_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=temperature,
    )
    return completion.choices[0].message.content or ""


# ─────────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "service": "interview"}


@app.post("/generate-questions")
def generate_questions(req: GenerateQuestionsRequest):
    """
    Generate interview questions tailored to the resume and JD.
    Returns a list of { id, type, question } objects.
    """
    prompt = f"""
You are an expert technical interviewer.

Given the following resume and job description, generate exactly {req.num_questions} interview questions.
Mix technical questions (based on required skills in the JD) and behavioral questions.

Return ONLY a valid JSON array with this exact shape — no extra text, no markdown:
[
  {{"id": 1, "type": "technical", "question": "..."}},
  {{"id": 2, "type": "behavioral", "question": "..."}}
]

RESUME:
{req.resume_text}

JOB DESCRIPTION:
{req.job_description}
""".strip()

    try:
        raw = groq_chat(prompt, temperature=0.7)
        questions = parse_json_response(raw)
        if not isinstance(questions, list):
            raise ValueError("Response is not a list")
        return {"questions": questions}
    except (json.JSONDecodeError, ValueError) as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse questions: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Groq error: {str(e)}")


@app.post("/transcribe")
async def transcribe(audio: UploadFile = File(...)):
    """
    Transcribe audio using Groq Whisper.
    Accepts webm/ogg/mp4 audio from the browser MediaRecorder.
    """
    # Save upload to a temp file — Groq SDK needs a real file path
    suffix = ".webm"
    if audio.filename:
        ext = os.path.splitext(audio.filename)[-1]
        if ext in (".ogg", ".mp4", ".wav", ".m4a"):
            suffix = ext

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = await audio.read()
            tmp.write(content)
            tmp_path = tmp.name

        with open(tmp_path, "rb") as f:
            transcription = client.audio.transcriptions.create(
                file=(os.path.basename(tmp_path), f),
                model=WHISPER_MODEL,
                response_format="json",
            )

        os.unlink(tmp_path)
        return {"transcript": transcription.text}

    except Exception as e:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")


@app.post("/evaluate-answer")
def evaluate_answer(req: EvaluateAnswerRequest):
    """
    Evaluate a candidate's transcribed answer using Groq LLM.
    Returns scores, strengths, improvements, and feedback.
    """
    prompt = f"""
You are a strict technical interview evaluator.

Job Description: {req.job_description or "Not provided"}
Question: {req.question}
Candidate Answer: {req.transcript}

STRICT RULES:
- If transcript is empty, "you", or under 10 words — score everything 0. No exceptions.
- Score ONLY on technical keywords and concepts actually present in the answer.
- Vague answers with no keywords = 1-2 max.

SCORING:
0 = empty/gibberish, 1-2 = no keywords, 3-4 = 1-2 keywords no explanation,
5-6 = keywords with partial explanation, 7-8 = clear explanation with keywords,
9-10 = comprehensive with examples

Return ONLY valid JSON, no markdown:
{{
  "technicalScore": <0-10>,
  "clarityScore": <0-10>,
  "overallScore": <0-10>,
  "keywords_detected": [],
  "keywords_missing": [],
  "strengths": [],
  "improvements": [],
  "feedback": "strict one paragraph"
}}
""".strip()

    try:
        raw = groq_chat(prompt, temperature=0.4)
        evaluation = parse_json_response(raw)
        return evaluation
    except (json.JSONDecodeError, ValueError) as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse evaluation: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Groq error: {str(e)}")


@app.post("/aggregate-scores")
def aggregate_scores(req: SaveReportRequest):
    """
    Compute aggregate scores from all answers.
    Called by Node backend before saving to MongoDB.
    """
    answers = req.answers
    count = len(answers) or 1

    total_tech = sum(a.get("evaluation", {}).get("technicalScore", 0) for a in answers)
    total_clarity = sum(a.get("evaluation", {}).get("clarityScore", 0) for a in answers)
    total_overall = sum(a.get("evaluation", {}).get("overallScore", 0) for a in answers)

    return {
        "technicalAvg": round(total_tech / count, 1),
        "clarityAvg": round(total_clarity / count, 1),
        "overallAvg": round(total_overall / count, 1),
        "totalQuestions": len(answers),
    }
