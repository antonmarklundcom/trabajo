# Merges Google Keyword Planner data into docs/seo/keywords-2026-09-27.csv
# (phrase, monthly_searches, low_cpc_sek, high_cpc_sek). Existing rows win,
# new phrases are appended, the file is re-sorted by volume.
#
#   python3 docs/seo/kwp-merge.py docs/seo/raw/*.csv     # Keyword Planner "Download keyword ideas" CSV
#   python3 docs/seo/kwp-merge.py paste.txt              # or a copy-paste from the planner's table
#
# Variants of the same search are ONE row: phrases that differ only in accents,
# capitals, spacing or punctuation ("selección de personal" / "seleccion de
# personal", "oferta detrabajo" / "oferta de trabajo") share a key, and the
# variant with the highest volume is kept (its own volume and CPCs — volumes
# are not summed, because Keyword Planner already groups close variants).
# Real misspellings with different letters are kept: they are real searches.
#
# Both inputs are detected per file:
#   - The planner's CSV export is UTF-16 (sometimes UTF-8), tab- or
#     comma-separated, with a title line and a date line above the header. The
#     header is matched by meaning, not exact text, so Swedish, English and
#     Spanish UI exports all work (Sökord / Keyword / Palabra clave; "månad" /
#     "monthly" / "mensual"; "låg" / "low" / "bajo"; "hög" / "high" / "alto").
#   - A copy-paste is one phrase line followed by its value lines.
# Standard library only.
import csv, io, os, re, sys, unicodedata

CSV_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'keywords-2026-09-27.csv')


def key(phrase):
    folded = unicodedata.normalize('NFKD', phrase.lower())
    folded = ''.join(c for c in folded if not unicodedata.combining(c))
    # ñ folds to n on purpose: "ninera" is how many people type "niñera".
    return re.sub(r'[^a-z0-9]', '', folded)


def number(text):
    """'14 800' / '14,800' / '1.28 kr' / '1,28' / '10 – 100' -> first number, or None."""
    text = (text or '').replace(' ', ' ').strip()
    if not text or text in ('—', '-', '--'):
        return None
    m = re.search(r'\d[\d .,]*', text)
    if not m:
        return None
    raw = m.group(0).strip().replace(' ', '')
    if re.fullmatch(r'\d{1,3}([.,]\d{3})+', raw):  # thousands separators
        return float(re.sub(r'[.,]', '', raw))
    return float(raw.replace(',', '.'))


def read_text(path):
    data = open(path, 'rb').read()
    for enc in ('utf-16', 'utf-8-sig', 'latin-1'):
        if enc == 'utf-16' and not data.startswith((b'\xff\xfe', b'\xfe\xff')):
            continue
        try:
            return data.decode(enc)
        except UnicodeDecodeError:
            continue
    return data.decode('utf-8', 'replace')


def from_export(text):
    """Rows from a Keyword Planner CSV export, or None if this is not one."""
    lines = text.splitlines()
    for i, line in enumerate(lines[:10]):
        delim = '\t' if '\t' in line else ','
        cells = [c.strip().lower() for c in next(csv.reader([line], delimiter=delim))]
        if len(cells) < 3 or not re.search(r'keyword|sökord|palabra', cells[0]):
            continue
        find = lambda pat: next((j for j, c in enumerate(cells) if re.search(pat, c)), None)
        vol = find(r'month|månad|mensual')
        low = find(r'low|låg|bajo')
        high = find(r'high|hög|alto')
        rows = []
        for rec in csv.reader(io.StringIO('\n'.join(lines[i + 1:])), delimiter=delim):
            if not rec or not rec[0].strip():
                continue
            get = lambda j: rec[j] if j is not None and j < len(rec) else ''
            rows.append((rec[0].strip(), number(get(vol)), number(get(low)), number(get(high))))
        return rows
    return None


def from_paste(text):
    def is_value(l):
        l = l.strip()
        return (l == '' or l == '—' or l in ('Låg', 'Medel', 'Hög') or l.endswith('%')
                or l.endswith('kr') or l.startswith('+∞') or bool(re.fullmatch(r'[\d ]+', l)))
    recs, cur = [], None
    for l in text.split('\n'):
        if l.strip() in ('Sökord som du har angett', 'Sökordsförslag'):
            continue
        if not is_value(l):
            cur = {'p': l.strip(), 'v': []}
            recs.append(cur)
        elif cur and l.strip():
            cur['v'].append(l.strip())
    rows = []
    for r in recs:
        v = r['v']
        kr = [x for x in v if x.endswith('kr')]
        rows.append((r['p'], number(v[0]) if v else None,
                     number(kr[0]) if kr else None, number(kr[1]) if len(kr) > 1 else None))
    return rows


def fmt(n, decimals):
    if n is None:
        return '0'
    return f'{n:.{decimals}f}' if decimals else str(int(n))


def main(paths):
    rows = {}  # key -> (phrase, volume, low, high)
    merged = 0

    def put(row):
        nonlocal merged
        k = key(row[0])
        if not k:
            return False
        if k in rows:
            if rows[k][0] != row[0]:
                merged += 1  # a real variant, not the same phrase seen again
            if row[1] > rows[k][1]:
                rows[k] = row
            return False
        rows[k] = row
        return True

    if os.path.exists(CSV_PATH):
        for r in csv.DictReader(open(CSV_PATH, encoding='utf-8')):
            put((r['phrase'], int(r['monthly_searches']), r['low_cpc_sek'], r['high_cpc_sek']))
    added = 0
    for path in paths:
        text = read_text(path)
        parsed = from_export(text)
        parsed = parsed if parsed is not None else from_paste(text)
        for phrase, vol, low, high in parsed:
            if phrase and put((phrase, int(vol or 0), fmt(low, 2), fmt(high, 2))):
                added += 1
    out = sorted(rows.values(), key=lambda x: (-x[1], x[0]))
    with open(CSV_PATH, 'w', newline='', encoding='utf-8') as f:
        w = csv.writer(f)
        w.writerow(['phrase', 'monthly_searches', 'low_cpc_sek', 'high_cpc_sek'])
        w.writerows(out)
    print(f'added {added}, variants merged {merged}, total {len(out)}')


if __name__ == '__main__':
    main(sys.argv[1:])
