from sentence_transformers import SentenceTransformer

# ─────────────────────────────────────────
# Single model load for the entire application.
# All modules import from here — never load separately.
#
# Why all-MiniLM-L6-v2:
#   - 384 dimensions, ~80MB RAM
#   - ~5x faster inference than mpnet
#   - Cosine similarity scores are well-calibrated for short texts
#   - Sufficient for interview answer scoring (not retrieval over millions of docs)
# ─────────────────────────────────────────

model = SentenceTransformer('all-MiniLM-L6-v2')