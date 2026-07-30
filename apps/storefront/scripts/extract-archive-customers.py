#!/usr/bin/env python3
"""
Stage 1 of the document-archive customer import.

Walks the local `Documents/` business archive (gitignored) and extracts every
contact it can find into a JSONL file, one record per (email, source file) pair
with full provenance. Nothing is merged or de-duplicated here — that is stage 2
(`scripts/import-archive-customers.ts`), so "did I extract it" and "did I load
it" stay separately debuggable.

Handles: .csv, .xlsx, .xls, .docx, .pdf. Three extraction modes are tried per
file, because the archive mixes clean exports with hand-built order forms:

  tabular  - a header row maps columns to fields (BigCommerce/Constant Contact/
             QuickBooks exports, retail-store lists)
  labelled - `Organization:` / `Submitted by:` / `E-Mail:` label-in-cell layout
             used by the fundraiser order forms
  freeform - last resort: any email-shaped string in the text, with the nearest
             name-looking line as a guess

Usage:
  python3 scripts/extract-archive-customers.py \
      --root ../../Documents --out ../../data/customer-extract
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import subprocess
import sys
import zipfile
from collections import Counter
from pathlib import Path

csv.field_size_limit(10**9)

EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9][A-Za-z0-9.\-]*\.[A-Za-z]{2,}")
EMAIL_EXACT_RE = re.compile(r"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9][A-Za-z0-9.\-]*\.[A-Za-z]{2,}$")

# Addresses that are the business itself, placeholders, or vendor noise — never
# customers. Matched case-insensitively against the full address or its domain.
EMAIL_DENY_DOMAINS = {
    "example.com",
    "example.org",
    "domain.com",
    "email.com",
    "yourdomain.com",
    "sentry.io",
    "constantcontact.com",
    "bigcommerce.com",
    "godaddy.com",
    "intuit.com",
    "quickbooks.com",
    "paypal.com",
    "stripe.com",
    "squareup.com",
    "ups.com",
    "fedex.com",
    "usps.com",
    "easypost.com",
    "faire.com",
    "shopify.com",
    "mailchimp.com",
    "resend.com",
    "wixpress.com",
    "sentry.wixpress.com",
}
EMAIL_DENY_EXACT = {"josemadridsalsa@gmail.com"}
# Jose Madrid's own addresses appear on every order-form template and in the
# "To" column of every PayPal export; typos of them are just as common.
OWN_DOMAIN_RE = re.compile(r"@[^@]*josemadrid", re.I)
# Extensions that are never worth opening.
SKIP_EXT = {
    ".jpg", ".jpeg", ".png", ".gif", ".webp", ".tif", ".tiff", ".psd", ".ai",
    ".mov", ".mp4", ".m4v", ".aae", ".zip", ".lnk", ".url", ".ps1", ".psm1",
    ".psd1", ".reg", ".css", ".svg", ".ico", ".exe", ".dll", ".db", ".jpe",
    ".ds_store", ".download", ".loaded_0",
}
# Files this pipeline itself produced / archive bookkeeping.
SKIP_NAMES = {"search_index.csv", "_move_manifest.csv", "search.html", "readme.md"}

# --------------------------------------------------------------------------
# Header aliases. Keys are our fields; values are normalized header spellings.
# --------------------------------------------------------------------------

FIELD_ALIASES: dict[str, tuple[str, ...]] = {
    "email": (
        "email", "emailaddress", "email address", "e-mail", "e mail",
        "customeremail", "customer email", "billingemail", "billing email",
        "shippingemail", "shipping email", "emailaddr", "contactemail",
        "contact email", "primaryemail", "email1",
    ),
    "firstName": (
        "firstname", "first name", "first", "fname", "givenname", "given name",
        "billingfirstname", "billing first name", "shippingfirstname",
        "shipping first name",
    ),
    "lastName": (
        "lastname", "last name", "last", "lname", "surname", "familyname",
        "family name", "billinglastname", "billing last name",
        "shippinglastname", "shipping last name",
    ),
    "fullName": (
        "name", "fullname", "full name", "customer", "customername",
        "customer name", "shippingname", "shipping name", "contact",
        "contactname", "contact name", "retailername", "retailer name",
        "storename", "store name", "account", "accountname", "account name",
    ),
    "phone": (
        "phone", "phonenumber", "phone number", "phonenumbers",
        "phone numbers", "customerphone", "customer phone", "billingphone",
        "billing phone", "shippingphone", "shipping phone", "mobile", "cell",
        "telephone", "tel", "phone1",
    ),
    "company": (
        "company", "companyname", "company name", "billingcompany",
        "billing company", "shippingcompany", "shipping company",
        "organization", "organisation", "org", "business", "businessname",
        "business name",
    ),
    "group": (
        "customergroup", "customer group", "fundraisinggroup",
        "fundraising group", "shippingfundraisinggroup",
        "shipping fundraising group", "group",
    ),
    "emailStatus": ("emailstatus", "email status", "status", "contactstatus"),
    "emailPermissionStatus": (
        "emailpermissionstatus", "email permission status", "permissionstatus",
        "permission status", "permission", "optin", "opt in", "consent",
    ),
    "sourceName": ("sourcename", "source name", "source", "listname", "list name", "origin"),
    "orders": ("orders", "ordercount", "order count", "totalorders", "total orders"),
    "createdAt": ("datejoined", "date joined", "createdat", "created at", "signupdate", "date added"),
    "orderTotal": (
        "ordertotal(inctax)", "order total (inc tax)", "ordertotal",
        "order total", "total", "amount", "grandtotal", "grand total",
    ),
    "orderDate": ("orderdate", "order date", "date"),
    "customerType": ("customertype", "customer type", "type", "accounttype", "account type"),
    "notes": ("notes", "note", "comments", "ordernotes", "order notes"),
    "city": ("city", "suburb", "billingsuburb", "billing suburb", "shippingsuburb", "shipping suburb"),
    "state": ("state", "billingstate", "billing state", "shippingstate", "shipping state",
              "stateabbreviation", "shippingstateabbreviation", "shipping state abbreviation"),
}

# Label-in-cell patterns used by the fundraiser order forms.
LABEL_PATTERNS = {
    "group": re.compile(r"organi[sz]ation\s*:?\s*(.+)", re.I),
    "fullName": re.compile(r"submitted\s*by\s*:?\s*(.+)", re.I),
    "email": re.compile(r"e-?\s*mail\s*:?\s*(.+)", re.I),
    "phone": re.compile(r"phone\s*:\s*(.+)", re.I),
}

# Only these archive categories are scanned in freeform mode. Elsewhere an
# address in loose text belongs to a bank, an insurer, or a licensing agency
# rather than a customer, and header-driven tabular mode still runs everywhere.
FREEFORM_CATEGORIES = ("03 fundraisers", "07 wholesale & retail", "08 marketing", "12 correspondence")

PHONE_CLEAN_RE = re.compile(r"[^\d]")


def norm_header(h: str) -> str:
    """Lowercase, strip punctuation/whitespace so 'First Name?' == 'firstname'."""
    return re.sub(r"[^a-z0-9]", "", (h or "").lower())


# Alias lookup, keyed with the same normalization applied to real headers.
ALIAS_TO_FIELD: dict[str, str] = {}
for _field, _aliases in FIELD_ALIASES.items():
    for _a in _aliases:
        ALIAS_TO_FIELD.setdefault(norm_header(_a), _field)


def clean(v) -> str | None:
    if v is None:
        return None
    s = str(v).strip().strip('​')
    # openpyxl surfaces escaped control chars from some legacy exports.
    s = s.replace("_x000D_", " ").replace("_x000d_", " ")
    s = re.sub(r"\s+", " ", s).strip()
    if s in ("", "-", "--", "n/a", "N/A", "None", "none", "null", "NULL", "0"):
        return None if s != "0" else "0"
    return s or None


def valid_email(s: str | None) -> str | None:
    if not s:
        return None
    s = s.strip().strip("<>,;:\"'()[]").lower()
    if not EMAIL_EXACT_RE.match(s):
        return None
    if s in EMAIL_DENY_EXACT or OWN_DOMAIN_RE.search(s):
        return None
    domain = s.split("@", 1)[1]
    if domain in EMAIL_DENY_DOMAINS:
        return None
    # Image/asset filenames sometimes look like addresses after OCR.
    if re.search(r"\.(png|jpg|jpeg|gif|webp|pdf|docx?|xlsx?)$", s):
        return None
    return s


def clean_phone(s: str | None) -> str | None:
    if not s:
        return None
    digits = PHONE_CLEAN_RE.sub("", s)
    if len(digits) == 11 and digits.startswith("1"):
        digits = digits[1:]
    if len(digits) != 10:
        return None
    return f"{digits[0:3]}-{digits[3:6]}-{digits[6:]}"


NAME_NOISE_RE = re.compile(
    r"\b(llc|inc|corp|ltd|company|market|store|school|band|club|team|booster|"
    r"church|dept|department|association|society|chapter|cheer|dance|athletics|"
    r"academy|college|university|elementary|middle|high|choir|orchestra)\b",
    re.I,
)


def split_name(full: str | None) -> tuple[str | None, str | None]:
    """Best-effort first/last split. Organization-looking names go to firstName
    only so we never invent a surname from a business name."""
    full = clean(full)
    if not full:
        return None, None
    if "," in full and full.count(",") == 1:
        last, first = [p.strip() for p in full.split(",", 1)]
        if first and last and not NAME_NOISE_RE.search(full):
            return first or None, last or None
    if NAME_NOISE_RE.search(full):
        return full, None
    parts = full.split()
    if len(parts) == 1:
        return parts[0], None
    if len(parts) > 4:
        return full, None
    return parts[0], " ".join(parts[1:])


# --------------------------------------------------------------------------
# Per-file designation signal, from where the file lives and what it is called.
# --------------------------------------------------------------------------

WHOLESALE_PATH_HINTS = (
    "retail stores", "current retail stores", "faire", "ht hackney", "hackney",
    "gia russa", "hirzel", "distributor", "wholesale", "vendor form",
    "daycare center",
)
FUNDRAISER_PATH_HINTS = (
    "fundraiser", "fundraising", "ffa", "shriners", "dance & cheer",
    "dance and cheer",
)
# Lists that mix retail individuals with wholesale accounts — the presence of a
# company name decides each row rather than the file. The "Responders" files are
# open/click reports from the 2020 institutional-buyer email campaigns and are
# filed under Wholesale, but roughly half the addresses on them are consumers.
MIXED_FILE_HINTS = (
    "qb customer list", "customer dump from quickbooks", "customer contact list",
    "customer list 11-19-24", "full constant contact list", "responders",
)


# BigCommerce ran two storefronts (the main shop and the fundraiser shop) and
# the archive's generic `orders-*.csv` / `customers-*.csv` filenames don't record
# which one an export came from. These assignments were established by comparing
# each file's email set against the two known-labelled anchor exports
# ("Fundraiser website customers 4-13-26.csv" = 571 contacts, "Reg website
# customers 4-14-26.csv" = 5,109 contacts); each file matched one anchor almost
# completely and the other barely at all.
FILE_SIGNAL_OVERRIDES: dict[str, str] = {
    "01 Financial/Online Orders & Customers/2026/customers-2026-04-13-12-50-44.csv": "fundraising",
    "01 Financial/Online Orders & Customers/2026/customers-2026-05-11-15-04-06.csv": "fundraising",
    "01 Financial/Online Orders & Customers/2026/customers-2026-05-11-16-01-01.csv": "fundraising",
    "01 Financial/Online Orders & Customers/2026/customers-2026-05-11-16-04-08.csv": "fundraising",
    "01 Financial/Online Orders & Customers/2026/orders-2026-05-11 (3).csv": "fundraising",
    "01 Financial/Online Orders & Customers/try this.csv": "fundraising",
    "01 Financial/Online Orders & Customers/2026/customers-2026-04-14-09-00-00.csv": "standard",
    "01 Financial/Online Orders & Customers/2026/orders-2026-05-11 (4).csv": "standard",
    "05 Licenses & Legal/Recall contacts 11-19-24 Main website.csv": "standard",
    "05 Licenses & Legal/Recall contacts 11-20-24 Main website.csv": "standard",
}


def file_signal(rel: str) -> str:
    if rel in FILE_SIGNAL_OVERRIDES:
        return FILE_SIGNAL_OVERRIDES[rel]
    # Downloaded filenames use `+` and `_` where the original had spaces
    # ("Jose+Madrid+Salsa_Customer+Contact+List"), so normalize before matching.
    low = re.sub(r"[+_]+", " ", rel.lower())
    if any(h in low for h in MIXED_FILE_HINTS):
        return "mixed"
    if low.startswith("07 wholesale") or any(h in low for h in WHOLESALE_PATH_HINTS):
        return "wholesale"
    if low.startswith("03 fundraisers") or any(h in low for h in FUNDRAISER_PATH_HINTS):
        return "fundraising"
    return "standard"


# --------------------------------------------------------------------------
# Readers
# --------------------------------------------------------------------------


def read_text(path: Path) -> str:
    raw = path.read_bytes()
    for enc in ("utf-8-sig", "utf-8", "cp1252", "latin-1"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("latin-1", errors="replace")


def csv_rows(path: Path) -> list[list[str | None]]:
    text = read_text(path)
    sample = text[:8192]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
    except csv.Error:
        dialect = csv.excel
    out: list[list[str | None]] = []
    for row in csv.reader(text.splitlines(), dialect):
        out.append([clean(c) for c in row])
    return out


def xlsx_sheets(path: Path):
    import openpyxl

    try:
        wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    except (zipfile.BadZipFile, KeyError, ValueError, TypeError) as exc:
        raise RuntimeError(f"openpyxl: {exc}") from exc
    try:
        for ws in wb.worksheets:
            rows = []
            for i, row in enumerate(ws.iter_rows(values_only=True)):
                if i > 50000:
                    break
                rows.append([clean(c) for c in row])
            yield ws.title, rows
    finally:
        wb.close()


def xls_sheets(path: Path):
    import xlrd

    try:
        wb = xlrd.open_workbook(path)
    except Exception as exc:  # xlrd raises a wide range on legacy files
        raise RuntimeError(f"xlrd: {exc}") from exc
    for sh in wb.sheets():
        rows = []
        for r in range(sh.nrows):
            rows.append([clean(sh.cell_value(r, c)) for c in range(sh.ncols)])
        yield sh.name, rows


def docx_content(path: Path) -> tuple[list[str], list[list[list[str | None]]]]:
    """Returns (paragraph lines, list of tables-as-rows)."""
    import docx

    d = docx.Document(str(path))
    lines = [clean(p.text) for p in d.paragraphs]
    tables = []
    for t in d.tables:
        rows = []
        for r in t.rows:
            rows.append([clean(c.text) for c in r.cells])
        tables.append(rows)
    return [l for l in lines if l], tables


def pdf_text(path: Path) -> str:
    try:
        res = subprocess.run(
            ["pdftotext", "-layout", "-q", str(path), "-"],
            capture_output=True, timeout=60,
        )
        return res.stdout.decode("utf-8", errors="replace")
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        return ""


# --------------------------------------------------------------------------
# Extraction modes
# --------------------------------------------------------------------------


def detect_header(rows: list[list[str | None]]) -> tuple[int, dict[int, str]] | None:
    """Find the header row in the first 30 rows: the row that maps the most
    columns to known fields, and maps an email or a name column at all."""
    best = None
    for idx, row in enumerate(rows[:30]):
        mapping: dict[int, str] = {}
        for ci, cell in enumerate(row):
            if not cell:
                continue
            field = ALIAS_TO_FIELD.get(norm_header(cell))
            if field and field not in mapping.values():
                mapping[ci] = field
        if len(mapping) < 2:
            continue
        fields = set(mapping.values())
        if not (fields & {"email", "fullName", "firstName", "lastName"}):
            continue
        score = len(mapping) + (5 if "email" in fields else 0)
        if best is None or score > best[0]:
            best = (score, idx, mapping)
    if best is None:
        return None
    return best[1], best[2]


def rec(email: str, rel: str, mode: str, signal: str, **kw) -> dict:
    r = {
        "email": email,
        "firstName": None, "lastName": None, "phone": None, "company": None,
        "group": None, "emailStatus": None, "emailPermissionStatus": None,
        "sourceName": None, "orders": None, "orderTotal": None,
        "orderDate": None, "createdAt": None, "customerType": None,
        "city": None, "state": None,
        "sourceFile": rel, "mode": mode, "signal": signal,
    }
    r.update({k: v for k, v in kw.items() if v is not None})
    return r


# Tabular rows that named a person but carried no usable email address, keyed by
# file. They cannot become `Customer` rows (email is the primary key) and are
# reported so the coverage gap is explicit rather than silent.
NO_EMAIL_ROWS: Counter = Counter()


def extract_tabular(rows, rel, sheet, signal) -> list[dict]:
    det = detect_header(rows)
    if not det:
        return []
    hidx, mapping = det
    out: list[dict] = []
    for row in rows[hidx + 1 :]:
        if not any(row):
            continue
        vals: dict[str, str | None] = {}
        for ci, field in mapping.items():
            if ci < len(row):
                v = row[ci]
                if v and not vals.get(field):
                    vals[field] = v

        # Column order is unreliable in the hand-edited sheets (one export has
        # addresses in the Email column and emails under "Order ID"), so accept
        # any email-shaped cell in the row, not just the mapped one.
        emails: list[str] = []
        mapped = valid_email(vals.get("email"))
        if mapped:
            emails.append(mapped)
        for cell in row:
            if not cell:
                continue
            for m in EMAIL_RE.findall(cell):
                e = valid_email(m)
                if e and e not in emails:
                    emails.append(e)
        if not emails:
            if vals.get("fullName") or vals.get("firstName") or vals.get("lastName"):
                NO_EMAIL_ROWS[rel] += 1
            continue

        first = vals.get("firstName")
        last = vals.get("lastName")
        if not first and not last:
            first, last = split_name(vals.get("fullName"))
        row_signal = signal
        company = vals.get("company")
        ctype = (vals.get("customerType") or "").lower()
        group = vals.get("group")
        if signal == "mixed":
            row_signal = "wholesale" if company else "standard"
        if "wholesale" in ctype:
            row_signal = "wholesale"
        elif group and "wholesale" in group.lower():
            row_signal = "wholesale"
        elif group:
            row_signal = "fundraising"

        for e in emails:
            out.append(
                rec(
                    e, rel, f"tabular:{sheet}" if sheet else "tabular", row_signal,
                    firstName=first, lastName=last,
                    phone=clean_phone(vals.get("phone")),
                    company=company, group=group,
                    emailStatus=vals.get("emailStatus"),
                    emailPermissionStatus=vals.get("emailPermissionStatus"),
                    sourceName=vals.get("sourceName"),
                    orders=vals.get("orders"), orderTotal=vals.get("orderTotal"),
                    orderDate=vals.get("orderDate"), createdAt=vals.get("createdAt"),
                    customerType=vals.get("customerType"),
                    city=vals.get("city"), state=vals.get("state"),
                )
            )
    return out


def extract_labelled(cells: list[str], rel: str, signal: str) -> list[dict]:
    """The fundraiser order forms put `Organization:` / `Submitted by:` /
    `E-Mail:` / `Phone:` inside individual cells rather than in a header row.

    Matched per cell, not per row: joining a row's cells first merges
    "Submitted by: Jane Doe" with the neighbouring "Name: <ship-to>" cell and
    corrupts the name. An `Organization:` match is required — without it, the
    same `E-Mail:`/`Phone:` labels match bank statements and vendor agreements
    and yield their support addresses.
    """
    found: dict[str, str] = {}
    emails: list[str] = []
    for cell in cells:
        cell = cell.strip()
        if not cell or len(cell) > 200:
            continue
        for field, pat in LABEL_PATTERNS.items():
            m = pat.match(cell)
            if not m:
                continue
            v = clean(m.group(1))
            if not v:
                continue
            if field == "email":
                for cand in EMAIL_RE.findall(v):
                    e = valid_email(cand)
                    if e and e not in emails:
                        emails.append(e)
            elif field not in found:
                found[field] = v

    # A short label value is an organization name; a long one is a sentence
    # from a vendor agreement that happens to contain the word "organization".
    if "group" not in found or len(found["group"]) > 80:
        return []

    if not emails:
        # A form whose organizer address sits outside an `E-Mail:` label.
        for cell in cells:
            for m in EMAIL_RE.findall(cell):
                e = valid_email(m)
                if e and e not in emails:
                    emails.append(e)
    if not emails:
        return []

    first, last = split_name(found.get("fullName"))
    group = found["group"]
    return [
        rec(
            emails[0], rel, "labelled", signal,
            firstName=first, lastName=last,
            phone=clean_phone(found.get("phone")),
            group=group, company=group,
        )
    ]


def extract_freeform(text: str, rel: str, signal: str) -> list[dict]:
    """Last resort: pull every address out of a blob of text and try to name it
    from the same line."""
    out: list[dict] = []
    seen: set[str] = set()
    for line in text.splitlines():
        for m in EMAIL_RE.findall(line):
            e = valid_email(m)
            if not e or e in seen:
                continue
            seen.add(e)
            # Text immediately before the address on the same line, minus
            # labels, is usually the person's name.
            before = line[: line.lower().find(m.lower())]
            before = re.sub(
                r"(?i)\b(e-?mail|email|contact|name|phone|from|to|cc)\b\s*:?\s*",
                " ", before,
            )
            before = re.sub(r"[^A-Za-z .'\-]", " ", before)
            before = re.sub(r"\s+", " ", before).strip()
            cand = before if 3 <= len(before) <= 40 and " " in before else None
            first, last = split_name(cand)
            out.append(rec(e, rel, "freeform", signal, firstName=first, lastName=last))
    return out


def extract_file(path: Path, rel: str) -> tuple[list[dict], str | None]:
    """Returns (records, error). Tries tabular first, then labelled, then
    freeform — a hand-built order form has no header row, and a clean export has
    no `Submitted by:` label, so the modes are mutually exclusive in practice."""
    signal = file_signal(rel)
    ext = path.suffix.lower()
    freeform_ok = rel.lower().startswith(FREEFORM_CATEGORIES)
    out: list[dict] = []
    # Individual cell / line values, kept unjoined so label matching stays exact.
    cells: list[str] = []

    try:
        if ext == ".csv":
            rows = csv_rows(path)
            out = extract_tabular(rows, rel, "", signal)
            cells = [c for r in rows for c in r if c]

        elif ext in (".xlsx", ".xlsm", ".xls"):
            sheets = xls_sheets(path) if ext == ".xls" else xlsx_sheets(path)
            for sheet, rows in sheets:
                got = extract_tabular(rows, rel, sheet, signal)
                out.extend(got)
                if not got:
                    cells.extend(c for r in rows for c in r if c)

        elif ext == ".docx":
            lines, tables = docx_content(path)
            for i, rows in enumerate(tables):
                out.extend(extract_tabular(rows, rel, f"table{i}", signal))
            cells = list(lines) + [c for rows in tables for r in rows for c in r if c]

        elif ext == ".pdf":
            cells = [l for l in pdf_text(path).splitlines() if l.strip()]

        elif ext in (".txt", ".html", ".htm", ".xml"):
            text = read_text(path)
            if ext in (".html", ".htm", ".xml"):
                text = re.sub(r"<[^>]+>", " ", text)
            cells = [l for l in text.splitlines() if l.strip()]

        else:
            return [], None

        if not out and cells:
            out = extract_labelled(cells, rel, signal)
        if not out and cells and freeform_ok:
            out = extract_freeform("\n".join(cells), rel, signal)

    except Exception as exc:  # a single unreadable legacy file must not stop the run
        return [], f"{type(exc).__name__}: {exc}"

    return out, None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True, help="path to the Documents archive")
    ap.add_argument("--out", required=True, help="output directory (gitignored)")
    ap.add_argument("--limit", type=int, default=0, help="stop after N files (debug)")
    args = ap.parse_args()

    root = Path(args.root).resolve()
    outdir = Path(args.out).resolve()
    outdir.mkdir(parents=True, exist_ok=True)
    if not root.is_dir():
        print(f"archive not found: {root}", file=sys.stderr)
        return 1

    files: list[Path] = []
    for p in sorted(root.rglob("*")):
        if not p.is_file():
            continue
        if p.name.startswith("._") or p.name == ".DS_Store":
            continue
        if p.suffix.lower() in SKIP_EXT or p.name.lower() in SKIP_NAMES:
            continue
        files.append(p)

    print(f"scanning {len(files)} files under {root}")

    recs_path = outdir / "contacts.raw.jsonl"
    report_path = outdir / "extract-report.json"

    per_file: list[dict] = []
    errors: list[dict] = []
    mode_counts: Counter = Counter()
    signal_counts: Counter = Counter()
    total = 0

    with recs_path.open("w", encoding="utf-8") as fh:
        for i, p in enumerate(files):
            if args.limit and i >= args.limit:
                break
            rel = str(p.relative_to(root))
            recs, err = extract_file(p, rel)
            if err:
                errors.append({"file": rel, "error": err})
            for r in recs:
                fh.write(json.dumps(r, ensure_ascii=False) + "\n")
                mode_counts[r["mode"].split(":")[0]] += 1
                signal_counts[r["signal"]] += 1
            total += len(recs)
            if recs:
                per_file.append(
                    {"file": rel, "records": len(recs), "signal": file_signal(rel)}
                )

            if (i + 1) % 250 == 0:
                print(f"  {i + 1}/{len(files)} files, {total} records")

    per_file.sort(key=lambda r: -r["records"])
    report = {
        "archiveRoot": str(root),
        "filesScanned": len(files),
        "filesWithContacts": len(per_file),
        "rawRecords": total,
        "byMode": dict(mode_counts),
        "bySignal": dict(signal_counts),
        "topFiles": per_file[:60],
        "namedRowsWithoutEmail": sum(NO_EMAIL_ROWS.values()),
        "namedRowsWithoutEmailByFile": dict(NO_EMAIL_ROWS.most_common(40)),
        "unreadable": errors,
    }
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    print(f"\n{total} raw contact records -> {recs_path}")
    print(f"by mode:   {dict(mode_counts)}")
    print(f"by signal: {dict(signal_counts)}")
    print(f"named rows with no email (cannot become customers): {sum(NO_EMAIL_ROWS.values())}")
    print(f"unreadable files: {len(errors)}")
    print(f"report -> {report_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
