import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import Navbar from "./Navbar";

export default function PDFJobMatch(){

const [file,setFile] = useState(null)
const [jd,setJd] = useState("")
const [loading,setLoading] = useState(false)

const navigate = useNavigate()

const handleMatch = async()=>{

if(!file) return alert("Upload resume PDF")
if(!jd.trim()) return alert("Paste Job Description")

const formData = new FormData()

formData.append("file",file)
formData.append("jd",jd)

try{

setLoading(true)

const res = await api.post(
"/resume/match-pdf-jd",
formData,
{headers:{ "Content-Type":"multipart/form-data"}}
)

navigate("/results",{state:res.data})

}
catch(err){

console.error(err)
alert("Matching failed")

}
finally{

setLoading(false)

}

}

return(

<>

<Navbar/>

<div className="container center">

<div className="card" style={{textAlign:"center"}}>

<h2>Match Resume With Job Description</h2>

<div className="uploadBox">

<input
type="file"
accept=".pdf"
onChange={(e)=>setFile(e.target.files[0])}
/>

</div>

<textarea
rows="8"
placeholder="Paste Job Description..."
value={jd}
onChange={(e)=>setJd(e.target.value)}
/>

<br/><br/>

<button
className="button"
onClick={handleMatch}
disabled={loading}
>

{loading ? "Analyzing..." : "Match Score"}

</button>

</div>

</div>

</>

)
}