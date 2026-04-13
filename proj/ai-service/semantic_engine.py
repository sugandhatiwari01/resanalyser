import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from model_loader import model
from threshold_config import (
    COMPLETENESS_LENGTH_FLOOR,
    DEPTH_MIN_SENTENCES,
    DEPTH_DIVERSITY_WEIGHT,
    DEPTH_TECHNICAL_WEIGHT,
)

# ─────────────────────────────────────────
# Technical vocabulary — used ONLY for density measurement in depth_score.
# Not keyword triggers. Measures whether an answer uses domain language.
# ─────────────────────────────────────────
TECHNICAL_TERMS = {
    "algorithm", "complexity", "recursion", "iteration", "abstraction",
    "polymorphism", "inheritance", "encapsulation", "interface", "class",
    "function", "method", "variable", "constant", "pointer", "reference",
    "api", "rest", "http", "tcp", "udp", "dns", "cache", "latency",
    "throughput", "bandwidth", "protocol", "socket", "endpoint",
    "database", "sql", "nosql", "query", "index", "schema", "transaction",
    "normalization", "join", "acid",
    "microservice", "monolith", "scalability", "availability",
    "load", "balancer", "queue", "async", "sync", "thread", "process",
    "concurrency", "mutex", "deadlock",
    "model", "training", "inference", "accuracy", "precision", "recall",
    "gradient", "loss", "epoch", "batch", "layer", "neural", "embedding",
    "deploy", "pipeline", "docker", "container", "kubernetes",
    "git", "version", "test", "debug", "refactor", "dependency",
}


def get_embedding(text: str):
    return model.encode([text])[0]


def semantic_similarity(text1: str, text2: str) -> float:
    emb1 = model.encode([text1])
    emb2 = model.encode([text2])
    return float(cosine_similarity(emb1, emb2)[0][0])


# ─────────────────────────────────────────
# JD Relevance
# Chunks JD into sentences → top-3 match average
# ─────────────────────────────────────────
def relevance_score(answer: str, jd: str) -> float:
    if not jd.strip():
        return 0.0

    chunks = [s.strip() for s in jd.split('.') if len(s.strip()) > 15]
    if not chunks:
        return round(semantic_similarity(answer, jd), 3)

    answer_emb = model.encode([answer])
    chunk_embs = model.encode(chunks[:10])
    scores     = cosine_similarity(answer_emb, chunk_embs)[0]
    top_scores = sorted(scores, reverse=True)[:3]

    return round(float(np.mean(top_scores)), 3)


# ─────────────────────────────────────────
# Completeness Score  ← FIXED
#
# OLD problem:
#   similarity(question, answer) gave high scores to answers
#   that just restated the question.
#   e.g. Q: "What is REST?" A: "REST is a thing" → high sim, bad answer
#
# NEW approach:
#   Transform question → expected answer PATTERN.
#   Compare answer against the pattern, not the question.
#   Also apply length factor — short answers can't be complete.
# ─────────────────────────────────────────
def _expected_answer_pattern(question: str) -> str:
    """
    Converts a question into what a complete answer should semantically cover.
    No API. No lookup. Pure intent-based transformation.
    """
    q = question.lower().strip()

    if any(w in q for w in ["what is", "define", "explain what"]):
        return f"definition explanation mechanism use case example of {question}"

    elif any(w in q for w in ["how does", "how do", "how would"]):
        return f"step by step mechanism working explanation with example of {question}"

    elif any(w in q for w in ["difference between", "compare", "vs"]):
        return f"key differences similarities tradeoffs use cases comparison of {question}"

    elif any(w in q for w in ["why", "reason", "purpose"]):
        return f"reasons motivation justification benefits of {question}"

    elif any(w in q for w in ["tell me about", "describe", "walk me through"]):
        return f"situation task action result outcome experience related to {question}"

    elif any(w in q for w in ["implement", "design", "build", "code"]):
        return f"technical steps approach tradeoffs implementation details for {question}"

    else:
        return f"thorough answer covering definition mechanism example and outcome for {question}"


def completeness_score(answer: str, question: str) -> float:
    expected = _expected_answer_pattern(question)

    exp_emb  = model.encode([expected])
    ans_emb  = model.encode([answer])
    base_sim = float(cosine_similarity(exp_emb, ans_emb)[0][0])

    word_count = len(answer.split())
    if word_count < COMPLETENESS_LENGTH_FLOOR:
        length_factor = word_count / COMPLETENESS_LENGTH_FLOOR
    elif word_count > 300:
        length_factor = 0.9
    else:
        length_factor = 1.0

    return round(base_sim * length_factor, 3)


# ─────────────────────────────────────────
# Depth Score  ← FIXED
#
# OLD problem:
#   Low inter-sentence similarity = "depth".
#   But "It is useful. It helps. Very good." also has low sim → fake depth.
#
# NEW approach — two signals blended:
#   Signal 1: Semantic diversity (genuine topic spread across sentences)
#   Signal 2: Technical term density (gates vague content)
#   Blend: DEPTH_DIVERSITY_WEIGHT + DEPTH_TECHNICAL_WEIGHT (from config)
# ─────────────────────────────────────────
def _technical_term_density(text: str) -> float:
    words = set(text.lower().split())
    if not words:
        return 0.0
    hits     = words.intersection(TECHNICAL_TERMS)
    density  = len(hits) / len(words)
    # Normalise: floor=0.04 → 0, ceiling=0.15 → 1.0
    normalised = min(density / 0.15, 1.0)
    return round(normalised, 3)


def depth_score(answer: str) -> float:
    sentences    = [s.strip() for s in answer.split('.') if len(s.strip()) > 8]
    tech_density = _technical_term_density(answer)

    if len(sentences) < DEPTH_MIN_SENTENCES:
        return round(tech_density * 0.5, 3)

    embs = model.encode(sentences[:6])

    total_diversity = 0.0
    count = 0
    for i in range(len(embs)):
        for j in range(i + 1, len(embs)):
            sim = float(cosine_similarity([embs[i]], [embs[j]])[0][0])
            total_diversity += (1.0 - sim)
            count += 1

    avg_diversity   = total_diversity / count if count else 0.0
    count_signal    = min(len(sentences) / 6, 1.0)
    diversity_score = avg_diversity * 0.7 + count_signal * 0.3

    return round(
        diversity_score * DEPTH_DIVERSITY_WEIGHT +
        tech_density    * DEPTH_TECHNICAL_WEIGHT,
        3
    )