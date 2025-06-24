from fastapi import FastAPI, File, UploadFile, Form
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
from extract_trench_data import process_demand_note
import threading

app = FastAPI()

# Allow CORS for local frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For dev only; restrict in prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "content-disposition"],  # <-- Expose for frontend JS
)

# Global in-memory cache for parsed preview data
preview_cache = {}
preview_cache_lock = threading.Lock()
CACHE_EXPIRY_SECONDS = 3600  # 1 hour (optional, not enforced in this snippet)

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
        from extract_trench_data import process_demand_note
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
            from extract_trench_data import append_row_to_excel
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
        from extract_trench_data import process_demand_note
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
