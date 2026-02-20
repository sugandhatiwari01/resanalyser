import { useState } from "react";
import api from "../services/api";

export default function ResumePDF() {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleParsePDF = async () => {
    if (!file) {
      alert("Please select a PDF resume");
      return;
    }

    const formData = new FormData();

    // 🔥 IMPORTANT: key MUST match backend
formData.append("file", file);
    try {
      setLoading(true);

      const res = await api.post("/resume/parse-pdf", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      console.log("PDF API RESPONSE:", res.data); // DEBUG
      setResult(res.data);

    } catch (err) {
      console.error(err);
      alert("PDF parsing failed ❌");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 40 }}>
      <h2>Upload PDF Resume → AI Skill Extraction</h2>

      <input
        type="file"
        accept=".pdf"
        onChange={(e) => setFile(e.target.files[0])}
      />

      <br /><br />

      <button onClick={handleParsePDF} disabled={loading}>
        {loading ? "Parsing..." : "Parse PDF Resume"}
      </button>

      {result && (
  <div style={{ marginTop: 30 }}>
    {(() => {
      const data = result.analysis || result;

      return (
        <>
          <h3>Technical Skills</h3>
          <ul>
            {(data?.technical_skills || []).map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>

          <h3>Soft Skills</h3>
          <ul>
            {(data?.soft_skills || []).map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>

          <h3>Strengths</h3>
          <ul>
            {(data?.strengths || []).map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>

          <h3>Summary</h3>
          <p>{data?.summary || "No summary generated"}</p>

          <h3>Extracted Text Preview</h3>
          <pre style={{
            whiteSpace: "pre-wrap",
            background: "#eee",
            padding: 15,
            borderRadius: 8,
          }}>
            {result?.extracted_text_preview || ""}
          </pre>
        </>
      );
    })()}
  </div>
)}
    </div>
  );
}