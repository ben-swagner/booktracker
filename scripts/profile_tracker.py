import json, sys, collections, re
p = sys.argv[1]
d = json.load(open(p))
vals = d["values"]
blocks, header = vals[0], vals[1]
rows = [r for r in vals[2:] if r and r[0].strip()]
ncol = len(header)
out = []
for i, name in enumerate(header):
    col = [(r[i] if i < len(r) else "") for r in rows]
    nonempty = [v for v in col if v.strip() not in ("", "❔", "❌")]
    c = collections.Counter(nonempty)
    distinct = len(c)
    sample = ", ".join(f"{k!r}×{v}" for k, v in c.most_common(12))
    # list-like?
    multi = sum(1 for v in nonempty if "," in v or ";" in v)
    out.append(f"[{i:2d}] {name.strip()!r}: filled {len(nonempty)}/{len(rows)}, distinct {distinct}, multi {multi}\n     {sample[:600]}")
print("\n".join(out))
