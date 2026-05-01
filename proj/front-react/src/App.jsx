import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import Navbar from "./pages/Navbar";
import PDFJobMatch from "./pages/PDFJobMatch";
import ResultPage from "./pages/ResultPage";
import MockInterview from "./pages/MockInterview";
import "./App.css";

function Home() {
  const navigate = useNavigate();

  return (
    <div className="app">
      <Navbar />

      <div className="hero">
        <div className="heroCard">
          <h1>AI Resume ATS Analyzer</h1>
          <p>
            Upload your resume and instantly discover how well it aligns with
            your dream job using intelligent ATS analysis.
          </p>

          <button
            className="button"
            onClick={() => navigate("/pdf-job-match")}
          >
            Start Matching →
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/pdf-job-match" element={<PDFJobMatch />} />
        <Route path="/results" element={<ResultPage />} />
        <Route path="/mock-interview" element={<MockInterview />} />
      </Routes>
    </BrowserRouter>
  );
}