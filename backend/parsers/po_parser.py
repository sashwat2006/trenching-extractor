import pandas as pd
import re

def po_parser(excel_path, site_id):
    """
    excel_path: path to the PO Excel file
    site_id: the site ID to look up
    Returns a dict with 'PO No' and 'PO Length (Mtr)' or 'PO Length', or empty strings if not found.
    """
    # Read the sheet without headers
    df_raw = pd.read_excel(excel_path, sheet_name="684 POP", header=None)
    # Find the header row index
    header_row_idx = None
    for i in range(min(10, len(df_raw))):
        if any(str(cell).strip().lower() == "siteid" for cell in df_raw.iloc[i]):
            header_row_idx = i
            break
    if header_row_idx is None:
        return {"error": "SiteID column not found in the first 10 rows."}
    # Read again with the correct header row
    df = pd.read_excel(excel_path, sheet_name="684 POP", header=header_row_idx)
    # Normalize column names
    def normalize(col):
        return re.sub(r'[^a-z0-9]', '', str(col).strip().lower())
    norm_cols = {normalize(col): col for col in df.columns}
    # Find the best match for PO Length columns
    po_length_col = None
    for key in ["polengthmtr", "polength"]:
        if key in norm_cols:
            po_length_col = norm_cols[key]
            break
    # Find the best match for Category columns
    category_col = None
    for key in ["categaory", "category"]:
        if key in norm_cols:
            category_col = norm_cols[key]
            break
    # Find UID column
    uid_col = None
    for key in ["uid"]:
        if key in norm_cols:
            uid_col = norm_cols[key]
            break
    # Find Parent Route Name / HH column
    parent_route_col = None
    for key in ["parentroutename/hh", "parent route name / hh"]:
        if normalize(key) in norm_cols:
            parent_route_col = norm_cols[normalize(key)]
            break
    match = df[df['SiteID'].astype(str).str.strip().str.lower() == str(site_id).strip().lower()]
    def clean_value(val):
        if pd.isna(val) or str(val).strip() in ('', '-', 'nan', 'None'):
            return ""
        return str(val).strip()
    if not match.empty:
        row = match.iloc[0]
        po_no = clean_value(row.get('PO No', ""))
        po_length = clean_value(row.get(po_length_col, "")) if po_length_col else ""
        # Category logic
        category_val = clean_value(row.get(category_col, "")) if category_col else ""
        if category_val.lower() == "fibmax":
            category_val = "LMC (Standalone)"
        uid_val = clean_value(row.get(uid_col, "")) if uid_col else ""
        parent_route_val = clean_value(row.get(parent_route_col, "")) if parent_route_col else ""
        return {
            'PO No': po_no,
            'PO Length (Mtr)': po_length,
            'Category': category_val,
            'SiteID': str(site_id),
            'UID': uid_val,
            'Parent Route Name / HH': parent_route_val
        }
    return {'PO No': "", 'PO Length (Mtr)': "", 'Category': "", 'SiteID': str(site_id), 'UID': "", 'Parent Route Name / HH': ""}

if __name__ == "__main__":
    import sys
    excel_path = sys.argv[1]
    site_id = sys.argv[2]
    print(po_parser(excel_path, site_id)) 