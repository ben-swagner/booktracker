"""Wandelt den Export des Google Sheets (data/raw/*.json) in eine SQL-Datei um,
die alle Daten in das Booktracker-Schema (supabase/migrations/0001_init.sql) einträgt.

Aufruf:  python3 -I scripts/sheet_to_sql.py data/raw data/import.sql
Die SQL-Datei erwartet eine psql-Variable `owner` (die Konto-ID der Person):
    psql ... -v owner=<uuid> -f data/import.sql
"""
import json, re, sys, uuid, collections, unicodedata, datetime

RAW, OUT = sys.argv[1], sys.argv[2]
NS = uuid.UUID("7c6a2d2e-6c1b-4a6e-9f2e-0b6b8f1c1a01")  # feste Basis für reproduzierbare IDs
EMPTY = {"", "❔", "❌"}

def load(name):
    return json.load(open(f"{RAW}/{name}.json"))["values"]

def cell(r, i):
    v = r[i] if i < len(r) else ""
    v = v.strip()
    return "" if v in EMPTY else v

def split(v, seps=(";", ",")):
    if not v: return []
    parts = [v]
    for s in seps:
        parts = [p for x in parts for p in x.split(s)]
    out = []
    for p in parts:
        p = p.strip()
        if p and p not in EMPTY and p not in out: out.append(p)
    return out

