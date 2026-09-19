from django.core.management.base import BaseCommand, CommandError

from translation.openrouter import OpenRouterError, sync_catalog


class Command(BaseCommand):
    help = "Download the full OpenRouter model catalogue (output_modalities=all) into the database."

    def handle(self, *args, **options):
        try:
            result = sync_catalog()
        except OpenRouterError as exc:
            raise CommandError(str(exc)) from exc
        self.stdout.write(
            self.style.SUCCESS(
                f"{result['received']} models received ({result['text_output']} output text): "
                f"{result['created']} new, {result['updated']} updated, {result['made_unavailable']} no longer listed."
            )
        )
