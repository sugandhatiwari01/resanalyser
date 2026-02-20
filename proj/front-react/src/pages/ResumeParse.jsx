import { useState } from "react";
import axios from "axios";

export default function ResumeParse() {
  const [resumeText, setResumeText] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async () => {
    if (!resumeText.trim()) {
      alert("Please paste your resume text");
      return;
    }

    try {
      setLoading(true);

      const response = await axios.post(
        "http://127.0.0.1:8000/parse-resume",
        { text: resumeText }
      );

      console.log("API RESPONSE:", response.data); // DEBUG
      setResult(response.data);

    } catch (error) {
      console.error("Error:", error);
      alert("Failed to analyze resume");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "30px" }}>
      <h1>AI Resume Analyzer</h1>

      <textarea
        rows="10"
        cols="80"
        placeholder="Paste your resume text here..."
        value={resumeText}
        onChange={(e) => setResumeText(e.target.value)}
        style={{ padding: "10px", marginBottom: "20px" }}
      />

      <br />

      <button onClick={handleAnalyze} disabled={loading}>
        {loading ? "Analyzing..." : "Analyze Resume"}
      </button>

      {/* DISPLAY RESULT */}
      {result && (
        <div style={{ marginTop: "30px" }}>
          <h2>Analysis Result</h2>

          <h3>Technical Skills:</h3>
          <ul>
            {result.technical_skills?.map((skill, index) => (
              <li key={index}>{skill}</li>
            ))}
          </ul>

          <h3>Soft Skills:</h3>
          <ul>
            {result.soft_skills?.map((skill, index) => (
              <li key={index}>{skill}</li>
            ))}
          </ul>

          <h3>Strengths:</h3>
          <ul>
            {result.strengths?.map((s, index) => (
              <li key={index}>{s}</li>
            ))}
          </ul>

          <h3>Summary:</h3>
          <p>{result.summary}</p>
        </div>
      )}
    </div>
  );
}