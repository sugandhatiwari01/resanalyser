// components/AnswerEvaluationCard.jsx
// Displays AI evaluation for one interview answer

export default function AnswerEvaluationCard({ answer, index }) {
  const { question, transcript, evaluation } = answer;
  if (!evaluation) return null;

  const { technicalScore, clarityScore, overallScore, strengths, improvements, feedback } = evaluation;

  const ScoreBar = ({ label, score }) => (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3 }}>
        <span>{label}</span>
        <strong>{score}/10</strong>
      </div>
      <div style={{ background: "#e2e8f0", borderRadius: 4, height: 8 }}>
        <div
          style={{
            width: `${score * 10}%`,
            height: "100%",
            borderRadius: 4,
            background: score >= 7 ? "#48bb78" : score >= 4 ? "#ed8936" : "#e53e3e",
            transition: "width 0.6s ease",
          }}
        />
      </div>
    </div>
  );

  return (
    <div style={{
      border: "1px solid #e2e8f0",
      borderRadius: 12,
      padding: 20,
      marginBottom: 16,
      background: "#fff",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <h4 style={{ margin: 0, fontSize: 15, color: "#2d3748" }}>
          Q{index + 1}: {question}
        </h4>
        <span style={{
          background: overallScore >= 7 ? "#c6f6d5" : overallScore >= 4 ? "#feebc8" : "#fed7d7",
          color: overallScore >= 7 ? "#276749" : overallScore >= 4 ? "#c05621" : "#9b2c2c",
          borderRadius: 20,
          padding: "2px 12px",
          fontSize: 13,
          fontWeight: 700,
          whiteSpace: "nowrap",
          marginLeft: 12,
        }}>
          {overallScore}/10
        </span>
      </div>

      {/* Transcript */}
      <details style={{ marginBottom: 16 }}>
        <summary style={{ cursor: "pointer", fontSize: 13, color: "#718096", marginBottom: 6 }}>
          📝 Your answer (transcript)
        </summary>
        <p style={{
          background: "#f7fafc",
          padding: "10px 14px",
          borderRadius: 8,
          fontSize: 13,
          color: "#4a5568",
          marginTop: 8,
          lineHeight: 1.6,
        }}>
          {transcript || "No transcript available."}
        </p>
      </details>

      {/* Score bars */}
      <div style={{ marginBottom: 16 }}>
        <ScoreBar label="Technical Knowledge" score={technicalScore || 0} />
        <ScoreBar label="Clarity & Communication" score={clarityScore || 0} />
      </div>
// Add this block after the score bars, before feedback:
{evaluation.keywords_detected?.length > 0 && (
  <div style={{ marginBottom: 12 }}>
    <p style={{ fontSize: 12, fontWeight: 600, color: "#4a5568", marginBottom: 6 }}>
      🔑 Keywords detected in your answer:
    </p>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {evaluation.keywords_detected.map((k, i) => (
        <span key={i} style={{
          background: "#c6f6d5", color: "#276749",
          borderRadius: 12, padding: "2px 10px", fontSize: 12
        }}>{k}</span>
      ))}
    </div>
  </div>
)}

{evaluation.keywords_missing?.length > 0 && (
  <div style={{ marginBottom: 12 }}>
    <p style={{ fontSize: 12, fontWeight: 600, color: "#4a5568", marginBottom: 6 }}>
      ❌ Important keywords you missed:
    </p>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {evaluation.keywords_missing.map((k, i) => (
        <span key={i} style={{
          background: "#fed7d7", color: "#9b2c2c",
          borderRadius: 12, padding: "2px 10px", fontSize: 12
        }}>{k}</span>
      ))}
    </div>
  </div>
)}
      {/* Feedback */}
      <p style={{ fontSize: 13, color: "#4a5568", lineHeight: 1.6, marginBottom: 12 }}>
        {feedback}
      </p>

      {/* Strengths / Improvements */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ background: "#f0fff4", borderRadius: 8, padding: 12 }}>
          <p style={{ fontWeight: 600, fontSize: 12, color: "#276749", margin: "0 0 6px" }}>✅ Strengths</p>
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: "#2f855a" }}>
            {(strengths || []).map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
        <div style={{ background: "#fff5f5", borderRadius: 8, padding: 12 }}>
          <p style={{ fontWeight: 600, fontSize: 12, color: "#9b2c2c", margin: "0 0 6px" }}>💡 Improve</p>
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: "#c53030" }}>
            {(improvements || []).map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}
