from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import os
from parsers import nmmc
from parsers import mcgm_application_parser

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/nmmc-translate")
async def nmmc_translate(file: UploadFile = File(...)):
    # Save uploaded file to a temp location
    temp_path = f"/tmp/{file.filename}"
    with open(temp_path, "wb") as f:
        f.write(await file.read())
    # Call the translation function
    translated_text = nmmc.translate_pdf_to_english(temp_path)
    # Clean up temp file
    os.remove(temp_path)
    return {"translated_text": translated_text}

@app.post("/api/debug-mcgm-application")
async def debug_mcgm_application(file: UploadFile = File(...)):
    import tempfile
    temp = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
    temp.write(await file.read())
    temp.close()
    # Use the parser to extract text
    doc = mcgm_application_parser.fitz.open(temp.name)
    text = "\n".join(page.get_text() for page in doc)
    doc.close()
    os.remove(temp.name)
    return {"text": text} 