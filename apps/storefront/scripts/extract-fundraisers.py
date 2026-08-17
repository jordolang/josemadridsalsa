#!/usr/bin/env python3
"""Stage 1 of the fundraiser-history import.

Walks the order-form spreadsheets under `03 Fundraisers` and emits one JSONL
record per file with the primitives needed to build an `ArchivedFundraiser`
summary. The archive holds two form shapes:

  ORDER_EXPORT — a store export: header row with "Order ID" + "Total Jars", one
                 row per customer order. We sum jars, count orders, capture the
                 date range and the fundraising-group name (all mechanical).
  ORDER_FORM   — the hand-filled Jose Madrid template: "Organization:",
                 "Submitted by:", "E-Mail:", "Phone:" labels plus a per-flavor
                 quantity column. We emit the raw label cells and the
                 (flavor, qty) lines; resolving/cleaning them is the tested TS
                 normalizer's job.

Usage:
    python3 scripts/extract-fundraisers.py --archive ../../Documents --out <dir>
Output: <out>/fundraisers.raw.jsonl
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import re
import sys
from pathlib import Path

from _spreadsheet import read_first_sheet

SUBPATH = "03 Fundraisers"
LABELS = ("organization", "date", "submitted by", "e-mail", "email", "phone", "name")


def md5(path: Path) -> str:
    h = hashlib.md5()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()


def to_num(v) -> float | None:
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = re.sub(r"[^0-9.\-]", "", str(v))
    try:
        return float(s) if s not in ("", "-", ".") else None
    except ValueError:
        return None


def iso(v) -> str | None:
    if isinstance(v, (dt.datetime, dt.date)):
        return v.isoformat()
    return None


def year_from_path(rel: str) -> int | None:
    for seg in rel.split(os.sep):
        if re.fullmatch(r"(19|20)\d{2}", seg.strip()):
            return int(seg.strip())
    return None


def folder_org(path: Path, archive_root: Path) -> str | None:
    """Immediate parent folder name, unless it is a plain year folder."""
    parent = path.parent
    if parent == archive_root / SUBPATH:
        return None
    name = parent.name
    if re.fullmatch(r"(19|20)\d{2}", name):
        return None
    return name


def classify(rows: list[tuple]) -> str:
    flat = [str(c).strip().lower() for r in rows[:8] for c in r if c is not None]
    joined = " ".join(flat)
    if "order id" in flat and any("total jars" in c for c in flat):
        return "ORDER_EXPORT"
    if "jose" in joined and "salsa ord" in joined:
        return "ORDER_FORM"
    if any(c.startswith("organization") for c in flat):
        return "ORDER_FORM"
    return "UNKNOWN"


def parse_order_export(rows: list[tuple]) -> dict:
    # Locate the header row and map the columns we need.
    header_idx = next(
        (i for i, r in enumerate(rows) if any(str(c).strip().lower() == "order id" for c in r if c)),
        0,
    )
    header = [str(c).strip() if c is not None else "" for c in rows[header_idx]]
    lower = [h.lower() for h in header]

    def col(*names):
        for n in names:
            for i, h in enumerate(lower):
                if n in h:
                    return i
        return None

    c_id = col("order id")
    c_jars = col("total jars")
    c_date = col("order date")
    c_group = col("fundraising", "group", "shipping")

    order_count = 0
    total_jars = 0.0
    dates: list[str] = []
    groups: dict[str, int] = {}
    for r in rows[header_idx + 1 :]:
        if c_id is None or c_id >= len(r) or r[c_id] in (None, ""):
            continue
        order_count += 1
        if c_jars is not None and c_jars < len(r):
            n = to_num(r[c_jars])
            if n:
                total_jars += n
        if c_date is not None and c_date < len(r):
            d = iso(r[c_date])
            if d:
                dates.append(d)
        if c_group is not None and c_group < len(r) and r[c_group]:
            g = str(r[c_group]).strip()
            groups[g] = groups.get(g, 0) + 1
    group_name = max(groups, key=groups.get) if groups else None
    return {
        "orderCount": order_count,
        "totalJars": int(round(total_jars)) if total_jars else None,
        "dateMin": min(dates) if dates else None,
        "dateMax": max(dates) if dates else None,
        "groupName": group_name,
    }


def parse_order_form(rows: list[tuple]) -> dict:
    labels: dict[str, str] = {}
    flavors: dict[str, int] = {}
    for r in rows:
        # Labels: a cell like "Organization: PASS Fou" or "Phone:3306798921".
        for c in r:
            if not isinstance(c, str):
                continue
            s = c.strip()
            low = s.lower()
            for lab in LABELS:
                if low.startswith(lab) and ":" in s:
                    val = s.split(":", 1)[1].strip()
                    if val and lab not in labels:
                        labels[lab] = val
        # Flavor lines: name in col 1, quantity in col 2.
        if len(r) >= 3:
            name = r[1]
            qty = to_num(r[2])
            if isinstance(name, str) and name.strip() and qty and qty > 0:
                nm = name.strip()
                if ":" not in nm and not nm.lower().startswith(LABELS):
                    flavors[nm] = flavors.get(nm, 0) + int(round(qty))
    total = sum(flavors.values()) if flavors else None
    return {"labels": labels, "flavors": flavors, "totalJars": total}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--archive", default="../../Documents")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    archive_root = Path(args.archive).resolve()
    base = archive_root / SUBPATH
    if not base.is_dir():
        sys.exit(f"not found: {base}")

    files = sorted(
        p for p in base.rglob("*")
        if p.is_file() and p.suffix.lower() in (".xlsx", ".xls") and not p.name.startswith("~")
    )
    out_dir = Path(args.out).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "fundraisers.raw.jsonl"

    counts: dict[str, int] = {}
    written = 0
    with out_file.open("w", encoding="utf-8") as fh:
        for path in files:
            rel = str(path.relative_to(archive_root))
            try:
                rows = read_first_sheet(path)
            except Exception as exc:  # noqa: BLE001
                print(f"  ! {rel}: {exc}", file=sys.stderr)
                counts["ERROR"] = counts.get("ERROR", 0) + 1
                continue
            shape = classify(rows)
            counts[shape] = counts.get(shape, 0) + 1
            rec = {
                "sourceFile": rel,
                "sourceMd5": md5(path),
                "year": year_from_path(rel),
                "folderOrg": folder_org(path, archive_root),
                "fileBase": path.stem,
                "shape": shape,
            }
            if shape == "ORDER_EXPORT":
                rec.update(parse_order_export(rows))
            elif shape == "ORDER_FORM":
                rec.update(parse_order_form(rows))
            fh.write(json.dumps(rec, ensure_ascii=False) + "\n")
            written += 1

    print(f"wrote {written} records -> {out_file}")
    print(f"shapes: {counts}")


if __name__ == "__main__":
    main()
