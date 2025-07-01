import fitz  # PyMuPDF
import camelot
import re
from datetime import datetime

HEADERS = [
    "Intercity/Intracity- Deployment Intercity/intracity- O&M FTTH- Deployment FTTH-O&M",
    "BUSINESS UNIT",
    "Circle",
    "City",
    "Demand Note Reference number",
    "LM/BB/FTTH",
    "Type (UG/OH)",
    "Capping/Non Capping",
    "UG TYPE( HDD/ OT/ MICROTRENCHING)",
    "Road Types - CC/BT/TILES/ Normal Soil/kacha",
    "HDD - Number of Pits",
    "OH (EB Poles/MC Poles/Own Poles)",
    "NO OF POLES",
    "RAILWAY CROSSING/ PIPELINE CROSSING( No of crossing)",
    "GO RATE",
    "PREVIOUS DN RATE",
    "Rate/mtr- Current DN (UG/OH)",
    "Annual Rate/Pole( current DN)",
    "HDD(PIT RATE)",
    "Section Length (Mtr.)",
    "Total Route (MTR)",
    "RAILWAY/ PIPELINE/ EACH CROSSING RATE",
    "Reason (Current rate is more than GO or Previous DN)",
    "Annual Lease/ rent amount",
    "Renewal Lease/Rent date",
    "Not part of capping (License Fee/Rental Payment /Way Leave charges etc.)",
    "Covered under capping (Restoration Charges, admin, registration etc.)",
    "Non Refundable Cost( Amount to process for payment shold be sum of 'Z' and 'AA' coulm )",
    "Cost type with Cost Breakup EG.. - PROCESING FEES/ SUPERVISOIN CHARGE/ ADMIN FEES/ LICENSE FEES etc etc.",
    "GST Amount",
    "BG Amount",
    "SD Amount",
    "ROW APPLICATION  DATE",
    "Demand Note Date",
    "DN RECEIVED FROM PARTNER/AUTHORITY- DATE",
    "Difference from, DN date  - DN Sent to Central team (ARTL)",
    "REASON FOR DELAY (>2 DAYS)",
    "Total DN Amount ( NON REFUNDABLE+SD+ BG+ GST) To be filled by helpdesk team",
    "Supplier Code( if team have) To be filled by helpdesk team",
    "Supplier site name( if team have) To be filled by helpdesk team",
    "Locator Code (material)",
    "Authority( email address)",
    "Authority",
    "BENEFICIERY NAME",
    "Mode of payment(DD/ONLINE-URL/ONLINE-NEFT/BHARATKOSH",
    "EXECUTION PARTNER NAME",
    "Payable (Authority) Location",
    "Printing Location",
    "PO No.",
    "Business NFA NUMBER (Approved CAF) To be filled by helpdesk team",
    "Route Name(As per CWIP)",
    "Section Name for ROW(As per CWIP)",
    "NSG ID(As per CWIP)/CWO NO.",
    "Total Amount as per capping MB(Partner Scope)",
    "Cost type(restoration/ supervison/ agency changes/ admin etc)",
    "Total Amount as per capping MB(Not in Partner Scope)",
    "Cost type (way leave charges/ rent/ license etc)",
    "Permission Type (Primary/ Secondary)",
    "Additional Remarks"
]

