SUPPORTED_IMPORT_EXTENSIONS = {".csv": "csv", ".xlsx": "xlsx", ".xls": "xls", ".pdf": "pdf"}


def detect_import_file_type(file_name: str, content: bytes | None = None) -> str | None:
    if content:
        if content.startswith(b"%PDF"):
            return "pdf"
        if content.startswith(b"PK"):
            return "xlsx"
        if content.startswith(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"):
            return "xls"

    lowered = file_name.lower()
    for extension, file_type in SUPPORTED_IMPORT_EXTENSIONS.items():
        if lowered.endswith(extension):
            return file_type
    return None
