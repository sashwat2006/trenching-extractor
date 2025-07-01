import fitz  # PyMuPDF
import re
import camelot

APPLICATION_HEADERS = [
    "Application Number",
    "Application Length (Mtr)",
    "Application Date",
    "From",
    "To",
    "Authority",
    "Ward"
]

def extract_application_number(text):
    match = re.search(r"Application\s*No\.?\s*[:\-]?\s*([A-Za-z0-9\-\/]+)", text, re.IGNORECASE)
    return match.group(1).strip() if match else ""

def extract_application_length(text):
    total = 0.0
    for section in [7, 8, 9]:
        # Match the section, colon, optional whitespace/newlines, number (optional), then mtrs
        pattern = rf"{section}\.\s+Length of trench[^\n\r]*?\n:\n\s*([0-9]+(?:\.[0-9]+)?)?\s*\nmtrs?\.?"
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            print(f"[DEBUG] Section {section} match: {match.group(0)} | value: {match.group(1)}")
            val = match.group(1)
            if val:
                try:
                    total += float(val)
                except Exception:
                    pass
    return str(int(total)) if total else ""

def extract_application_date(text):
    match = re.search(r"Date\s*[:\-]?\s*([0-9]{2}[./-][0-9]{2}[./-][0-9]{4})", text)
    return match.group(1).replace('.', '/').replace('-', '/') if match else ""

def extract_from(text):
    # Look for "2.   Exact location of starting point", then colon, then value on next line
    match = re.search(
        r"2\.\s+Exact location of starting point\s*\n:\n([^\n\r]+)", text, re.IGNORECASE
    )
    return match.group(1).strip() if match else ""

def extract_to(text):
    # Look for "3.   Exact location of end point", then colon, then value on next line
    match = re.search(
        r"3\.\s+Exact location of end point\s*\n:\n([^\n\r]+)", text, re.IGNORECASE
    )
    return match.group(1).strip() if match else ""

def extract_authority(text):
    return "MCGM"

def extract_ward(text):
    # Look for a line with 'Commissioner' and 'Ward', and capture the word(s) before 'Ward'
    match = re.search(r"Commissioner\s+([A-Za-z ]+?)\s+Ward", text)
    return match.group(1).strip() if match else ""

def application_parser(pdf_path):
    doc = fitz.open(pdf_path)
    text = "\n".join(page.get_text() for page in doc)
    doc.close()
    print("=== PDF TEXT START ===")
    print(text)
    print("=== PDF TEXT END ===")

    # Try extracting tables with Camelot
    try:
        tables = camelot.read_pdf(pdf_path, pages='all', flavor='stream')
        print(f"[DEBUG] Camelot found {len(tables)} tables.")
        for idx, table in enumerate(tables):
            print(f"[DEBUG] Table {idx}:")
            print(table.df)
    except Exception as e:
        print(f"[DEBUG] Camelot extraction failed: {e}")

    # TODO: Use table data for extraction if needed

    row = [
        extract_application_number(text),
        extract_application_length(text),
        extract_application_date(text),
        extract_from(text),
        extract_to(text),
        extract_authority(text),
        extract_ward(text)
    ]
    return dict(zip(APPLICATION_HEADERS, row))

if __name__ == "__main__":
    import sys
    pdf_path = sys.argv[1]
    print(application_parser(pdf_path)) 