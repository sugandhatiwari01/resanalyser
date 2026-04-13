// pages/MockInterview.jsx
// Main page — orchestrates question generation, recording, evaluation, report
// Props: resumeText (string), jobDescription (string) — passed from ATS results page

import { useState } from "react";
import { useMockInterview } from "../hooks/useMockInterview";
import VideoRecorder from "../components/VideoRecorder";
import AnswerEvaluationCard from "../components/AnswerEvaluationCard";

import { useLocation } from "react-router-dom";

export default function MockInterview() {
  const location = useLocation();
  const resumeText = location.state?.resumeText || "";
  const jobDescription = location.state?.jobDescription || "";  const {
    step,
    questions,
    currentIndex,
    currentQuestion,
    answers,
    reportId,
    aggregateScore,
    error,
    generateQuestions,
    submitAnswer,
    reset,
  } = useMockInterview();

  const [numQuestions, setNumQuestions] = useState(5);
  const [pendingAudio, setPendingAudio] = useState(null); // audio blob from recorder
  const [submitted, setSubmitted] = useState(false);

  const handleRecordingComplete = (audioBlob) => {
    setPendingAudio(audioBlob);
    setSubmitted(false);
  };

  const handleSubmitAnswer = async () => {
    if (!pendingAudio) return;
    setSubmitted(true);
    setPendingAudio(null);
    await submitAnswer(pendingAudio, jobDescription);
    setSubmitted(false);
  };

  // ── STEP: idle ──────────────────────────────
  if (step === "idle") {
    return (
      <div style={styles.container}>
        <h2 style={styles.heading}>🎙️ Mock Interview Simulator</h2>
        <p style={styles.subtext}>
          AI will generate tailored interview questions from your resume and job description,
          then evaluate your recorded answers for technical depth and communication clarity.
        </p>

        {(!resumeText || !jobDescription) && (
          <div style={styles.warning}>
            ⚠️ Please complete the resume analysis first so your resume text and job description
            are available here.
          </div>
        )}

        <div style={styles.card}>
          <label style={styles.label}>Number of Questions</label>
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            {[3, 5, 7, 10].map((n) => (
              <button
                key={n}
                onClick={() => setNumQuestions(n)}
                style={{
                  ...styles.chipBtn,
                  background: numQuestions === n ? "#4f46e5" : "#edf2f7",
                  color: numQuestions === n ? "#fff" : "#4a5568",
                }}
              >
                {n}
              </button>
            ))}
          </div>

          <button
            style={styles.primaryBtn}
            disabled={!resumeText || !jobDescription}
            onClick={() => generateQuestions(resumeText, jobDescription, numQuestions)}
          >
            Generate Questions & Start Interview
          </button>
        </div>

        {error && <p style={styles.error}>{error}</p>}
      </div>
    );
  }

  // ── STEP: generating ─────────────────────────
  if (step === "generating") {
    return (
      <div style={{ ...styles.container, alignItems: "center", textAlign: "center" }}>
        <div style={styles.spinner} />
        <p style={{ color: "#718096", marginTop: 16 }}>
          Generating {numQuestions} tailored questions…
        </p>
      </div>
    );
  }

  // ── STEP: ready / recording / evaluating ────
  if (step === "ready" || step === "recording" || step === "evaluating") {
    const progress = ((currentIndex) / questions.length) * 100;

    return (
      <div style={styles.container}>
        {/* Progress */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#718096", marginBottom: 6 }}>
            <span>Question {currentIndex + 1} of {questions.length}</span>
            <span>{Math.round(progress)}% complete</span>
          </div>
          <div style={{ background: "#e2e8f0", borderRadius: 4, height: 6 }}>
            <div style={{ width: `${progress}%`, height: "100%", borderRadius: 4, background: "#4f46e5", transition: "width 0.5s" }} />
          </div>
        </div>

        {/* Question card */}
        <div style={styles.questionCard}>
          <span style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: 1,
            color: currentQuestion?.type === "technical" ? "#4f46e5" : "#ed8936",
            marginBottom: 8,
            display: "block",
          }}>
            {currentQuestion?.type === "technical" ? "🔧 Technical" : "💬 Behavioral"}
          </span>
          <h3 style={{ margin: 0, fontSize: 18, color: "#1a202c", lineHeight: 1.5 }}>
            {currentQuestion?.question}
          </h3>
        </div>

        {/* Recorder */}
        <VideoRecorder
          onRecordingComplete={handleRecordingComplete}
          maxSeconds={120}
        />

        {/* Submit button */}
        {pendingAudio && (
          <button
            style={{ ...styles.primaryBtn, marginTop: 12 }}
            onClick={handleSubmitAnswer}
            disabled={submitted || step === "evaluating"}
          >
            {step === "evaluating" || submitted ? "⏳ Evaluating…" : "✅ Submit Answer"}
          </button>
        )}

        {step === "evaluating" && (
          <p style={{ color: "#718096", fontSize: 13, marginTop: 8 }}>
            Transcribing and evaluating your answer…
          </p>
        )}

        {error && <p style={styles.error}>{error}</p>}
      </div>
    );
  }

  // ── STEP: done ───────────────────────────────
  if (step === "done") {
    const { technicalAvg, clarityAvg, overallAvg } = aggregateScore || {};

    return (
      <div style={styles.container}>
        <h2 style={styles.heading}>📊 Interview Report</h2>

        {/* Aggregate scores */}
        <div style={{ ...styles.card, background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", color: "#fff", marginBottom: 24 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 18 }}>Overall Performance</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, textAlign: "center" }}>
            {[
              { label: "Technical", value: technicalAvg },
              { label: "Clarity", value: clarityAvg },
              { label: "Overall", value: overallAvg },
            ].map(({ label, value }) => (
              <div key={label}>
                <div style={{ fontSize: 32, fontWeight: 800 }}>{value}<span style={{ fontSize: 16 }}>/10</span></div>
                <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Per-question breakdown */}
        <h3 style={{ fontSize: 16, marginBottom: 12 }}>Answer Breakdown</h3>
        {answers.map((a, i) => (
          <AnswerEvaluationCard key={i} answer={a} index={i} />
        ))}

        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button style={styles.primaryBtn} onClick={reset}>
            🔄 Restart Interview
          </button>
          {reportId && (
            <button
              style={{ ...styles.primaryBtn, background: "#48bb78" }}
              onClick={() => window.open(`/api/interview/report/${reportId}`, "_blank")}
            >
              📥 Download Report
            </button>
          )}
        </div>
      </div>
    );
  }

  return null;
}

const styles = {
  container: {
    maxWidth: 680,
    margin: "0 auto",
    padding: "24px 16px",
    fontFamily: "'Inter', sans-serif",
    display: "flex",
    flexDirection: "column",
  },
  heading: {
    fontSize: 24,
    fontWeight: 700,
    color: "#1a202c",
    marginBottom: 8,
  },
  subtext: {
    fontSize: 14,
    color: "#718096",
    lineHeight: 1.6,
    marginBottom: 24,
  },
  card: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  questionCard: {
    background: "#f7f9ff",
    border: "1px solid #c3dafe",
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: "#4a5568",
    marginBottom: 10,
  },
  chipBtn: {
    border: "none",
    borderRadius: 8,
    padding: "8px 16px",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 14,
    transition: "all 0.2s",
  },
  primaryBtn: {
    background: "#4f46e5",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "12px 24px",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 15,
    width: "100%",
  },
  error: {
    color: "#e53e3e",
    background: "#fff5f5",
    border: "1px solid #fed7d7",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 13,
    marginTop: 12,
  },
  warning: {
    color: "#c05621",
    background: "#fffaf0",
    border: "1px solid #fbd38d",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 13,
    marginBottom: 16,
  },
  spinner: {
    width: 40,
    height: 40,
    border: "4px solid #e2e8f0",
    borderTop: "4px solid #4f46e5",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
    marginTop: 60,
  },
};
