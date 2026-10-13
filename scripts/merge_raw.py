#!/usr/bin/env python3
"""Merge <tab>_partNN.json chunks in data/raw into <tab>.json (values concatenated in order)."""
import glob
import json
import os
import re
import sys

RAW = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "data", "raw")
RAW = os.path.abspath(RAW)

pattern = re.compile(r"^(?P<tab>.+)_part(?P<n>\d+)\.json$")
groups = {}
for path in sorted(glob.glob(os.path.join(RAW, "*_part*.json"))):
    m = pattern.match(os.path.basename(path))
    if not m:
        continue
    groups.setdefault(m.group("tab"), []).append((int(m.group("n")), path))

for tab, parts in sorted(groups.items()):
    parts.sort()
    values = []
    first_range = None
    last_range = None
    for _, path in parts:
        with open(path, encoding="utf-8") as f:
            d = json.load(f)
        if first_range is None:
            first_range = d["range"]
        last_range = d["range"]
        values.extend(d.get("values", []))
    # Combined range: sheet + start of first chunk + end of last chunk
    if len(parts) == 1:
        rng = first_range
    else:
        sheet, a = first_range.split("!")
        _, b = last_range.split("!")
        rng = f"{sheet}!{a.split(':')[0]}:{b.split(':')[1]}"
    out = os.path.join(RAW, f"{tab}.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump({"range": rng, "values": values}, f, ensure_ascii=False)
    print(f"{tab}.json\t{rng}\t{len(values)} rows\t({len(parts)} part(s))")
