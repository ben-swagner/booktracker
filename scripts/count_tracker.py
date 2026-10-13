#!/usr/bin/env python3
"""Count tracker.json data rows (index >= 2) with a non-empty first column and
print the frequency of column AV (index 47, 'Lesestatus')."""
import collections
import json
import os
import sys

path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "data", "raw", "tracker.json")

with open(path, encoding="utf-8") as f:
    values = json.load(f)["values"]

header = values[1] if len(values) > 1 else []
col_name = header[47] if len(header) > 47 else "(kein Header)"
print(f"Spalte AV (Index 47) Header: {col_name!r}")

rows = values[2:]
nonempty = [r for r in rows if len(r) > 0 and str(r[0]).strip() != ""]
print(f"Datenzeilen gesamt (ab Index 2): {len(rows)}")
print(f"Datenzeilen mit nicht-leerer erster Spalte: {len(nonempty)}")

status = collections.Counter(
    (r[47].strip() if len(r) > 47 and r[47].strip() else "(leer)") for r in nonempty)
print("Lesestatus-Verteilung (nur Zeilen mit nicht-leerer erster Spalte):")
for k, v in status.most_common():
    print(f"  {k}: {v}")
