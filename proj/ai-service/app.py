from flask import Flask, request, jsonify
from dotenv import load_dotenv
import os

from resume_parser import parse_resume
from pdf_parser import extract_text_from_pdf
from matcher import match_resume_with_jd

load_dotenv()
app = Flask(__name__)

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

        return jsonify({
            "extracted_text_preview": extracted_text[:1000],
            "analysis": analysis
        })

    except Exception as e:
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

        return jsonify({
            "match_analysis": result,
            "resume_preview": resume_text[:1000]
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    app.run(host="0.0.0.0", port=port, debug=True)