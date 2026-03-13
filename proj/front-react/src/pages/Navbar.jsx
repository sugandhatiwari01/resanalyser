import { Link } from "react-router-dom";

export default function Navbar(){
return(

<div className="navbar">

<Link to="/">Home</Link>
<Link to="/pdf-job-match">ATS Matcher</Link>

</div>

)
}