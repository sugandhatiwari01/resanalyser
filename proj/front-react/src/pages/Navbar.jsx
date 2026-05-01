import { Link, useLocation } from "react-router-dom";

export default function Navbar() {

  const location = useLocation();

  return (
    <div className="navbar">

      {/* LEFT: BRAND */}
      <div className="navLeft">
        <Link to="/" className="logo">
          ResumeAI
        </Link>
      </div>

      {/* RIGHT: LINKS */}
      <div className="navRight">
        <Link
          to="/"
          className={location.pathname === "/" ? "active" : ""}
        >
          Home
        </Link>

        <Link
          to="/pdf-job-match"
          className={location.pathname === "/pdf-job-match" ? "active" : ""}
        >
          ATS Matcher
        </Link>
      </div>

    </div>
  );
}