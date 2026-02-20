import { useState } from "react";
import api from "../services/api";

export default function PDFJobMatch() {
  const [file, setFile] = useState(null);
  const [jd, setJd] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleMatch = async () => {
    if (!file) return alert("Upload a resume PDF");
    if (!jd.trim()) return alert("Paste Job Description");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("jd", jd);

    try {
      setLoading(true);
      const res = await api.post("/resume/match-pdf-jd", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setResult(res.data);
    } catch (err) {
      console.error(err);
      alert("ATS Matching failed ❌");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 40 }}>
      <h2>ATS Resume vs Job Description Matcher</h2>

      <input
        type="file"
        accept=".pdf"
        onChange={(e) => setFile(e.target.files[0])}
      />

      <br /><br />

      <textarea
        rows="8"
        cols="80"
        placeholder="Paste Job Description here..."
        value={jd}
        onChange={(e) => setJd(e.target.value)}
      />

      <br /><br />
      <button onClick={handleMatch} disabled={loading}>
        {loading ? "Analyzing ATS Match..." : "Get Match Score"}
      </button>

      {result && (
        <div style={{ marginTop: 30 }}>
<h3>
  Match Score: {
    result?.match_analysis?.match_score
      ? Math.round(
          result.match_analysis.match_score <= 1
            ? result.match_analysis.match_score * 100
            : result.match_analysis.match_score
        )
      : 0
  }%
</h3>
          <h4>Matched Skills</h4>
          <ul>
            {result.match_analysis?.matched_skills?.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>

          <h4>Missing Skills</h4>
          <ul>
            {result.match_analysis?.missing_skills?.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>

          <h4>Weaknesses</h4>
          <ul>
            {result.match_analysis?.weaknesses?.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>

          <h4>Final Verdict</h4>
          <p>{result.match_analysis?.final_verdict}</p>
        </div>
      )}
    </div>
  );
}