import { useState } from "react";
import axios from "axios";

export default function JDMatch() {
  const [resume, setResume] = useState("");
  const [jd, setJd] = useState("");
  const [result, setResult] = useState(null);

  const handleMatch = async () => {
    const res = await axios.post("http://127.0.0.1:8000/match-jd", {
      resume,
      jd,
    });
    setResult(res.data);
  };

  return (
    <div style={{ padding: 40 }}>
      <h2>ATS Resume vs Job Description Matcher</h2>

      <textarea
        rows="8"
        placeholder="Paste Resume Text"
        value={resume}
        onChange={(e) => setResume(e.target.value)}
      />

      <br /><br />

      <textarea
        rows="8"
        placeholder="Paste Job Description"
        value={jd}
        onChange={(e) => setJd(e.target.value)}
      />

      <br /><br />
      <button onClick={handleMatch}>Analyze Match</button>

      {result && (
        <div style={{ marginTop: 30 }}>
          <h3>Match Score: {result.match_score}%</h3>

          <h4>Matched Skills</h4>
          <ul>
            {result.matched_skills?.map((s, i) => <li key={i}>{s}</li>)}
          </ul>

          <h4>Missing Skills</h4>
          <ul>
            {result.missing_skills?.map((s, i) => <li key={i}>{s}</li>)}
          </ul>

          <h4>Final Verdict</h4>
          <p>{result.final_verdict}</p>
        </div>
      )}
    </div>
  );
}