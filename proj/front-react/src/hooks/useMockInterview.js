// hooks/useMockInterview.js
// Central state machine for the mock interview flow
import { useState, useCallback, useRef } from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

export function useMockInterview() {
  const [step, setStep] = useState("idle");
  // idle → generating → ready → recording → evaluating → done

  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [reportId, setReportId] = useState(null);
  const [aggregateScore, setAggregateScore] = useState(null);
  const [error, setError] = useState(null);

  // ── Refs to avoid stale closures inside async useCallback ─────────────────
  // These mirror their state counterparts and are always up-to-date.
  const questionsRef = useRef([]);
  const currentIndexRef = useRef(0);
  const answersRef = useRef([]);

  // ─── Step 1: Generate questions from resume + JD ──────────────────────────
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
      // sync refs immediately so submitAnswer sees fresh data
      questionsRef.current = data.questions;
      currentIndexRef.current = 0;
      answersRef.current = [];
      setStep("ready");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to generate questions.");
      setStep("idle");
    }
  }, []);

  // ─── Step 2: Transcribe + evaluate + store faceReport ────────────────────
  // Uses refs instead of closed-over state — never stale after awaits.
  const submitAnswer = useCallback(async (audioBlob, jobDescription, faceReport = null) => {
    // Read from refs — always current, never stale
    const question = questionsRef.current[currentIndexRef.current];
    if (!question) return;

    setStep("evaluating");
    setError(null);

    try {
      // ── 2a. Transcribe ────────────────────────────────────────────────────
      const formData = new FormData();
      formData.append("audio", audioBlob, "answer.webm");
      const { data: transcribeData } = await axios.post(`${API}/interview/transcribe`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const transcript = transcribeData.transcript;

      // ── 2b. Evaluate ──────────────────────────────────────────────────────
      const { data: evalData } = await axios.post(`${API}/interview/evaluate-answer`, {
        question: question.question,
        transcript,
        jobDescription,
      });

      // ── 2c. Build answer with faceReport ──────────────────────────────────
      const newAnswer = {
        questionId: question.id,
        question: question.question,
        transcript,
        evaluation: evalData,
        faceReport,                         // ← passed in directly, never stale
      };

      // Update ref first (sync), then state (async re-render)
      const updatedAnswers = [...answersRef.current, newAnswer];
      answersRef.current = updatedAnswers;
      setAnswers(updatedAnswers);

      const nextIndex = currentIndexRef.current + 1;

      // ── Move to next question or finish ───────────────────────────────────
      if (nextIndex < questionsRef.current.length) {
        currentIndexRef.current = nextIndex;
        setCurrentIndex(nextIndex);
        setStep("ready");
      } else {
        // All questions done — save report
        const { data: reportData } = await axios.post(`${API}/interview/save-report`, {
          jobDescription,
          questions: questionsRef.current,
          answers: updatedAnswers,
        });
        setReportId(reportData.reportId);
        setAggregateScore(reportData.aggregateScore);
        setStep("done");
      }
    } catch (err) {
      setError(err.response?.data?.error || "Failed to process answer.");
      setStep("ready");
    }
  }, []); // empty deps — reads everything from refs, never stale

  // ─── Reset ────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    setStep("idle");
    setQuestions([]);
    setCurrentIndex(0);
    setAnswers([]);
    setReportId(null);
    setAggregateScore(null);
    setError(null);
    questionsRef.current = [];
    currentIndexRef.current = 0;
    answersRef.current = [];
  }, []);

  return {
    step,
    questions,
    currentIndex,
    currentQuestion: questionsRef.current[currentIndexRef.current] || null,
    answers,
    reportId,
    aggregateScore,
    error,
    generateQuestions,
    submitAnswer,
    reset,
  };
}