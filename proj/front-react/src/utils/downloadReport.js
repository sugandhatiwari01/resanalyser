// utils/downloadReport.js
// Generates and downloads a PDF interview report entirely in the browser.
// Uses jsPDF (loaded from CDN via a dynamic import shim).
//
// Usage:
//   import { downloadReport } from "../utils/downloadReport";
//   await downloadReport({ answers, aggregateScore, jobDescription });
//
// Install jsPDF if not already in your project:
//   npm install jspdf

import { jsPDF } from "jspdf";

// ── Helpers ───────────────────────────────────────────────────────────────────

const PAD = 20;          // left/right page margin
const PAGE_W = 210;      // A4 width  (mm)
const PAGE_H = 297;      // A4 height (mm)
const CONTENT_W = PAGE_W - PAD * 2;

// Color palette (R, G, B)
const C = {
    indigo: [79, 70, 229],
    indigoDk: [49, 46, 129],
    green: [5, 150, 105],
    greenLt: [209, 250, 229],
    amber: [217, 119, 6],
    amberLt: [255, 251, 235],
    red: [220, 38, 38],
    redLt: [254, 226, 226],
    slate9: [15, 23, 42],
    slate7: [51, 65, 85],
    slate5: [100, 116, 139],
    slate3: [203, 213, 225],
    slate1: [248, 250, 252],
    white: [255, 255, 255],
    dark: [15, 17, 23],
    teal: [20, 184, 166],
    orange: [251, 146, 60],
};

const scoreColor = (s) => s >= 7 ? C.green : s >= 4 ? C.amber : C.red;
const scoreBg = (s) => s >= 7 ? C.greenLt : s >= 4 ? C.amberLt : C.redLt;

function setFill(doc, rgb) { doc.setFillColor(...rgb); }
function setDraw(doc, rgb) { doc.setDrawColor(...rgb); }
function setTxt(doc, rgb) { doc.setTextColor(...rgb); }
function setFont(doc, style, size) {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
}

// Draw a rounded rect (jsPDF's roundedRect uses 'F'/'S'/'FD')
function rRect(doc, x, y, w, h, r, style = "F") {
    doc.roundedRect(x, y, w, h, r, r, style);
}

// Draw a horizontal score bar
function scoreBar(doc, x, y, w, h, score) {
    // background
    setFill(doc, [220, 220, 220]);
    doc.rect(x, y, w, h, "F");

    // filled part
    const pct = Math.max(0, Math.min(score / 10, 1));
    setFill(doc, scoreColor(score));
    doc.rect(x, y, w * pct, h, "F");
}

// Add a new page and return the starting Y
function newPage(doc) {
    doc.addPage();
    return 24;
}

// Check if we need a page break; if so, add page and return new Y
function checkY(doc, y, needed = 20) {
    if (y + needed > PAGE_H - 20) return newPage(doc);
    return y;
}

// Wrapped text — returns new Y after drawing
function wrappedText(doc, text, x, y, maxW, lineH = 5) {
    const lines = doc.splitTextToSize(String(text || ""), maxW);
    doc.text(lines, x, y);
    return y + lines.length * lineH;
}

// ── Section header band ────────────────────────────────────────────────────────
function sectionHeader(doc, y, label) {
    setFill(doc, C.indigo);
    doc.rect(PAD, y, CONTENT_W, 8, "F");
    setFont(doc, "bold", 9);
    setTxt(doc, C.white);
    doc.text(label.toUpperCase(), PAD + 4, y + 5.5);
    return y + 12;
}

// ── Score chip (pill badge) ────────────────────────────────────────────────────
function scoreChip(doc, x, y, score, label) {
    const bg = scoreBg(score);
    const fg = scoreColor(score);
    setFill(doc, bg);
    rRect(doc, x, y - 4, 22, 6, 3);
    setFont(doc, "bold", 8);
    setTxt(doc, fg);
    doc.text(`${score}/10`, x + 11, y, { align: "center" });
    if (label) {
        setFont(doc, "normal", 7);
        setTxt(doc, C.slate5);
        doc.text(label, x + 11, y + 4.5, { align: "center" });
    }
}