def slugify(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s or "x"

def uid(*parts):
    return str(uuid.uuid5(NS, "|".join(parts)))

def to_int(v):
    v = v.replace(".", "").replace(",", ".") if v else v
    try: return int(float(v))
    except: return None

def to_date(v):
    m = re.fullmatch(r"(\d{1,2})\.(\d{1,2})\.(\d{4})", v or "")
    if m:
        d, mo, y = map(int, m.groups())
        try: return datetime.date(y, mo, d).isoformat()
        except ValueError: return None
    return None

def to_cents(v):
    m = re.search(r"(\d+)[,.](\d{2})", v or "")
    if m: return int(m.group(1)) * 100 + int(m.group(2))
    m = re.search(r"\d+", v or "")
    return int(m.group(0)) * 100 if m else None

def isbn13_from(v):
    """Erste gültige ISBN-13 aus dem Feld, ISBN-10 wird umgerechnet."""
    for cand in re.split(r"[;,/ ]+", v or ""):
        d = re.sub(r"[^0-9Xx]", "", cand)
        if len(d) == 10:
            core = "978" + d[:9]
            chk = (10 - sum(int(c) * (1 if i % 2 == 0 else 3) for i, c in enumerate(core)) % 10) % 10
            return core + str(chk)
        if len(d) == 13 and d.isdigit():
            chk = (10 - sum(int(c) * (1 if i % 2 == 0 else 3) for i, c in enumerate(d[:12])) % 10) % 10
            if chk == int(d[12]): return d
    return None

def dur_min(v):
    m = re.fullmatch(r"(\d+):(\d{2})(?::(\d{2}))?", v or "")
    return int(m.group(1)) * 60 + int(m.group(2)) if m else None

# SQL-Hilfen -----------------------------------------------------------------
def q(v):
    if v is None or v == "": return "NULL"
    if isinstance(v, bool): return "true" if v else "false"
    if isinstance(v, (int, float)): return str(v)
    return "'" + str(v).replace("'", "''") + "'"

def arr(items):
    if not items: return "'{}'"
    return "ARRAY[" + ",".join(q(i) for i in items) + "]::text[]"

def ins(table, row, conflict="do nothing"):
    cols = ", ".join(row.keys())
    vals = ", ".join(row.values())
    return f"insert into {table} ({cols}) values ({vals}) on conflict {conflict};"

STATUS = {"Gelesen": "gelesen", "Ungelesen": "ungelesen", "TBR": "tbr", "DNF": "abgebrochen",
          "Current Read": "lese", "Second Read": "lese"}
KIND = {"Buch": "Buch", "Manga": "Manga", "Manhwa": "Manhwa", "Kurzgeschichte": "Kurzgeschichte",
        "Graphic Novel": "Graphic Novel", "Kinderbuch": "Kinderbuch", "Bildband": "Bildband",
        "Comic": "Comic", "Magazin/Zeitschrift": "Magazin"}
AUD = {"Child": "Child", "Teen": "Teen", "YA": "YA", "NA": "NA", "Adult": "Adult"}
GENDER = {"Weiblich": "weiblich", "Männlich": "maennlich", "Divers": "divers", "Mehrere Autor:innen": "mehrere"}
VERDICT = {"Love": "love", "Like": "like", "Middle": "middle", "Dislike": "dislike", "Hate": "hate", "IDK": "idk"}
EXPECT = {"Erfüllt": "erfuellt", "Übertroffen": "uebertroffen", "Untertroffen": "untertroffen"}
BURN = {"No Burn": "no", "Slow Burn": "slow", "Fast Burn": "fast"}
COMPANY = {"Solo": "solo", "Buddy": "buddy", "Group": "group"}
SERIES_KINDS = {"Fortlaufende Reihe", "Unabhängige Reihe", "Standalone"}

def map_prefix(v, table):
    for k, out in table.items():
        if v and k in v: return out
    return None

sql = ["-- Automatisch erzeugt aus dem Google Sheet. Erwartet psql-Variable :owner",
       "begin;", "set local client_min_messages = warning;"]

authors, series, books, book_authors, used_isbn = {}, {}, {}, [], {}
stats = collections.Counter()

# ---------------------------------------------------------------------------
# Tracker
# ---------------------------------------------------------------------------
tr = load("tracker")
rows = [r for r in tr[2:] if r and r[0].strip()]
title_index = {}  # titel -> user_book id (für ReReads, DNFs, Verkauf)

for r in rows:
    title = cell(r, 0)
    author_names = split(cell(r, 1))
    series_name = cell(r, 8)
    bid = uid("book", title, "|".join(author_names), series_name, cell(r, 9))
    if bid in books:
        bid = uid("book", title, "|".join(author_names), series_name, cell(r, 9), cell(r, 2))
    stats["books"] += 1

    # Autor:innen
    country = cell(r, 27); gender = cell(r, 28)
    aids = []
    for i, name in enumerate(author_names):
        s = slugify(name)
        if s not in authors:
            authors[s] = {"id": uid("author", s), "name": name, "slug": s,
                          "country": country if len(author_names) == 1 else None,
                          "gender": GENDER.get(gender, "unbekannt") if len(author_names) == 1 else "unbekannt"}
        aids.append(authors[s]["id"])
        book_authors.append((bid, authors[s]["id"], i + 1))

    # Reihe
    roles = split(cell(r, 7))
    kind = next((x for x in roles if x in SERIES_KINDS), None)
    roles = [x for x in roles if x not in SERIES_KINDS]
    sid = None
    if series_name and kind != "Standalone":
        ss = slugify(series_name)
        if ss not in series:
            series[ss] = {"id": uid("series", ss), "name": series_name, "slug": ss,
                          "total_count": to_int(cell(r, 10)), "is_complete": cell(r, 11) == "TRUE", "kind": kind}
        sid = series[ss]["id"]

    isbn = isbn13_from(cell(r, 2))
    if isbn:
        if isbn in used_isbn: stats["isbn_doppelt"] += 1; isbn = None
        else: used_isbn[isbn] = bid
    elif cell(r, 2): stats["isbn_ungueltig"] += 1

    spice_raw = cell(r, 40)
    spice = 0 if spice_raw == "🥛" else (spice_raw.count("🌶") or None)
    cat = [("Non-Fiction" if c.startswith("Non") else c) for c in split(cell(r, 35))] or ["Fiction"]

    books[bid] = dict(
        id=q(bid), title=q(title), original_title=q(cell(r, 4)), isbn13=q(isbn), blurb=q(cell(r, 5)),
        first_published=q(cell(r, 6)), publisher=q(cell(r, 15)), language=arr(split(cell(r, 14))),
        pages=q(to_int(cell(r, 20))), chapters=q(to_int(cell(r, 21))),
        kind=q(KIND.get(cell(r, 22), "Sonstiges")) + "::book_kind",
        category="ARRAY[" + ",".join(q(c) for c in cat) + "]::book_category[]",
        genre=q(cell(r, 36)), subgenres=arr(split(cell(r, 37))),
        audience=(q(map_prefix(cell(r, 46), AUD)) + "::audience_kind") if cell(r, 46) else "NULL",
        period=(q(cell(r, 44)) + "::time_period") if cell(r, 44) else "NULL",
        setting=q(cell(r, 43)), pov=arr(split(cell(r, 45))), main_characters=arr(split(cell(r, 42))),
        tropes=arr(split(cell(r, 38))), trigger_warnings=arr(split(cell(r, 39))),
        series_id=q(sid), series_number=q(cell(r, 9) if sid else None), series_roles=arr(roles),
        metadata_source=q("sheet"), created_by=":'owner'",
    )
    sql_adapt = [ins("adaptations", {"id": q(uid("adapt", bid, k)), "book_id": q(bid), "kind": q(k)})
                 for k in split(cell(r, 33))]

    # Persönliche Daten
    status = STATUS.get(cell(r, 47), "ungelesen")
    ubid = uid("ub", bid)
    title_index.setdefault(title.lower(), ubid)
    rating = to_int(cell(r, 54).replace(".", "")) if False else None
    try: rating = min(float(cell(r, 54)), 5.0) if cell(r, 54) else None
    except ValueError: rating = None
    ub = dict(
        id=q(ubid), user_id=":'owner'", book_id=q(bid), status=q(status) + "::reading_status",
        owned=q(status != "wunschliste"), bought=q(cell(r, 19) == "TRUE"),
        medium=arr(split(cell(r, 23))), format=arr(split(cell(r, 24))), edition=q(cell(r, 16)),
        specials=arr(split(cell(r, 17))), price_cents=q(to_cents(cell(r, 18))),
        series_following=q(cell(r, 12) == "TRUE") if cell(r, 12) else "NULL",
        series_complete_owned=q(cell(r, 13) == "TRUE") if sid else "NULL",
        audio_platforms=arr(split(cell(r, 29))), narrators=arr(split(cell(r, 30))),
        duration_min=q(dur_min(cell(r, 31))), audio_verdict=q(cell(r, 32)),
        adaptation_seen=q(cell(r, 34) == "TRUE"),
        company=(q(map_prefix(cell(r, 49), COMPANY)) + "::company_kind") if cell(r, 49) else "NULL",
        verdict=(q(map_prefix(cell(r, 53), VERDICT)) + "::verdict_kind") if map_prefix(cell(r, 53), VERDICT) else "NULL",
        rating=q(rating), expectation=(q(EXPECT[cell(r, 56)]) + "::expectation_kind") if cell(r, 56) in EXPECT else "NULL",
        spice=q(spice), burn=(q(BURN[cell(r, 41)]) + "::burn_kind") if cell(r, 41) in BURN else "NULL",
        notes=q(cell(r, 57)),
    )
    # Erstlesung
    readings = []
    if status in ("gelesen", "lese", "abgebrochen") or cell(r, 50) or cell(r, 51):
        s_raw, e_raw = cell(r, 50), cell(r, 51)
        readings.append(dict(
            id=q(uid("read", ubid, "1")), user_book_id=q(ubid), user_id=":'owner'", read_number="1",
            started_on=q(to_date(s_raw)), finished_on=q(to_date(e_raw)),
            started_text=q(s_raw if s_raw and not to_date(s_raw) else None),
            finished_text=q(e_raw if e_raw and not to_date(e_raw) else None),
            days=q(to_int(cell(r, 52))), abandoned=q(status == "abgebrochen"),
            mode=q("audio") + "::read_mode" if cell(r, 29) and "Audiobook" in cell(r, 23) and "Print" not in cell(r, 23) else "NULL",
        ))
    books[bid]["_extra"] = (ub, readings, sql_adapt)

# ---------------------------------------------------------------------------
# ReReads: weitere Lesevorgänge
# ---------------------------------------------------------------------------
# Der Tab kennt nur die Gesamtzahl der Lesungen ("3" oder "1+❔" = mindestens einmal wiedergelesen).
# Der Tracker-Tab hat in Spalte "Reread" die Zahl der Wiederholungen. Beides wird zusammengeführt.
reread_total = {}
for r in load("rereads")[3:]:
    t = cell(r, 1).lower()
    if not t: continue
    raw = cell(r, 2)
    total = 2 if "❔" in raw else (to_int(raw) or 1)
    reread_total[t] = total
for r in rows:
    n = to_int(cell(r, 48))
    if n: reread_total[cell(r, 0).lower()] = max(reread_total.get(cell(r, 0).lower(), 0), n + 1)
for t, total in reread_total.items():
    ubid = title_index.get(t)
    if not ubid: stats["reread_ohne_treffer"] += 1; continue
    for b in books.values():
        if b["_extra"][0]["id"] == q(ubid):
            if not b["_extra"][1]:
                b["_extra"][1].append(dict(id=q(uid("read", ubid, "1")), user_book_id=q(ubid), user_id=":'owner'",
                                           read_number="1", started_on="NULL", finished_on="NULL", started_text="NULL",
                                           finished_text="NULL", days="NULL", abandoned="false", mode="NULL"))
            for n in range(2, total + 1):
                b["_extra"][1].append(dict(
                    id=q(uid("read", ubid, str(n))), user_book_id=q(ubid), user_id=":'owner'", read_number=str(n),
                    started_on="NULL", finished_on="NULL", started_text="NULL", finished_text="NULL",
                    days="NULL", abandoned="false", mode="NULL"))
                stats["rereads"] += 1

# ---------------------------------------------------------------------------
# DNFs: Abbruchdetails an die Erstlesung hängen
# ---------------------------------------------------------------------------
for r in load("dnfs")[3:]:
    t = cell(r, 0).lower()
    ubid = title_index.get(t)
    if not ubid: stats["dnf_ohne_treffer"] += (1 if cell(r, 0) else 0); continue
    for b in books.values():
        if b["_extra"][0]["id"] == q(ubid) and b["_extra"][1]:
            rd = b["_extra"][1][0]
            rd["abandoned"] = "true"
            rd["abandoned_page"] = q(to_int(cell(r, 6)))
            rd["abandoned_percent"] = q(to_int(cell(r, 7).replace("%", "")))
            rd["abandoned_reasons"] = arr(split(cell(r, 5)))
            rd["finished_on"] = q(to_date(cell(r, 9))) if to_date(cell(r, 9)) else rd["finished_on"]
            rd["abandoned_final"] = q(cell(r, 10) == "Endgültig")
            rd["continue_series"] = q(cell(r, 4) == "Ja")
            stats["dnf_details"] += 1

# ---------------------------------------------------------------------------
# SQL schreiben
# ---------------------------------------------------------------------------
for a in authors.values():
    sql.append(ins("authors", {"id": q(a["id"]), "name": q(a["name"]), "slug": q(a["slug"]),
                               "country": q(a["country"]), "gender": q(a["gender"]) + "::author_gender",
                               "created_by": ":'owner'"}))
for s in series.values():
    sql.append(ins("series", {"id": q(s["id"]), "name": q(s["name"]), "slug": q(s["slug"]),
                              "total_count": q(s["total_count"]), "is_complete": q(s["is_complete"]),
                              "kind": q(s["kind"]), "created_by": ":'owner'"}))
for b in books.values():
    ub, readings, adapt = b.pop("_extra")
    sql.append(ins("books", b))
    sql.extend(adapt)
    sql.append(ins("user_books", ub))
    for rd in readings:
        sql.append(ins("readings", rd))
for bid, aid, pos in book_authors:
    sql.append(ins("book_authors", {"book_id": q(bid), "author_id": q(aid), "position": str(pos)}))

# Wunschliste
PRIO = {"Gekauft": "gekauft", "Hoch": "hoch", "Mittel": "mittel", "Niedrig": "niedrig"}
for r in load("wunschliste")[2:]:
    if not cell(r, 0): continue
    stats["wunschliste"] += 1
    sql.append(ins("wishlist_items", dict(
        id=q(uid("wish", cell(r, 0), cell(r, 2))), user_id=":'owner'", title=q(cell(r, 0)), isbn=q(cell(r, 1)),
        author=q(cell(r, 2)), series_name=q(cell(r, 4)), series_number=q(cell(r, 5)), series_total=q(to_int(cell(r, 6))),
        wanted_format=q(cell(r, 7)), release_date=q(to_date(cell(r, 8))),
        release_text=q(cell(r, 8) if cell(r, 8) and not to_date(cell(r, 8)) else None),
        genre=q(cell(r, 9)), price_cents=q(to_cents(cell(r, 10))),
        priority=q(PRIO.get(cell(r, 11), "mittel")) + "::wish_priority",  # „Geschenkt“ in Prio: siehe purchase_condition
        recommended_by=q(cell(r, 12)), owned=q(cell(r, 13) == "TRUE"), purchase_condition=q("Geschenkt" if cell(r, 11) == "Geschenkt" else ("Gekauft" if cell(r, 13) == "TRUE" else cell(r, 14))))))

# Verkauf und Verkaufsplan
for name, default_status in (("verkauf", "eingestellt"), ("verkaufsplan", "geplant")):
    for r in load(name)[3:]:
        if not cell(r, 0): continue
        stats["verkauf"] += 1
        st = default_status
        if name == "verkauf" and cell(r, 6) == "TRUE": st = "verkauft"
        sql.append(ins("sales", dict(
            id=q(uid("sale", name, cell(r, 0))), user_id=":'owner'", title=q(cell(r, 0)), author=q(cell(r, 1)),
            isbn=q(cell(r, 2)), reason=q(cell(r, 5)), status=q(st) + "::sale_status",
            platform=q(cell(r, 7)) if name == "verkauf" else "NULL",
            price_cents=q(to_cents(cell(r, 8))) if name == "verkauf" else "NULL",
            book_id=q(next((bid for bid, b in books.items() if b["title"] == q(cell(r, 0))), None)))))

# Tops (Favoriten)
for r in load("tops")[4:]:
    rank = to_int(cell(r, 0))
    if not rank: continue
    for kind, col in (("book", 2), ("graphic", 8)):
        t = cell(r, col)
        bid = next((bid for bid, b in books.items() if b["title"] == q(t)), None) if t else None
        if bid:
            stats["favoriten"] += 1
            sql.append(ins("favorites", dict(id=q(uid("fav", kind, str(rank))), user_id=":'owner'",
                                             kind=q(kind), rank=str(rank), book_id=q(bid))))
    a = cell(r, 13)
    if a and slugify(a) in authors:
        stats["favoriten"] += 1
        sql.append(ins("favorites", dict(id=q(uid("fav", "author", str(rank))), user_id=":'owner'",
                                         kind=q("author"), rank=str(rank), author_id=q(authors[slugify(a)]["id"]))))

# Bingo 26 als Challenge
cid = uid("challenge", "bingo-2026")
sql.append(ins("challenges", dict(id=q(cid), user_id=":'owner'", name=q("Bookish Bingo 2026"), kind=q("bingo"),
                                  ends_on=q("2026-12-31"))))
pos = 0
for r in load("bingo_26")[4:]:
    label = cell(r, 7)
    if not label: continue
    pos += 1; stats["bingo_felder"] += 1
    t = cell(r, 9)
    bid = next((bid for bid, b in books.items() if b["title"] == q(t)), None) if t else None
    sql.append(ins("challenge_entries", dict(id=q(uid("bingo", label)), challenge_id=q(cid), label=q(label),
                                             book_id=q(bid), done=q(cell(r, 8) == "TRUE"), position=str(pos))))

sql.append("commit;")
open(OUT, "w").write("\n".join(sql) + "\n")
stats["autoren"] = len(authors); stats["reihen"] = len(series)
print(json.dumps(stats, indent=1, ensure_ascii=False))
