import re
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from model_loader import model
from threshold_config import STRUCTURE_THRESHOLD, STAR_THRESHOLD

FILLERS = {
    "um", "uh", "like", "you know", "basically", "literally",
    "actually", "sort of", "kind of"
}


def clean_text(text: str) -> str:
    return text.lower().strip()


# ─────────────────────────────────────────
# 1. Fluency Metrics
# ─────────────────────────────────────────
def fluency_metrics(text: str) -> dict:
    words = re.findall(r'\b\w+\b', text)
    word_count = len(words)

    filler_count     = sum(1 for w in words if w in FILLERS)
    repetition_count = sum(1 for i in range(1, len(words)) if words[i] == words[i - 1])

    return {
        "wordCount":       word_count,
        "fillerCount":     filler_count,
        "fillerDensity":   round(filler_count / max(word_count, 1), 3),
        "repetitionCount": repetition_count,
        "repetitionRate":  round(repetition_count / max(word_count, 1), 3),
    }


# ─────────────────────────────────────────
# 2. Speaking Pace
# ─────────────────────────────────────────
def speaking_metrics(word_count: int, duration_sec: float) -> dict:
    if duration_sec < 3:
        estimated = max(word_count / 2.5, 5)
        return {"wpm": round((word_count / estimated) * 60, 2), "valid": False, "estimated": True}
    return {"wpm": round((word_count / duration_sec) * 60, 2), "valid": True, "estimated": False}


# ─────────────────────────────────────────
# 3. Fluency Label
# ─────────────────────────────────────────
def interpret_fluency(filler_density: float) -> str:
    if filler_density < 0.03:
        return "Excellent"
    elif filler_density < 0.07:
        return "Average"
    return "Needs Improvement"


# ─────────────────────────────────────────
# 4. Structure Score (0–1)
# Semantic anchors, threshold from config
# ─────────────────────────────────────────
def structure_score(text: str) -> dict:
    sentences = [s.strip() for s in text.split('.') if len(s.strip()) > 8]
    if not sentences:
        return {"score": 0.0, "hasSequence": False, "hasExample": False, "hasResult": False}

    sentence_embs = model.encode(sentences)

    sequence_ref = model.encode(["firstly then finally step by step in order"])[0]
    example_ref  = model.encode(["for example for instance to illustrate such as"])[0]
    result_ref   = model.encode(["the result was we achieved the outcome was improvement"])[0]

    has_sequence = bool(np.max(cosine_similarity(sentence_embs, [sequence_ref])[:, 0]) > STRUCTURE_THRESHOLD)
    has_example  = bool(np.max(cosine_similarity(sentence_embs, [example_ref])[:, 0])  > STRUCTURE_THRESHOLD)
    has_result   = bool(np.max(cosine_similarity(sentence_embs, [result_ref])[:, 0])   > STRUCTURE_THRESHOLD)

    raw = sum([has_sequence * 0.3, has_example * 0.3, has_result * 0.4])

    return {
        "score":       round(raw, 3),
        "hasSequence": has_sequence,
        "hasExample":  has_example,
        "hasResult":   has_result,
    }


# ─────────────────────────────────────────
# 5. STAR Score (0–1)
# ─────────────────────────────────────────
def star_score(text: str) -> dict:
    sentences = [s.strip() for s in text.split('.') if len(s.strip()) > 8]
    if not sentences:
        return {"situation": False, "task": False, "action": False, "result": False, "score": 0.0}

    sentence_embs = model.encode(sentences)

    refs = {
        "situation": model.encode(["the background context was the project team situation"])[0],
        "task":      model.encode(["my responsibility was the goal objective I was assigned"])[0],
        "action":    model.encode(["I built implemented developed designed created the solution"])[0],
        "result":    model.encode(["the result was improvement we achieved the outcome impact"])[0],
    }

    flags = {
        k: bool(np.max(cosine_similarity(sentence_embs, [v])[:, 0]) > STAR_THRESHOLD)
        for k, v in refs.items()
    }

    return {**flags, "score": round(sum(flags.values()) / 4, 3)}


# ─────────────────────────────────────────
# 6. Confidence Score (0–1)
# ─────────────────────────────────────────
def confidence_score(fluency: dict, speech: dict) -> float:
    score = 1.0
    score -= min(fluency["fillerDensity"]  * 4, 0.4)
    score -= min(fluency["repetitionRate"] * 3, 0.2)

    if speech["valid"] or speech.get("estimated"):
        wpm = speech["wpm"]
        if wpm < 80:
            score -= 0.2
        elif wpm > 200:
            score -= 0.15

    return round(max(score, 0.0), 3)


# ─────────────────────────────────────────
# 7. Overall Score (0–1)
# ─────────────────────────────────────────
def overall_score(structure: dict, star: dict, confidence: float) -> float:
    return round(
        structure["score"] * 0.4 +
        star["score"]      * 0.3 +
        confidence         * 0.3,
        3
    )


# ─────────────────────────────────────────
# 8. Feedback
# ─────────────────────────────────────────
def generate_feedback(fluency: dict, speech: dict, structure: dict, star: dict) -> list:
    feedback = []

    if fluency["fillerDensity"] > 0.05:
        feedback.append(f"High filler word usage ({fluency['fillerCount']} in {fluency['wordCount']} words) — pause instead of filling")

    if speech.get("valid") and speech["wpm"] < 100:
        feedback.append(f"Pace too slow ({speech['wpm']} WPM) — aim for 120–160 WPM")
    elif speech.get("valid") and speech["wpm"] > 190:
        feedback.append(f"Pace too fast ({speech['wpm']} WPM) — slow down for clarity")

    if not structure["hasSequence"]:
        feedback.append("No sequential flow detected — structure your answer with a clear progression")
    if not structure["hasExample"]:
        feedback.append("No examples detected — concrete examples strengthen answers significantly")
    if not structure["hasResult"]:
        feedback.append("No result or outcome mentioned — always close with what was achieved")

    missing = [k for k in ["situation", "task", "action", "result"] if not star[k]]
    if missing:
        feedback.append(f"STAR framework incomplete — missing: {', '.join(missing)}")

    return feedback


# ─────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────
def analyze_answer(transcript: str, duration_sec: float) -> dict:
    text = clean_text(transcript)

    fluency    = fluency_metrics(text)
    speech     = speaking_metrics(fluency["wordCount"], duration_sec)
    structure  = structure_score(text)
    star       = star_score(text)
    confidence = confidence_score(fluency, speech)
    overall    = overall_score(structure, star, confidence)
    feedback   = generate_feedback(fluency, speech, structure, star)

    return {
        "fluency":         fluency,
        "fluencyLevel":    interpret_fluency(fluency["fillerDensity"]),
        "speech":          speech,
        "structure":       structure,
        "star":            star,
        "confidenceScore": confidence,
        "overallScore":    overall,
        "feedback":        feedback,
    }