from django.db import models


class ListingEmbedding(models.Model):
    """One float32 vector per published listing, rebuilt whenever the public snapshot changes."""

    listing = models.OneToOneField("listings.BoatListing", related_name="embedding", on_delete=models.CASCADE)
    snapshot_version = models.PositiveIntegerField()
    model_name = models.CharField(max_length=120)
    text_hash = models.CharField(max_length=64)
    vector = models.BinaryField()
    updated_at = models.DateTimeField(auto_now=True)
