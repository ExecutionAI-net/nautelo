"""Hybrid ranking: filters from the sentence decide WHAT qualifies, meaning decides the ORDER."""

import re

import numpy as np
from django.db.models import Case, IntegerField, Value, When

from places.importer import fold

from .embedder import embed, model_name
from .models import ListingEmbedding
from .parse import Parsed

MAX_CANDIDATES = 300
KEYWORD_WEIGHT = 0.25


def rank(queryset, query: str, parsed: Parsed):
    """Order `queryset` (already filtered) by relevance to `query`. Returns (queryset, ranked?)."""
    if not parsed.residual:
        return queryset, False
    ids = list(queryset.values_list("pk", flat=True)[:5000])
    rows = list(ListingEmbedding.objects.filter(listing_id__in=ids, model_name=model_name()).values_list("listing_id", "vector"))
    if not rows:
        return queryset, False
    matrix = np.vstack([np.frombuffer(bytes(vector), dtype=np.float32) for _, vector in rows])
    scores = matrix @ embed([query])[0]
    tokens = set(re.findall(r"[a-z0-9]{3,}", fold(parsed.residual)))
    if tokens:
        texts = {
            pk: fold(f"{title} {brand} {model}")
            for pk, title, brand, model in queryset.filter(pk__in=[r[0] for r in rows]).values_list(
                "pk",
                "current_public_snapshot__title_en",
                "current_public_snapshot__brand_name_snapshot",
                "current_public_snapshot__model_name_snapshot",
            )
        }
        for index, (pk, _) in enumerate(rows):
            hits = sum(1 for token in tokens if token in texts.get(pk, ""))
            scores[index] += KEYWORD_WEIGHT * hits / len(tokens)
    order = [rows[i][0] for i in np.argsort(-scores)[:MAX_CANDIDATES]]
    position = Case(*[When(pk=pk, then=Value(pos)) for pos, pk in enumerate(order)], default=Value(len(order)), output_field=IntegerField())
    return queryset.filter(pk__in=order).annotate(_semantic_rank=position).order_by("_semantic_rank"), True
