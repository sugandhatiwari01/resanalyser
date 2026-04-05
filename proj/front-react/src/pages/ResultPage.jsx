import { useLocation, useNavigate } from "react-router-dom";
import Navbar from "./Navbar";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

export default function ResultPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const result = location.state?.match_analysis;
  const resumeText = location.state?.resume_text;   // we'll pass this from PDFJobMatch
  const jobDescription = location.state?.jd_text;   // we'll pass this from PDFJobMatch

  if (!result) return <h2 style={{ textAlign: "center" }}>No Result</h2>;

  const score = result.match_score;

  const data = [
    { name: "Matched", value: result.matched_skills.length },
    { name: "Missing", value: result.missing_skills.length }
  ];

  const COLORS = ["#8b5cf6", "#ff4d6d"];

  return (
    <>
      <Navbar />

      <div className="results">

        <div className="scoreContainer">
          <h2>ATS Match Score</h2>
          <h1>{score}%</h1>
          <div className="scoreBar">
            <div className="scoreFill" style={{ width: `${score}%` }} />
          </div>
        </div>

        <div className="chartWrapper">
          <ResponsiveContainer width={400} height={300}>
            <PieChart>
              <Pie data={data} dataKey="value" outerRadius={110}>
                {data.map((entry, index) => (
                  <Cell key={index} fill={COLORS[index]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend verticalAlign="bottom" align="center" iconType="circle" />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="section">
          <h3>Matched Skills</h3>
          <div className="skills">
            {result.matched_skills.map((s, i) => (
              <span className="tag" key={i}>{s}</span>
            ))}
          </div>
        </div>

        <div className="section">
          <h3>Missing Skills</h3>
          <div className="skills">
            {result.missing_skills.map((s, i) => (
              <span className="tag missing" key={i}>{s}</span>
            ))}
          </div>
        </div>

        <div className="section">
          <h3>Weaknesses</h3>
          <ul>
            {result.weaknesses.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>

        <div className="section">
          <h3>Final Verdict</h3>
          <p>{result.final_verdict}</p>
        </div>

        {/* ── Mock Interview CTA ── */}
        <div className="section" style={{ textAlign: "center", marginTop: 32 }}>
          <h3>Ready to Practice?</h3>
          <p style={{ color: "#718096", marginBottom: 16 }}>
            Take an AI mock interview tailored to this job description.
          </p>
          <button
            className="button"
            onClick={() =>
             // In ResultPage, the navigate call should be:
navigate("/mock-interview", {
  state: {
    resumeText: location.state?.resume_preview,  // from Flask response
    jobDescription: location.state?.jd_text,     // from PDFJobMatch
  }
})
            }
          >
            🎙️ Start Mock Interview
          </button>
        </div>

      </div>
    </>
  );
}