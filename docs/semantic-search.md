# Semantic search

Buyers can describe a boat in a sentence (English, Italian or Spanish) on the home page ("Semantic search" tab) and in the search box on `/boats/`.
Both send `mode=semantic&query=...` to `GET /api/v1/listings/`; the plain `q` parameter keeps working for the old keyword match.

## How a sentence is handled
1. `semantic/parse.py` reads what can be trusted as a filter: price ("under 180,000", "sotto 180 mila", "por debajo de 180.000 €", ranges),
   length ("12 m", "12 metri", about +-10%), cabins, boat type (EN/IT/ES synonyms) and place (GeoNames names in any language,
   plus island aliases such as Mallorca/Maiorca -> Balearic Islands). Filters the visitor set by hand always win.
2. The remaining words are the "feel" ("family", "fast", "for charter"). Listings that pass the filters are ranked by cosine similarity between
   the sentence vector and the listing vector, plus a small bonus for words that appear in the title, brand or model.
3. The response carries `interpretation.labels`, shown on the page as "Understood: ...", so the visitor can see what was read.

## Vectors
- Model: `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` (384 dimensions, open source) run by `fastembed` (ONNX, CPU only). Settings: `SEMANTIC_MODEL`, `SEMANTIC_CACHE_DIR`, `SEMANTIC_EMBEDDER` (`hash` in tests).
- One vector per published listing in `semantic.ListingEmbedding`, built from title, brand, model, year, specs, description and the place names in all three languages.
  It is rebuilt (Celery, queue `maintenance`) when a listing is published or an edit is approved, and only if the text changed.
- `python manage.py index_listings` builds or refreshes everything; the compose `migrate` step runs it after `ensure_places`.
- Ranking is a NumPy dot product over the filtered candidates (up to 300 ranked). That is exact and instant for tens of thousands of listings, so there is no vector extension
  and no database image change. If the catalogue ever grows far beyond that, move the vectors to pgvector.
- The model is baked into the backend image (`deploy/backend.Dockerfile`) so nothing is downloaded at runtime.
