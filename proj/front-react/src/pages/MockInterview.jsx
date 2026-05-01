// pages/MockInterview.jsx

import { useState } from "react";
import { useMockInterview } from "../hooks/useMockInterview";
import VideoRecorder from "../components/VideoRecorder";
import AnswerEvaluationCard from "../components/AnswerEvaluationCard";
import { downloadReport } from "../utils/downloadReport";
import { useLocation } from "react-router-dom";

export default function MockInterview() {
  const location = useLocation();
  const resumeText = location.state?.resumeText || "";
  const jobDescription = location.state?.jobDescription || "";

  const {
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
  const [pendingAudio, setPendingAudio] = useState(null);
  const [pendingFaceReport, setPendingFaceReport] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  const handleRecordingComplete = (audioBlob, videoBlob, faceReport) => {
    setPendingAudio(audioBlob);
    setPendingFaceReport(faceReport);
    setSubmitted(false);
  };

  const handleSubmitAnswer = async () => {
    if (!pendingAudio) return;
    setSubmitted(true);
    const face = pendingFaceReport;
    setPendingAudio(null);
    setPendingFaceReport(null);
    await submitAnswer(pendingAudio, jobDescription, face);
    setSubmitted(false);
  };

  // ── IDLE ──────────────────────────────
  if (step === "idle") {
    return (
      <div style={styles.container}>
        <h2 style={styles.heading}>🎙️ Mock Interview Simulator</h2>

        <p style={styles.subtext}>
          Generate tailored questions and get AI-powered evaluation.
        </p>

        {(!resumeText || !jobDescription) && (
          <div style={styles.warning}>
            ⚠️ Complete resume analysis first.
          </div>
        )}

        <div style={styles.card}>
          <label style={styles.label}>Number of Questions</label>

          <div style={styles.chipWrapper}>
            {[3, 5, 7, 10].map((n) => (
              <button
                key={n}
                onClick={() => setNumQuestions(n)}
                style={{
                  ...styles.chipBtn,
                  background: numQuestions === n ? "#8b5e3c" : "#efe7df",
                  color: numQuestions === n ? "#fff" : "#5a4334",
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
            Start Interview
          </button>
        </div>

        {error && <p style={styles.error}>{error}</p>}
      </div>
    );
  }

  // ── GENERATING ─────────────────────────
  if (step === "generating") {
    return (
      <div style={styles.centered}>
        <div style={styles.spinner} />
        <p>Generating questions…</p>
      </div>
    );
  }

  // ── INTERVIEW FLOW ─────────────────────
  if (step === "ready" || step === "recording" || step === "evaluating") {
    const progress = ((currentIndex) / questions.length) * 100;

    return (
  <div style={styles.fullScreenWrapper}>

    {/* TOP QUESTION */}
    <div style={styles.topSection}>
      <span style={styles.badge}>
        {currentQuestion?.type === "technical" ? "Technical" : "Behavioral"}
      </span>

      <h1 style={styles.bigQuestion}>
        {currentQuestion?.question}
      </h1>
    </div>

    {/* VIDEO CENTER */}
    <div style={styles.videoSection}>
      <VideoRecorder
        onRecordingComplete={handleRecordingComplete}
        maxSeconds={120}
      />
    </div>

    {/* CONTROLS */}
    <div style={styles.controls}>
      {pendingAudio && (
        <button
          style={styles.primaryBtn}
          onClick={handleSubmitAnswer}
          disabled={submitted || step === "evaluating"}
        >
          {step === "evaluating" ? "Evaluating..." : "Submit Answer"}
        </button>
      )}
    </div>

    {error && <p style={styles.error}>{error}</p>}
  </div>
);
  }

  // ── DONE ───────────────────────────────
  if (step === "done") {
    const { technicalAvg, clarityAvg, overallAvg } = aggregateScore || {};

    return (
      <div
  style={{
    width: "100%",
    padding: "60px 80px",
  }}
>
        <h2 style={styles.heading}>📊 Interview Report</h2>

        <div
  style={{
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "20px",
    marginBottom: "30px",
  }}
>
  <div style={styles.scoreBox}>
    <p style={styles.scoreLabel}>Technical</p>
    <h1 style={styles.scoreValue}>{technicalAvg}/10</h1>
  </div>

  <div style={styles.scoreBox}>
    <p style={styles.scoreLabel}>Clarity</p>
    <h1 style={styles.scoreValue}>{clarityAvg}/10</h1>
  </div>

  <div style={styles.scoreBox}>
    <p style={styles.scoreLabel}>Overall</p>
    <h1 style={styles.scoreValue}>{overallAvg}/10</h1>
  </div>
</div>

        {answers.map((a, i) => (
          <AnswerEvaluationCard key={i} answer={a} index={i} />
        ))}

        <div style={styles.buttonRow}>
          <button style={styles.primaryBtn} onClick={reset}>
            Restart
          </button>

          {reportId && (
            <button
              style={{ ...styles.primaryBtn, background: "#48bb78" }}
              onClick={() =>
                downloadReport({
                  answers,
                  aggregateScore,
                  jobDescription,
                })
              }
            >
              Download Report
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
  width: "100%",
  padding: "60px 80px",
},

  heading: {
    fontSize: 28,
    fontWeight: 600,
    color: "#3a2f2a",
    marginBottom: 10,
  },

  subtext: {
    color: "#6b6b6b",
    marginBottom: 30,
  },

  card: {
    background: "#fff",
    border: "1px solid #e6ddd5",
    borderRadius: 16,
    padding: 25,
    
  },

  label: {
    fontWeight: 500,
    marginBottom: 10,
    display: "block",
  },

  chipWrapper: {
    display: "flex",
    gap: 10,
    marginBottom: 20,
  },

  chipBtn: {
    padding: "8px 16px",
    borderRadius: 20,
    border: "none",
    cursor: "pointer",
  },

  primaryBtn: {
    background: "#8b5e3c",
    color: "#fff",
    border: "none",
    padding: "12px",
    borderRadius: 10,
    cursor: "pointer",
    width: "100%",
    marginTop: 10,
  },

  warning: {
    background: "#fdf6f0",
    padding: 12,
    borderRadius: 10,
    marginBottom: 20,
  },

  error: {
    color: "red",
    marginTop: 10,
  },

  questionCard: {
    background: "#f9f6f3",
    padding: 20,
    borderRadius: 14,
    marginBottom: 20,
  },

  badge: {
    fontSize: 12,
    color: "#8b5e3c",
    marginBottom: 5,
    display: "block",
  },

  questionText: {
    fontSize: 18,
  },

  progressBar: {
    height: 6,
    background: "#eee",
    borderRadius: 10,
    marginBottom: 20,
  },

  progressFill: {
    height: "100%",
    background: "#8b5e3c",
    borderRadius: 10,
  },

  spinner: {
    width: 40,
    height: 40,
    border: "4px solid #eee",
    borderTop: "4px solid #8b5e3c",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },

  centered: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    marginTop: 150,
  },

  scoreCard: {
    display: "flex",
    justifyContent: "space-around",
    marginBottom: 20,
  },

  buttonRow: {
    display: "flex",
    gap: 10,
  },
  fullScreenWrapper: {
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "40px 20px",
  background: "#f5efe9",
},

topSection: {
  textAlign: "center",
  maxWidth: 800,
},

badge: {
  fontSize: 12,
  fontWeight: 600,
  color: "#8b5e3c",
  marginBottom: 12,
  display: "inline-block",
},

bigQuestion: {
  fontSize: 28,
  fontWeight: 600,
  color: "#2d2d2d",
  lineHeight: 1.5,
},

videoSection: {
  width: "100%",
  maxWidth: 700,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
},

controls: {
  marginTop: 20,
  width: "100%",
  maxWidth: 400,
  display: "flex",
  justifyContent: "center",
},
scoreBox: {
  background: "#fff",
  border: "1px solid #e6ddd5",
  borderRadius: "16px",
  padding: "20px",
  textAlign: "center",
  boxShadow: "0 6px 20px rgba(0,0,0,0.05)",
},

scoreLabel: {
  fontSize: "13px",
  color: "#8b5e3c",
  fontWeight: "600",
  letterSpacing: "1px",
  marginBottom: "6px",
},

scoreValue: {
  fontSize: "40px",
  fontWeight: "700",
  color: "#2d2d2d",
},
};