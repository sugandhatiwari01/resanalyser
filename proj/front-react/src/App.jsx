import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import ResumeParse from "./pages/ResumeParse";
import ResumePDF from "./pages/ResumePDF";
import Navbar from "./pages/Navbar";
import PDFJobMatch from "./pages/PDFJobMatch";

function Home() {
  return (
    
    <div style={{ padding: 40 }}>
      <Navbar />
      <h1>AI Interview & Resume Analyzer</h1>
      <p>Select a feature:</p>

      <ul>
        <li>
          <Link to="/resume-parse">Paste Resume Text Analysis</Link>
        </li>
        <li>
          <Link to="/resume-pdf">Upload PDF Resume Analysis</Link>
        </li>
        <li>
          <Link to="/pdf-job-match">Match PDF Resume with Job Description</Link>
        </li>
      </ul>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/resume-parse" element={<ResumeParse />} />
        <Route path="/resume-pdf" element={<ResumePDF />} />
        <Route path="/pdf-job-match" element={<PDFJobMatch />} />
      </Routes>
    </BrowserRouter>
  );
}