STATIC_VALUES = {
    "Intercity/Intracity- Deployment Intercity/intracity- O&M FTTH- Deployment FTTH-O&M": "Intercity/Intracity - Deployment",
    "BUSINESS UNIT": "TNL-FF-Maharashtra",
    "Circle": "MUM",
    "City": "MUM",
    "Capping/Non Capping": "Non capping",
    "Cost type with Cost Breakup EG.. - PROCESING FEES/ SUPERVISOIN CHARGE/ ADMIN FEES/ LICENSE FEES etc etc.": "Restoration Charges",
    "Authority( email address)": "dyche.rdplg@mcgm.gov.in",
    "Authority": "MUNICIPAL CORPORATION OF GREATER MUMBAI",
    "BENEFICIERY NAME": "MUNICIPAL CORPORATION OF GREATER MUMBAI",
    "Mode of payment(DD/ONLINE-URL/ONLINE-NEFT/BHARATKOSH": "ONLINE-NEFT",
    "EXECUTION PARTNER NAME": "Excel Telesonic India Private Limited",
    "Payable (Authority) Location": "Mumbai",
    "Printing Location": "Mumbai",
    "Cost type(restoration/ supervison/ agency changes/ admin etc)": "Restoration Charges",
    "Permission Type (Primary/ Secondary)": "Primary",
    "Type (UG/OH)": "UG",
    "UG TYPE( HDD/ OT/ MICROTRENCHING)": "OT"
}

def extract_demand_note_reference(text):
    match = re.search(r"^\s*No\.?\s*([A-Za-z0-9\-\/]+)", text, re.MULTILINE)
    print(f"[DEBUG] [mcgm] extract_demand_note_reference: match={match.group(0) if match else None}, value={match.group(1) if match else None}")
    return match.group(1).strip() if match else ""

def extract_section_length(text):
    matches = re.findall(r"Length in Mt\.\s*:?\s*([0-9,.]+)", text)
    return str(sum(float(m.replace(",", "")) for m in matches)) if matches else ""

def extract_gst_amount(text):
    cgst = re.search(r"CGST\s*[:\-]?\s*([0-9,]+)", text)
    sgst = re.search(r"SGST\s*[:\-]?\s*([0-9,]+)", text)
    total = 0
    if cgst:
        total += float(cgst.group(1).replace(",", ""))
    if sgst:
        total += float(sgst.group(1).replace(",", ""))
    return str(total) if total else ""

def extract_gst_amount_from_text(text):
    cgst = 0.0
    sgst = 0.0
    match_cgst = re.search(r"CGST\s*=\s*([0-9,.]+)", text)
    if match_cgst:
        try:
            cgst = float(match_cgst.group(1).replace(',', ''))
        except ValueError:
            pass
    match_sgst = re.search(r"SGST\s*=\s*([0-9,.]+)", text)
    if match_sgst:
        try:
            sgst = float(match_sgst.group(1).replace(',', ''))
        except ValueError:
            pass
    return str(int(cgst + sgst)) if (cgst + sgst).is_integer() else str(cgst + sgst)

def extract_sd_amount_from_text(text):
    match = re.search(r"Deposit as 50% of \(C\)\s*=\s*E\s*([0-9,]+\.?[0-9]*)", text)
    if match:
        val = match.group(1).replace(',', '')
        try:
            return str(int(float(val))) if float(val).is_integer() else str(float(val))
        except ValueError:
            return ""
    match = re.search(r"Deposit as 50%.*?([0-9,]+\.?[0-9]*)", text)
    if match:
        val = match.group(1).replace(',', '')
        try:
            return str(int(float(val))) if float(val).is_integer() else str(float(val))
        except ValueError:
            return ""
    return ""

def extract_row_application_date(text):
    for line in text.splitlines():
        if 'Your Letter No.' in line:
            match = re.search(r"Dated[:\s]*([0-9]{2}[./][0-9]{2}[./][0-9]{4})", line, re.IGNORECASE)
            if match:
                return match.group(1).replace('.', '/')
    return ""

def extract_demand_note_date(text):
    match = re.search(r"Dt\.?\s*([0-9]{2}[./][0-9]{2}[./][0-9]{4})", text)
    if match:
        return match.group(1).replace('.', '/')
    return ""

def extract_difference_days(received_date):
    try:
        dn_date = datetime.strptime(received_date, "%d/%m/%Y")
        return str((datetime.today() - dn_date).days)
    except Exception:
        return ""

def extract_total_dn_amount(fields):
    try:
        sd = float(fields.get("SD Amount", 0) or 0)
        non_refundable = float(fields.get("Non Refundable Cost( Amount to process for payment shold be sum of 'Z' and 'AA' coulm )", 0) or 0)
        return str(int(sd + non_refundable)) if (sd + non_refundable).is_integer() else str(sd + non_refundable)
    except Exception:
        return ""

