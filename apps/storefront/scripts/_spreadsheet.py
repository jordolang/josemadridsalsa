"""Read either spreadsheet generation into plain row tuples.

The archive mixes modern `.xlsx` with 112 legacy `.xls` files — 72 of them
fundraiser order forms — and openpyxl cannot read the old BIFF format at all, so
those campaigns were being dropped at extraction. `xlrd` 2.x reads `.xls` (and
only `.xls`; it dropped `.xlsx` in 2.0), which makes the two libraries exactly
complementary.

The point of this module is that callers should not care which one ran: xlrd
returns raw floats for dates and empty strings for blanks, so values are
normalized here to what openpyxl would have produced.

    for sheet_name, rows in read_sheets(path):
        ...
"""
from __future__ import annotations

import datetime as dt
from pathlib import Path

try:
    import openpyxl
except ImportError:  # pragma: no cover - reported by the calling script
    openpyxl = None

try:
    import xlrd
except ImportError:  # pragma: no cover - reported by the calling script
    xlrd = None

Sheet = tuple[str, list[tuple]]


def _xlsx_sheets(path: Path) -> list[Sheet]:
    # Opened as a handle, not a path: openpyxl rejects a `.xls` *name* outright,
    # without looking inside, and the archive holds real xlsx files misnamed
    # `.xls`. A handle has no extension for it to object to.
    with path.open("rb") as fh:
        wb = openpyxl.load_workbook(fh, read_only=True, data_only=True)
        try:
            return [(n, list(wb[n].iter_rows(values_only=True))) for n in wb.sheetnames]
        finally:
            wb.close()


def _xls_value(cell, datemode: int):
    """Match openpyxl's types: real dates, ints for whole numbers, None for blank."""
    kind, value = cell.ctype, cell.value
    if kind == xlrd.XL_CELL_DATE:
        y, mo, d, h, mi, s = xlrd.xldate_as_tuple(value, datemode)
        # A time-only cell has a zero date part and cannot become a datetime.
        if (y, mo, d) == (0, 0, 0):
            return dt.time(h, mi, s)
        return dt.datetime(y, mo, d, h, mi, s)
    if kind == xlrd.XL_CELL_NUMBER:
        return int(value) if float(value).is_integer() else value
    if kind == xlrd.XL_CELL_BOOLEAN:
        return bool(value)
    if kind in (xlrd.XL_CELL_EMPTY, xlrd.XL_CELL_BLANK, xlrd.XL_CELL_ERROR):
        return None
    return value if value != "" else None


def _xls_sheets(path: Path) -> list[Sheet]:
    book = xlrd.open_workbook(path, formatting_info=False)
    try:
        out: list[Sheet] = []
        for sheet in book.sheets():
            rows = [
                tuple(_xls_value(sheet.cell(r, c), book.datemode)
                      for c in range(sheet.ncols))
                for r in range(sheet.nrows)
            ]
            out.append((sheet.name, rows))
        return out
    finally:
        book.release_resources()


def read_sheets(path: Path) -> list[Sheet]:
    """Every sheet as (name, rows). Raises if the file cannot be read.

    The extension is only a hint — the archive holds `.xls` files that are
    really `.xlsx` (and the reverse), so the other reader is tried before
    giving up.
    """
    readers = [_xls_sheets, _xlsx_sheets] if path.suffix.lower() == ".xls" \
        else [_xlsx_sheets, _xls_sheets]
    first_error: Exception | None = None
    for reader in readers:
        if reader is _xlsx_sheets and openpyxl is None:
            continue
        if reader is _xls_sheets and xlrd is None:
            continue
        try:
            return reader(path)
        except Exception as exc:  # noqa: BLE001 - try the other generation
            first_error = first_error or exc
    raise first_error or RuntimeError("no spreadsheet reader available")


def read_first_sheet(path: Path) -> list[tuple]:
    """Rows of the first sheet — the shape the order-form parsers expect."""
    sheets = read_sheets(path)
    return sheets[0][1] if sheets else []
