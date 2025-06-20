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
    file: UploadFile = File(...)
):
    import tempfile, os, uuid, json, traceback
    temp_dir = tempfile.gettempdir()
    unique_filename = f"{uuid.uuid4()}_{file.filename}"
    temp_path = os.path.join(temp_dir, unique_filename)
    print(f"[DEBUG] [non_refundable] Incoming file: {file.filename}, saved as: {temp_path}")
    file_bytes = await file.read()
    print(f"[DEBUG] [non_refundable] File size: {len(file_bytes)} bytes, first 8 bytes: {file_bytes[:8]}")
    with open(temp_path, "wb") as f:
        f.write(file_bytes)
    manual_fields_dict = json.loads(manual_fields) if manual_fields else {}
    print(f"[DEBUG] [non_refundable] Manual fields: {manual_fields_dict}")
    try:
        excel_path, _, demand_note_number = process_demand_note(temp_path, authority, manual_fields_dict, None, return_paths=True)
        print(f"[DEBUG] [non_refundable] Excel path: {excel_path}, Demand Note Number: {demand_note_number}")
        os.remove(temp_path)
        download_filename = f"{demand_note_number}_Non Refundable Output.xlsx"
        print(f"[DEBUG] [non_refundable] Download filename: {download_filename}")
        from fastapi.responses import FileResponse
        response = FileResponse(
            excel_path,
            filename=download_filename,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        print(f"[DEBUG] [non_refundable] FileResponse headers: {response.headers}")
        return response
    except Exception as e:
        traceback.print_exc()
        os.remove(temp_path)
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.post("/process/sd")
async def process_sd(
    authority: str = Form(...),
    sd_manual_fields: Optional[str] = Form(None),
    file: UploadFile = File(...)
):
    import tempfile, os, uuid, json, traceback
    temp_dir = tempfile.gettempdir()
    unique_filename = f"{uuid.uuid4()}_{file.filename}"
    temp_path = os.path.join(temp_dir, unique_filename)
    print(f"[DEBUG] [sd] Incoming file: {file.filename}, saved as: {temp_path}")
    file_bytes = await file.read()
    print(f"[DEBUG] [sd] File size: {len(file_bytes)} bytes, first 8 bytes: {file_bytes[:8]}")
    with open(temp_path, "wb") as f:
        f.write(file_bytes)
    sd_manual_fields_dict = json.loads(sd_manual_fields) if sd_manual_fields else {}
    print(f"[DEBUG] [sd] Manual fields: {sd_manual_fields_dict}")
    try:
        _, sd_excel_path, demand_note_number = process_demand_note(temp_path, authority, None, sd_manual_fields_dict, return_paths=True)
        print(f"[DEBUG] [sd] Excel path: {sd_excel_path}, Demand Note Number: {demand_note_number}")
        os.remove(temp_path)
        download_filename = f"{demand_note_number}_SD Output.xlsx"
        print(f"[DEBUG] [sd] Download filename: {download_filename}")
        from fastapi.responses import FileResponse
        response = FileResponse(
            sd_excel_path,
            filename=download_filename,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        print(f"[DEBUG] [sd] FileResponse headers: {response.headers}")
        return response
    except Exception as e:
        traceback.print_exc()
        os.remove(temp_path)
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.post("/preview/non_refundable")
async def preview_non_refundable(
    authority: str = Form(...),
    manualFields: Optional[str] = Form(None),
    file: UploadFile = File(...)
):
    import tempfile, os, uuid, json, traceback
    temp_dir = tempfile.gettempdir()
    unique_filename = f"{uuid.uuid4()}_{file.filename}"
    temp_path = os.path.join(temp_dir, unique_filename)
    file_bytes = await file.read()
    with open(temp_path, "wb") as f:
        f.write(file_bytes)
    manual_fields_dict = json.loads(manualFields) if manualFields else {}
    try:
        # Get the parsed row (do not write Excel, just parse)
        # For MCGM, pass manual fields
        row = None
        headers = None
        if authority.upper() == "MCGM":
            from parsers.mcgm import non_refundable_request_parser, HEADERS
            row = non_refundable_request_parser(temp_path, manual_values=manual_fields_dict)
            headers = HEADERS
        else:
            # TODO: Add other authorities as implemented
            return JSONResponse(status_code=400, content={"error": "Preview not implemented for this authority"})
        os.remove(temp_path)
        # Return as list of dicts for table preview
        return {"rows": [{h: row[i] for i, h in enumerate(headers)}]}
    except Exception as e:
        traceback.print_exc()
        os.remove(temp_path)
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.post("/preview/sd")
async def preview_sd(
    authority: str = Form(...),
    manualFields: Optional[str] = Form(None),
    file: UploadFile = File(...)
):
    import tempfile, os, uuid, json, traceback
    temp_dir = tempfile.gettempdir()
    unique_filename = f"{uuid.uuid4()}_{file.filename}"
    temp_path = os.path.join(temp_dir, unique_filename)
    file_bytes = await file.read()
    with open(temp_path, "wb") as f:
        f.write(file_bytes)
    manual_fields_dict = json.loads(manualFields) if manualFields else {}
    try:
        # For MCGM, SD parser
        if authority.upper() == "MCGM":
            from parsers.mcgm import sd_parser
            alt_headers, row_alt = sd_parser(temp_path, manual_values=manual_fields_dict)
            os.remove(temp_path)
            return {"rows": [{h: row_alt[i] for i, h in enumerate(alt_headers)}]}
        else:
            return JSONResponse(status_code=400, content={"error": "Preview not implemented for this authority"})
    except Exception as e:
        traceback.print_exc()
        os.remove(temp_path)
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
