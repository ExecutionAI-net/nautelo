import pytest

from places.importer import fold, load_alternate_names, load_cities, load_regions
from places.models import City, Region

pytestmark = pytest.mark.django_db

ADMIN1 = ["IT.07\tLiguria\tLiguria\t3174725\n", "FR.93\tProvence\tProvence\t2985244\n"]
CITIES = [
    "3176219\tGenoa\tGenoa\tGenova,Genua\t44.40478\t8.94439\tP\tPPLA\tIT\t\t07\t\t\t\t580223\t\t19\tEurope/Rome\t2024-01-01\n",
    "6355234\tCádiz\tCadiz\t\t36.5\t-6.3\tP\tPPLA2\tES\t\t51\t\t\t\t116027\t\t10\tEurope/Madrid\t2024-01-01\n",
    "9999999\tNowhere\tNowhere\t\t1\t1\tP\tPPL\tZZ\t\t01\t\t\t\t5\t\t1\tUTC\t2024-01-01\n",
]
ALTERNATES = [
    "1\t3176219\tit\tGenova\t1\t0\t0\t0\n",
    "2\t3176219\ten\tGenoa\t1\t0\t0\t0\n",
    "3\t3176219\tes\tGénova\t1\t0\t0\t0\n",
    "4\t3176219\tit\tGenua\t\t0\t0\t0\n",
]


def test_fold_ignores_case_and_accents():
    assert fold("Cádiz") == fold("CADIZ") == "cadiz"


def test_import_links_cities_to_regions_and_keeps_local_names():
    regions = load_regions(ADMIN1, {"IT", "ES"})
    assert list(regions) == [("IT", "07")]
    alternates = load_alternate_names(ALTERNATES, {3176219})
    assert alternates[3176219] == {"it": "Genova", "en": "Genoa", "es": "Génova"}
    assert load_cities(CITIES, {"IT", "ES"}, regions, alternates) == 2
    genoa = City.objects.get(geoname_id=3176219)
    assert genoa.region.name_en == "Liguria"
    assert (genoa.name("it"), genoa.name("es")) == ("Genova", "Génova")
    assert "genova" in genoa.search_text and "genua" in genoa.search_text
    assert City.objects.get(geoname_id=6355234).name("it") == "Cádiz"


def test_a_second_run_updates_in_place():
    regions = load_regions(ADMIN1, {"IT"})
    load_cities(CITIES, {"IT"}, regions)
    load_cities([CITIES[0].replace("580223", "600000")], {"IT"}, regions)
    assert City.objects.count() == 1
    assert City.objects.get().population == 600000
    assert Region.objects.count() == 1
