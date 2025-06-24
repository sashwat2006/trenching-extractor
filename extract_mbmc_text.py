import fitz  # PyMuPDF
import camelot
import pandas as pd
import os

def extract_text_from_pdf(pdf_path):
    """
    Extract all text from a PDF file and display it in the terminal.
    """
    doc = fitz.open(pdf_path)
    text = ""
    
    for page_num in range(len(doc)):
        page = doc[page_num]
        text += f"\n\n=== PAGE {page_num + 1} ===\n\n"
        text += page.get_text()
    
    doc.close()
    return text

def extract_tables_from_pdf(pdf_path):
    """
    Extract tables from a PDF file using Camelot.
    """
    # Try both lattice and stream flavors
    print("\n\n=== EXTRACTING TABLES WITH CAMELOT ===\n")
    
    print("Trying LATTICE mode...")
    try:
        tables_lattice = camelot.read_pdf(pdf_path, pages='all', flavor='lattice')
        print(f"Found {len(tables_lattice)} tables in lattice mode")
        
        for i, table in enumerate(tables_lattice):
            print(f"\n--- LATTICE TABLE {i+1} ---")
            print(f"Accuracy: {table.accuracy}")
            print(f"Whitespace: {table.whitespace}")
            print(f"Table shape: {table.df.shape}")
            print("\nTable content:")
            print(table.df)
            print("\n")
    except Exception as e:
        print(f"Error in lattice mode: {str(e)}")
    
    print("\nTrying STREAM mode...")
    try:
        tables_stream = camelot.read_pdf(pdf_path, pages='all', flavor='stream')
        print(f"Found {len(tables_stream)} tables in stream mode")
        
        for i, table in enumerate(tables_stream):
            print(f"\n--- STREAM TABLE {i+1} ---")
            print(f"Accuracy: {table.accuracy}")
            print(f"Whitespace: {table.whitespace}")
            print(f"Table shape: {table.df.shape}")
            print("\nTable content:")
            print(table.df)
            print("\n")
    except Exception as e:
        print(f"Error in stream mode: {str(e)}")

# Path to the MBMC PDF file
pdf_path = r"c:\Users\SashwatRavishankar\OneDrive - cloudextel.com\TrenchExtractor\MBMC\Demand Note MU-1608 Dr Babasaheb Ambedkar Rd MBMC_PWD_1014_64_2025-26.pdf"

# Extract and print the text
print("=== FULL PDF TEXT ===")
pdf_text = extract_text_from_pdf(pdf_path)
print(pdf_text)

# Extract and print tables
extract_tables_from_pdf(pdf_path)
