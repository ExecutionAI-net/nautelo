# Places (regions and cities)

Source: GeoNames (https://www.geonames.org, CC BY 4.0 - keep the attribution in the site footer).

- Models: `places.Region` (first-level division) and `places.City`, keyed by the stable GeoNames id.
- Refresh: `python manage.py sync_places` (options: `--dataset cities500|cities1000|cities5000|cities15000`, `--no-alternate-names`). A Celery beat task runs it every Sunday 02:30 on the `maintenance` queue. First run downloads about 40 MB (cities) plus the alternate-names file for Italian and Spanish names (large, several minutes); `--no-alternate-names` skips it.
- Scope: the countries in `listings.form_options.COUNTRIES` (about 124k cities in the `cities1000` set).
- Search: `City.search_text` holds accent-folded spellings from every language, so "genova", "genoa" and "Cádiz"/"cadiz" find the same city.
- Next steps (not done yet): search API, form selectors, listing and profile foreign keys with a name snapshot at publish time, filter by place id, mapping of existing free-text values.
