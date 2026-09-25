from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from uitext.services import load_seed, load_source, sync_source
from uitext.tasks import translate_pending_ui_text


class Command(BaseCommand):
    help = "Register the site text keys written in the code, and translate the new ones."

    def add_arguments(self, parser):
        parser.add_argument("--file", default=str(settings.UITEXT_SOURCE_FILE))
        parser.add_argument("--seed", default=str(settings.UITEXT_SEED_FILE))
        parser.add_argument("--no-translate", action="store_true")

    def handle(self, *args, **options):
        try:
            source = load_source(options["file"])
        except (OSError, ValueError) as exc:
            raise CommandError(str(exc)) from exc
        seeds = load_seed(options["seed"])
        result = sync_source(source, seeds)
        self.stdout.write(f"site text: {len(source)} keys - {result['created']} new, {result['changed']} changed, {result['retired']} retired")
        if not options["no_translate"] and (result["created"] or result["changed"]):
            try:
                translate_pending_ui_text.delay()
                self.stdout.write("translation of the new texts queued")
            except Exception as exc:  # noqa: BLE001 - the 10-minute schedule picks them up anyway
                self.stdout.write(f"could not queue the translation now ({exc}); the schedule will do it")
