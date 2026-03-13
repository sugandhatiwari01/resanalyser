import { useLocation } from "react-router-dom";
import Navbar from "./Navbar";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

export default function ResultPage() {

  const location = useLocation();

  const result = location.state?.match_analysis;

  if (!result) return <h2 style={{textAlign:"center"}}>No Result</h2>;

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
            <div
              className="scoreFill"
              style={{ width: `${score}%` }}
            />
          </div>
        </div>

        <div className="chartWrapper">
          <ResponsiveContainer width={400} height={300}>
            <PieChart>

  <Pie
    data={data}
    dataKey="value"
    outerRadius={110}
  >
    {data.map((entry, index) => (
      <Cell key={index} fill={COLORS[index]} />
    ))}
  </Pie>

  <Tooltip />

  <Legend
    verticalAlign="bottom"
    align="center"
    iconType="circle"
  />

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

      </div>
    </>
  );
}