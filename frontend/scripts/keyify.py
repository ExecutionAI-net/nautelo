"""Turn hard-coded English in a TSX file into site-text keys.

usage: python scripts/keyify.py <file.tsx> <mapping.json> [--client]
mapping.json: {"key": "English text", ...}. Each English text found between tags (or as an attribute value)
is replaced by {t("key")}; the key is added to src/i18n/source.en.json. The file gets its t() setup if missing
(server file: `const t = await getT();` must be added by hand inside the component if the script cannot find one).
"""
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
path, mapping_file = Path(sys.argv[1]), Path(sys.argv[2])
mapping = json.loads(mapping_file.read_text(encoding="utf-8"))
src_path = ROOT / "src/i18n/source.en.json"
source = json.loads(src_path.read_text(encoding="utf-8"))
text = path.read_text(encoding="utf-8")

def variants(english):
    forms = {english}
    forms.add(english.replace("&", "&amp;"))
    forms.add(english.replace("'", "&apos;"))
    forms.add(english.replace("&", "&amp;").replace("'", "&apos;"))
    forms.add(english.replace("'", "&#39;"))
    return forms

missing = []
for key, english in mapping.items():
    done = False
    for form in variants(english):
        body = r"\s*".join(re.escape(part) for part in form.split())
        # text node
        pattern = re.compile(r">(\s*)" + body + r"(\s*)<")
        if pattern.search(text):
            text = pattern.sub(lambda m: ">" + m.group(1) + '{t("%s")}' % key + m.group(2) + "<", text)
            done = True
        # attribute value: attr="English"
        pattern = re.compile(r'(\b[a-zA-Z-]+)="' + re.escape(form) + '"')
        if pattern.search(text):
            text = pattern.sub(lambda m: m.group(1) + '={t("%s")}' % key, text)
            done = True
    if not done:
        missing.append(key)
    else:
        source[key] = english

path.write_text(text, encoding="utf-8")
src_path.write_text(json.dumps(source, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("replaced", len(mapping) - len(missing), "of", len(mapping), "| missing:", missing)
