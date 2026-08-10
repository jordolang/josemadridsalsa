#!/usr/bin/env python3
"""Stage 1 of the mileage import.

Reads every spreadsheet under the local (gitignored) archive's
`01 Financial/Mileage` folder and emits one raw JSONL record per data row, with
full provenance (source file, md5, sheet, 1-based row) and the row's cells keyed
by their column header. This stage does NOT normalize — the four different column
layouts, driver-name variants, junk rows, and cross-file de-duplication are all
resolved by the tested TypeScript normalizer (`lib/archive/mileage-normalize.ts`),
so that logic can be unit-tested without spreadsheets.

Usage:
    python3 scripts/extract-mileage.py \
        --archive ../../Documents \
        --out /path/to/scratchpad/mileage-extract

Output: <out>/mileage.raw.jsonl
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import sys
from pathlib import Path

try:
    import openpyxl
except ImportError:
    sys.exit("openpyxl is required: pip install openpyxl")

MILEAGE_SUBPATH = os.path.join("01 Financial", "Mileage")


def md5(path: Path) -> str:
    h = hashlib.md5()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()


def cell_to_json(value: object) -> object:
    """Make a cell JSON-serializable, preserving type where it matters."""
    if value is None:
        return None
    if isinstance(value, (dt.datetime, dt.date)):
        return value.isoformat()
    if isinstance(value, (int, float, str, bool)):
        return value
    return str(value)


def is_blank_row(cells: dict[str, object]) -> bool:
    return all(v in (None, "") for v in cells.values())


def extract_file(path: Path, archive_root: Path) -> list[dict]:
    rel = str(path.relative_to(archive_root))
    digest = md5(path)
    out: list[dict] = []
    try:
        wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    except Exception as exc:  # noqa: BLE001 - report and skip unreadable files
        print(f"  ! skip {rel}: {exc}", file=sys.stderr)
        return out

    for sheet_name in wb.sheetnames:
        ws = wb[sheet_name]
        rows = list(ws.iter_rows(values_only=True))
        if not rows:
            continue
        # The header is the first non-empty row.
        header_idx = next(
            (i for i, r in enumerate(rows) if any(c not in (None, "") for c in r)),
            None,
        )
        if header_idx is None:
            continue
        header = [
            (str(c).strip() if c is not None else "") for c in rows[header_idx]
        ]
        for offset, raw in enumerate(rows[header_idx + 1 :], start=header_idx + 2):
            cells = {}
            for col_idx, col_name in enumerate(header):
                if not col_name:
                    continue
                value = raw[col_idx] if col_idx < len(raw) else None
                cells[col_name] = cell_to_json(value)
            if is_blank_row(cells):
                continue
            out.append(
                {
                    "sourceFile": rel,
                    "sourceMd5": digest,
                    "sourceSheet": sheet_name,
                    "sourceRow": offset,  # 1-based row number in the sheet
                    "header": [h for h in header if h],
                    "cells": cells,
                }
            )
    return out


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--archive", default="../../Documents")
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    archive_root = Path(args.archive).resolve()
    mileage_dir = archive_root / MILEAGE_SUBPATH
    if not mileage_dir.is_dir():
        sys.exit(f"mileage folder not found: {mileage_dir}")

    files = sorted(
        p
        for p in mileage_dir.rglob("*")
        if p.is_file() and p.suffix.lower() in (".xlsx", ".xls")
    )
    print(f"found {len(files)} mileage spreadsheet(s) under {mileage_dir}")

    out_dir = Path(args.out).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "mileage.raw.jsonl"

    total = 0
    with out_file.open("w", encoding="utf-8") as fh:
        for path in files:
            records = extract_file(path, archive_root)
            for rec in records:
                fh.write(json.dumps(rec, ensure_ascii=False) + "\n")
            total += len(records)
            print(f"  {len(records):5d} rows  {path.relative_to(archive_root)}")

    print(f"\nwrote {total} raw rows -> {out_file}")


if __name__ == "__main__":
    main()
