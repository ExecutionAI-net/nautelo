import hashlib

import numpy as np

from listings.models import BoatListing

from .embedder import embed, model_name
from .models import ListingEmbedding
from .text import listing_text


def index_listing(listing_id) -> bool:
    """(Re)build the vector for a published listing. Returns whether it was written."""
    listing = BoatListing.objects.select_related("current_public_snapshot").filter(pk=listing_id).first()
    snapshot = listing.current_public_snapshot if listing else None
    if snapshot is None:
        ListingEmbedding.objects.filter(listing_id=listing_id).delete()
        return False
    text = listing_text(snapshot)
    digest = hashlib.sha256(text.encode()).hexdigest()
    current = ListingEmbedding.objects.filter(listing=listing).first()
    if current and current.text_hash == digest and current.model_name == model_name():
        return False
    vector = embed([text])[0].astype(np.float32).tobytes()
    ListingEmbedding.objects.update_or_create(
        listing=listing,
        defaults={"snapshot_version": snapshot.version, "model_name": model_name(), "text_hash": digest, "vector": vector},
    )
    return True


def index_all() -> int:
    ids = BoatListing.objects.filter(current_public_snapshot__isnull=False).values_list("pk", flat=True)
    return sum(index_listing(pk) for pk in ids)
