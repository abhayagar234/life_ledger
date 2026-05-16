import re
from io import BytesIO

import pdfplumber

from app.ingestion.readers import (
    ParsedSheet,
    _detect_best_sheet,
    _normalize_header,
    _score_header_row,
)


BANK_NAMES = ["hdfc bank", "sbi", "state bank", "icici bank", "axis bank", "kotak mahindra", "indusind", "yes bank", "paytm"]
SUMMARY_BALANCE_RE = re.compile(r"\b(clear|closing)\s+balance\s*:\s*([\d,]+(?:\.\d{1,2})?)\s*(cr|dr)?", re.IGNORECASE)
DATE_WORD_RE = re.compile(r"\b(\d{1,2}\s+[A-Za-z]{3}\s+\d{2,4})\b")
AMOUNT_RE = re.compile(r"([\d,]+(?:\.\d{1,2})?)")


def _detect_bank_from_text(text: str) -> str | None:
    text_lower = text.lower()
    for bank in BANK_NAMES:
        if bank in text_lower:
            return bank
    return None


def _extract_summary_balance(text: str) -> str | None:
    match = SUMMARY_BALANCE_RE.search(text)
    if not match:
        return None
    amount = match.group(2)
    suffix = (match.group(3) or "").lower()
    return f"-{amount}" if suffix == "dr" else amount


def _looks_like_date(cell: object) -> bool:
    text = str(cell).strip() if cell else ""
    if not text:
        return False
    normalized = " ".join(text.replace("\n", " ").split())
    import re
    return bool(
        re.match(r"^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}", normalized)
        or re.match(r"^\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4}$", normalized)
    )


def _looks_like_amount(cell: object) -> bool:
    text = str(cell).strip() if cell else ""
    import re
    return bool(re.match(r'^[\d,.-]+$', text))


def _is_transaction_table(table: list[list]) -> bool:
    if not table or len(table) < 2:
        return False

    # Check header row
    header_row = table[0]
    header_normalized = [str(cell).lower() if cell else "" for cell in header_row]
    header_text = " ".join(header_normalized)

    # Reject non-transaction tables
    if "open" in header_text and "date" in header_text:
        return False
    if "maturity" in header_text:
        return False

    # For tables with weak/empty headers, check if data rows look like transactions
    non_empty_headers = sum(1 for cell in header_row if cell and str(cell).strip())
    if non_empty_headers < 3 or len(header_row) - non_empty_headers > len(header_row) / 2:
        if len(table) < 3:
            return False
        data_row = table[1]
        if len(data_row) < 3:
            return False
        has_date = any(_looks_like_date(cell) for cell in data_row[:3])
        has_amount = sum(1 for cell in data_row if _looks_like_amount(cell)) >= 2
        return has_date and has_amount

    # For tables with clear headers
    has_date = "date" in header_text
    has_transaction_markers = ("transaction" in header_text or "narration" in header_text or
                               "description" in header_text or "particulars" in header_text or "details" in header_text)
    has_direction = "debit" in header_text or "credit" in header_text or "dr" in header_text or "cr" in header_text
    has_balance = "balance" in header_text
    return (has_date or has_balance) and (has_transaction_markers or has_direction)


def _looks_like_header_row(row: list) -> bool:
    if not row or len(row) < 3:
        return False
    non_empty = [str(cell).strip() for cell in row if cell and str(cell).strip()]
    if not non_empty:
        return False
    non_numeric = sum(1 for cell in non_empty if not str(cell).replace(".", "").replace(",", "").replace("-", "").isdigit())
    return non_numeric >= len(non_empty) * 0.5


def _stitch_tables(tables_per_page: list[list[list]]) -> list[list]:
    if not tables_per_page:
        return []

    all_tables = []
    for page_tables in tables_per_page:
        for table in page_tables:
            if table and len(table) > 3 and _is_transaction_table(table):
                all_tables.append(table)

    if not all_tables:
        return []

    if len(all_tables) == 1:
        return all_tables[0]

    best_table = [all_tables[0][0]]
    seen_rows = set()

    for table in all_tables:
        for row in table[1:]:
            if not any(str(cell).strip() for cell in row if cell is not None):
                continue

            # Create a fingerprint of the row to detect exact duplicates
            row_fingerprint = tuple(str(cell).strip() if cell is not None else "" for cell in row)
            if row_fingerprint in seen_rows:
                continue
            seen_rows.add(row_fingerprint)

            if any(_looks_like_date(cell) for cell in row[:2]):
                best_table.append(row)
                continue
            if not _looks_like_header_row(row):
                best_table.append(row)

    return best_table


