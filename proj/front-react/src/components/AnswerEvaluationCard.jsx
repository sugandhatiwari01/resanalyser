// components/AnswerEvaluationCard.jsx
//
// Usage:
//   <AnswerEvaluationCard answer={answer} index={i} />
//
// `answer` shape expected:
//   {
//     question,
//     transcript,
//     evaluation: {
//       technicalScore, clarityScore, overallScore, feedback,
//       strengths?, improvements?, keywords_detected?, keywords_missing?
//     },
//     faceReport?: {
//       overallConfidence,   // 0-100
//       avgStress,           // 0-100
//       peakStress,          // 0-100
//       samplesAnalyzed,     // number
//       dominantMood,        // string
//       avgExpressions,      // { happy, neutral, surprised, sad, fearful, disgusted, angry }
//       tips?                // string[]
//     }
//   }
//
// FIX NOTES (why faceReport was not showing):
//   The most common cause is that faceReport is attached AFTER evaluation renders,
//   or it's never merged into the answer object in the parent. Make sure in your parent:
//
//     const handleRecordingComplete = async (audioBlob, videoBlob, faceReport) => {
//       const evaluation = await evaluateAnswer(transcript);   // await your eval
//       setAnswers(prev => prev.map((a, idx) =>
//         idx === currentIndex
//           ? { ...a, evaluation, faceReport }   // set BOTH together
//           : a
//       ));
//     };
//
//   Also confirm your VideoRecorder actually calls:
//     onRecordingComplete(audioBlob, videoBlob, faceReport)   ← 3 args

import { useState } from "react";

// ─── Design tokens ────────────────────────────────────────────────────────────
const colors = {
  bg: "#ffffff",
  surface: "#f8fafc",
  surfaceAlt: "#f1f5f9",
  border: "#e2e8f0",
  borderLight: "#f0f4f8",
  text: "#0f172a",
  textMuted: "#64748b",
  textLight: "#94a3b8",

  success: "#059669",
  successBg: "#ecfdf5",
  successBorder: "#a7f3d0",
  successText: "#065f46",

  warning: "#d97706",
  warningBg: "#fffbeb",
  warningBorder: "#fde68a",
  warningText: "#92400e",

  danger: "#dc2626",
  dangerBg: "#fef2f2",
  dangerBorder: "#fecaca",
  dangerText: "#7f1d1d",

  info: "#2563eb",
  infoBg: "#eff6ff",
  infoBorder: "#bfdbfe",

  dark: "#0f1117",
  darkSurface: "rgba(255,255,255,0.05)",
  darkBorder: "rgba(255,255,255,0.08)",
  darkText: "rgba(255,255,255,0.85)",
  darkMuted: "rgba(255,255,255,0.35)",
  darkFaint: "rgba(255,255,255,0.18)",
};

const scoreColor = (s) =>
  s >= 7 ? colors.success : s >= 4 ? colors.warning : colors.danger;
const scoreBg = (s) =>
  s >= 7 ? colors.successBg : s >= 4 ? colors.warningBg : colors.dangerBg;
const scoreText = (s) =>
  s >= 7 ? colors.successText : s >= 4 ? colors.warningText : colors.dangerText;
const scoreBorder = (s) =>
  s >= 7 ? colors.successBorder : s >= 4 ? colors.warningBorder : colors.dangerBorder;

const confColor = (s) =>
  s >= 70 ? "#4ade80" : s >= 40 ? "#fb923c" : "#f87171";
const stressColor = (s) =>
  s > 50 ? "#f87171" : s > 25 ? "#fb923c" : "#4ade80";
const exprColor = (e) =>
  e === "happy" ? "#4ade80"
    : e === "neutral" ? "#60a5fa"
      : e === "fearful" || e === "angry" ? "#f87171"
        : "#fb923c";

