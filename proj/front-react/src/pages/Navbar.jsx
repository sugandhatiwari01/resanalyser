import { Link } from "react-router-dom";

export default function Navbar() {
  return (
    <nav style={{
      padding: 20,
      background: "#111",
      color: "white",
      display: "flex",
      gap: 20
    }}>
      <Link to="/" style={{ color: "white" }}>Home</Link>
      <Link to="/resume-parse" style={{ color: "white" }}>Text Resume</Link>
      <Link to="/resume-pdf" style={{ color: "white" }}>PDF Resume</Link>
    </nav>
  );
}