def extract_road_types(text):
    values = []
    stop_keywords = ["excavation", "beyond", "liability", "guarantee", "period"]
    for m in re.finditer(r'Particulars', text):
        chunk = text[m.end():m.end()+600]
        lines = chunk.splitlines()
        found_one = False
        collecting = False
        material_lines = []
        for i, line in enumerate(lines):
            s = line.strip()
            if found_one and not collecting:
                if not s or re.match(r'^\d+$', s):
                    continue
                collecting = True
            if collecting:
                if not s or any(kw in s.lower() for kw in stop_keywords):
                    break
                material_lines.append(s)
            if re.match(r'^\s*1\s*$', line):
                found_one = True
        if material_lines:
            values.append(' '.join(material_lines))
    return ' / '.join(values)

def extract_rate_in_rs(text):
    rates = []
    for m in re.finditer(r'Rate in Rs\.', text):
        chunk = text[m.end():m.end()+200]
        lines = chunk.splitlines()
        idx_1 = None
        for i, line in enumerate(lines):
            if re.match(r'^\s*1\s*$', line):
                idx_1 = i
                break
        if idx_1 is not None:
            for j in range(idx_1+1, len(lines)):
                s = lines[j].strip()
                if s:
                    for k in range(j+1, len(lines)):
                        s2 = lines[k].strip()
                        if s2:
                            parts = s2.split()
                            if len(parts) >= 4:
                                rates.append(parts[3])
                            break
                    break
    return ' / '.join(rates)

def extract_road_types_from_tables(tables):
    road_types = []
    for table in tables:
        df = table.df
        for col_idx, col_name in enumerate(df.iloc[0]):
            if "Particulars" in col_name:
                for i in range(2, len(df)):
                    val = df.iloc[i, col_idx].replace('\n', ' ').strip()
                    if val and "Total" not in val:
                        road_types.append(val)
                break
    return ' / '.join(road_types)

def extract_rate_in_rs_from_tables(tables):
    rates = []
    for table in tables:
        df = table.df
        for col_idx, col_name in enumerate(df.iloc[0]):
            if "Rate" in col_name and "Rs" in col_name:
                for i in range(2, len(df)):
                    val = df.iloc[i, col_idx].replace('\n', '').strip()
                    if val and "Total" not in val:
                        rates.append(val)
                break
    return ' / '.join(rates)

def extract_section_length_from_tables(tables):
    total_length = 0.0
    for table in tables:
        df = table.df
        for col_idx, col_name in enumerate(df.iloc[0]):
            if "Length" in col_name and "Mt" in col_name:
                for i in range(2, len(df)):
                    val = df.iloc[i, col_idx].replace('\n', '').replace(',', '').strip()
                    if val and "Total" not in val:
                        try:
                            total_length += float(val)
                        except ValueError:
                            pass
                break
    return str(int(total_length)) if total_length.is_integer() else str(total_length)

def extract_covered_under_capping(text, tables):
    total = 0.0
    for table in tables:
        df = table.df
        for i in range(len(df)):
            for j in range(len(df.columns)):
                cell = df.iloc[i, j].replace('\n', ' ').strip()
                if "Total R.I." in cell or "Total R.I. (A+B) = (C)" in cell:
                    for k in range(len(df.columns)-1, -1, -1):
                        val = df.iloc[i, k].replace(',', '').replace('\n', '').strip()
                        try:
                            total += float(val)
                            break
                        except ValueError:
                            continue
    for table in tables:
        df = table.df
        for i in range(len(df)):
            for j in range(len(df.columns)):
                cell = df.iloc[i, j].replace('\n', ' ').strip()
                if "Access Charges(F)" in cell:
                    for k in range(len(df.columns)-1, -1, -1):
                        val = df.iloc[i, k].replace(',', '').replace('\n', '').strip()
                        try:
                            total += float(val)
                            break
                        except ValueError:
                            continue
    match = re.search(r"\(i\)\s*Ground Rent\s*:?\s*([0-9,.]+)", text)
    if match:
        try:
            total += float(match.group(1).replace(',', ''))
        except ValueError:
            pass
    match = re.search(r"\(ii\)\s*Administrative Charge\s*:?\s*([0-9,.]+)", text)
    if match:
        try:
            total += float(match.group(1).replace(',', ''))
        except ValueError:
            pass
    return str(int(total)) if total.is_integer() else str(total)

