// components/VideoRecorder.jsx
// WebRTC-based video + audio recorder
// Props:
//   onRecordingComplete(audioBlob, videoBlob) — called when user stops recording
//   maxSeconds — auto-stop after N seconds (default 120)

import { useEffect, useRef, useState, useCallback } from "react";

export default function VideoRecorder({ onRecordingComplete, maxSeconds = 120 }) {
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  const [status, setStatus] = useState("idle"); // idle | previewing | recording | done
  const [secondsLeft, setSecondsLeft] = useState(maxSeconds);
  const [videoURL, setVideoURL] = useState(null);

  // Start webcam preview
  const startPreview = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true; // prevent echo during preview
      }
      setStatus("previewing");
    } catch (err) {
      console.error("Camera access denied:", err);
      alert("Please allow camera and microphone access to use this feature.");
    }
  }, []);

  // Start recording
  const startRecording = useCallback(() => {
    if (!streamRef.current) return;

    chunksRef.current = [];
    setVideoURL(null);
    setSecondsLeft(maxSeconds);

    const options = { mimeType: "video/webm;codecs=vp8,opus" };
    let recorder;
    try {
      recorder = new MediaRecorder(streamRef.current, options);
    } catch {
      // Fallback for Safari
      recorder = new MediaRecorder(streamRef.current);
    }

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const videoBlob = new Blob(chunksRef.current, { type: "video/webm" });
      // Extract audio-only blob for Whisper transcription
      // Whisper accepts webm with audio track
      const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
      const url = URL.createObjectURL(videoBlob);
      setVideoURL(url);
      setStatus("done");
      if (videoRef.current) videoRef.current.srcObject = null;
      stopStream();
      onRecordingComplete(audioBlob, videoBlob);
    };

    mediaRecorderRef.current = recorder;
    recorder.start(250); // collect data every 250ms
    setStatus("recording");

    // Countdown timer
    let remaining = maxSeconds;
    timerRef.current = setInterval(() => {
      remaining -= 1;
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        clearInterval(timerRef.current);
        stopRecording();
      }
    }, 1000);
  }, [maxSeconds, onRecordingComplete]);

  const stopRecording = useCallback(() => {
    clearInterval(timerRef.current);
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // Retry — restart preview
  const retry = useCallback(() => {
    setVideoURL(null);
    setStatus("idle");
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      stopStream();
    };
  }, [stopStream]);

  const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="video-recorder">
      {/* VIDEO ELEMENT */}
      {status === "done" && videoURL ? (
        <video src={videoURL} controls className="video-preview" />
      ) : (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="video-preview"
          style={{ display: status === "idle" ? "none" : "block" }}
        />
      )}

      {/* PLACEHOLDER when idle */}
      {status === "idle" && (
        <div className="video-placeholder">
          <span>📹</span>
          <p>Camera not started</p>
        </div>
      )}

      {/* TIMER BADGE */}
      {status === "recording" && (
        <div className="timer-badge">
          🔴 {formatTime(secondsLeft)}
        </div>
      )}

      {/* CONTROLS */}
      <div className="recorder-controls">
        {status === "idle" && (
          <button className="btn btn-primary" onClick={startPreview}>
            📷 Start Camera
          </button>
        )}

        {status === "previewing" && (
          <button className="btn btn-danger" onClick={startRecording}>
            ⏺ Start Recording
          </button>
        )}

        {status === "recording" && (
          <button className="btn btn-warning" onClick={stopRecording}>
            ⏹ Stop Recording
          </button>
        )}

        {status === "done" && (
          <button className="btn btn-secondary" onClick={retry}>
            🔄 Re-record
          </button>
        )}
      </div>

      <style>{`
        .video-recorder {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          width: 100%;
        }
        .video-preview {
          width: 100%;
          max-width: 560px;
          border-radius: 12px;
          border: 2px solid #e2e8f0;
          background: #000;
          aspect-ratio: 16/9;
          object-fit: cover;
        }
        .video-placeholder {
          width: 100%;
          max-width: 560px;
          aspect-ratio: 16/9;
          border-radius: 12px;
          border: 2px dashed #cbd5e0;
          background: #f7fafc;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #a0aec0;
          font-size: 14px;
          gap: 8px;
        }
        .video-placeholder span { font-size: 36px; }
        .timer-badge {
          position: absolute;
          top: 12px;
          right: 12px;
          background: rgba(0,0,0,0.7);
          color: #fff;
          border-radius: 8px;
          padding: 4px 10px;
          font-size: 14px;
          font-weight: 600;
          font-family: monospace;
        }
        .recorder-controls {
          display: flex;
          gap: 8px;
        }
        .btn {
          padding: 8px 20px;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          font-weight: 600;
          font-size: 14px;
          transition: opacity 0.2s;
        }
        .btn:hover { opacity: 0.85; }
        .btn-primary { background: #4f46e5; color: white; }
        .btn-danger { background: #e53e3e; color: white; }
        .btn-warning { background: #ed8936; color: white; }
        .btn-secondary { background: #718096; color: white; }
      `}</style>
    </div>
  );
}
