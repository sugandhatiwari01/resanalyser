import { BrowserRouter,Routes,Route,useNavigate } from "react-router-dom";
import Navbar from "./pages/Navbar";
import PDFJobMatch from "./pages/PDFJobMatch";
import ResultPage from "./pages/ResultPage";
import "./App.css";

function Home(){

const navigate = useNavigate();

return(

<div className="app">

<Navbar/>

<div className="hero">

<h1>AI Resume ATS Analyzer</h1>

<p>
Upload your resume and instantly see how well it matches
a job description using AI powered ATS analysis.
</p>

<button
className="button"
onClick={()=>navigate("/pdf-job-match")}
>

Match Resume With Job Description

</button>

</div>

</div>

)
}

export default function App(){

return(

<BrowserRouter>

<Routes>

<Route path="/" element={<Home/>}/>
<Route path="/pdf-job-match" element={<PDFJobMatch/>}/>
<Route path="/results" element={<ResultPage/>}/>

</Routes>

</BrowserRouter>

)

}