def extract_not_part_of_capping(text, tables):
    return ""

def extract_ri_from_tables(tables):
    for table in tables:
        df = table.df
        for i in range(len(df)):
            for j in range(len(df.columns)):
                cell = df.iloc[i, j].replace('\n', ' ').strip()
                if "Total R.I." in cell or "Total R.I. (A+B) = (C)" in cell:
                    # Return the last column value in this row
                    for k in range(len(df.columns)-1, -1, -1):
                        val = df.iloc[i, k].replace(',', '').replace('\n', '').strip()
                        if val:
                            return val
    return ""

def extract_ground_rent_from_text(text):
    import re
    match = re.search(r"\(i\)\s*Ground Rent\s*:?\s*([0-9,.]+)", text)
    if match:
        try:
            return str(float(match.group(1).replace(',', '')))
        except ValueError:
            return ""
    return ""

def extract_administrative_charge_from_text(text):
    import re
    match = re.search(r"\(ii\)\s*Administrative Charge\s*:?\s*([0-9,.]+)", text)
    if match:
        try:
            return str(float(match.group(1).replace(',', '')))
        except ValueError:
            return ""
    return ""

def extract_supervision_charges_from_text(text):
    # MCGM: Not applicable, return blank
    return ""

def extract_chamber_fee_from_text(text):
    # MCGM: Not applicable, return blank
    return ""

def extract_gst_from_text(text):
    # MCGM: Not applicable, return blank (use other GST extractors if needed)
    return ""

def extract_multiplication_factor_from_tables(tables):
    def normalize(s):
        return s.replace('\n', '').replace(' ', '').lower()
    for idx, table in enumerate(tables):
        df = table.df
        for col_idx, col_name in enumerate(df.iloc[0]):
            if "multiplyingfactor" in normalize(col_name):
                for i in range(2, len(df)):
                    val = df.iloc[i, col_idx].replace('\n', '').replace(',', '').strip()
                    if val and "Total" not in val:
                        return val
                break
    return ""