def _repair_weak_header(matrix: list[list]) -> list[list]:
    if not matrix:
        return matrix

    first_row = matrix[0]
    normalized = [_normalize_header(cell) for cell in first_row]
    non_empty = [cell for cell in normalized if cell]
    only_balance_header = len(non_empty) <= 1 and "balance" in non_empty

    if not only_balance_header or len(matrix) < 2:
        return matrix

    first_txn_index = None
    for index, row in enumerate(matrix[1:], start=1):
        if len(row) >= 6 and any(_looks_like_date(cell) for cell in row[:2]):
            first_txn_index = index
            break
    if first_txn_index is None:
        return matrix

    synthetic_header = ["transaction date", "value date", "description", "reference", "debit", "credit", "balance"]
    width = max(len(first_row), len(matrix[first_txn_index]))
    padded_header = synthetic_header[:width] + [""] * max(0, width - len(synthetic_header))
    return [padded_header, *matrix[first_txn_index:]]


ICICI_ROW_RE = re.compile(
    r"^\s*(\d+)\s+(\d{2}\.\d{2}\.\d{4})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s*$"
)
CARD_TXN_LINE_RE = re.compile(
    r"^\s*(\d{1,2}\s+[A-Za-z]{3}\s+\d{2,4})\s+(.+?)\s+([\d,]+\.\d{1,2})\s+([CD])\s*$",
    re.IGNORECASE,
)
GENERIC_TXN_LINE_RE = re.compile(
    r"^\s*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\s+(.*?)\s+([+-]?\d[\d,]*(?:\.\d{1,2})?)\s*(dr|cr)?\s*$",
    re.IGNORECASE,
)


def _parse_text_fallback(pdf_file: pdfplumber.PDF) -> list[list]:
    rows: list[list] = []
    description_parts: list[str] = []
    prev_balance: float | None = None
    seen_rows = set()

    for page in pdf_file.pages:
        text = page.extract_text() or ""
        for raw_line in text.splitlines():
            line = " ".join(raw_line.split())
            if not line:
                continue
            lower = line.lower()
            if (
                "statement of transactions" in lower
                or "transaction withdrawal deposit balance" in lower
                or "transaction remarks" in lower
                or "date amount (inr)" in lower
                or lower in {"1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"}
            ):
                continue

            match = ICICI_ROW_RE.match(line)
            if match:
                serial_no, txn_date, amount_text, balance_text = match.groups()
                amount_value = float(amount_text.replace(",", ""))
                balance_value = float(balance_text.replace(",", ""))
                debit = ""
                credit = ""

                if prev_balance is not None:
                    delta = round(balance_value - prev_balance, 2)
                    if abs(delta + amount_value) < 1:
                        debit = amount_text
                    elif abs(delta - amount_value) < 1:
                        credit = amount_text
                    else:
                        debit = amount_text
                else:
                    debit = amount_text

                description = " ".join(description_parts).strip()
                row = [serial_no, txn_date, description, "", debit, credit, balance_text]

                # Deduplicate exact row copies
                row_fingerprint = tuple(str(cell) for cell in row)
                if row_fingerprint not in seen_rows:
                    rows.append(row)
                    seen_rows.add(row_fingerprint)

                description_parts = []
                prev_balance = balance_value
                continue

            card_match = CARD_TXN_LINE_RE.match(line)
            if card_match:
                txn_date, desc, amount_text, marker = card_match.groups()
                debit = amount_text if marker.upper() == "D" else ""
                credit = amount_text if marker.upper() == "C" else ""
                row = ["", txn_date, desc.strip(), "", debit, credit, ""]
                row_fingerprint = tuple(str(cell) for cell in row)
                if row_fingerprint not in seen_rows:
                    rows.append(row)
                    seen_rows.add(row_fingerprint)
                description_parts = []
                continue

            generic_match = GENERIC_TXN_LINE_RE.match(line)
            if generic_match:
                txn_date, desc, amount_text, drcr = generic_match.groups()
                if len(desc.strip()) < 2:
                    continue
                debit = ""
                credit = ""
                if drcr and drcr.lower() == "dr":
                    debit = amount_text
                elif drcr and drcr.lower() == "cr":
                    credit = amount_text
                else:
                    # Safe default: treat unsigned lines as debit expenses for card/bank activity
                    debit = amount_text
                row = ["", txn_date, desc.strip(), "", debit, credit, ""]
                row_fingerprint = tuple(str(cell) for cell in row)
                if row_fingerprint not in seen_rows:
                    rows.append(row)
                    seen_rows.add(row_fingerprint)
                description_parts = []
                continue

            description_parts.append(line)

    if not rows:
        return []

    return [["s no", "transaction date", "description", "reference", "debit", "credit", "balance"], *rows]


