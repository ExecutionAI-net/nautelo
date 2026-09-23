"""Seeded guides still credited the retired brand's editorial team."""

from django.db import migrations


def rename(apps, schema_editor):
    Guide = apps.get_model("content", "GuideArticle")
    for guide in Guide.objects.filter(author_name__icontains="nauta"):
        guide.author_name = guide.author_name.replace("Nauta ", "Nautelo ").replace("NAUTA", "Nautelo")
        guide.save(update_fields=["author_name"])


class Migration(migrations.Migration):
    dependencies = [("content", "0002_ad_directory_target")]
    operations = [migrations.RunPython(rename, migrations.RunPython.noop)]
