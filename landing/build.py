"""Builds the static landing site: python landing/build.py  ->  landing/dist/

Fill landing/site.json first (legal name, address, VAT, contact email, domain).
The output is plain HTML/CSS: host it on any static host or nginx, no runtime.
"""

import json
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).parent
PAGES = {
    "index": ("/", "{brand} - boat marketplace for Spain and Italy", "Boats, brokers and nautical professionals in Spain and Italy."),
    "contact": ("/contact.html", "Contact - {brand}", "How to reach {brand}."),
    "privacy": ("/privacy.html", "Privacy policy - {brand}", "How {brand} handles personal data."),
    "terms": ("/terms.html", "Terms of use - {brand}", "Terms for using {brand}."),
}


def fill(text, values):
    return re.sub(r"\{\{(\w+)\}\}", lambda m: str(values[m.group(1)]), text)


def build(site=None, out=None):
    site = site or json.loads((ROOT / "site.json").read_text(encoding="utf8"))
    out = Path(out or ROOT / "dist")
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    layout = (ROOT / "templates/_layout.html").read_text(encoding="utf8")
    for name, (path, title, description) in PAGES.items():
        body = fill((ROOT / f"templates/{name}.body.html").read_text(encoding="utf8"), site)
        page = fill(
            layout,
            {**site, "path": path, "title": fill(title, site), "description": fill(description, site), "body": body},
        )
        (out / f"{name}.html").write_text(page, encoding="utf8")
    shutil.copy(ROOT / "style.css", out / "style.css")
    (out / "robots.txt").write_text(
        f"User-agent: *\nAllow: /\nSitemap: https://{site['domain']}/sitemap.xml\n", encoding="utf8"
    )
    urls = "".join(f"<url><loc>https://{site['domain']}{p}</loc></url>" for p, _, _ in PAGES.values())
    (out / "sitemap.xml").write_text(
        f'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{urls}</urlset>',
        encoding="utf8",
    )
    return out


def unfilled(site):
    return [
        k
        for k, v in site.items()
        if isinstance(v, str) and ("REPLACE" in v or v.endswith(".example") or "@nauta.example" in v)
    ]


if __name__ == "__main__":
    site = json.loads((ROOT / "site.json").read_text(encoding="utf8"))
    todo = unfilled(site)
    if todo and "--allow-placeholders" not in sys.argv:
        sys.exit(f"site.json still has placeholders: {', '.join(todo)} (use --allow-placeholders to preview)")
    print(build(site))