def _extract_card_insights(text: str) -> dict[str, str]:
    lines = [l.strip() for l in (text or "").splitlines() if l.strip()]
    joined = "\n".join(lines)
    result: dict[str, str] = {}

    total_due_match = re.search(r"total amount due.*?\n\s*([\d,]+(?:\.\d{1,2})?)", joined, re.IGNORECASE | re.DOTALL)
    if total_due_match:
        result["statement_total_due"] = total_due_match.group(1)

    min_due_match = re.search(r"minimum amount due.*?\n.*?([\d,]+(?:\.\d{1,2})?)", joined, re.IGNORECASE | re.DOTALL)
    if min_due_match:
        result["statement_min_due"] = min_due_match.group(1)

    for idx, line in enumerate(lines):
        lower = line.lower()
        if "statement date" in lower:
            look = " ".join(lines[idx : min(idx + 3, len(lines))])
            dm = DATE_WORD_RE.search(look)
            if dm:
                result["statement_date_text"] = dm.group(1)
        if "payment due date" in lower:
            look = " ".join(lines[idx : min(idx + 3, len(lines))])
            dm = DATE_WORD_RE.search(look)
            if dm:
                result["statement_payment_due_date_text"] = dm.group(1)
        if "for statement period" in lower:
            dates = DATE_WORD_RE.findall(line)
            if len(dates) >= 2:
                result["statement_period_start_text"] = dates[0]
                result["statement_period_end_text"] = dates[1]

    return result


def read_pdf_rows(content: bytes) -> ParsedSheet:
    try:
        pdf_file = pdfplumber.open(BytesIO(content))
    except Exception as exc:
        if "password" in str(exc).lower():
            raise RuntimeError("PDF is password-protected. Please remove the password and re-upload.") from exc
        raise RuntimeError(f"Failed to read PDF: {str(exc)}") from exc

    if not pdf_file.pages:
        raise RuntimeError("PDF has no pages.")

    tables_per_page = []
    bank_hint = None
    summary_balance = None

    empty_text_pages = 0
    first_page_text = ""
    for page_idx, page in enumerate(pdf_file.pages):
        if page_idx == 0:
            try:
                text = page.extract_text()
                if text:
                    first_page_text = text
                    bank_hint = _detect_bank_from_text(text)
                    summary_balance = _extract_summary_balance(text)
            except Exception:
                pass

        try:
            page_text = page.extract_text() or ""
            if not page_text.strip():
                empty_text_pages += 1
            tables = page.extract_tables()
            if tables:
                tables_per_page.append(tables)
            else:
                tables_per_page.append([])
        except Exception:
            tables_per_page.append([])

    combined_matrix = _repair_weak_header(_stitch_tables(tables_per_page))
    if not combined_matrix or len(combined_matrix) <= 1:
        combined_matrix = _parse_text_fallback(pdf_file)

    if not combined_matrix or all(not row for row in combined_matrix):
        if empty_text_pages >= max(1, len(pdf_file.pages) // 3):
            raise ValueError(
                "PDF appears image/scanned on key pages. Please upload CSV export or enable OCR ingestion."
            )
        raise ValueError("PDF contains no readable transaction table. Try exporting as CSV from your bank instead.")

    sheet = _detect_best_sheet(None, combined_matrix)
    if not sheet.headers or not sheet.rows:
        raise ValueError("PDF was read but contains no recognizable transaction data. Check that your statement includes a table with dates and amounts.")

    # Drop obvious non-transaction rows (legal text / fee tables) that slip into extracted tables.
    tx_date_headers = [h for h in sheet.headers if "date" in (h or "").lower()]
    if tx_date_headers:
        filtered_rows = []
        for row in sheet.rows:
            date_present = any(str(row.get(h, "")).strip() for h in tx_date_headers)
            if not date_present:
                continue
            filtered_rows.append(row)
        if filtered_rows:
            sheet.rows = filtered_rows

    if summary_balance and sheet.rows:
        sheet.rows[0]["statement_clear_balance"] = summary_balance
    card_insights = _extract_card_insights(first_page_text)
    if card_insights and sheet.rows:
        for key, value in card_insights.items():
            sheet.rows[0][key] = value

    pdf_file.close()

    return sheet
