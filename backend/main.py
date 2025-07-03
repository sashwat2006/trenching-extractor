from fastapi import FastAPI, File, UploadFile, Form, APIRouter, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse, FileResponse
from typing import List, Optional
import io
import os
import tempfile
import json
import traceback
import uuid
import zipfile
import threading
import pandas as pd
from datetime import datetime
from supabase import create_client, Client
from extract_trench_data import process_demand_note, append_row_to_excel
import re
import time

# Import and include the actual_cost_extraction router
from parsers.actual_cost_extraction import router as actual_cost_extraction_router
# from parsers.dn_master_upload import router as dn_master_upload_router
from dotenv import load_dotenv
from parsers.application_parser import application_parser
from parsers.po_parser import po_parser

load_dotenv()

import os
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
print(f"[LOG] Loaded SUPABASE_URL: {SUPABASE_URL}")
if SUPABASE_KEY:
    print(f"[LOG] Loaded SUPABASE_KEY: {SUPABASE_KEY[:8]}...{SUPABASE_KEY[-4:]}")
else:
    print("[ERROR] SUPABASE_KEY not found in environment!")

app = FastAPI()

# Allow CORS for local frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Allow only frontend origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "content-disposition"],  # <-- Expose for frontend JS
)

# Global in-memory cache for parsed preview data
preview_cache = {}
preview_cache_lock = threading.Lock()
CACHE_EXPIRY_SECONDS = 3600  # 1 hour (optional, not enforced in this snippet)

# Include the actual_cost_extraction router
app.include_router(actual_cost_extraction_router)
# app.include_router(dn_master_upload_router)

DN_MASTER_COLUMNS = [
    "sr_no", "route_type", "lmc_route", "ip1_co_built", "dn_recipient", "project_name", "site_id", "uid",
    "contract_type", "build_type", "category_type", "survey_id", "po_number", "po_length", "route_id_lmc_id",
    "parent_route", "route_lmc_id", "route_lmc_section_id", "route_lmc_subsection_id", "application_number",
    "application_length_mtr", "application_date", "from_location", "to_location", "authority", "ward",
    "survey_done_mtr", "dn_number", "dn_length_mtr", "dn_received_date", "type", "trench_type", "ot_hdd", "pit",
    "surface", "ri_rate_go_rs", "dn_ri_amount", "multiplying_factor", "ground_rent", "administrative_charge",
    "supervision_charges", "chamber_fee", "gst", "deposit", "total_dn_amount", "ri_budget_amount_per_meter",
    "projected_budget_ri_amount_dn", "actual_total_non_refundable", "non_refundable_amount_per_mtr",
    "proj_non_refundable_savings_per_mtr", "deposit_repeat", "total_dn_amount_repeat", "row_network_id",
    "route_network_id", "new_revised_dn_number", "new_revised_dn_against", "internal_approval_start",
    "internal_approval_end", "ticket_raised_date", "dn_payment_date", "tat_days", "civil_completion_date"
]

# Add this mapping at the top (after DN_MASTER_COLUMNS or near SUPABASE_URL)
FIELD_MAP = {
    "sr_no": "sr_no",
    "route_type": "route_type",
    "lmc_route": "lmc_route",
    "ip1_co_built": "ip1_co_built",
    "dn_recipient": "dn_recipient",
    "project_name": "project_name",
    "route_id / site_id": "route_id_site_id",
    "SiteID": "route_id_site_id",
    "route_id_site_id": "route_id_site_id",
    "uid": "uid",
    "contract_type": "contract_type",
    "build_type": "build_type",
    "category_type": "category_type",
    "survey_id": "survey_id",
    "po_number": "po_number",
    "PO No": "po_number",
    "po_length": "po_length",
    "PO Length (Mtr)": "po_length",
    "parent_route": "parent_route",
    "Parent Route Name / HH": "parent_route",
    "ce_route_lmc_id": "ce_route_lmc_id",
    "route_lmc_section_id": "route_lmc_section_id",
    "route_lmc_subsection_id": "route_lmc_subsection_id",
    "application_number": "application_number",
    "Application Number": "application_number",
    "application_length_mtr": "application_length_mtr",
    "Application Length (Mtr)": "application_length_mtr",
    "application_date": "application_date",
    "Application Date": "application_date",
    "from_location": "from_location",
    "From": "from_location",
    "to_location": "to_location",
    "To": "to_location",
    "authority": "authority",
    "Authority": "authority",
    "ward": "ward",
    "Ward": "ward",
    "dn_number": "dn_number",
    "Demand Note Reference number": "dn_number",
    "dn_length_mtr": "dn_length_mtr",
    "Section Length": "dn_length_mtr",
    "dn_received_date": "dn_received_date",
    "DN Received Date": "dn_received_date",
    "trench_type": "trench_type",
    "ot_length": "ot_length",
    "surface": "surface",
    "Road Types": "surface",
    "ri_rate_go_rs": "ri_rate_go_rs",
    "Rate in Rs": "ri_rate_go_rs",
    "dn_ri_amount": "dn_ri_amount",
    "RI Amount": "dn_ri_amount",
    "multiplying_factor": "multiplying_factor",
    "Multiplication Factor": "multiplying_factor",
    "ground_rent": "ground_rent",
    "Ground Rent": "ground_rent",
    "administrative_charge": "administrative_charge",
    "Administrative Charge": "administrative_charge",
    "supervision_charges": "supervision_charges",
    "Supervision Charges": "supervision_charges",
    "chamber_fee": "chamber_fee",
    "Chamber Fee": "chamber_fee",
    "gst": "gst",
    "GST Amount": "gst",
    "ri_budget_amount_per_meter": "ri_budget_amount_per_meter",
    "projected_budget_ri_amount_dn": "projected_budget_ri_amount_dn",
    "actual_total_non_refundable": "actual_total_non_refundable",
    "non_refundable_amount_per_mtr": "non_refundable_amount_per_mtr",
    "proj_non_refundable_savings_per_mtr": "proj_non_refundable_savings_per_mtr",
    "proj_savings_per_dn": "proj_savings_per_dn",
    "deposit": "deposit",
    "SD Amount": "deposit",
    "total_dn_amount": "total_dn_amount",
    "Total DN Amount": "total_dn_amount",
    "new_revised_dn_number": "new_revised_dn_number",
    "new_revised_dn_against": "new_revised_dn_against",
    "internal_approval_start": "internal_approval_start",
    "internal_approval_end": "internal_approval_end",
    "ticket_raised_date": "ticket_raised_date",
    "dn_payment_date": "dn_payment_date",
    "tat_days": "tat_days",
    "civil_completion_date": "civil_completion_date",
    "hdd_length": "hdd_length",
    "no_of_pits": "no_of_pits",
    "pit_ri_rate": "pit_ri_rate",
    "surface_wise_length": "surface_wise_length",
    "surface_wise_ri_amount": "surface_wise_ri_amount",
    "surface_wise_multiplication_factor": "surface_wise_multiplication_factor",
    # Add more mappings as needed
}

