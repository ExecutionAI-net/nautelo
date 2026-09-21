from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from uitext.services import load_source, sync_source
from uitext.translate import translate_pending


class Command(BaseCommand):
    help = "Register the site text keys written in the code, and translate the new ones."

    def add_arguments(self, parser):
        parser.add_argument("--file", default=str(settings.UITEXT_SOURCE_FILE))
        parser.add_argument("--no-translate", action="store_true")

    def handle(self, *args, **options):
        try:
            source = load_source(options["file"])
        except (OSError, ValueError) as exc:
            raise CommandError(str(exc)) from exc
        result = sync_source(source)
        self.stdout.write(f"site text: {len(source)} keys - {result['created']} new, {result['changed']} changed, {result['retired']} retired")
        if not options["no_translate"] and (result["created"] or result["changed"]):
            self.stdout.write(f"translation: {translate_pending()}")
