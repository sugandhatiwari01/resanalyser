import { useLocation, useNavigate } from "react-router-dom";
import Navbar from "./Navbar";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

export default function ResultPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const result = location.state?.match_analysis;
  const resumeText = location.state?.resume_text;
  const jobDescription = location.state?.jd_text;

  if (!result) return <h2 style={{ textAlign: "center" }}>No Result</h2>;

  const score = result.match_score;

  const data = [
    { name: "Matched", value: result.matched_skills.length },
    { name: "Missing", value: result.missing_skills.length }
  ];

  const COLORS = ["#8b5e3c", "#d97706"];

  return (
    <>
      <Navbar />

      <div className="results">

        {/* TOP SCORE CARD */}
        <div className="scoreCard">
          <h2>ATS Match Score</h2>
          <h1>{score}%</h1>

          <div className="scoreBar">
            <div className="scoreFill" style={{ width: `${score}%` }} />
          </div>
        </div>

        {/* MIDDLE GRID */}
        <div className="resultGrid">

          {/* CHART */}
          <div className="card">
            <h3 style={{ textAlign: "center" }}>Skill Distribution</h3>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={data} dataKey="value" outerRadius={100}>
                  {data.map((entry, index) => (
                    <Cell key={index} fill={COLORS[index]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* VERDICT */}
          <div className="card">
            <h3>Final Verdict</h3>
            <p>{result.final_verdict}</p>

            <h4 style={{ marginTop: 20 }}>Weaknesses</h4>
            <ul>
              {result.weaknesses.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>

        </div>

        {/* SKILLS */}
        <div className="skillsGrid">

          <div className="card">
            <h3>Matched Skills</h3>
            <div className="skills">
              {result.matched_skills.map((s, i) => (
                <span className="tag" key={i}>{s}</span>
              ))}
            </div>
          </div>

          <div className="card">
            <h3>Missing Skills</h3>
            <div className="skills">
              {result.missing_skills.map((s, i) => (
                <span className="tag missing" key={i}>{s}</span>
              ))}
            </div>
          </div>

        </div>

        {/* CTA */}
        <div className="ctaBox">

  <div className="ctaContent">
    <h3>🎯 Ready to Practice?</h3>
    <p>
      Take an AI mock interview tailored to this job description.
    </p>

    <button
      className="button large"
      onClick={() =>
        navigate("/mock-interview", {
          state: {
            resumeText: location.state?.resume_preview,
            jobDescription: location.state?.jd_text,
          }
        })
      }
    >
      🎙️ Start Mock Interview
    </button>
  </div>

</div>

      </div>
    </>
  );
}