const exprEmoji = {
  happy: "😊", neutral: "😐", surprised: "😮",
  sad: "😔", fearful: "😰", disgusted: "😒", angry: "😠",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const ScoreBar = ({ label, score }) => (
  <div style={{ marginBottom: 10 }}>
    <div style={{
      display: "flex", justifyContent: "space-between",
      alignItems: "center", marginBottom: 5,
    }}>
      <span style={{ fontSize: 13, color: colors.textMuted, fontWeight: 500 }}>{label}</span>
      <span style={{
        fontSize: 12, fontWeight: 700,
        color: scoreColor(score),
        background: scoreBg(score),
        border: `1px solid ${scoreBorder(score)}`,
        borderRadius: 6, padding: "1px 8px",
      }}>
        {score}/10
      </span>
    </div>
    <div style={{
      background: colors.surfaceAlt, borderRadius: 6, height: 7,
      overflow: "hidden", border: `1px solid ${colors.border}`,
    }}>
      <div style={{
        width: `${score * 10}%`, height: "100%", borderRadius: 6,
        background: `linear-gradient(90deg, ${scoreColor(score)}cc, ${scoreColor(score)})`,
        transition: "width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)",
        boxShadow: `0 0 8px ${scoreColor(score)}66`,
      }} />
    </div>
  </div>
);

const Arc = ({ pct, color, size = 56, stroke = 5 }) => {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = Math.min(pct / 100, 1) * circ;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)", display: "block" }}>
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke}
      />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: "stroke-dasharray 1s cubic-bezier(0.34, 1.56, 0.64, 1)" }}
      />
    </svg>
  );
};

const GaugeCard = ({ label, value, color, sublabel, subvalue }) => (
  <div style={{
    flex: 1,
    background: colors.darkSurface,
    borderRadius: 10,
    padding: "12px 14px",
    border: `1px solid ${colors.darkBorder}`,
    display: "flex",
    alignItems: "center",
    gap: 12,
  }}>
    <div style={{ position: "relative", flexShrink: 0, width: 56, height: 56 }}>
      <Arc pct={value} color={color} />
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 11, fontWeight: 800, color,
      }}>
        {value}%
      </div>
    </div>
    <div>
      <div style={{
        fontSize: 9, fontWeight: 700, color: colors.darkMuted,
        textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3,
      }}>
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color, lineHeight: 1 }}>
        {sublabel}
      </div>
      <div style={{ fontSize: 10, color: colors.darkFaint, marginTop: 3 }}>
        {subvalue}
      </div>
    </div>
  </div>
);

