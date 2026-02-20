const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/match", require("./routes/match.routes"));
app.use("/api/job", require("./routes/job.routes"));
app.use("/api/resume", require("./routes/resume.routes"));

mongoose.connect(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 5000
})
.then(() => {
  console.log("MongoDB Atlas connected");
  app.listen(5000, () => {
    console.log("Server running on port 5000");
  });
})
.catch(err => console.error(err));

app.get("/", (req, res) => {
  res.send("Backend running with Atlas");
});