// ── Mini donut drawn with arcs (approximated as filled circle + text) ─────────
function miniGauge(doc, cx, cy, r, pct, color, label, sublabel) {
    // background circle
    setFill(doc, C.slate3);
    doc.circle(cx, cy, r, "F");
    // filled arc approximation — draw a wedge using lines
    // jsPDF doesn't support arcs natively, so use a filled circle overlay
    setFill(doc, color);
    // We approximate the arc as a pie slice using polygon
    const steps = 40;
    const angle = pct * 2 * Math.PI;
    const startAngle = -Math.PI / 2;
    const pts = [[cx, cy]];
    for (let i = 0; i <= steps; i++) {
        const a = startAngle + (angle * i) / steps;
        pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    if (pct > 0) {
        doc.setFillColor(...color);
        // draw filled polygon
        doc.lines(
            pts.slice(1).map((p, i) => {
                const prev = pts[i];
                return [p[0] - prev[0], p[1] - prev[1]];
            }),
            pts[0][0], pts[0][1],
            [1, 1], "F", true
        );
    }
    // inner white circle (donut hole)
    setFill(doc, C.dark);
    doc.circle(cx, cy, r * 0.62, "F");
    // percentage text
    setFont(doc, "bold", 7);
    setTxt(doc, color);
    doc.text(`${Math.round(pct * 100)}%`, cx, cy + 2, { align: "center" });
    // label below
    setFont(doc, "bold", 6.5);
    setTxt(doc, C.slate5);
    doc.text(label, cx, cy + r + 5, { align: "center" });
    setFont(doc, "normal", 6);
    setTxt(doc, C.slate5);
    doc.text(sublabel, cx, cy + r + 9, { align: "center" });
}

// ── Expression bar row ─────────────────────────────────────────────────────────
function exprRow(doc, x, y, expr, val, color) {
    const pct = Math.round(val * 100);

    setFont(doc, "normal", 7);
    setTxt(doc, C.slate5);
    doc.text(`${expr}: ${pct}%`, x, y);

    return y + 5;
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function downloadReport({ answers = [], aggregateScore = {}, jobDescription = "", candidateName = "" }) {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const date = new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" });

    // ════════════════════════════════════════════════════════════════════════════
    // PAGE 1 — COVER + SUMMARY
    // ════════════════════════════════════════════════════════════════════════════

    // Header band
    setFill(doc, C.indigoDk);
    doc.rect(0, 0, PAGE_W, 52, "F");

    // Accent stripe
    setFill(doc, C.indigo);
    doc.rect(0, 48, PAGE_W, 4, "F");

    // Title
    setFont(doc, "bold", 22);
    setTxt(doc, C.white);
    doc.text("Mock Interview Report", PAD, 22);

    setFont(doc, "normal", 10);
    setTxt(doc, [180, 190, 255]);
    doc.text("AI-Powered Interview Performance Analysis", PAD, 30);

    setFont(doc, "normal", 8);
    setTxt(doc, [160, 170, 220]);
    if (candidateName) doc.text(`Candidate: ${candidateName}`, PAD, 38);
    doc.text(`Generated: ${date}`, PAD, candidateName ? 43 : 38);

    // JD snippet
    if (jobDescription) {
        setFont(doc, "normal", 7);
        setTxt(doc, [160, 170, 220]);
        const jdLines = doc.splitTextToSize(`Role: ${jobDescription.slice(0, 120)}${jobDescription.length > 120 ? "…" : ""}`, CONTENT_W);
        doc.text(jdLines, PAD, candidateName ? 48 : 43);
    }

    let y = 64;

    // ── OVERALL PERFORMANCE CARD ─────────────────────────────────────────────
    setFill(doc, C.slate1);
    rRect(doc, PAD, y, CONTENT_W, 44, 4);
    setDraw(doc, C.slate3);
    doc.setLineWidth(0.3);
    rRect(doc, PAD, y, CONTENT_W, 44, 4, "S");

    setFont(doc, "bold", 11);
    setTxt(doc, C.slate9);
    doc.text("Overall Performance", PAD + 6, y + 9);

    setFont(doc, "normal", 8);
    setTxt(doc, C.slate5);
    doc.text(`${answers.length} question${answers.length !== 1 ? "s" : ""} answered`, PAD + 6, y + 15);

    // Three score boxes
    const metrics = [
        { label: "Technical", value: aggregateScore?.technicalAvg ?? 0 },
        { label: "Clarity", value: aggregateScore?.clarityAvg ?? 0 },
        { label: "Overall", value: aggregateScore?.overallAvg ?? 0 },
    ];
    const boxW = (CONTENT_W - 20) / 3;
    metrics.forEach((m, i) => {
        const bx = PAD + 6 + i * (boxW + 3);
        const by = y + 20;
        setFill(doc, scoreBg(m.value));
        rRect(doc, bx, by, boxW, 18, 3);
        setFont(doc, "bold", 16);
        setTxt(doc, scoreColor(m.value));
        doc.text(`${m.value}`, bx + boxW / 2, by + 11, { align: "center" });
        setFont(doc, "normal", 6);
        setTxt(doc, C.slate5);
        doc.text("/10", bx + boxW / 2 + 5, by + 11);
        setFont(doc, "bold", 7);
        setTxt(doc, C.slate7);
        doc.text(m.label, bx + boxW / 2, by + 16, { align: "center" });
    });

    y += 52;

    // ── QUESTION SUMMARY TABLE ────────────────────────────────────────────────
    y = sectionHeader(doc, y, "Question-by-Question Summary");

    // Table header
    setFill(doc, C.slate1);
    doc.rect(PAD, y, CONTENT_W, 7, "F");
    setFont(doc, "bold", 7.5);
    setTxt(doc, C.slate7);
    doc.text("#", PAD + 3, y + 5);
    doc.text("Question", PAD + 10, y + 5);
    doc.text("Tech", PAD + 120, y + 5);
    doc.text("Clarity", PAD + 135, y + 5);
    doc.text("Overall", PAD + 152, y + 5);
    y += 7;

    answers.forEach((a, i) => {
        y = checkY(doc, y, 14);
        const bg = i % 2 === 0 ? C.white : C.slate1;
        setFill(doc, bg);
        doc.rect(PAD, y, CONTENT_W, 16, "F");

        const qText = doc.splitTextToSize(a.question || "", 105);
        setFont(doc, "normal", 7);
        setTxt(doc, C.slate9);
        doc.text(`${i + 1}`, PAD + 3, y + 5);
        const lines = doc.splitTextToSize(a.question || "", 100);
doc.text(lines.slice(0, 2), PAD + 10, y + 5);
        y += 1;

        const ev = a.evaluation || {};
        scoreChip(doc, PAD + 118, y + 3, ev.technicalScore ?? 0, "");
        scoreChip(doc, PAD + 133, y + 3, ev.clarityScore ?? 0, "");
        scoreChip(doc, PAD + 150, y + 3, ev.overallScore ?? 0, "");

        // Face report mini badge
        if (a.faceReport) {
            const conf = a.faceReport.overallConfidence ?? 0;
            const confColor = conf >= 70 ? C.green : conf >= 40 ? C.amber : C.red;
            setFont(doc, "bold", 6);
            setTxt(doc, confColor);
            doc.text(` ${conf}%`, PAD + 170, y + 5);
        }

        y += 16;
    });

    y += 6;

    // ════════════════════════════════════════════════════════════════════════════
    // PAGES 2+ — PER-QUESTION DETAIL
    // ════════════════════════════════════════════════════════════════════════════

    for (let i = 0; i < answers.length; i++) {
        const a = answers[i];
        const ev = a.evaluation || {};
        const fr = a.faceReport;

        y = newPage(doc);

        // ── Question header ───────────────────────────────────────────────────
        setFill(doc, C.indigo);
        rRect(doc, PAD, y, CONTENT_W, 14, 3);
        setFont(doc, "bold", 8);
        setTxt(doc, [180, 190, 255]);
        doc.text(`Q${i + 1} of ${answers.length}`, PAD + 4, y + 5.5);
        setFont(doc, "bold", 9);
        setTxt(doc, C.white);
        const qLines = doc.splitTextToSize(a.question || "", CONTENT_W - 30);
        doc.text(qLines[0] + (qLines.length > 1 ? "…" : ""), PAD + 4, y + 11);
        // Overall badge top-right
        scoreChip(doc, PAGE_W - PAD - 24, y + 4, ev.overallScore ?? 0, "Overall");
        y += 18;

        // ── Score bars ────────────────────────────────────────────────────────
        setFill(doc, C.slate1);
        rRect(doc, PAD, y, CONTENT_W, 26, 3);

        const bars = [
            { label: "Technical Knowledge", score: ev.technicalScore ?? 0 },
            { label: "Clarity & Communication", score: ev.clarityScore ?? 0 },
        ];
        bars.forEach((b, bi) => {
            const by = y + 6 + bi * 11;
            setFont(doc, "normal", 8);
            setTxt(doc, C.slate7);
            doc.text(b.label, PAD + 4, by);
            setFont(doc, "bold", 8);
            setTxt(doc, scoreColor(b.score));
            doc.text(`${b.score}/10`, PAD + CONTENT_W - 4, by, { align: "right" });
            scoreBar(doc, PAD + 4, by + 2, CONTENT_W - 8, 3, b.score);
        });
        y += 30;

        // ── Transcript ────────────────────────────────────────────────────────
        if (a.transcript) {
            y = checkY(doc, y, 18);
            setFont(doc, "bold", 8);
            setTxt(doc, C.slate7);
            doc.text("Your Answer (Transcript)", PAD, y);
            y += 4;
            setFill(doc, C.slate1);
            const tLines = doc.splitTextToSize(a.transcript, CONTENT_W - 8);
            const tH = Math.min(tLines.length, 6) * 4.5 + 6;
            rRect(doc, PAD, y, CONTENT_W, tH, 2);
            setFont(doc, "normal", 7.5);
            setTxt(doc, C.slate7);
            const shown = tLines.slice(0, 6);
            shown.forEach((line, li) => doc.text(line, PAD + 4, y + 5 + li * 4.5));
            if (tLines.length > 6) {
                setFont(doc, "italic", 7);
                setTxt(doc, C.slate5);
                doc.text("… (truncated)", PAD + 4, y + tH - 2);
            }
            y += tH + 4;
        }

        // ── Keywords ─────────────────────────────────────────────────────────
        const kd = ev.keywords_detected || [];
        const km = ev.keywords_missing || [];
        if (kd.length || km.length) {
            y = checkY(doc, y, 16);
            if (kd.length) {
                setFont(doc, "bold", 7.5);
                setTxt(doc, C.green);
                doc.text("✓ Keywords detected:", PAD, y);
                setFont(doc, "normal", 7.5);
                setTxt(doc, C.slate7);
                doc.text(kd.join("  ·  "), PAD + 36, y);
                y += 6;
            }
            if (km.length) {
                y = checkY(doc, y, 8);
                setFont(doc, "bold", 7.5);
                setTxt(doc, C.red);
                doc.text("✗ Keywords missed:", PAD, y);
                setFont(doc, "normal", 7.5);
                setTxt(doc, C.slate7);
                doc.text(km.join("  ·  "), PAD + 34, y);
                y += 6;
            }
            y += 2;
        }

        // ── Feedback ─────────────────────────────────────────────────────────
        const feedback = (ev.feedback || "").replace(/\*\*/g, "").trim();
        if (feedback) {
            y = checkY(doc, y, 20);
            setFont(doc, "bold", 8);
            setTxt(doc, C.slate7);
            doc.text("Feedback", PAD, y);
            y += 4;
            setFill(doc, [239, 246, 255]);
            const fbLines = doc.splitTextToSize(feedback, CONTENT_W - 8);
            const fbH = Math.min(fbLines.length, 8) * 4.5 + 6;
            rRect(doc, PAD, y, CONTENT_W, fbH, 2);
            setFont(doc, "normal", 7.5);
            setTxt(doc, C.slate7);
            fbLines.slice(0, 8).forEach((line, li) => doc.text(line, PAD + 4, y + 5 + li * 4.5));
            y += fbH + 4;
        }

        // ── FACIAL ANALYSIS ───────────────────────────────────────────────────
        if (fr) {
            y = checkY(doc, y, 60);

            // Dark card background
            const cardH = 58 + (fr.tips?.length ? fr.tips.length * 5 + 10 : 0);
            setFill(doc, C.dark);
            rRect(doc, PAD, y, CONTENT_W, cardH, 4);

            setFont(doc, "bold", 7.5);
            setTxt(doc, [100, 110, 160]);
            doc.text("FACIAL ANALYSIS — THIS QUESTION", PAD + 4, y + 7);

            // Confidence gauge
            
            //miniGauge(doc, PAD + 22, y + 28, 13, confPct, confC,
                //"Confidence", fr.overallConfidence >= 70 ? "High" : fr.overallConfidence >= 40 ? "Moderate" : "Low");
                setFont(doc, "normal", 7);
setTxt(doc, [200, 210, 240]);

const conf = fr.overallConfidence ?? 0;
const stress = fr.avgStress ?? 0;
const peak = fr.peakStress ?? 0;

let barY = y + 16;   // 🔥 single base line

// Confidence
doc.setFont("helvetica", "normal");
doc.setFontSize(7);
doc.setTextColor(220, 220, 220);
doc.text(`Confidence: ${conf}%`, PAD + 4, barY);

doc.setFillColor(70, 70, 90);
doc.rect(PAD + 4, barY + 3, 70, 3, "F");

doc.setFillColor(0, 200, 150);
doc.rect(PAD + 4, barY + 3, (70 * conf) / 100, 3, "F");

// Stress
barY += 10;

doc.text(`Stress: ${stress}%`, PAD + 4, barY);

doc.setFillColor(70, 70, 90);
doc.rect(PAD + 4, barY + 3, 70, 3, "F");

doc.setFillColor(255, 140, 0);
doc.rect(PAD + 4, barY + 3, (70 * stress) / 100, 3, "F");

// Peak Stress
barY += 10;

doc.text(`Peak Stress: ${peak}%`, PAD + 4, barY);

doc.setFillColor(70, 70, 90);
doc.rect(PAD + 4, barY + 3, 70, 3, "F");

doc.setFillColor(220, 50, 50);
doc.rect(PAD + 4, barY + 3, (70 * peak) / 100, 3, "F");

// Frames
barY += 10;
doc.text(`Frames: ${fr.samplesAnalyzed ?? 0}`, PAD + 4, barY);
barY += 6; 

            // Stress gauge
            
            //miniGauge(doc, PAD + 62, y + 28, 13, stPct, stC,
                //"Avg Stress", fr.avgStress > 50 ? "High" : fr.avgStress > 25 ? "Mild" : "Calm");
                

            // Frames badge
            setFill(doc, [25, 30, 45]);
            rRect(doc, PAD + 88, y + 13, 28, 26, 3);
            setFont(doc, "bold", 14);
            setTxt(doc, [200, 210, 240]);
            doc.text(`${fr.samplesAnalyzed ?? 0}`, PAD + 102, y + 27, { align: "center" });
            setFont(doc, "normal", 6);
            setTxt(doc, [100, 110, 160]);
            doc.text("FRAMES", PAD + 102, y + 33, { align: "center" });
            doc.text("ANALYZED", PAD + 102, y + 37, { align: "center" });

            // Dominant mood
            setFont(doc, "normal", 7);
            setTxt(doc, [150, 160, 200]);
            doc.text(`Dominant mood: ${fr.dominantMood ?? "—"}`, PAD + 4, y + 48);
            doc.text(`Peak stress: ${fr.peakStress ?? 0}%`, PAD + 4, y + 53);

            // Expression breakdown (right side)
            if (fr.avgExpressions) {
                const exprColors = {
                    happy: C.teal, neutral: [96, 165, 250], surprised: C.orange,
                    sad: C.red, fearful: C.red, disgusted: C.orange, angry: C.red,
                };
                let ey = y + 14;
                const ex = PAD + 122;
                setFont(doc, "bold", 6.5);
                setTxt(doc, [100, 110, 160]);
                doc.text("EXPRESSIONS", ex, ey);
                ey += 5;
                Object.entries(fr.avgExpressions)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .forEach(([expr, val]) => {
                        ey = exprRow(doc, ex, ey, expr, val, exprColors[expr] || C.orange);
                    });
            }

            // Tips
            if (fr.tips?.length) {
                let ty = y + cardH - fr.tips.length * 5 - 6;
                setFont(doc, "bold", 6.5);
                setTxt(doc, [100, 110, 160]);
                doc.text("BODY LANGUAGE TIPS", PAD + 4, ty);
                ty += 5;
                fr.tips.forEach(tip => {
                    setFont(doc, "normal", 6.5);
                    setTxt(doc, [150, 160, 200]);
                    const tl = doc.splitTextToSize(`• ${tip}`, CONTENT_W - 10);
                    doc.text(tl, PAD + 4, ty);
                    ty += tl.length * 4;
                });
            }

            y += cardH + 6;
        }
    }

    // ── Footer on every page ─────────────────────────────────────────────────
    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        setFill(doc, C.indigo);
        doc.rect(0, PAGE_H - 10, PAGE_W, 10, "F");
        setFont(doc, "normal", 6.5);
        setTxt(doc, [180, 190, 255]);
        doc.text("AI Mock Interview Report", PAD, PAGE_H - 3.5);
        doc.text(`Page ${p} of ${totalPages}`, PAGE_W - PAD, PAGE_H - 3.5, { align: "right" });
        doc.text(date, PAGE_W / 2, PAGE_H - 3.5, { align: "center" });
    }

    doc.save(`interview-report-${Date.now()}.pdf`);
}