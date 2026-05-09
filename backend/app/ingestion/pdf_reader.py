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


def _detect_bank_from_text(text: str) -> str | None:
    text_lower = text.lower()
    for bank in BANK_NAMES:
        if bank in text_lower:
            return bank
    return None


def _looks_like_date(cell: object) -> bool:
    text = str(cell).strip() if cell else ""
    import re
    return bool(re.match(r'^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}', text))


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
    for table in all_tables:
        for row in table[1:]:
            if not _looks_like_header_row(row):
                best_table.append(row)

    return best_table


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

    for page_idx, page in enumerate(pdf_file.pages):
        if page_idx == 0:
            try:
                text = page.extract_text()
                if text:
                    bank_hint = _detect_bank_from_text(text)
            except Exception:
                pass

        try:
            tables = page.extract_tables()
            if tables:
                tables_per_page.append(tables)
            else:
                tables_per_page.append([])
        except Exception:
            tables_per_page.append([])

    combined_matrix = _stitch_tables(tables_per_page)

    if not combined_matrix or all(not row for row in combined_matrix):
        raise RuntimeError("PDF contains no readable table data.")

    sheet = _detect_best_sheet(None, combined_matrix)
    pdf_file.close()

    return sheet