# Add this near the top, after FIELD_MAP or DN_MASTER_COLUMNS
VALIDATE_PARSER_FIELDS = [
    'sr_no', 'route_type', 'lmc_route', 'ip1_co_built', 'dn_recipient', 'project_name', 'route_id_site_id', 'uid',
    'contract_type', 'build_type', 'category_type', 'survey_id', 'po_number', 'po_length', 'parent_route', 'ce_route_lmc_id',
    'route_lmc_section_id', 'route_lmc_subsection_id', 'application_number', 'application_length_mtr', 'application_date',
    'from_location', 'to_location', 'authority', 'ward', 'dn_number', 'dn_length_mtr', 'dn_received_date', 'trench_type',
    'ot_length', 'surface', 'ri_rate_go_rs', 'dn_ri_amount', 'multiplying_factor', 'ground_rent', 'administrative_charge',
    'supervision_charges', 'chamber_fee', 'gst', 'ri_budget_amount_per_meter', 'projected_budget_ri_amount_dn',
    'actual_total_non_refundable', 'non_refundable_amount_per_mtr', 'proj_non_refundable_savings_per_mtr', 'deposit',
    'total_dn_amount', 'new_revised_dn_number', 'new_revised_dn_against', 'internal_approval_start', 'internal_approval_end',
    'ticket_raised_date', 'dn_payment_date', 'tat_days', 'civil_completion_date', 'hdd_length', 'no_of_pits', 'pit_ri_rate',
    'proj_savings_per_dn',
    'surface_wise_length',
    'surface_wise_ri_amount',
    'surface_wise_multiplication_factor',
]

# Normalization function for field names
def normalize_field_name(name):
    # Lowercase, remove spaces, replace underscores and slashes with nothing
    return re.sub(r'[\s_\/]+', '', name).lower()

# Canonical allowed fields (normalized)
NORMALIZED_ALLOWED_FIELDS = {normalize_field_name(f): f for f in VALIDATE_PARSER_FIELDS}

# Use the new DB column name for route_id_site_id
ROUTE_ID_SITE_ID_CANONICAL = 'route_id_site_id'

# List of date fields in the DB
DATE_FIELDS = {
    'application_date',
    'dn_received_date',
    'internal_approval_start',
    'internal_approval_end',
    'ticket_raised_date',
    'dn_payment_date',
    'civil_completion_date'
}

def normalize_date(val):
    if val is None or val == "":
        return None
    if isinstance(val, str):
        # Try DD/MM/YYYY
        try:
            return datetime.strptime(val, '%d/%m/%Y').strftime('%Y-%m-%d')
        except Exception:
            pass
        # Try YYYY-MM-DD (already correct)
        try:
            return datetime.strptime(val, '%Y-%m-%d').strftime('%Y-%m-%d')
        except Exception:
            pass
    return None  # Return None if not a recognized date string

def fetch_ri_cost_per_meter_from_supabase(site_id):
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    response = supabase.table("master_budget").select("ri_budget_amount_per_meter").eq("SiteID", site_id).execute()
    if response.data and len(response.data) > 0:
        return response.data[0].get("ri_budget_amount_per_meter", "")
    return ""

