import os
import tempfile
import json
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from groq import Groq
from dotenv import load_dotenv
from sklearn.metrics.pairwise import cosine_similarity

from model_loader import model
from semantic_engine import relevance_score, completeness_score, depth_score
from analysis_engine import analyze_answer

load_dotenv()

app = FastAPI(title="Resume Analyser - Interview Service")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

client        = Groq(api_key=os.environ.get("GROQ_API_KEY"))
LLM_MODEL     = "llama-3.1-8b-instant"
WHISPER_MODEL = "whisper-large-v3"

# ─────────────────────────────────────────
# Question classifier reference embeddings
# Computed ONCE at startup — not per request
# ─────────────────────────────────────────
_behavioral_ref  = model.encode(["tell me about a time describe a situation how did you handle give an example from your experience"])[0]
_technical_ref   = model.encode(["implement design algorithm explain how it works system architecture code optimize complexity"])[0]
_conceptual_ref  = model.encode(["what is the concept define explain the theory difference between overview"])[0]
_REF_MATRIX      = [_behavioral_ref, _technical_ref, _conceptual_ref]
_TYPES           = ["behavioral", "technical", "conceptual"]


# ─────────────────────────────────────────
# Schemas
# ─────────────────────────────────────────
class GenerateQuestionsRequest(BaseModel):
    resume_text:     str
    job_description: str
    num_questions:   Optional[int] = 5


class EvaluateAnswerRequest(BaseModel):
    question:        str
    transcript:      str
    job_description: Optional[str]   = ""
    duration:        Optional[float] = 30


class SaveReportRequest(BaseModel):
    user_id:         Optional[str] = "anonymous"
    job_description: Optional[str] = ""
    questions:       list
    answers:         list


# ─────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────
def parse_json_response(raw: str):
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        lines   = [l for l in cleaned.split('\n') if not l.strip().startswith("```")]
        cleaned = '\n'.join(lines).strip()
    return json.loads(cleaned)


def groq_chat(prompt: str, temperature: float = 0.5) -> str:
    completion = client.chat.completions.create(
        model=LLM_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=temperature,
    )
    return completion.choices[0].message.content or ""


def classify_question(question: str) -> str:
    q_emb  = model.encode([question])
    scores = cosine_similarity(q_emb, _REF_MATRIX)[0]
    return _TYPES[int(scores.argmax())]


VALID_TYPES = {"technical", "behavioral", "conceptual"}

def normalize_question_type(q_type: str) -> str:
    q_type = q_type.lower().strip()
    if q_type in VALID_TYPES:
        return q_type
    if q_type in {"problem-solving", "problem solving", "algorithmic", "coding"}:
        return "technical"
    if q_type in {"situational", "experience", "soft skills"}:
        return "behavioral"
    return "conceptual"

# ─────────────────────────────────────────
# Routes
# ─────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok", "service": "interview"}


@app.post("/generate-questions")
def generate_questions(req: GenerateQuestionsRequest):
    resume_safe = req.resume_text[:3000].replace("```", "")
    jd_safe     = req.job_description[:2000].replace("```", "")

    prompt = f"""
Generate {req.num_questions} interview questions based on the resume and job description below.
Return ONLY valid JSON array, no markdown, no explanation:
[{{"id": 1, "question": "..."}}]

RESUME:
{resume_safe}

JOB DESCRIPTION:
{jd_safe}
"""
    try:
        questions = parse_json_response(groq_chat(prompt))
        # Never trust LLM for type — classify it ourselves
        for i, q in enumerate(questions):
            q["id"]   = i + 1
            q["type"] = classify_question(q.get("question", ""))
        return {"questions": questions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/transcribe")
async def transcribe(audio: UploadFile = File(...)):
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp:
            tmp.write(await audio.read())
            tmp_path = tmp.name

        with open(tmp_path, "rb") as f:
            result = client.audio.transcriptions.create(
                file=(os.path.basename(tmp_path), f),
                model=WHISPER_MODEL,
                response_format="json",
            )
        os.unlink(tmp_path)
        return {"transcript": result.text}

    except Exception as e:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/evaluate-answer")
def evaluate_answer(req: EvaluateAnswerRequest):
    try:
        transcript = req.transcript.strip()

        if not transcript or len(transcript.split()) < 5:
            return {"technicalScore": 0, "clarityScore": 0, "overallScore": 0,
                    "feedback": "Answer too short or unclear"}

        # ── All local, no API ─────────────────────────────────
        analysis = analyze_answer(transcript, req.duration)
        q_type   = classify_question(req.question)

        sem_rel   = relevance_score(transcript, req.job_description)
        sem_comp  = completeness_score(transcript, req.question)
        sem_depth = depth_score(transcript)

        # All inputs 0–1
        struct     = analysis["structure"]["score"]
        star       = analysis["star"]["score"]
        confidence = analysis["confidenceScore"]

        if q_type == "behavioral":
            technical_raw = star * 0.5 + struct * 0.3 + sem_depth * 0.2
        else:
            technical_raw = struct * 0.3 + sem_rel * 0.4 + sem_depth * 0.3

        clarity_raw   = confidence * 0.5 + sem_comp * 0.5

        technical_score = round(technical_raw * 10, 1)
        clarity_score   = round(clarity_raw   * 10, 1)
        overall_score   = round(technical_score * 0.6 + clarity_score * 0.4, 1)

        # ── LLM: wording feedback only ────────────────────────
        try:
            prompt = f"""
You are an interview coach.

Question type: {q_type}
Scores (0–1): structure={struct}, STAR={star}, confidence={confidence},
              relevance={sem_rel}, completeness={sem_comp}, depth={sem_depth}
Rule-based flags: {analysis["feedback"]}

Write:
- 2 specific strengths
- 2 specific improvements
- 1 closing encouragement line
Be concise. Do not mention numbers.
"""
            ai_feedback = groq_chat(prompt, temperature=0.3)
        except Exception:
            ai_feedback = "Good attempt. Focus on structure and include measurable outcomes."

        return {
            "technicalScore": technical_score,
            "clarityScore":   clarity_score,
            "overallScore":   overall_score,
            "questionType":   q_type,
            "semantic": {
                "relevance":    sem_rel,
                "completeness": sem_comp,
                "depth":        sem_depth,
            },
            "metrics":  analysis,
            "feedback": ai_feedback,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/aggregate-scores")
def aggregate_scores(req: SaveReportRequest):
    answers = req.answers
    count   = len(answers) or 1
    return {
        "technicalAvg":   round(sum(a.get("evaluation", {}).get("technicalScore", 0) for a in answers) / count, 1),
        "clarityAvg":     round(sum(a.get("evaluation", {}).get("clarityScore",   0) for a in answers) / count, 1),
        "overallAvg":     round(sum(a.get("evaluation", {}).get("overallScore",   0) for a in answers) / count, 1),
        "totalQuestions": len(answers),
    }