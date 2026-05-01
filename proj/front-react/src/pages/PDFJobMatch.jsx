import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import Navbar from "./Navbar";

export default function PDFJobMatch() {

  const [file, setFile] = useState(null);
  const [jd, setJd] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleMatch = async () => {
    if (!file) return alert("Upload resume PDF");
    if (!jd.trim()) return alert("Paste Job Description");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("jd", jd);

    try {
      setLoading(true);

      const res = await api.post(
        "/match-pdf-jd",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      navigate("/results", { state: { ...res.data, jd_text: jd } });

    } catch (err) {
      console.error(err);
      alert("Matching failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar />

      <div className="fullPage">

        <h1 className="pageTitle">Resume ↔ Job Matcher</h1>

        <div className="splitLayout">

          {/* LEFT: UPLOAD */}
          <div className="uploadPanel">
            <h3>Upload Resume</h3>

            <label className="fileUploadLarge">
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => setFile(e.target.files[0])}
              />

              <div className="uploadInnerLarge">
                <span className="uploadIcon">📄</span>
                <p>{file ? file.name : "Click to upload PDF"}</p>
              </div>
            </label>
          </div>

          {/* RIGHT: JD */}
          <div className="jdPanel">
            <h3>Job Description</h3>

            <textarea
              rows="12"
              placeholder="Paste job description here..."
              value={jd}
              onChange={(e) => setJd(e.target.value)}
            />
          </div>

        </div>

        {/* BUTTON */}
        <div className="actionBar">
          <button
            className="button large"
            onClick={handleMatch}
            disabled={loading}
          >
            {loading ? "Analyzing..." : "Generate Match Score"}
          </button>
        </div>

      </div>
    </>
  );
}