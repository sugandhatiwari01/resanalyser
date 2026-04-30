// hooks/useMockInterview.js
// Central state machine for the mock interview flow
import { useState, useCallback } from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export function useMockInterview() {
  const [step, setStep] = useState("idle");
  // idle → generating → ready → recording → evaluating → done

  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState([]); // [{ questionId, transcript, evaluation }]
  const [reportId, setReportId] = useState(null);
  const [aggregateScore, setAggregateScore] = useState(null);
  const [error, setError] = useState(null);
  console.log("API URL:", import.meta.env.VITE_API_URL);
  // Step 1: Generate questions from resume + JD
  const generateQuestions = useCallback(async (resumeText, jobDescription, numQuestions = 5) => {
    setStep("generating");
    setError(null);
    try {
      const { data } = await axios.post(`${API}/interview/generate-questions`, {
        resumeText,
        jobDescription,
        numQuestions,
      });
      setQuestions(data.questions);
      setCurrentIndex(0);
      setAnswers([]);
      setStep("ready");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to generate questions.");
      setStep("idle");
    }
  }, []);

  // Step 2: After recording, transcribe audio blob and evaluate answer
  const submitAnswer = useCallback(async (audioBlob, jobDescription) => {
    if (!questions[currentIndex]) return;
    setStep("evaluating");
    setError(null);

    try {
      // 2a. Transcribe
      const formData = new FormData();
      formData.append("audio", audioBlob, "answer.webm");
      const { data: transcribeData } = await axios.post(`${API}/interview/transcribe`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const transcript = transcribeData.transcript;

      // 2b. Evaluate
      const { data: evalData } = await axios.post(`${API}/interview/evaluate-answer`, {
        question: questions[currentIndex].question,
        transcript,
        jobDescription,
      });

      const newAnswer = {
        questionId: questions[currentIndex].id,
        question: questions[currentIndex].question,
        transcript,
        evaluation: evalData,
      };

      const updatedAnswers = [...answers, newAnswer];
      setAnswers(updatedAnswers);

      // Move to next question or finish
      if (currentIndex + 1 < questions.length) {
        setCurrentIndex((i) => i + 1);
        setStep("ready");
      } else {
        // All questions done — save report
        const { data: reportData } = await axios.post(`${API}/interview/save-report`, {
          jobDescription,
          questions,
          answers: updatedAnswers,
        });
        setReportId(reportData.reportId);
        setAggregateScore(reportData.aggregateScore);
        setStep("done");
      }
    } catch (err) {
      setError(err.response?.data?.error || "Failed to process answer.");
      setStep("ready"); // let user retry
    }
  }, [questions, currentIndex, answers]);

  const reset = useCallback(() => {
    setStep("idle");
    setQuestions([]);
    setCurrentIndex(0);
    setAnswers([]);
    setReportId(null);
    setAggregateScore(null);
    setError(null);
  }, []);

  return {
    step,
    questions,
    currentIndex,
    currentQuestion: questions[currentIndex] || null,
    answers,
    reportId,
    aggregateScore,
    error,
    generateQuestions,
    submitAnswer,
    reset,
  };
} 