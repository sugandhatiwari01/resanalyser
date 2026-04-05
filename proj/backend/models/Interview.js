const mongoose = require("mongoose");

const EvaluationSchema = new mongoose.Schema({
  technicalScore: Number,
  clarityScore: Number,
  overallScore: Number,
  strengths: [String],
  improvements: [String],
  feedback: String,
}, { _id: false });

const AnswerSchema = new mongoose.Schema({
  questionId: Number,
  question: String,
  transcript: String,
  evaluation: EvaluationSchema,
}, { _id: false });

const QuestionSchema = new mongoose.Schema({
  id: Number,
  type: { type: String, enum: ["technical", "behavioral"] },
  question: String,
}, { _id: false });

const InterviewSchema = new mongoose.Schema({
  userId: { type: String, default: "anonymous" },
  jobDescription: String,
  questions: [QuestionSchema],
  answers: [AnswerSchema],
  aggregateScore: {
    technicalAvg: Number,
    clarityAvg: Number,
    overallAvg: Number,
  },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Interview", InterviewSchema);