// ─── Parse markdown feedback into structured sections ─────────────────────────
function parseFeedback(text = "") {
  const strengths = [], improvements = [];
  let closing = "";

  const sm = text.match(/\*\*Strengths:\*\*(.+?)(?=\*\*Improvements:|$)/si);
  if (sm) {
    (sm[1].match(/\d+\.\s+\*\*(.+?)\*\*[:\s-]*(.+?)(?=\d+\.|$)/gs) || []).forEach(item => {
      const m = item.match(/\*\*(.+?)\*\*[:\s-]*(.+)/s);
      if (m) strengths.push(`${m[1].trim()}: ${m[2].trim()}`);
    });
  }
  const im = text.match(/\*\*Improvements:\*\*(.+?)(?=\*\*Closing|$)/si);
  if (im) {
    (im[1].match(/\d+\.\s+\*\*(.+?)\*\*[:\s-]*(.+?)(?=\d+\.|$)/gs) || []).forEach(item => {
      const m = item.match(/\*\*(.+?)\*\*[:\s-]*(.+)/s);
      if (m) improvements.push(`${m[1].trim()}: ${m[2].trim()}`);
    });
  }
  const cm = text.match(/\*\*Closing encouragement:\*\*\s*(.+)/si);
  if (cm) closing = cm[1].trim();

  return { strengths, improvements, closing };
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AnswerEvaluationCard({ answer, index }) {
  const [exprOpen, setExprOpen] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);

  // ── Guard: render nothing if no evaluation yet ───────────────────────────
  if (!answer?.evaluation) return null;

  const { question, transcript, evaluation, faceReport } = answer;
  const { technicalScore, clarityScore, overallScore, feedback } = evaluation;

  // ── Derive strengths / improvements ──────────────────────────────────────
  const provided = {
    s: evaluation.strengths || [],
    i: evaluation.improvements || [],
  };
  const parsed = parseFeedback(feedback);
  const finalStrengths = provided.s.length > 0 ? provided.s : parsed.strengths;
  const finalImprovements = provided.i.length > 0 ? provided.i : parsed.improvements;

  const cleanFeedback =
    parsed.closing ||
    feedback
      ?.replace(/\*\*Strengths:\*\*.+?(?=\*\*Improvements:|$)/si, "")
      ?.replace(/\*\*Improvements:\*\*.+?(?=\*\*Closing|$)/si, "")
      ?.replace(/\*\*Closing encouragement:\*\*/si, "")
      ?.replace(/\*\*/g, "")
      .trim();

  // ── Facial report derived values ─────────────────────────────────────────
  const hasFace = faceReport && typeof faceReport === "object";
  const confLabel = hasFace
    ? faceReport.overallConfidence >= 70 ? "High"
      : faceReport.overallConfidence >= 40 ? "Moderate" : "Low"
    : "";
  const stressLabel = hasFace
    ? faceReport.avgStress > 50 ? "High"
      : faceReport.avgStress > 25 ? "Mild" : "Calm"
    : "";

  // ── DEBUG: uncomment in development to trace faceReport attachment ────────
  // console.log(`[Q${index + 1}] faceReport:`, faceReport);

  return (
    <div style={{
      border: `1px solid ${colors.border}`,
      borderRadius: 14,
      padding: 22,
      marginBottom: 18,
      background: colors.bg,
      fontFamily: "'Geist', 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)",
    }}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", justifyContent: "space-between",
        alignItems: "flex-start", marginBottom: 14, gap: 12,
      }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <span style={{
            flexShrink: 0,
            background: colors.surfaceAlt,
            border: `1px solid ${colors.border}`,
            borderRadius: 8,
            fontSize: 11, fontWeight: 800,
            color: colors.textMuted,
            padding: "3px 8px",
            letterSpacing: "0.04em",
            marginTop: 1,
          }}>
            Q{index + 1}
          </span>
          <h4 style={{
            margin: 0, fontSize: 14, fontWeight: 600,
            color: colors.text, lineHeight: 1.5,
          }}>
            {question}
          </h4>
        </div>
        <span style={{
          flexShrink: 0,
          background: scoreBg(overallScore),
          color: scoreText(overallScore),
          border: `1px solid ${scoreBorder(overallScore)}`,
          borderRadius: 20, padding: "3px 13px",
          fontSize: 13, fontWeight: 800,
          letterSpacing: "0.01em",
        }}>
          {overallScore}/10
        </span>
      </div>

      {/* ── Transcript ────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 16 }}>
        <button
          onClick={() => setTranscriptOpen(v => !v)}
          style={{
            background: "none", border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6,
            fontSize: 12, color: colors.textLight, padding: 0,
            fontWeight: 500,
          }}
        >
          <span style={{
            display: "inline-block",
            transform: transcriptOpen ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
            fontSize: 10,
          }}>▶</span>
          📝 Your answer (transcript)
        </button>
        {transcriptOpen && (
          <p style={{
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            padding: "10px 14px", borderRadius: 8,
            fontSize: 13, color: colors.textMuted,
            marginTop: 8, lineHeight: 1.7, marginBottom: 0,
          }}>
            {transcript || "No transcript available."}
          </p>
        )}
      </div>

      {/* ── Score bars ────────────────────────────────────────────────────── */}
      <div style={{
        background: colors.surface,
        border: `1px solid ${colors.borderLight}`,
        borderRadius: 10, padding: "14px 16px",
        marginBottom: 14,
      }}>
        <ScoreBar label="Technical Knowledge" score={technicalScore || 0} />
        <ScoreBar label="Clarity & Communication" score={clarityScore || 0} />
      </div>

      {/* ── Keywords detected ─────────────────────────────────────────────── */}
      {evaluation.keywords_detected?.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: colors.textMuted, marginBottom: 6, margin: "0 0 6px" }}>
            🔑 Keywords detected
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {evaluation.keywords_detected.map((k, i) => (
              <span key={i} style={{
                background: colors.successBg,
                color: colors.successText,
                border: `1px solid ${colors.successBorder}`,
                borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 600,
              }}>{k}</span>
            ))}
          </div>
        </div>
      )}

      {/* ── Keywords missing ──────────────────────────────────────────────── */}
      {evaluation.keywords_missing?.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: colors.textMuted, marginBottom: 6, margin: "0 0 6px" }}>
            ❌ Keywords missed
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {evaluation.keywords_missing.map((k, i) => (
              <span key={i} style={{
                background: colors.dangerBg,
                color: colors.dangerText,
                border: `1px solid ${colors.dangerBorder}`,
                borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 600,
              }}>{k}</span>
            ))}
          </div>
        </div>
      )}

      {/* ── Closing feedback ──────────────────────────────────────────────── */}
      {cleanFeedback && (
        <p style={{
          fontSize: 13, color: colors.textMuted,
          lineHeight: 1.7, marginBottom: 14,
          padding: "10px 14px",
          background: colors.infoBg,
          border: `1px solid ${colors.infoBorder}`,
          borderRadius: 8, margin: "0 0 14px",
        }}>
          {cleanFeedback}
        </p>
      )}

      {/* ── Strengths / Improvements ──────────────────────────────────────── */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr",
        gap: 10, marginBottom: 16,
      }}>
        <div style={{
          background: colors.successBg,
          border: `1px solid ${colors.successBorder}`,
          borderRadius: 10, padding: "12px 14px",
        }}>
          <p style={{
            fontWeight: 700, fontSize: 11,
            color: colors.successText, margin: "0 0 8px",
            textTransform: "uppercase", letterSpacing: "0.05em",
          }}>
            ✅ Strengths
          </p>
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: colors.success, lineHeight: 1.7 }}>
            {finalStrengths.length > 0
              ? finalStrengths.map((s, i) => <li key={i}>{s}</li>)
              : <li style={{ color: colors.textLight }}>See feedback above</li>}
          </ul>
        </div>
        <div style={{
          background: colors.warningBg,
          border: `1px solid ${colors.warningBorder}`,
          borderRadius: 10, padding: "12px 14px",
        }}>
          <p style={{
            fontWeight: 700, fontSize: 11,
            color: colors.warningText, margin: "0 0 8px",
            textTransform: "uppercase", letterSpacing: "0.05em",
          }}>
            💡 Improve
          </p>
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: colors.warning, lineHeight: 1.7 }}>
            {finalImprovements.length > 0
              ? finalImprovements.map((s, i) => <li key={i}>{s}</li>)
              : <li style={{ color: colors.textLight }}>See feedback above</li>}
          </ul>
        </div>
      </div>

      {/* ══ FACIAL ANALYSIS SECTION ═════════════════════════════════════════ */}
      {hasFace ? (
        <div style={{
          background: colors.dark,
          border: `1px solid ${colors.darkBorder}`,
          borderRadius: 12, padding: 16,
        }}>
          {/* Header */}
          <p style={{
            margin: "0 0 14px",
            fontSize: 10, fontWeight: 800,
            color: colors.darkMuted,
            textTransform: "uppercase",
            letterSpacing: "0.09em",
          }}>
            🧠 Facial Analysis — This Question
          </p>

          {/* Gauges row */}
          <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>

            {/* Confidence */}
            <GaugeCard
              label="Confidence"
              value={faceReport.overallConfidence ?? 0}
              color={confColor(faceReport.overallConfidence ?? 0)}
              sublabel={confLabel}
              subvalue={faceReport.dominantMood ?? "—"}
            />

            {/* Stress */}
            <GaugeCard
              label="Avg Stress"
              value={faceReport.avgStress ?? 0}
              color={stressColor(faceReport.avgStress ?? 0)}
              sublabel={stressLabel}
              subvalue={`Peak: ${faceReport.peakStress ?? 0}%`}
            />

            {/* Frames badge */}
            <div style={{
              background: colors.darkSurface,
              border: `1px solid ${colors.darkBorder}`,
              borderRadius: 10, padding: "12px 14px",
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              minWidth: 68,
            }}>
              <div style={{
                fontSize: 24, fontWeight: 800,
                color: "rgba(255,255,255,0.75)", lineHeight: 1,
              }}>
                {faceReport.samplesAnalyzed ?? 0}
              </div>
              <div style={{
                fontSize: 9, fontWeight: 700,
                color: colors.darkMuted,
                textTransform: "uppercase",
                letterSpacing: "0.07em",
                marginTop: 5, textAlign: "center", lineHeight: 1.4,
              }}>
                Frames<br />Analyzed
              </div>
            </div>
          </div>

          {/* Expression breakdown (collapsible) */}
          {faceReport.avgExpressions && Object.keys(faceReport.avgExpressions).length > 0 && (
            <div style={{ marginBottom: faceReport.tips?.length ? 14 : 0 }}>
              <button
                onClick={() => setExprOpen(v => !v)}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 6, padding: 0,
                  fontSize: 10, fontWeight: 700,
                  color: colors.darkMuted,
                  textTransform: "uppercase", letterSpacing: "0.07em",
                }}
              >
                <span style={{
                  display: "inline-block",
                  transform: exprOpen ? "rotate(90deg)" : "rotate(0deg)",
                  transition: "transform 0.2s ease",
                }}>▶</span>
                Expression Breakdown
              </button>

              {exprOpen && (
                <div style={{ marginTop: 12 }}>
                  {Object.entries(faceReport.avgExpressions)
                    .sort((a, b) => b[1] - a[1])
                    .map(([expr, val]) => {
                      const pct = Math.round((val ?? 0) * 100);
                      return (
                        <div key={expr} style={{ marginBottom: 8 }}>
                          <div style={{
                            display: "flex", justifyContent: "space-between",
                            fontSize: 12, marginBottom: 4,
                          }}>
                            <span style={{ color: "#94a3b8" }}>
                              {exprEmoji[expr] ?? "•"}{" "}
                              {expr.charAt(0).toUpperCase() + expr.slice(1)}
                            </span>
                            <span style={{ fontWeight: 700, color: exprColor(expr) }}>
                              {pct}%
                            </span>
                          </div>
                          <div style={{
                            background: "rgba(255,255,255,0.07)",
                            borderRadius: 4, height: 5, overflow: "hidden",
                          }}>
                            <div style={{
                              width: `${pct}%`, height: "100%",
                              borderRadius: 4, background: exprColor(expr),
                              transition: "width 0.6s ease",
                            }} />
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}

          {/* Body language tips */}
          {faceReport.tips?.length > 0 && (
            <div style={{
              background: "rgba(255,255,255,0.03)",
              border: `1px solid rgba(255,255,255,0.06)`,
              borderRadius: 8, padding: "10px 14px",
            }}>
              <p style={{
                margin: "0 0 7px",
                fontSize: 9, fontWeight: 700,
                color: colors.darkMuted,
                textTransform: "uppercase", letterSpacing: "0.07em",
              }}>
                💡 Body Language Tips
              </p>
              <ul style={{ margin: 0, paddingLeft: 16 }}>
                {faceReport.tips.map((tip, i) => (
                  <li key={i} style={{
                    fontSize: 12, color: "#94a3b8",
                    lineHeight: 1.7, marginBottom: 2,
                  }}>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        /* ── faceReport missing — clear debug hint ── */
        <div style={{
          border: `1px dashed rgba(100,116,139,0.35)`,
          borderRadius: 10, padding: "11px 14px",
          background: colors.surface,
          display: "flex", alignItems: "flex-start", gap: 10,
        }}>
          <span style={{ fontSize: 18, marginTop: 1 }}>📷</span>
          <div>
            <p style={{ margin: "0 0 4px", fontSize: 13, color: colors.textMuted, fontWeight: 600 }}>
              No facial analysis for this question.
            </p>
            <p style={{ margin: 0, fontSize: 11, color: colors.textLight, lineHeight: 1.6 }}>
              Make sure <code style={{
                background: colors.surfaceAlt,
                padding: "1px 5px", borderRadius: 4,
                fontFamily: "monospace", fontSize: 11,
              }}>answer.faceReport</code> is set when saving each recorded answer.{" "}
              In your parent, call{" "}
              <code style={{
                background: colors.surfaceAlt,
                padding: "1px 5px", borderRadius: 4,
                fontFamily: "monospace", fontSize: 11,
              }}>
                {`setAnswers(prev => prev.map((a, i) => i === currentIndex ? { ...a, faceReport } : a))`}
              </code>{" "}
              inside <code style={{
                background: colors.surfaceAlt,
                padding: "1px 5px", borderRadius: 4,
                fontFamily: "monospace", fontSize: 11,
              }}>handleRecordingComplete</code>.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}