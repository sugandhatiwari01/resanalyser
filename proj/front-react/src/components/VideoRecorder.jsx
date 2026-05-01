// components/VideoRecorder.jsx
import { useEffect, useRef, useState, useCallback } from "react";

const FACE_API_CDN = "https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js";
const MODELS_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model";
const DETECTION_INTERVAL_MS = 1000; // 1000ms on CPU (was 500ms for WebGL)

export default function VideoRecorder({ onRecordingComplete, maxSeconds = 120 }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const detectionTimer = useRef(null);
  const rafRef = useRef(null);
  const faceApiLoadedRef = useRef(false);
  const expressionHistory = useRef([]);

  // Smoothed display values — lerped every RAF frame → buttery animation
  const smoothed = useRef({ confidence: 0, stress: 0 });
  // Raw inference targets written by face detection
  const targets = useRef({ confidence: 0, stress: 0, faceDetected: false });

  const [status, setStatus] = useState("idle");
  const [secondsLeft, setSecondsLeft] = useState(maxSeconds);
  const [videoURL, setVideoURL] = useState(null);
  const [faceReady, setFaceReady] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);

  // ─── Load face-api once ───────────────────────────────────────────────────
  useEffect(() => {
    // Guard against React StrictMode double-invoke and re-runs
    if (faceApiLoadedRef.current || window.__faceApiLoading) return;
    window.__faceApiLoading = true;

    setLoadingModels(true);
    const script = document.createElement("script");
    script.src = FACE_API_CDN;
    script.onload = async () => {
      try {
        // Force CPU backend — WebGL is unavailable in many environments
        await window.faceapi.tf.setBackend("cpu");
        await window.faceapi.tf.ready();

        await Promise.all([
          window.faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_URL),
          window.faceapi.nets.faceExpressionNet.loadFromUri(MODELS_URL),
        ]);
        faceApiLoadedRef.current = true;
        setFaceReady(true);
      } catch (e) {
        console.warn("face-api models failed:", e);
      } finally {
        window.__faceApiLoading = false;
        setLoadingModels(false);
      }
    };
    script.onerror = () => {
      window.__faceApiLoading = false;
      setLoadingModels(false);
    };
    document.head.appendChild(script);
  }, []);

  // ─── Scoring ──────────────────────────────────────────────────────────────
  const scoreOf = (expressions) => {
    if (!expressions) return { confidence: 0, stress: 0, label: "Unknown" };
    const pos = (expressions.happy || 0) + (expressions.neutral || 0) * 0.7 + (expressions.surprised || 0) * 0.4;
    const neg = (expressions.angry || 0) + (expressions.fearful || 0) * 0.9 + (expressions.disgusted || 0) * 0.8 + (expressions.sad || 0) * 0.6;
    const confidence = Math.min(100, Math.max(0, (pos / (pos + neg + 0.01)) * 100));
    const stress = Math.min(100, Math.max(0, ((expressions.fearful || 0) * 90 + (expressions.angry || 0) * 80 + (expressions.sad || 0) * 50)));
    const dominant = Object.entries(expressions).sort((a, b) => b[1] - a[1])[0]?.[0] || "neutral";
    const labels = {
      happy: "Confident & Positive", neutral: "Composed & Focused",
      surprised: "Engaged & Alert", sad: "Low Energy",
      fearful: "Nervous", disgusted: "Discomfort", angry: "Tense",
    };
    return { confidence, stress, label: labels[dominant] || "Neutral" };
  };

  // ─── Canvas helpers ───────────────────────────────────────────────────────
  const roundRect = (ctx, x, y, w, h, r) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  };

  // ─── RAF HUD loop ─────────────────────────────────────────────────────────
  const LERP_SPEED = 0.07;
  const lerp = (a, b, t) => a + (b - a) * t;

  const drawHUD = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    smoothed.current.confidence = lerp(smoothed.current.confidence, targets.current.confidence, LERP_SPEED);
    smoothed.current.stress = lerp(smoothed.current.stress, targets.current.stress, LERP_SPEED);

    const conf = smoothed.current.confidence;
    const stress = smoothed.current.stress;
    const detected = targets.current.faceDetected;

    if (!detected) {
      const msg = "No face detected";
      ctx.font = "600 12px -apple-system, BlinkMacSystemFont, sans-serif";
      const tw = ctx.measureText(msg).width;
      const pw = tw + 28, ph = 28;
      const bx = (W - pw) / 2, by = H - ph - 14;
      roundRect(ctx, bx, by, pw, ph, 8);
      ctx.fillStyle = "rgba(8,8,16,0.78)";
      ctx.fill();
      roundRect(ctx, bx, by, pw, ph, 8);
      ctx.strokeStyle = "rgba(248,113,113,0.4)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = "#fca5a5";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(msg, bx + pw / 2, by + ph / 2);
      ctx.textBaseline = "alphabetic";
      ctx.textAlign = "left";
      rafRef.current = requestAnimationFrame(drawHUD);
      return;
    }

    // ── TOP-RIGHT HUD CARD ────────────────────────────────────────────────
    const PAD = 12;
    const cardW = 170;
    const cardH = 96;
    const cardX = W - cardW - PAD;
    const cardY = PAD;

    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 4;
    roundRect(ctx, cardX, cardY, cardW, cardH, 12);
    ctx.fillStyle = "rgba(8, 10, 22, 0.82)";
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    roundRect(ctx, cardX, cardY, cardW, cardH, 12);
    ctx.strokeStyle = "rgba(255,255,255,0.11)";
    ctx.lineWidth = 1;
    ctx.stroke();

    const confHex = conf >= 70 ? "#4ade80" : conf >= 40 ? "#fb923c" : "#f87171";
    const confLabel = conf >= 70 ? "High" : conf >= 40 ? "Moderate" : "Low";
    const IX = cardX + 12;

    ctx.font = "600 9px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.40)";
    ctx.letterSpacing = "0.5px";
    ctx.fillText("CONFIDENCE", IX, cardY + 17);
    ctx.letterSpacing = "0px";

    ctx.font = "bold 20px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillStyle = confHex;
    ctx.fillText(`${Math.round(conf)}%`, IX, cardY + 37);

    const numW = ctx.measureText(`${Math.round(conf)}%`).width;
    ctx.font = "600 10px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillStyle = confHex;
    ctx.globalAlpha = 0.75;
    ctx.fillText(confLabel, IX + numW + 6, cardY + 36);
    ctx.globalAlpha = 1;

    const barInnerW = cardW - 24;
    const confBarY = cardY + 43;
    roundRect(ctx, IX, confBarY, barInnerW, 5, 3);
    ctx.fillStyle = "rgba(255,255,255,0.10)";
    ctx.fill();
    const confFill = Math.max(6, barInnerW * (conf / 100));
    const confGrad = ctx.createLinearGradient(IX, 0, IX + confFill, 0);
    confGrad.addColorStop(0, confHex + "99");
    confGrad.addColorStop(1, confHex);
    roundRect(ctx, IX, confBarY, confFill, 5, 3);
    ctx.fillStyle = confGrad;
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(IX, cardY + 56);
    ctx.lineTo(cardX + cardW - 12, cardY + 56);
    ctx.stroke();

    const stressHex = stress > 50 ? "#f87171" : stress > 25 ? "#fb923c" : "#4ade80";
    const stressLabel = stress > 50 ? "High" : stress > 25 ? "Mild" : "Calm";

    ctx.font = "600 9px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.40)";
    ctx.fillText("STRESS", IX, cardY + 70);

    ctx.font = "bold 16px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillStyle = stressHex;
    ctx.fillText(`${Math.round(stress)}%`, IX, cardY + 87);

    const sBarX = IX + 52;
    const sBarW = cardW - 24 - 52;
    const sBarY = cardY + 76;
    roundRect(ctx, sBarX, sBarY, sBarW, 5, 3);
    ctx.fillStyle = "rgba(255,255,255,0.10)";
    ctx.fill();
    const sFill = Math.max(6, sBarW * (stress / 100));
    const sGrad = ctx.createLinearGradient(sBarX, 0, sBarX + sFill, 0);
    sGrad.addColorStop(0, stressHex + "99");
    sGrad.addColorStop(1, stressHex);
    roundRect(ctx, sBarX, sBarY, sFill, 5, 3);
    ctx.fillStyle = sGrad;
    ctx.fill();

    ctx.font = "600 10px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillStyle = stressHex;
    ctx.globalAlpha = 0.75;
    ctx.textAlign = "right";
    ctx.fillText(stressLabel, cardX + cardW - 12, cardY + 87);
    ctx.textAlign = "left";
    ctx.globalAlpha = 1;

    rafRef.current = requestAnimationFrame(drawHUD);
  }, []);

  const startHUDLoop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(drawHUD);
  }, [drawHUD]);

  const stopHUDLoop = () => cancelAnimationFrame(rafRef.current);

  // ─── Face inference ───────────────────────────────────────────────────────
  const runDetection = useCallback(async () => {
    if (!faceApiLoadedRef.current || !videoRef.current) return;
    const video = videoRef.current;
    if (video.readyState < 2 || video.paused || video.ended) return;

    const displaySize = { width: video.videoWidth || 640, height: video.videoHeight || 480 };
    if (canvasRef.current) window.faceapi.matchDimensions(canvasRef.current, displaySize);

    try {
      const det = await window.faceapi
        .detectSingleFace(video, new window.faceapi.TinyFaceDetectorOptions({
          inputSize: 160,       // slightly larger than 128 — more reliable on CPU
          scoreThreshold: 0.35, // slightly lower threshold
        }))
        .withFaceExpressions();

      if (det) {
        const { confidence, stress } = scoreOf(det.expressions);
        targets.current = { confidence, stress, faceDetected: true };
        expressionHistory.current.push({ ...det.expressions, timestamp: Date.now() });
        if (expressionHistory.current.length > 300) expressionHistory.current.shift();
      } else {
        targets.current.faceDetected = false;
      }
    } catch (_) { }
  }, []);

  const startFaceAnalysis = useCallback(() => {
    if (detectionTimer.current) clearInterval(detectionTimer.current);
    detectionTimer.current = setInterval(runDetection, DETECTION_INTERVAL_MS);
  }, [runDetection]);

  const stopFaceAnalysis = () => {
    if (detectionTimer.current) {
      clearInterval(detectionTimer.current);
      detectionTimer.current = null;
    }
  };

  // ─── Report ───────────────────────────────────────────────────────────────
  const generateReport = useCallback(() => {
    const history = expressionHistory.current;
    if (!history.length) return null;
    const avg = (key) => history.reduce((s, h) => s + (h[key] || 0), 0) / history.length;
    const avgExpressions = {
      happy: avg("happy"), neutral: avg("neutral"), surprised: avg("surprised"),
      sad: avg("sad"), fearful: avg("fearful"), disgusted: avg("disgusted"), angry: avg("angry"),
    };
    const { confidence, stress, label } = scoreOf(avgExpressions);
    const stressScores = history.map(h => (h.fearful || 0) * 0.9 + (h.angry || 0) * 0.8 + (h.sad || 0) * 0.5);
    const peakStress = Math.round(Math.max(...stressScores) * 100);
    const tips = [];
    if (avgExpressions.fearful > 0.15) tips.push("Nervousness was visible — slow, deliberate breathing helps.");
    if (avgExpressions.neutral > 0.6) tips.push("Great composure! Slight smiles make you appear more approachable.");
    if (avgExpressions.happy > 0.3) tips.push("Your positive energy came through clearly — keep it up!");
    if (avgExpressions.sad > 0.15) tips.push("Energy dipped at times. Try power-posing before your next answer.");
    if (avgExpressions.angry > 0.1) tips.push("Some tension detected — practice relaxing your jaw and brow.");
    if (!tips.length) tips.push("Well-balanced expression throughout. Keep this composure.");
    return {
      overallConfidence: Math.round(confidence),
      avgStress: Math.round(stress),
      peakStress,
      dominantMood: label,
      avgExpressions,
      tips,
      samplesAnalyzed: history.length,
    };
  }, []);

  // ─── Camera / recording ───────────────────────────────────────────────────
  const startPreview = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30, max: 30 } },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
      }
      setStatus("previewing");
      expressionHistory.current = [];
      smoothed.current = { confidence: 0, stress: 0 };
      targets.current = { confidence: 0, stress: 0, faceDetected: false };
      startHUDLoop();
      if (faceApiLoadedRef.current) startFaceAnalysis();
    } catch {
      alert("Please allow camera and microphone access.");
    }
  }, [startFaceAnalysis, startHUDLoop]);

  const startRecording = useCallback(() => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    setVideoURL(null);
    setSecondsLeft(maxSeconds);
    expressionHistory.current = [];

    const mimeTypes = ["video/webm;codecs=vp8,opus", "video/webm;codecs=vp9,opus", "video/webm"];
    let recorder;
    for (const mime of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mime)) {
        try {
          recorder = new MediaRecorder(streamRef.current, { mimeType: mime, videoBitsPerSecond: 600_000 });
          break;
        } catch { }
      }
    }
    if (!recorder) recorder = new MediaRecorder(streamRef.current);

    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      const report = generateReport();
      console.log("🧠 faceReport generated:", report);
      console.log("📊 expressionHistory length:", expressionHistory.current.length);
      const videoBlob = new Blob(chunksRef.current, { type: "video/webm" });
      const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
      setVideoURL(URL.createObjectURL(videoBlob));
      setStatus("done");
      if (videoRef.current) videoRef.current.srcObject = null;
      stopFaceAnalysis();
      stopHUDLoop();
      stopStream();
      onRecordingComplete(audioBlob, videoBlob, report);
    };

    mediaRecorderRef.current = recorder;
    recorder.start(1000);
    setStatus("recording");

    let remaining = maxSeconds;
    timerRef.current = setInterval(() => {
      remaining -= 1;
      setSecondsLeft(remaining);
      if (remaining <= 0) { clearInterval(timerRef.current); stopRecording(); }
    }, 1000);
  }, [maxSeconds, onRecordingComplete, generateReport]);

  const stopRecording = useCallback(() => {
    clearInterval(timerRef.current);
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  const retry = useCallback(() => {
    setVideoURL(null);
    expressionHistory.current = [];
    smoothed.current = { confidence: 0, stress: 0 };
    targets.current = { confidence: 0, stress: 0, faceDetected: false };
    setStatus("idle");
  }, []);

  useEffect(() => () => {
    clearInterval(timerRef.current);
    stopFaceAnalysis();
    stopHUDLoop();
    stopStream();
  }, []);

  const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, width: "100%", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>

      {loadingModels && (
        <div style={{ fontSize: 12, color: "#718096", display: "flex", alignItems: "center", gap: 6 }}>
          ⚙️ Loading facial analysis models…
        </div>
      )}

      {/* ── Video wrapper ── */}
      <div style={{ position: "relative", width: "100%", maxWidth: 560 }}>
        {status === "done" && videoURL ? (
          <video src={videoURL} controls style={videoStyle} />
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay playsInline muted disablePictureInPicture
              style={{ ...videoStyle, display: status === "idle" ? "none" : "block" }}
            />
            <canvas
              ref={canvasRef}
              style={{
                position: "absolute", top: 0, left: 0,
                width: "100%", height: "100%",
                pointerEvents: "none", borderRadius: 12,
                willChange: "contents",
              }}
            />
          </>
        )}

        {status === "idle" && (
          <div style={{ ...videoStyle, border: "2px dashed #2d3748", background: "#0f1117", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#4a5568", gap: 10 }}>
            <span style={{ fontSize: 40 }}>📹</span>
            <p style={{ margin: 0, fontSize: 14 }}>Camera not started</p>
          </div>
        )}

        {status === "recording" && (
          <div style={{
            position: "absolute", top: 12, left: 12,
            background: "rgba(8,10,22,0.82)",
            color: "#f8fafc", borderRadius: 8, padding: "5px 12px",
            fontSize: 14, fontWeight: 700, fontFamily: "monospace",
            border: "1px solid rgba(255,255,255,0.10)",
            display: "flex", alignItems: "center", gap: 7,
            backdropFilter: "blur(4px)",
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: "50%", background: "#f87171",
              display: "inline-block", boxShadow: "0 0 8px #f87171",
              animation: "pulse 1.2s ease-in-out infinite",
            }} />
            {formatTime(secondsLeft)}
          </div>
        )}

        {status === "previewing" && (
          <div style={{
            position: "absolute", top: 12, left: 12,
            background: "rgba(8,10,22,0.72)", color: "rgba(255,255,255,0.5)",
            borderRadius: 8, padding: "5px 12px", fontSize: 11, fontWeight: 700,
            letterSpacing: "0.06em", border: "1px solid rgba(255,255,255,0.08)",
          }}>
            PREVIEW
          </div>
        )}
      </div>

      {/* ── Buttons ── */}
      <div style={{ display: "flex", gap: 14, marginTop: 10 }}>

  {status === "idle" && (
    <button style={btn("linear-gradient(135deg,#8b5e3c,#a47148)", true)} onClick={startPreview}>
      🎥 <span>Start Camera</span>
    </button>
  )}

  {status === "previewing" && (
    <button style={btn("linear-gradient(135deg,#dc2626,#ef4444)")} onClick={startRecording}>
      🔴 <span>Start Recording</span>
    </button>
  )}

  {status === "recording" && (
    <button style={btn("linear-gradient(135deg,#d97706,#f59e0b)")} onClick={stopRecording}>
      ⏹ <span>Stop Recording</span>
    </button>
  )}

  {status === "done" && (
  <button
    style={{
      padding: "14px 26px",
      borderRadius: "12px",
      border: "none",
      cursor: "pointer",
      fontWeight: 600,
      fontSize: "15px",
      display: "flex",
      alignItems: "center",
      gap: "8px",
      background: "linear-gradient(135deg,#8b5e3c,#a47148)",
      color: "white",
      boxShadow: "0 6px 16px rgba(139,94,60,0.25)",
      transition: "all 0.25s ease",
      opacity: 0.95
    }}
    onClick={retry}
  >
    🔄 <span>Re-record</span>
  </button>
)}

</div>

      <style>{`
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.35; }
  }

  @keyframes pulseGlow {
    0% {
      box-shadow: 0 0 0 0 rgba(139, 94, 60, 0.5);
    }
    70% {
      box-shadow: 0 0 0 12px rgba(139, 94, 60, 0);
    }
    100% {
      box-shadow: 0 0 0 0 rgba(139, 94, 60, 0);
    }
  }

  button:hover {
    transform: scale(1.05);
  }
`}</style>
    </div>
  );
}

const videoStyle = {
  width: "100%", maxWidth: 560, borderRadius: 12,
  border: "2px solid rgba(255,255,255,0.07)", background: "#000",
  aspectRatio: "16/9", objectFit: "cover", display: "block",
};

const btn = (bg, pulse = false) => ({
  padding: "14px 26px",
  borderRadius: 12,
  border: "none",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 15,
  display: "flex",
  alignItems: "center",
  gap: 8,
  background: bg,
  color: "white",
  boxShadow: "0 8px 20px rgba(0,0,0,0.2)",
  transition: "all 0.25s ease",
  animation: pulse ? "pulseGlow 1.5s infinite" : "none",
});