def non_refundable_request_parser(pdf_path, manual_values=None):
    """
    Main extraction logic for Non Refundable Request Parser (was extract_fields_from_pdf).
    """
    doc = fitz.open(pdf_path)
    text = "\n".join(page.get_text() for page in doc)
    doc.close()
    tables = camelot.read_pdf(pdf_path, pages='1', flavor='lattice')
    print("\n" + "="*60)
    print("[DEBUG] [mcgm] DN EXTRACTED TEXT (START)")
    print(text)
    print("[DEBUG] [mcgm] DN EXTRACTED TEXT (END)")
    print("-"*60)
    print(f"[DEBUG] [mcgm] Camelot tables found: {len(tables)}")
    for idx, table in enumerate(tables):
        print(f"[DEBUG] [mcgm] Table {idx}:")
        print(table.df)
    print("="*60 + "\n")
    # ...existing code from extract_trench_data.py's non_refundable_request_parser...
    demand_note_ref = extract_demand_note_reference(text)
    section_length = extract_section_length(text)
    gst_amount = extract_gst_amount_from_text(text)
    sd_amount = extract_sd_amount_from_text(text)
    row_app_date = extract_row_application_date(text)
    demand_note_date = extract_demand_note_date(text)
    received_date = demand_note_date
    diff_days = extract_difference_days(received_date)
    road_types = extract_road_types_from_tables(tables)
    rate_in_rs = extract_rate_in_rs_from_tables(tables)
    section_length = extract_section_length_from_tables(tables)
    covered_under_capping = extract_covered_under_capping(text, tables)
    not_part_of_capping = extract_not_part_of_capping(text, tables)
    row = []
    for header in HEADERS:
        if header not in STATIC_VALUES and header not in [
            "Demand Note Reference number", "Section Length (Mtr.)", "GST Amount", "SD Amount", "ROW APPLICATION  DATE", "Demand Note Date", "DN RECEIVED FROM PARTNER/AUTHORITY- DATE", "Difference from, DN date  - DN Sent to Central team (ARTL)", "Total DN Amount ( NON REFUNDABLE+SD+BG+GST) To be filled by helpdesk team", "Road Types - CC/BT/TILES/ Normal Soil/kacha", "Rate/mtr- Current DN (UG/OH)", "Covered under capping (Restoration Charges, admin, registration etc.)", "Not part of capping (License Fee/Rental Payment /Way Leave charges etc.)", "Non Refundable Cost( Amount to process for payment shold be sum of 'Z' and 'AA' coulm )", "Rate/mtr- Current DN (UG/OH) (2)"
        ]:
            print(f"[⚠️ UNHANDLED HEADER]: {header}")
        if header in STATIC_VALUES:
            row.append(STATIC_VALUES[header])
        elif header == "Demand Note Reference number":
            row.append(demand_note_ref)
        elif header == "Section Length (Mtr.)":
            row.append(section_length)
        elif header == "GST Amount":
            row.append(gst_amount)
        elif header == "SD Amount":
            row.append(sd_amount)
        elif header == "ROW APPLICATION  DATE":
            row.append(row_app_date)
        elif header == "Demand Note Date":
            row.append(demand_note_date)
        elif header == "DN RECEIVED FROM PARTNER/AUTHORITY- DATE":
            row.append(received_date)
        elif header == "Difference from, DN date  - DN Sent to Central team (ARTL)":
            row.append(diff_days)
        elif header == "Total DN Amount ( NON REFUNDABLE+SD+ BG+ GST) To be filled by helpdesk team":
            row.append(extract_total_dn_amount({
                "SD Amount": sd_amount,
                "Non Refundable Cost( Amount to process for payment shold be sum of 'Z' and 'AA' coulm )": row[HEADERS.index("Non Refundable Cost( Amount to process for payment shold be sum of 'Z' and 'AA' coulm )")]
            }))
        elif header == "Road Types - CC/BT/TILES/ Normal Soil/kacha":
            row.append(road_types)
        elif header == "Rate/mtr- Current DN (UG/OH)":
            row.append(rate_in_rs)
        elif header == "Covered under capping (Restoration Charges, admin, registration etc.)":
            row.append(covered_under_capping)
        elif header == "Not part of capping (License Fee/Rental Payment /Way Leave charges etc.)":
            row.append(not_part_of_capping)
        elif header == "Non Refundable Cost( Amount to process for payment shold be sum of 'Z' and 'AA' coulm )":
            non_refundable_cost = None
            try:
                non_refundable_cost = float(covered_under_capping) + float(not_part_of_capping or 0)
            except Exception:
                non_refundable_cost = covered_under_capping
            row.append(str(int(non_refundable_cost)) if str(non_refundable_cost).replace('.', '', 1).isdigit() and float(non_refundable_cost).is_integer() else str(non_refundable_cost))
        elif header == "Rate/mtr- Current DN (UG/OH) (2)":
            row.append(rate_in_rs)
        elif header == "NO OF POLES":
            row.append("")
        else:
            row.append("")
    # Apply manual values if provided
    if manual_values:
        for field, value in manual_values.items():
            if field in HEADERS:
                idx = HEADERS.index(field)
                row[idx] = value
    return row

