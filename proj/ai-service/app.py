from dotenv import load_dotenv
import os

load_dotenv()
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import os
from analysis_engine import analyze_answer
from resume_parser import parse_resume
from pdf_parser import extract_text_from_pdf
from matcher import match_resume_with_jd

load_dotenv()
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)


@app.route("/", methods=["GET"])
def home():
    return jsonify({"message": "AI Resume Analysis Service Running"})


# 🔹 Text Resume Analysis
@app.route("/parse-resume", methods=["POST"])
def analyze_resume():
    try:
        data = request.get_json()
        text = data.get("text", "")

        if not text:
            return jsonify({"error": "No resume text provided"}), 400

        result = parse_resume(text)
        return jsonify(result)

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# 🔹 PDF Resume Analysis
@app.route("/analyze-pdf", methods=["POST"])
def analyze_pdf():
    try:
        if "file" not in request.files:
            return jsonify({"error": "No file uploaded"}), 400

        file = request.files["file"]

        extracted_text = extract_text_from_pdf(file)

        if not extracted_text.strip():
            return jsonify({"error": "Could not extract text"}), 400

        analysis = parse_resume(extracted_text)

        return jsonify(
            {"extracted_text_preview": extracted_text[:1000], "analysis": analysis}
        )

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# 🔥 NEW: Interview Answer Analysis
@app.route("/analyze-answer", methods=["POST"])
def analyze_interview_answer():
    try:
        data = request.get_json()

        transcript = data.get("transcript", "")
        duration = data.get("duration", 0)

        if not transcript:
            return jsonify({"error": "Transcript is required"}), 400

        result = analyze_answer(transcript, duration)

        return jsonify({"analysis": result})

    except Exception as e:
        import traceback

        print("ERROR in /analyze-answer:", str(e))
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 500


# 🔥 FINAL: Hybrid ATS (PDF + JD)
@app.route("/match-pdf-jd", methods=["POST"])
def match_pdf_jd():
    try:
        if "file" not in request.files:
            return jsonify({"error": "No PDF uploaded"}), 400

        jd_text = request.form.get("jd", "")
        if not jd_text:
            return jsonify({"error": "Job Description is required"}), 400

        file = request.files["file"]
        resume_text = extract_text_from_pdf(file)

        result = match_resume_with_jd(resume_text, jd_text)

        return jsonify({"match_analysis": result, "resume_preview": resume_text[:1000]})

    except Exception as e:
        import traceback

        print(f"ERROR in /match-pdf-jd: {str(e)}")
        print(traceback.format_exc())
        return jsonify({"error": str(e), "type": type(e).__name__}), 500


# Replace the 3 stub routes in ai-service/app.py with these:


@app.route("/interview/generate-questions", methods=["POST"])
def generate_questions():
    try:
        from interview_service import (
            generate_questions as _gen,
            GenerateQuestionsRequest,
        )

        data = request.get_json()
        req = GenerateQuestionsRequest(
            resume_text=data.get("resumeText", data.get("resume", "")),
            job_description=data.get("jobDescription", data.get("job_description", "")),
            num_questions=int(data.get("numQuestions", data.get("num_questions", 5))),
        )
        result = _gen(req)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/interview/transcribe", methods=["POST"])
def transcribe():
    import asyncio, tempfile, os
    from interview_service import transcribe as _transcribe
    from werkzeug.datastructures import FileStorage

    try:
        if "audio" not in request.files:
            return jsonify({"error": "No audio file uploaded"}), 400

        file: FileStorage = request.files["audio"]

        # Save to temp file so the async FastAPI handler can read it
        suffix = os.path.splitext(file.filename or "answer.webm")[1] or ".webm"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            file.save(tmp.name)
            tmp_path = tmp.name

        # interview_service.transcribe is async — run it synchronously
        from fastapi import UploadFile
        import io

        with open(tmp_path, "rb") as f:
            audio_bytes = f.read()
        os.unlink(tmp_path)

        # Call Groq Whisper directly (same logic as interview_service)
        from groq import Groq
        from dotenv import load_dotenv

        load_dotenv()
        client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp2:
            tmp2.write(audio_bytes)
            tmp2_path = tmp2.name

        with open(tmp2_path, "rb") as f:
            result = client.audio.transcriptions.create(
                file=(os.path.basename(tmp2_path), f),
                model="whisper-large-v3",
                response_format="json",
            )
        os.unlink(tmp2_path)
        return jsonify({"transcript": result.text})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/interview/evaluate-answer", methods=["POST"])
def evaluate_answer():
    try:
        from interview_service import evaluate_answer as _eval, EvaluateAnswerRequest

        data = request.get_json()
        req = EvaluateAnswerRequest(
            question=data.get("question", ""),
            transcript=data.get("transcript", ""),
            job_description=data.get("jobDescription", data.get("job_description", "")),
            duration=float(data.get("duration", 30)),
        )
        result = _eval(req)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/interview/save-report", methods=["POST"])
def save_report():
    try:
        data = request.get_json()
        answers = data.get("answers", [])
        count = len(answers) or 1
        tech_avg = round(
            sum(a.get("evaluation", {}).get("technicalScore", 0) for a in answers)
            / count,
            1,
        )
        clarity_avg = round(
            sum(a.get("evaluation", {}).get("clarityScore", 0) for a in answers)
            / count,
            1,
        )
        overall_avg = round(
            sum(a.get("evaluation", {}).get("overallScore", 0) for a in answers)
            / count,
            1,
        )
        import time

        return jsonify(
            {
                "reportId": f"report_{int(time.time())}",
                "aggregateScore": {
                    "technicalAvg": tech_avg,
                    "clarityAvg": clarity_avg,
                    "overallAvg": overall_avg,
                    "totalQuestions": len(answers),
                },
            }
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    app.run(host="0.0.0.0", port=port, debug=True)