@app.post("/process")
async def process_pdf(
    authority: str = Form(...),
    manual_fields: Optional[str] = Form(None),  # JSON string of manual fields (Non-Refundable)
    sd_manual_fields: Optional[str] = Form(None),  # JSON string of manual fields (SD Output)
    file: UploadFile = File(...)
):
    # Save uploaded file to a temp location (cross-platform, ensure unique name)
    temp_dir = tempfile.gettempdir()
    unique_filename = f"{uuid.uuid4()}_{file.filename}"
    temp_path = os.path.join(temp_dir, unique_filename)
    file_bytes = await file.read()
    with open(temp_path, "wb") as f:
        f.write(file_bytes)
    print(f"[DEBUG] Saved file: {temp_path}, size: {os.path.getsize(temp_path)} bytes, first 8 bytes: {file_bytes[:8]}")

    # Parse manual fields if provided
    manual_fields_dict = json.loads(manual_fields) if manual_fields else {}
    sd_manual_fields_dict = json.loads(sd_manual_fields) if sd_manual_fields else {}
    # Call extraction logic, get both file paths
    try:
        non_ref_xlsx_path, sd_xlsx_path = process_demand_note(temp_path, authority, manual_fields_dict, sd_manual_fields_dict, return_paths=True)
        # Create a zip with both files
        zip_path = os.path.join(temp_dir, f"{uuid.uuid4()}_outputs.zip")
        with zipfile.ZipFile(zip_path, 'w') as zipf:
            zipf.write(non_ref_xlsx_path, arcname=os.path.basename(non_ref_xlsx_path))
            zipf.write(sd_xlsx_path, arcname=os.path.basename(sd_xlsx_path))
        os.remove(temp_path)
        return FileResponse(zip_path, filename="outputs.zip", media_type="application/zip")
    except Exception as e:
        traceback.print_exc()
        os.remove(temp_path)
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.post("/process/non_refundable")
async def process_non_refundable(
    authority: str = Form(...),
    manual_fields: Optional[str] = Form(None),
    file: UploadFile = File(None),
    preview_id: Optional[str] = Form(None)
):
    import tempfile, os, uuid, json, traceback
    temp_dir = tempfile.gettempdir()
    manual_fields_dict = json.loads(manual_fields) if manual_fields else {}
    try:
        # If preview_id is provided and in cache, use cached data
        if preview_id and preview_id in preview_cache:
            cached = preview_cache[preview_id]
            row = cached['row']
            headers = cached['headers']
            demand_note_number = cached.get('demand_note_number', 'Output')
            # Update cached row with latest manual fields before writing Excel
            if manual_fields_dict:
                for field, value in manual_fields_dict.items():
                    if field in headers:
                        idx = headers.index(field)
                        row[idx] = value
            from extract_trench_data import append_row_to_excel
            temp_excel_path = os.path.join(temp_dir, f"{uuid.uuid4()}_Non_Refundable_Output.xlsx")
            # Determine blue_headers for authority
            if authority.upper() == "MCGM":
                blue_headers = [
                    "LM/BB/FTTH", "GO RATE", "Total Route (MTR)", "Not part of capping (License Fee/Rental Payment /Way Leave charges etc.)",
                    "REASON FOR DELAY (>2 DAYS)", "PO No.", "Route Name(As per CWIP)", "Section Name for ROW(As per CWIP)"
                ]
            elif authority.upper() == "MBMC":
                blue_headers = [
                    "LM/BB/FTTH", "GO RATE", "Total Route (MTR)", "Not part of capping (License Fee/Rental Payment /Way Leave charges etc.)",
                    "REASON FOR DELAY (>2 DAYS)", "PO No.", "Route Name(As per CWIP)", "Section Name for ROW(As per CWIP)"
                ]
            else:
                blue_headers = []
            append_row_to_excel(temp_excel_path, row, headers, manual_fields=manual_fields_dict, blue_headers=blue_headers)
            download_filename = f"{demand_note_number}_Non Refundable Output.xlsx"
            from fastapi.responses import FileResponse
            return FileResponse(
                temp_excel_path,
                filename=download_filename,
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            )
        # Fallback: legacy path (reparse)
        unique_filename = f"{uuid.uuid4()}_{file.filename}"
        temp_path = os.path.join(temp_dir, unique_filename)
        file_bytes = await file.read()
        with open(temp_path, "wb") as f:
            f.write(file_bytes)
        manual_fields_dict = json.loads(manual_fields) if manual_fields else {}
        excel_path, _, demand_note_number = process_demand_note(temp_path, authority, manual_fields_dict, None, return_paths=True)
        os.remove(temp_path)
        download_filename = f"{demand_note_number}_Non Refundable Output.xlsx"
        from fastapi.responses import FileResponse
        return FileResponse(
            excel_path,
            filename=download_filename,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.post("/process/sd")
async def process_sd(
    authority: str = Form(...),
    sd_manual_fields: Optional[str] = Form(None),
    file: UploadFile = File(None),
    preview_id: Optional[str] = Form(None)
):
    import tempfile, os, uuid, json, traceback
    temp_dir = tempfile.gettempdir()
    sd_manual_fields_dict = json.loads(sd_manual_fields) if sd_manual_fields else {}
    try:
        # If preview_id is provided and in cache, use cached data
        if preview_id and preview_id in preview_cache:
            cached = preview_cache[preview_id]
            row = cached['row']
            headers = cached['headers']
            demand_note_number = cached.get('demand_note_number', 'Output')
            # Update cached row with latest manual fields before writing Excel
            if sd_manual_fields_dict:
                for field, value in sd_manual_fields_dict.items():
                    if field in headers:
                        idx = headers.index(field)
                        row[idx] = value
            temp_excel_path = os.path.join(temp_dir, f"{uuid.uuid4()}_SD_Output.xlsx")
            # Determine blue_headers for authority
            if authority.upper() == "MCGM":
                blue_headers = [
                    "Execution Partner GBPA PO No.", "Partner PO circle", "Unique route id", "NFA no."
                ]
            elif authority.upper() == "MBMC":
                blue_headers = [
                    "Execution Partner GBPA PO No.", "Partner PO circle", "Unique route id", "NFA no."
                ]
            else:
                blue_headers = []
            append_row_to_excel(temp_excel_path, row, headers, manual_fields=sd_manual_fields_dict, blue_headers=blue_headers)
            download_filename = f"{demand_note_number}_SD Output.xlsx"
            from fastapi.responses import FileResponse
            return FileResponse(
                temp_excel_path,
                filename=download_filename,
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            )
        # Fallback: legacy path (reparse)
        unique_filename = f"{uuid.uuid4()}_{file.filename}"
        temp_path = os.path.join(temp_dir, unique_filename)
        file_bytes = await file.read()
        with open(temp_path, "wb") as f:
            f.write(file_bytes)
        _, sd_excel_path, demand_note_number = process_demand_note(temp_path, authority, None, sd_manual_fields_dict, return_paths=True)
        os.remove(temp_path)
        download_filename = f"{demand_note_number}_SD Output.xlsx"
        from fastapi.responses import FileResponse
        return FileResponse(
            sd_excel_path,
            filename=download_filename,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.post("/preview/non_refundable")
async def preview_non_refundable(
    authority: str = Form(...),
    manualFields: Optional[str] = Form(None),
    file: UploadFile = File(...)
):
    import tempfile, os, json, traceback, uuid
    manual_fields_dict = json.loads(manualFields) if manualFields else {}
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(await file.read())
            tmp_path = tmp.name
        try:
            row = None
            headers = None
            demand_note_number = None
            if authority.upper() == "MCGM":
                from parsers.mcgm import non_refundable_request_parser, HEADERS
                row = non_refundable_request_parser(tmp_path, manual_values=manual_fields_dict)
                headers = HEADERS
            elif authority.upper() == "MBMC":
                from parsers.mbmc import non_refundable_request_parser, HEADERS
                row = non_refundable_request_parser(tmp_path, manual_values=manual_fields_dict)
                headers = HEADERS
            else:
                return JSONResponse(status_code=400, content={"error": "Preview not implemented for this authority"})
            preview_data = {h: row[i] for i, h in enumerate(headers)}
            # Try to get demand note number for filename
            demand_note_number = preview_data.get("Demand Note Reference number", "Output")
            # Store in cache and return preview_id
            preview_id = str(uuid.uuid4())
            with preview_cache_lock:
                preview_cache[preview_id] = {
                    'row': row,
                    'headers': headers,
                    'demand_note_number': demand_note_number
                }
            print("[DEBUG] Returning preview data (non_refundable):", preview_data)
            return {"rows": [preview_data], "preview_id": preview_id}
        finally:
            os.remove(tmp_path)
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.post("/preview/sd")
async def preview_sd(
    authority: str = Form(...),
    manualFields: Optional[str] = Form(None),
    file: UploadFile = File(...)
):
    import tempfile, os, json, traceback, uuid
    manual_fields_dict = json.loads(manualFields) if manualFields else {}
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(await file.read())
            tmp_path = tmp.name
        try:
            alt_headers = None
            row_alt = None
            demand_note_number = None
            if authority.upper() == "MCGM":
                from parsers.mcgm import sd_parser
                alt_headers, row_alt = sd_parser(tmp_path, manual_values=manual_fields_dict)
            elif authority.upper() == "MBMC":
                from parsers.mbmc import sd_parser
                alt_headers, row_alt = sd_parser(tmp_path, manual_values=manual_fields_dict)
            else:
                return JSONResponse(status_code=400, content={"error": "Preview not implemented for this authority"})
            preview_data = {h: row_alt[i] for i, h in enumerate(alt_headers)}
            # Try to get demand note number for filename
            demand_note_number = preview_data.get("DN No", "Output")
            # Store in cache and return preview_id
            preview_id = str(uuid.uuid4())
            with preview_cache_lock:
                preview_cache[preview_id] = {
                    'row': row_alt,
                    'headers': alt_headers,
                    'demand_note_number': demand_note_number
                }
            print("[DEBUG] Returning preview data (sd):", preview_data)
            return {"rows": [preview_data], "preview_id": preview_id}
        finally:
            os.remove(tmp_path)
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.options("/process/non_refundable")
async def options_non_refundable():
    from fastapi.responses import Response
    print("[DEBUG] [CORS] Preflight OPTIONS /process/non_refundable")
    return Response(status_code=204)

@app.options("/process/sd")
async def options_sd():
    from fastapi.responses import Response
    print("[DEBUG] [CORS] Preflight OPTIONS /process/sd")
    return Response(status_code=204)

@app.get("/debug/headers")
def debug_headers():
    from fastapi import Request
    from fastapi.responses import JSONResponse
    def _headers_to_dict(headers):
        return {k: v for k, v in headers.items()}
    # This endpoint is for manual curl/browser testing
    return JSONResponse({
        "request_headers": dict(),  # Not available in GET, but placeholder
        "note": "Check browser network tab for response headers."
    })

@app.get("/")
def root():
    return {"status": "FastAPI backend running"}

@app.post("/api/parse-application")
async def parse_application_file(dn_application_file: UploadFile = File(...)):
    import tempfile, os
    temp_dir = tempfile.gettempdir()
    temp_path = os.path.join(temp_dir, f"dn_app_{dn_application_file.filename}")
    file_bytes = await dn_application_file.read()
    with open(temp_path, "wb") as f:
        f.write(file_bytes)
    try:
        result = application_parser(temp_path)
        os.remove(temp_path)
        return result
    except Exception as e:
        os.remove(temp_path)
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.post("/api/parse-po")
async def parse_po_db(site_id: str = Form(...)):
    from supabase import create_client
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    # Query po_master for the matching row
    response = supabase.table("po_master").select("*").eq("route_id_site_id", site_id).execute()
    if not response.data or len(response.data) == 0:
        return {"error": "No matching row found in po_master."}
    row = response.data[0]
    def clean_value(val):
        if val is None or str(val).strip() in ('', '-', 'nan', 'None'):
            return ""
        return str(val).strip()
    # Determine route_type and normalize
    route_type_val = clean_value(row.get('route_type', ""))
    route_type_val_norm = route_type_val.replace(" ", "").lower()
    # PO No logic
    if route_type_val_norm in ["metrolm", "lmc(standalone)", "routelm"]:
        po_no = clean_value(row.get('po_no_cobuild', ""))
        po_length = clean_value(row.get('po_length_cobuild', ""))
    elif route_type_val_norm == "route":
        po_no = clean_value(row.get('po_no_ip1', ""))
        po_length = clean_value(row.get('po_length_ip1', ""))
    else:
        po_no = ""
        po_length = ""
    # Category: always from 'route_type'
    category_val = route_type_val
    # UID: always from 'uid'
    uid_val = clean_value(row.get('uid', ""))
    # Parent Route Name / HH: always from 'parent_route'
    parent_route_val = clean_value(row.get('parent_route', ""))
    return {
        'PO No': po_no,
        'PO Length (Mtr)': po_length,
        'Category': category_val,
        'SiteID': clean_value(row.get('route_id_site_id', site_id)),
        'UID': uid_val,
        'Parent Route Name / HH': parent_route_val
    }

@app.post("/api/parse-dn")
async def parse_dn_file(authority: str = Form(...), dn_file: UploadFile = File(...)):
    import tempfile, os
    temp_dir = tempfile.gettempdir()
    temp_path = os.path.join(temp_dir, f"dn_{dn_file.filename}")
    file_bytes = await dn_file.read()
    with open(temp_path, "wb") as f:
        f.write(file_bytes)
    try:
        if authority.upper() == "MBMC":
            from parsers.mbmc import non_refundable_request_parser, HEADERS
            row = non_refundable_request_parser(temp_path)
            headers = HEADERS
            if isinstance(row, dict):
                if os.path.exists(temp_path):
                    os.remove(temp_path)
                return row
            result = {h: row[i] for i, h in enumerate(headers)}
            if os.path.exists(temp_path):
                os.remove(temp_path)
            return result
        elif authority.upper() == "MCGM":
            from parsers.mcgm import extract_all_fields_for_testing
            result = extract_all_fields_for_testing(temp_path)
            if os.path.exists(temp_path):
                os.remove(temp_path)
            return result
        else:
            if os.path.exists(temp_path):
                os.remove(temp_path)
            return JSONResponse(status_code=400, content={"error": f"Unsupported authority: {authority}"})
    except Exception as e:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.post("/api/validate-parsers")
async def validate_parsers(po_file: UploadFile, dn_file: UploadFile, app_file: UploadFile):
    # ...existing parsing logic...
    po_fields = {}  # Replace with actual extraction logic if needed
    dn_fields = {}  # Replace with actual extraction logic if needed
    app_fields = {}  # Replace with actual extraction logic if needed
    site_id = po_fields.get("SiteID")
    ri_cost_per_meter = fetch_ri_cost_per_meter_from_supabase(site_id)
    # ...other extractions...
    return {
        "po": po_fields,
        "dn": dn_fields,
        "application": app_fields,
        "ri_cost_per_meter_master_budget": ri_cost_per_meter,
    }

NUMERIC_FIELDS = {
    'po_length', 'application_length_mtr', 'dn_length_mtr', 'ot_length', 'dn_ri_amount',
    'multiplying_factor', 'ground_rent', 'administrative_charge', 'supervision_charges',
    'chamber_fee', 'gst', 'ri_budget_amount_per_meter', 'projected_budget_ri_amount_dn',
    'actual_total_non_refundable', 'non_refundable_amount_per_mtr', 'proj_non_refundable_savings_per_mtr',
    'deposit', 'total_dn_amount', 'pit_ri_rate', 'hdd_length',
    'proj_savings_per_dn',
}
INTEGER_FIELDS = {'tat_days', 'no_of_pits'}

def normalize_numeric(val):
    try:
        if val is None or val == '':
            return None
        return float(val)
    except Exception:
        return None

def normalize_integer(val):
    try:
        if val is None or val == '' or (isinstance(val, str) and val.strip() == ''):
            return None
        return int(float(val))
    except Exception:
        return None

@app.post("/api/send-to-master-dn")
async def send_to_master_dn(request: Request):
    print("[LOG] Received request to /api/send-to-master-dn")
    body = await request.json()
    print(f"[LOG] Raw body: {body}")
    data = body.get("data", [])
    print(f"[LOG] Parsed data array: {data}")
    # Build the insert dict using FIELD_MAP to map frontend fields to DB columns
    insert_dict = {}
    for item in data:
        field = item.get("field")
        value = item.get("value")
        db_field = FIELD_MAP.get(field, field)  # Map to DB column name
        if db_field not in VALIDATE_PARSER_FIELDS:
            continue
        if db_field in DATE_FIELDS:
            value = normalize_date(value)
        elif db_field in INTEGER_FIELDS:
            value = normalize_integer(value)
        elif db_field in NUMERIC_FIELDS:
            value = normalize_numeric(value)
        insert_dict[db_field] = value
    print(f"[LOG] Final insert_dict (before insert): {insert_dict}")
    # Universal sweep: for any field in insert_dict, if value is '', set to None
    for k, v in insert_dict.items():
        if v == "":
            insert_dict[k] = None
    # Remove sr_no if present, so DB can auto-generate or ignore it
    if 'sr_no' in insert_dict:
        del insert_dict['sr_no']
    for k, v in insert_dict.items():
        print(f"[LOG] Field: {k}, Value: {v}, Type: {type(v)}")
    dn_number = insert_dict.get("dn_number")
    print(f"[LOG] dn_number for duplicate check: {dn_number}")
    if not dn_number:
        print("[ERROR] Missing dn_number in payload.")
        return JSONResponse(status_code=400, content={"error": "Missing dn_number in payload."})
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    existing = supabase.table("dn_master").select("dn_number").eq("dn_number", dn_number).execute()
    print(f"[LOG] Existing check result: {existing.data}")
    if existing.data and len(existing.data) > 0:
        print(f"[ERROR] DN number {dn_number} already exists. Not inserting.")
        return JSONResponse(status_code=409, content={"error": "DN number already exists."})
    try:
        response = supabase.table("dn_master").insert(insert_dict).execute()
        print(f"[LOG] Supabase insert response: {response}")
    except Exception as e:
        print(f"[ERROR] Exception during insert: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})
    print(f"[LOG] Insert successful for dn_number {dn_number}")
    return {"success": True}

@app.get("/api/download-master-dn")
def download_master_dn():
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    # Fetch all rows
    response = supabase.table("dn_master").select("*").execute()
    data = response.data or []
    if not data:
        raise HTTPException(status_code=404, detail="No data found in master DN table.")
    # Convert to DataFrame
    df = pd.DataFrame(data)
    # Clean DataFrame: replace inf/-inf with NA, then fill all NA/NaN with ''
    df = df.replace([float('inf'), float('-inf')], pd.NA)
    df = df.fillna("")
    # Write to a temp Excel file
    with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
        excel_path = tmp.name
    # Use ExcelWriter for formatting
    with pd.ExcelWriter(excel_path, engine='xlsxwriter') as writer:
        # Write data without header, start at row 1
        df.to_excel(writer, index=False, sheet_name='MasterDN', header=False, startrow=1)
        workbook = writer.book
        worksheet = writer.sheets['MasterDN']

        # Header format: light blue, bold, centered, wrapped, border
        header_format = workbook.add_format({
            'bold': True,
            'bg_color': '#B7E1FC',
            'border': 1,
            'align': 'center',
            'valign': 'vcenter',
            'text_wrap': True
        })

        # Data cell format: centered, wrapped, border
        cell_format = workbook.add_format({
            'border': 1,
            'align': 'center',
            'valign': 'vcenter',
            'text_wrap': True
        })

        # Write headers with format
        worksheet.set_row(0, 38)
        for col_num, value in enumerate(df.columns.values):
            worksheet.write(0, col_num, value, header_format)

        # Write data cells with format and set row height
        for row in range(df.shape[0]):
            worksheet.set_row(row + 1, 28)
            for col in range(df.shape[1]):
                worksheet.write(row + 1, col, df.iloc[row, col], cell_format)

        # Set column widths for readability (no format here)
        for i, col in enumerate(df.columns):
            max_len = max(df[col].astype(str).map(len).max(), len(col))
            worksheet.set_column(i, i, min(max_len + 2, 40))

        worksheet.freeze_panes(1, 0)
    # Return as file download
    return FileResponse(excel_path, filename="Master_DN_Database.xlsx", media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

@app.post("/api/upload-dn-master")
async def upload_dn_master(file: UploadFile = File(...)):
    start_total = time.time()
    # 1. Read Excel file into DataFrame
    start_read = time.time()
    contents = await file.read()
    try:
        df = pd.read_excel(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read Excel file: {e}")
    print(f"[TIMING] Read Excel: {time.time() - start_read:.3f} seconds")

    # 2. Define your required DB columns (should match your dn_master schema)
    required_columns = [
        "route_type", "lmc_route", "ip1_co_built", "dn_recipient", "project_name", "route_id_site_id", "uid",
        "contract_type", "build_type", "category_type", "survey_id", "po_number", "po_length", "parent_route",
        "ce_route_lmc_id", "route_lmc_section_id", "route_lmc_subsection_id", "application_number",
        "application_length_mtr", "application_date", "from_location", "to_location", "authority", "ward",
        "dn_number", "dn_length_mtr", "dn_received_date", "trench_type", "ot_length", "surface", "surface_wise_ri_amount",
        "dn_ri_amount", "surface_wise_multiplication_factor", "ground_rent", "administrative_charge", "supervision_charges",
        "chamber_fee", "gst", "ri_budget_amount_per_meter", "projected_budget_ri_amount_dn",
        "actual_total_non_refundable", "non_refundable_amount_per_mtr", "proj_non_refundable_savings_per_mtr",
        "deposit", "total_dn_amount", "new_revised_dn_number", "new_revised_dn_against", "internal_approval_start",
        "internal_approval_end", "ticket_raised_date", "dn_payment_date", "tat_days", "civil_completion_date",
        "hdd_length", "no_of_pits", "pit_ri_rate"
    ]

    # 3. Validate columns
    missing = [col for col in required_columns if col not in df.columns]
    extra = [col for col in df.columns if col not in required_columns]
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing columns: {missing}")
    # Optionally, warn about extra columns

    # 4. Clean DataFrame (replace NaN/inf)
    start_clean = time.time()
    df = df.replace([float('inf'), float('-inf')], pd.NA)
    df = df.fillna("")
    NUMERIC_FIELDS = {
        'po_length', 'application_length_mtr', 'dn_length_mtr', 'ot_length', 'dn_ri_amount',
        'multiplying_factor', 'ground_rent', 'administrative_charge', 'supervision_charges',
        'chamber_fee', 'gst', 'ri_budget_amount_per_meter', 'projected_budget_ri_amount_dn',
        'actual_total_non_refundable', 'non_refundable_amount_per_mtr', 'proj_non_refundable_savings_per_mtr',
        'deposit', 'total_dn_amount', 'pit_ri_rate', 'hdd_length',
        'proj_savings_per_dn',
    }
    INTEGER_FIELDS = {'tat_days', 'no_of_pits'}
    DATE_FIELDS = {
        'application_date',
        'dn_received_date',
        'internal_approval_start',
        'internal_approval_end',
        'ticket_raised_date',
        'dn_payment_date',
        'civil_completion_date'
    }
    def normalize_numeric(val):
        try:
            if val is None or val == '':
                return None
            return float(val)
        except Exception:
            return None
    def normalize_integer(val):
        try:
            if val is None or val == '' or (isinstance(val, str) and val.strip() == ''):
                return None
            return int(float(val))
        except Exception:
            return None
    def normalize_date(val):
        if val is None or val == "":
            return None
        if isinstance(val, str):
            # Try DD/MM/YYYY
            try:
                return datetime.strptime(val, '%d/%m/%Y').strftime('%Y-%m-%d')
            except Exception:
                pass
            # Try YYYY-MM-DD (already correct)
            try:
                return datetime.strptime(val, '%Y-%m-%d').strftime('%Y-%m-%d')
            except Exception:
                pass
        return None  # Return None if not a recognized date string
    cleaned_rows = []
    for idx, row in df.iterrows():
        data = row.to_dict()
        # Normalize all fields before upsert
        for k, v in data.items():
            if k in NUMERIC_FIELDS:
                data[k] = normalize_numeric(v)
            elif k in INTEGER_FIELDS:
                data[k] = normalize_integer(v)
            elif k in DATE_FIELDS:
                data[k] = normalize_date(v)
            elif v == "":
                data[k] = None
        dn_number = data.get("dn_number")
        if not dn_number:
            continue
        cleaned_rows.append(data)
    print(f"[TIMING] Clean/Map Rows: {time.time() - start_clean:.3f} seconds")
    print("[DN MASTER CLEANED ROWS]", cleaned_rows[:3])

    # 5. Bulk upsert all rows (using dn_number as unique key)
    start_upsert = time.time()
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    errors = []
    try:
        response = supabase.table("dn_master").upsert(cleaned_rows, on_conflict="dn_number").execute()
        if hasattr(response, 'error') and response.error:
            errors.append(str(response.error))
    except Exception as e:
        errors.append(str(e))
    print(f"[TIMING] Upsert to Supabase: {time.time() - start_upsert:.3f} seconds")
    print(f"[TIMING] Total /api/upload-dn-master: {time.time() - start_total:.3f} seconds")
    if errors:
        return {"success": False, "errors": errors}
    return {"success": True, "message": "All rows upserted successfully."}

@app.post("/api/fullroute-upload-master")
async def fullroute_upload_master(file: UploadFile = File(...)):
    import time
    start_total = time.time()
    # 1. Read Excel file into DataFrame
    start_read = time.time()
    contents = await file.read()
    try:
        df = pd.read_excel(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read Excel file: {e}")
    print(f"[TIMING] Read Excel: {time.time() - start_read:.3f} seconds")

    # 2. Define the required schema columns (should match your budget_master schema)
    schema_columns = [
        "id",
        "siteid_routeid",
        "ce_length_mtr",
        "ri_cost_per_meter",
        "material_cost_per_meter",
        "build_cost_per_meter",
        "total_ri_amount",
        "material_cost",
        "execution_cost_including_hh",
        "total_cost_without_deposit",
        "route_type",
        "survey_id",
        "existing_new",
    ]
    numeric_columns = {
        "ce_length_mtr",
        "ri_cost_per_meter",
        "material_cost_per_meter",
        "build_cost_per_meter",
        "total_ri_amount",
        "material_cost",
        "execution_cost_including_hh",
        "total_cost_without_deposit",
    }

    # 3. Clean and map rows
    start_clean = time.time()
    cleaned_rows = []
    for idx, row in df.iterrows():
        cleaned = {}
        for col in schema_columns:
            value = row[col] if col in row else None
            if pd.isna(value) or value == "":
                value = None
            if col in numeric_columns and value is not None:
                try:
                    value = float(value)
                except Exception:
                    value = None
            cleaned[col] = value
        # Remove id if present (autoincrement)
        if "id" in cleaned:
            cleaned.pop("id")
        cleaned_rows.append(cleaned)
    print(f"[TIMING] Clean/Map Rows: {time.time() - start_clean:.3f} seconds")
    print("[BUDGET MASTER CLEANED ROWS]", cleaned_rows[:3])

    # 4. Bulk upsert all rows (using siteid_routeid as unique key)
    start_upsert = time.time()
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    errors = []
    try:
        response = supabase.table("budget_master").upsert(cleaned_rows, on_conflict="siteid_routeid").execute()
        if hasattr(response, 'error') and response.error:
            errors.append(str(response.error))
    except Exception as e:
        errors.append(str(e))
    print(f"[TIMING] Upsert to Supabase: {time.time() - start_upsert:.3f} seconds")
    print(f"[TIMING] Total /api/fullroute-upload-master: {time.time() - start_total:.3f} seconds")
    return {
        "success": len(errors) == 0,
        "errors": errors,
        "rows": len(cleaned_rows),
        "cleaned_rows": cleaned_rows[:5],
        "message": "All rows upserted successfully." if len(errors) == 0 else "Some rows failed."
    }

@app.get("/api/download-master-budget")
def download_master_budget():
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    # Fetch all rows
    response = supabase.table("budget_master").select("*").execute()
    data = response.data or []
    if not data:
        raise HTTPException(status_code=404, detail="No data found in budget_master table.")
    # Use the column order from the frontend
    supabase_headers = [
        "id",
        "siteid_routeid",
        "ce_length_mtr",
        "ri_cost_per_meter",
        "material_cost_per_meter",
        "build_cost_per_meter",
        "total_ri_amount",
        "material_cost",
        "execution_cost_including_hh",
        "total_cost_without_deposit",
        "route_type",
        "survey_id",
        "existing_new",
    ]
    # Convert to DataFrame and reorder columns
    df = pd.DataFrame(data)
    df = df.reindex(columns=supabase_headers)
    df = df.replace([float('inf'), float('-inf')], pd.NA)
    df = df.fillna("")
    # Write to a temp Excel file
    with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
        excel_path = tmp.name
    with pd.ExcelWriter(excel_path, engine='xlsxwriter') as writer:
        df.to_excel(writer, index=False, sheet_name='MasterBudget', header=False, startrow=1)
        workbook = writer.book
        worksheet = writer.sheets['MasterBudget']
        header_format = workbook.add_format({
            'bold': True,
            'bg_color': '#B7E1FC',
            'border': 1,
            'align': 'center',
            'valign': 'vcenter',
            'text_wrap': True
        })
        cell_format = workbook.add_format({
            'border': 1,
            'align': 'center',
            'valign': 'vcenter',
            'text_wrap': True
        })
        worksheet.set_row(0, 38)
        for col_num, value in enumerate(df.columns.values):
            worksheet.write(0, col_num, value, header_format)
        for row in range(df.shape[0]):
            worksheet.set_row(row + 1, 28)
            for col in range(df.shape[1]):
                worksheet.write(row + 1, col, df.iloc[row, col], cell_format)
        for i, col in enumerate(df.columns):
            max_len = max(df[col].astype(str).map(len).max(), len(col))
            worksheet.set_column(i, i, min(max_len + 2, 40))
        worksheet.freeze_panes(1, 0)
    return FileResponse(excel_path, filename="Master_Budget_Database.xlsx", media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

@app.post("/api/upload-po-master")
async def upload_po_master(file: UploadFile = File(...)):
    start_total = time.time()
    # 1. Read Excel file into DataFrame
    start_read = time.time()
    contents = await file.read()
    try:
        df = pd.read_excel(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read Excel file: {e}")
    print(f"[TIMING] Read Excel: {time.time() - start_read:.3f} seconds")

    # 2. Define the required schema columns
    schema_columns = [
        "route_id_site_id",
        "parent_route",
        "route_type",
        "uid",
        "po_no_cobuild",
        "po_length_cobuild",
        "po_no_ip1",
        "po_length_ip1",
    ]
    numeric_columns = {"po_length_cobuild", "po_length_ip1"}

    # 3. Normalize and map columns from Excel to schema
    start_clean = time.time()
    def normalize(col):
        return str(col).strip().lower().replace(" ", "_").replace("/", "_")
    excel_col_map = {normalize(col): col for col in df.columns}
    schema_col_map = {normalize(col): col for col in schema_columns}
    col_mapping = {}
    for norm_col, excel_col in excel_col_map.items():
        if norm_col in schema_col_map:
            col_mapping[schema_col_map[norm_col]] = excel_col
    if 'route_id_site_id' not in col_mapping:
        for col in df.columns:
            if normalize(col) in ['route_id_site_id', 'route_id__site_id']:
                col_mapping['route_id_site_id'] = col
                break
    cleaned_rows = []
    for idx, row in df.iterrows():
        cleaned = {}
        for schema_col in schema_columns:
            excel_col = col_mapping.get(schema_col)
            value = row[excel_col] if excel_col in row else None
            if pd.isna(value) or value == "":
                value = None
            if schema_col in numeric_columns and value is not None:
                try:
                    value = float(value)
                except Exception:
                    value = None
            cleaned[schema_col] = value
        cleaned_rows.append(cleaned)
    print(f"[TIMING] Clean/Map Rows: {time.time() - start_clean:.3f} seconds")
    print("[PO MASTER CLEANED ROWS]", cleaned_rows[:3])
    print("[PO MASTER COL MAPPING]", col_mapping)

    # 5. Upsert all rows in bulk (using route_id_site_id as unique key)
    start_upsert = time.time()
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    errors = []
    try:
        response = supabase.table("po_master").upsert(cleaned_rows, on_conflict="route_id_site_id").execute()
        if hasattr(response, 'error') and response.error:
            errors.append(str(response.error))
    except Exception as e:
        errors.append(str(e))
    print(f"[TIMING] Upsert to Supabase: {time.time() - start_upsert:.3f} seconds")
    print(f"[TIMING] Total /api/upload-po-master: {time.time() - start_total:.3f} seconds")
    return {
        "success": len(errors) == 0,
        "errors": errors,
        "rows": len(cleaned_rows),
        "cleaned_rows": cleaned_rows[:5],
        "col_mapping": col_mapping,
        "message": "All rows upserted successfully." if len(errors) == 0 else "Some rows failed."
    }

@app.get("/api/download-master-po")
def download_master_po():
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    # Fetch all rows
    response = supabase.table("po_master").select("*").execute()
    data = response.data or []
    if not data:
        raise HTTPException(status_code=404, detail="No data found in po_master table.")
    # Use the column order from the schema
    po_headers = [
        "route_id_site_id",
        "parent_route",
        "route_type",
        "uid",
        "po_no_cobuild",
        "po_length_cobuild",
        "po_no_ip1",
        "po_length_ip1",
    ]
    # Convert to DataFrame and reorder columns
    df = pd.DataFrame(data)
    df = df.reindex(columns=po_headers)
    df = df.replace([float('inf'), float('-inf')], pd.NA)
    df = df.fillna("")
    # Write to a temp Excel file
    with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
        excel_path = tmp.name
    with pd.ExcelWriter(excel_path, engine='xlsxwriter') as writer:
        df.to_excel(writer, index=False, sheet_name='MasterPO', header=False, startrow=1)
        workbook = writer.book
        worksheet = writer.sheets['MasterPO']
        header_format = workbook.add_format({
            'bold': True,
            'bg_color': '#B7E1FC',
            'border': 1,
            'align': 'center',
            'valign': 'vcenter',
            'text_wrap': True
        })
        cell_format = workbook.add_format({
            'border': 1,
            'align': 'center',
            'valign': 'vcenter',
            'text_wrap': True
        })
        worksheet.set_row(0, 38)
        for col_num, value in enumerate(df.columns.values):
            worksheet.write(0, col_num, value, header_format)
        for row in range(df.shape[0]):
            worksheet.set_row(row + 1, 28)
            for col in range(df.shape[1]):
                worksheet.write(row + 1, col, df.iloc[row, col], cell_format)
        for i, col in enumerate(df.columns):
            max_len = max(df[col].astype(str).map(len).max(), len(col))
            worksheet.set_column(i, i, min(max_len + 2, 40))
        worksheet.freeze_panes(1, 0)
    return FileResponse(excel_path, filename="Master_PO_Database.xlsx", media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