def sd_parser(pdf_path, manual_values=None):
    """
    SD Parser for MCGM Type 1: outputs a 20-column, 2-row Excel with static headers and mapped row values.
    """
    alt_headers = [
        "SD OU Circle Name", "Execution Partner Vendor Code", "Execution Partner Vendor Name", "Execution Partner GBPA PO No.",
        "GIS Code", "M6 Code", "Locator ID", "Mother Work Order", "Child Work Order", "FA Location", "Partner PO circle",
        "Unique route id", "Supplier Code", "Supplier site name", "NFA no.", "Payment type", "DN No", "DN Date", "SD Amount", "SD Time Period"
    ]
    row_main = non_refundable_request_parser(pdf_path)
    def get_main(header):
        try:
            return row_main[HEADERS.index(header)]
        except Exception:
            return ""
    row = [
        "TNL-FF-Maharashtra",  # SD OU Circle Name
        "632607",               # Execution Partner Vendor Code
        "Excel Telesonic India Private Limited",  # Execution Partner Vendor Name
        "",                     # Execution Partner GBPA PO No.
        "",                     # GIS Code
        "",                     # M6 Code
        "61027-IP01-2948564-CONT1210",  # Locator ID
        "",                     # Mother Work Order
        "",                     # Child Work Order
        "Mumbai",               # FA Location
        "",                     # Partner PO circle
        "",                     # Unique route id
        "",                     # Supplier Code
        "",                     # Supplier site name
        "",                     # NFA no.
        "ONLINE-NEFT",          # Payment type
        get_main("Demand Note Reference number"),  # DN No
        get_main("Demand Note Date"),              # DN Date
        get_main("SD Amount"),                     # SD Amount
        "2 Years"               # SD Time Period
    ]
    # Apply manual values if provided
    if manual_values:
        for field, value in manual_values.items():
            if field in alt_headers:
                idx = alt_headers.index(field)
                row[idx] = value
    return alt_headers, row

def extract_all_fields_for_testing(pdf_path):
    import fitz
    import camelot
    doc = fitz.open(pdf_path)
    text = "\n".join(page.get_text() for page in doc)
    doc.close()
    tables = camelot.read_pdf(pdf_path, pages='1', flavor='lattice')
    results = {
        "Demand Note Reference number": extract_demand_note_reference(text),
        "Section Length": extract_section_length_from_tables(tables),
        "GST Amount": extract_gst_amount(text),
        "GST Amount (from text)": extract_gst_amount_from_text(text),
        "SD Amount": extract_sd_amount_from_text(text),
        "ROW APPLICATION DATE": extract_row_application_date(text),
        "DN Received Date": extract_row_application_date(text),
        "Demand Note Date": extract_demand_note_date(text),
        "Difference Days": extract_difference_days(extract_demand_note_date(text)),
        "Total DN Amount": extract_total_dn_amount({
            "SD Amount": extract_sd_amount_from_text(text),
            "Non Refundable Cost( Amount to process for payment shold be sum of 'Z' and 'AA' coulm )": extract_covered_under_capping(text, tables)
        }),
        "Road Types": extract_road_types_from_tables(tables),
        "Rate in Rs": extract_rate_in_rs_from_tables(tables),
        "Covered under capping": extract_covered_under_capping(text, tables),
        "Not part of capping": extract_not_part_of_capping(text, tables),
        "Non Refundable Cost": extract_covered_under_capping(text, tables),
        "RI Amount": extract_ri_from_tables(tables),
        "Ground Rent": extract_ground_rent_from_text(text),
        "Administrative Charge": extract_administrative_charge_from_text(text),
        "Supervision Charges": extract_supervision_charges_from_text(text),
        "Chamber Fee": extract_chamber_fee_from_text(text),
        "GST (custom)": extract_gst_from_text(text),
        "Multiplication Factor": extract_multiplication_factor_from_tables(tables),
    }
    print("\n" + "*"*60)
    print("[DEBUG] [mcgm] EXTRACTED FIELDS (START)")
    for k, v in results.items():
        print(f"  {k}: {v}")
    print("[DEBUG] [mcgm] EXTRACTED FIELDS (END)")
    print("*"*60 + "\n")
    return results