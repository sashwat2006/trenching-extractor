import fitz  # PyMuPDF
import sys
import os
import re

# Add the backend directory to the Python path so we can import the parser
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))
from parsers.mbmc import (
    extract_demand_note_reference,
    extract_road_types_opencv_ocr,
    extract_rate_in_rs_from_tables,
    extract_section_length_from_tables,
    extract_covered_under_capping,
    extract_sd_amount_opencv,
    extract_demand_note_date
)

def test_extract_demand_note_reference():
    """Test the extract_demand_note_reference function with an MBMC PDF."""
    # Path to the MBMC PDF file
    pdf_path = r"MBMC\Demand Note MU-1608 Dr Babasaheb Ambedkar Rd MBMC_PWD_1014_64_2025-26.pdf"
    
    # Extract text from the PDF
    doc = fitz.open(pdf_path)
    text = "\n".join(page.get_text() for page in doc)
    doc.close()
    
    # Print the first 500 characters of the text to get a sense of the content
    print("\nFirst 500 characters of the PDF text:")
    print(text[:500])
    print("\n" + "-" * 80 + "\n")
    
    # Test the function
    demand_note_ref = extract_demand_note_reference(text)
    print(f"Extracted demand note reference: {demand_note_ref}")

    # Test the road type extraction using OpenCV+OCR
    road_types = extract_road_types_opencv_ocr(pdf_path)
    print(f"Extracted road types (OpenCV+OCR): {road_types}")

def test_extract_rate_in_rs_from_tables():
    """Test the extract_rate_in_rs_from_tables function with an MBMC PDF using OpenCV+OCR."""
    pdf_path = r"MBMC\Demand Note MU-1608 Dr Babasaheb Ambedkar Rd MBMC_PWD_1014_64_2025-26.pdf"
    rate = extract_rate_in_rs_from_tables(None, pdf_path=pdf_path)
    print(f"Extracted RM Rate (OpenCV+OCR): {rate}")

def test_extract_section_length_from_tables():
    """Test the extract_section_length_from_tables function with an MBMC PDF using OpenCV+OCR."""
    pdf_path = r"MBMC\Demand Note MU-1608 Dr Babasaheb Ambedkar Rd MBMC_PWD_1014_64_2025-26.pdf"
    length = extract_section_length_from_tables(None, pdf_path=pdf_path)
    print(f"Extracted Section Length (OpenCV+OCR): {length}")

def test_extract_covered_under_capping():
    """Test the extract_covered_under_capping function with an MBMC PDF using OpenCV+OCR."""
    pdf_path = r"MBMC\Demand Note MU-1608 Dr Babasaheb Ambedkar Rd MBMC_PWD_1014_64_2025-26.pdf"
    amount = extract_covered_under_capping(None, None, pdf_path=pdf_path)
    print(f"Extracted Covered Under Capping Amount (OpenCV+OCR): {amount}")

def test_extract_sd_amount_opencv():
    """Test the extract_sd_amount_opencv function with an MBMC PDF using OpenCV+OCR."""
    pdf_path = r"MBMC\Demand Note MU-1608 Dr Babasaheb Ambedkar Rd MBMC_PWD_1014_64_2025-26.pdf"
    sd_amount = extract_sd_amount_opencv(None, pdf_path=pdf_path)
    print(f"Extracted SD Amount (OpenCV+OCR): {sd_amount}")

def test_extract_demand_note_date():
    """Test the extract_demand_note_date function with an MBMC PDF."""
    pdf_path = r"MBMC\Demand Note MU-1608 Dr Babasaheb Ambedkar Rd MBMC_PWD_1014_64_2025-26.pdf"
    import fitz
    from parsers.mbmc import extract_demand_note_date
    doc = fitz.open(pdf_path)
    text = "\n".join(page.get_text() for page in doc)
    doc.close()
    date = extract_demand_note_date(text)
    print(f"Extracted Demand Note Date: {date}")

def test_extract_gst_amount_opencv():
    """Test the extract_gst_amount_opencv function with an MBMC PDF."""
    pdf_path = r"MBMC\Demand Note MU-1608 Dr Babasaheb Ambedkar Rd MBMC_PWD_1014_64_2025-26.pdf"
    import fitz
    from parsers.mbmc import extract_gst_amount_opencv
    gst_amount = extract_gst_amount_opencv(pdf_path=pdf_path)
    print(f"Extracted GST: {gst_amount}")

if __name__ == "__main__":
    test_extract_demand_note_reference()
    test_extract_rate_in_rs_from_tables()
    test_extract_section_length_from_tables()
    test_extract_covered_under_capping()
    test_extract_sd_amount_opencv()
    test_extract_demand_note_date()
    test_extract_gst_amount_opencv()
