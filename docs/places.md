# Places (regions and cities)

Source: GeoNames (https://www.geonames.org, CC BY 4.0 - keep the attribution in the site footer).

- Models: `places.Region` (first-level division) and `places.City`, keyed by the stable GeoNames id.
- Refresh: `python manage.py sync_places` (options: `--dataset cities500|cities1000|cities5000|cities15000`, `--no-alternate-names`). A Celery beat task runs it every Sunday 02:30 on the `maintenance` queue. First run downloads about 40 MB (cities) plus the alternate-names file for Italian and Spanish names (large, several minutes); `--no-alternate-names` skips it.
- Scope: the countries in `listings.form_options.COUNTRIES` (about 124k cities in the `cities1000` set).
- Search: `City.search_text` holds accent-folded spellings from every language, so "genova", "genoa" and "Cádiz"/"cadiz" find the same city.
- API: `GET /api/v1/places/regions/?country=IT&locale=it`, `GET /api/v1/places/cities/?country=IT&region=<id>&q=gen&locale=it` (accent- and language-insensitive, big cities first).
- Listings: revisions accept `location_place_id`; the server then sets country, region and city to the canonical English names. Snapshots store `location_place_id`; the public list filters with `?place=<geoname id>`; the public detail returns `location.place_id`.
- Sell form: region select and city autocomplete; until places are synced the two boxes stay plain text so nobody is blocked.
- Existing listings: `python manage.py match_places` (dry run) and `--apply` attach places by matching the free text (any spelling, accents, region as a hint; ambiguous names are left for a person). The weekly task runs it after the sync.

## First run on a new environment

```bash
python manage.py migrate
python manage.py sync_places        # about a minute without --no-alternate-names data, longer with Italian/Spanish names
python manage.py match_places       # dry run: shows what would change and what is unmatched
python manage.py match_places --apply
```

Profiles: `BrokerOrganization` and `ProfessionalProfile` have `place_geoname_id`; their profile PATCH accepts `place_id` and then sets city, country (and region for professionals) to the canonical names; sending a free-text city without a place clears the place. Both dashboards use a country select plus the region/city picker.

Boats page: the filter panel has a City select (`?place=<id>`) built from the cities present on live listings (`facets.cities`).

Automatic first load: the migrate step of both compose files runs `ensure_places`, which queues the import on the maintenance queue when no cities exist (it never fails a release). The task also runs `match_places --apply`.

`match_places` works on every snapshot that has no place (all versions of all listings, live or not); drafts and revisions in progress are not touched and get a place when the owner next picks a city.
