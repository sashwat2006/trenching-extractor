import { useState, useRef, useEffect } from "react";
import * as XLSX from 'xlsx';
import { supabase } from '@/utils/supabaseClient';
import { queryBySiteId } from "@/lib/lmcLogic";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, FileText, Shield, XCircle, Loader2, ChevronDown } from "lucide-react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

// Date columns in the DB schema
const DATE_COLUMNS = [
  "application_date",
  "dn_received_date",
  "internal_approval_start",
  "internal_approval_end",
  "ticket_raised_date",
  "dn_payment_date",
  "civil_completion_date"
];

export const MANUAL_FIELDS = [
  "new_revised_dn_number",
  "new_revised_dn_against",
  "internal_approval_start",
  "internal_approval_end",
  "ticket_raised_date",
  "dn_payment_date",
  "tat_days",
  "civil_completion_date"
];

// List of fields to display in Validate Parsers output, in order, as-is
export const VALIDATE_PARSER_FIELDS = [
  "sr_no",
  "route_type",
  "lmc_route",
  "ip1_co_built",
  "dn_recipient",
  "project_name",
  "route_id / site_id",
  "uid",
  "contract_type",
  "build_type",
  "category_type",
  "survey_id",
  "po_number",
  "po_length",
  "parent_route",
  "ce_route_lmc_id",
  "route_lmc_section_id",
  "route_lmc_subsection_id",
  "application_number",
  "application_length_mtr",
  "application_date",
  "from_location",
  "to_location",
  "authority",
  "ward",
  "dn_number",
  "dn_length_mtr",
  "dn_received_date",
  "trench_type",
  "ot_length",
  "hdd_length",
  "no_of_pits",
  "pit_ri_rate",
  "surface",
  "ri_rate_go_rs",
  "dn_ri_amount",
  "multiplying_factor",
  "ground_rent",
  "administrative_charge",
  "supervision_charges",
  "chamber_fee",
  "gst",
  "ri_budget_amount_per_meter",
  "projected_budget_ri_amount_dn",
  "actual_total_non_refundable",
  "non_refundable_amount_per_mtr",
  "non_refundable_savings_per_mtr",
  "deposit",
  "total_dn_amount",
  "new_revised_dn_number",
  "new_revised_dn_against",
  "internal_approval_start",
  "internal_approval_end",
  "ticket_raised_date",
  "dn_payment_date",
  "tat_days",
  "civil_completion_date"
];

export default function DnManagementSection() {
  // State for 3-file upload
  const [poFile, setPoFile] = useState<File | null>(null);
  const [dnAppFile, setDnAppFile] = useState<File | null>(null);
  const [dnFile, setDnFile] = useState<File | null>(null);
  const [appParseResult, setAppParseResult] = useState<any | null>(null);
  const [uploading, setUploading] = useState(false);

  // DN Master File Upload state
  const [dnMasterFile, setDnMasterFile] = useState<File | null>(null);
  const [dnUploading, setDnUploading] = useState(false);
  const [dnError, setDnError] = useState<string | null>(null);
  const [dnSuccess, setDnSuccess] = useState<string | null>(null);

  // PO File Upload state
  const [poSiteId, setPoSiteId] = useState("");
  const [poSiteIdOptions, setPoSiteIdOptions] = useState<string[]>([]);
  const [poSiteIdDropdownOpen, setPoSiteIdDropdownOpen] = useState(false);
  const [poHeaders, setPoHeaders] = useState<string[]>([]);
  const [poSiteIdColIdx, setPoSiteIdColIdx] = useState<number>(-1);
  const [poSiteIdDebugVals, setPoSiteIdDebugVals] = useState<any[]>([]);
  const [poParseResult, setPoParseResult] = useState<any | null>(null);
  const [poUploading, setPoUploading] = useState(false);

  // DN File Upload state
  const [dnAuthority, setDnAuthority] = useState("MBMC");
  const [dnParseResult, setDnParseResult] = useState<any | null>(null);
  const [dnParsing, setDnParsing] = useState(false);
  const [showAuthorityDropdown, setShowAuthorityDropdown] = useState(false);

  // New state for validation
  const [validationResults, setValidationResults] = useState<any[]>([]);
  const [validating, setValidating] = useState(false);
  const [riCostPerMeter, setRiCostPerMeter] = useState<string | null>(null);

  // New state for Site ID input focus
  const [siteIdInputFocused, setSiteIdInputFocused] = useState(false);

  // New state for validation error
  const [validateError, setValidateError] = useState<string | null>(null);

  // Fetch RI Cost per Meter from Supabase when poSiteId changes
  useEffect(() => {
    if (poSiteId) {
      queryBySiteId(poSiteId, ["RI Cost per Meter"]).then(res => {
        setRiCostPerMeter(res.data?.["RI Cost per Meter"] ?? null);
      });
    } else {
      setRiCostPerMeter(null);
    }
  }, [poSiteId]);

  // Log validationResults for mapping debug
  useEffect(() => {
    if (validationResults.length > 0) {
      console.log("[DEBUG] validationResults:", validationResults);
    }
  }, [validationResults]);

  // Handler for testing application parsing only
  const handleApplicationParse = async () => {
    if (!dnAppFile) {
      alert("Please select a DN Application file (PDF).");
      return;
    }
    setUploading(true);
    setAppParseResult(null);
    try {
      const formData = new FormData();
      formData.append("dn_application_file", dnAppFile);
      const res = await fetch("http://localhost:8000/api/parse-application", {
        method: "POST",
        body: formData,
      });
      const result = await res.json();
      setAppParseResult(result);
      console.log(result);
    } catch (err) {
      alert("Failed to parse application file.");
    } finally {
      setUploading(false);
    }
  };

  // Handler for DN Master File upload
  const handleDnMasterFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDnMasterFile(e.target.files?.[0] || null);
    setDnError(null);
    setDnSuccess(null);
  };

  const handleDnMasterUpload = async () => {
    if (!dnMasterFile) return;
    setDnUploading(true);
    setDnError(null);
    setDnSuccess(null);
    try {
      const data = await dnMasterFile.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as any[][];
      if (!rows.length) {
        setDnError("Excel file is empty or unreadable.");
        setDnUploading(false);
        return;
      }
      // Auto-detect header row by searching for 'Sr. No.' in the first 10 rows
      let headerRowIndex = -1;
      for (let i = 0; i < Math.min(10, rows.length); i++) {
        if (Array.isArray(rows[i]) && rows[i].some(cell => typeof cell === 'string' && cell.trim().toLowerCase() === 'sr. no.')) {
          headerRowIndex = i;
          break;
        }
      }
      if (headerRowIndex === -1) {
        setDnError("Could not find a valid header row (with 'Sr. No.') in the first 10 rows of the Excel file.");
        setDnUploading(false);
        return;
      }
      const headers = rows[headerRowIndex].map((h: any) => (h ? h.toString().trim() : ""));
      const dataRows = rows.slice(headerRowIndex + 1);
      // Convert to array of objects
      const json = dataRows.map(rowArr => {
        const obj: Record<string, any> = {};
        headers.forEach((header, idx) => {
          if (!header) return;
          obj[header] = rowArr[idx];
        });
        return obj;
      });
      // Clean and map headers to canonical columns (simplified for brevity)
      const cleanedJson = json.filter(row => Object.values(row).some(val => val !== null && val !== ""));
      // Upsert: insert new and update changed rows, do not delete anything
      const { data: upsertData, error: upsertError } = await supabase
        .from('dn_master_final')
        .upsert(cleanedJson, { onConflict: 'dn_number' })
        .select();
      if (upsertError) {
        setDnError(upsertError.message + (upsertError.details ? ' - ' + upsertError.details : ''));
        return;
      }
      setDnSuccess('Upload successful! New and updated rows processed.');
    } catch (err: any) {
      setDnError(err.message || 'Upload failed');
    } finally {
      setDnUploading(false);
    }
  };

  // When a PO file is selected, extract Site IDs
  const handlePoFileChange = async (file: File | null) => {
    console.log("handlePoFileChange called with file:", file);
    setPoFile(file);
    setPoSiteId("");
    setPoSiteIdOptions([]);
    setPoHeaders([]);
    setPoSiteIdColIdx(-1);
    setPoSiteIdDebugVals([]);
    if (!file) return;
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets["684 POP"];
      console.log("Sheet object:", sheet);
      if (!sheet) { console.log("Sheet '684 POP' not found"); return; }
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as any[][];
      console.log("First 5 rows of sheet:", rows.slice(0, 5));
      if (!rows.length) { console.log("Sheet is empty"); return; }
      // Find header row (scan first 10 rows)
      let headerRowIndex = -1;
      for (let i = 0; i < Math.min(10, rows.length); i++) {
        if (
          Array.isArray(rows[i]) &&
          rows[i].some(cell =>
            typeof cell === 'string' &&
            cell.toLowerCase().replace(/\s/g, '') === 'siteid'
          )
        ) {
          headerRowIndex = i;
          break;
        }
      }
      if (headerRowIndex === -1) return;
      const headers = rows[headerRowIndex].map((h: any) => (h ? h.toString().trim() : ""));
      setPoHeaders(headers);
      console.log("Headers:", headers);
      // Find exact match for 'siteid'
      const siteIdColIdx = headers.findIndex(h => h.toLowerCase().replace(/\s/g, '') === 'siteid');
      setPoSiteIdColIdx(siteIdColIdx);
      console.log("SiteID column index:", siteIdColIdx);
      if (siteIdColIdx === -1) return;
      const dataRows = rows.slice(headerRowIndex + 1);
      const siteIds = Array.from(new Set(dataRows.map(row => row[siteIdColIdx]).filter(Boolean))).map(String);
      setPoSiteIdOptions(siteIds);
      setPoSiteIdDebugVals(dataRows.slice(0, 5).map(row => row[siteIdColIdx] !== undefined && row[siteIdColIdx] !== null ? String(row[siteIdColIdx]) : ""));
      console.log("Extracted Site IDs:", siteIds);
    } catch (err) {
      // ignore
    }
  };

  const handlePoParse = async () => {
    if (!poFile || !poSiteId) {
      alert("Please select a PO file and enter a Site ID.");
      return;
    }
    setPoUploading(true);
    setPoParseResult(null);
    try {
      const formData = new FormData();
      formData.append("po_file", poFile);
      formData.append("site_id", poSiteId);
      const res = await fetch("http://localhost:8000/api/parse-po", {
        method: "POST",
        body: formData,
      });
      const result = await res.json();
      setPoParseResult(result);
      console.log(result);
    } catch (err) {
      alert("Failed to parse PO file.");
    } finally {
      setPoUploading(false);
    }
  };

  const handleDnParse = async () => {
    if (!dnFile || !dnAuthority) {
      alert("Please select a DN file and authority.");
      return;
    }
    setDnParsing(true);
    setDnParseResult(null);
    try {
      const formData = new FormData();
      formData.append("dn_file", dnFile);
      formData.append("authority", dnAuthority);
      const res = await fetch("http://localhost:8000/api/parse-dn", {
        method: "POST",
        body: formData,
      });
      const result = await res.json();
      setDnParseResult(result);
      console.log(result);
    } catch (err) {
      alert("Failed to parse DN file.");
    } finally {
      setDnParsing(false);
    }
  };

  const handleValidateParsers = async () => {
    setValidateError(null);
    if (!poFile || !poSiteId || !dnAppFile || !dnFile || !dnAuthority) {
      setValidateError("Please upload all files and fill all required fields.");
      return;
    }
    setValidating(true);
    setValidationResults([]);
    try {
      // Prepare requests
      const poForm = new FormData();
      poForm.append("po_file", poFile);
      poForm.append("site_id", poSiteId);
      const dnAppForm = new FormData();
      dnAppForm.append("dn_application_file", dnAppFile);
      const dnForm = new FormData();
      dnForm.append("dn_file", dnFile);
      dnForm.append("authority", dnAuthority);
      // Fire all requests in parallel
      const [poRes, dnAppRes, dnRes] = await Promise.all([
        fetch("http://localhost:8000/api/parse-po", { method: "POST", body: poForm }).then(r => r.json()),
        fetch("http://localhost:8000/api/parse-application", { method: "POST", body: dnAppForm }).then(r => r.json()),
        fetch("http://localhost:8000/api/parse-dn", { method: "POST", body: dnForm }).then(r => r.json()),
      ]);
      // Merge results into a single array with source
      const merged: any[] = [];
      Object.entries(poRes).forEach(([k, v]) => merged.push({ field: k, value: v, source: "PO" }));
      Object.entries(dnAppRes).forEach(([k, v]) => merged.push({ field: k, value: v, source: "DN Application" }));
      Object.entries(dnRes).forEach(([k, v]) => merged.push({ field: k, value: v, source: "DN" }));
      setValidationResults(merged);
    } catch (err) {
      setValidateError("Failed to validate parsers.");
    } finally {
      setValidating(false);
    }
  };

  // Calculate Projected Budget RI Amount (DN)
  const dnLength = validationResults.find(
    row => row.field === "Section Length" && row.source === "DN"
  )?.value;
  let projectedBudgetRIAmount: string | null = null;
  const riCost = parseFloat(riCostPerMeter ?? "");
  const length = parseFloat(dnLength ?? "");
  if (!isNaN(riCost) && !isNaN(length)) {
    projectedBudgetRIAmount = (riCost * length).toFixed(2);
  }

  // Calculate Actual Total Non-Refundable (DN)
  function getFieldValue(field: string) {
    return validationResults.find(row => row.field === field && row.source === "DN")?.value;
  }
  const groundRent = parseFloat(getFieldValue("Ground Rent") ?? "");
  const adminCharge = parseFloat(getFieldValue("Administrative Charge") ?? "");
  const riAmount = parseFloat(getFieldValue("RI Amount") ?? "");
  const supervisionCharges = parseFloat(getFieldValue("Supervision Charges") ?? "");
  let actualTotalNonRefundable: string | null = null;
  const sum = [groundRent, adminCharge, riAmount, supervisionCharges]
    .map(v => isNaN(v) ? 0 : v)
    .reduce((a, b) => a + b, 0);
  if (sum > 0) {
    actualTotalNonRefundable = sum.toFixed(2);
  }

  // Calculate Non-Refundable Amount per Meter (DN)
  let nonRefundableAmountPerMtr: string | null = null;
  const total = parseFloat(actualTotalNonRefundable ?? "");
  const lengthForPerMtr = parseFloat(dnLength ?? "");
  if (!isNaN(total) && !isNaN(lengthForPerMtr) && lengthForPerMtr > 0) {
    nonRefundableAmountPerMtr = (total / lengthForPerMtr).toFixed(2);
  }

  // Calculate Non-Refundable Savings per Meter
  let nonRefundableSavingsPerMtr: string | null = null;
  const budgetPerMtr = parseFloat(riCostPerMeter ?? "");
  const actualPerMtr = parseFloat(nonRefundableAmountPerMtr ?? "");
  if (!isNaN(budgetPerMtr) && !isNaN(actualPerMtr)) {
    nonRefundableSavingsPerMtr = (budgetPerMtr - actualPerMtr).toFixed(2);
  }

  // Calculate Total DN Amount (DN)
  const dnRiAmount = parseFloat(getFieldValue("RI Amount") ?? "");
  const groundRentTotal = parseFloat(getFieldValue("Ground Rent") ?? "");
  const adminChargeTotal = parseFloat(getFieldValue("Administrative Charge") ?? "");
  const supervisionChargesTotal = parseFloat(getFieldValue("Supervision Charges") ?? "");
  const chamberFee = parseFloat(getFieldValue("Chamber Fee") ?? "");
  const gst = parseFloat(getFieldValue("GST Amount") ?? getFieldValue("GST") ?? "");
  const sdAmount = parseFloat(getFieldValue("SD Amount") ?? "");
  let totalDnAmount: string | null = null;
  const dnSum = [dnRiAmount, groundRentTotal, adminChargeTotal, supervisionChargesTotal, chamberFee, gst, sdAmount]
    .map(v => isNaN(v) ? 0 : v)
    .reduce((a, b) => a + b, 0);
  if (dnSum > 0) {
    totalDnAmount = dnSum.toFixed(2);
  }

  // Helper to normalize field names for case-insensitive matching
  function normalizeFieldName(name: string) {
    return name.replace(/\s+/g, '').toLowerCase();
  }

  // Helper to get the value for each field
  function getValidateParserFieldValue(field: string): any {
    // Hardcoded values
    if (field === "lmc_route") return "LMC";
    if (field === "ip1_co_built") return "Co-Built";
    if (field === "dn_recipient") return "Airtel";
    if (field === "project_name") return "Mumbai Fiber Refresh Project";
    if (field === "contract_type") return "Co-Built";
    if (field === "build_type") return "New-build";
    if (field === "category_type") return "Non-Strategic";
    if (field === "trench_type") return "Open Trench";

    // Calculated values (already in state)
    if (field === "ri_budget_amount_per_meter") return riCostPerMeter;
    if (field === "projected_budget_ri_amount_dn") return projectedBudgetRIAmount;
    if (field === "actual_total_non_refundable") return actualTotalNonRefundable;
    if (field === "non_refundable_amount_per_mtr") return nonRefundableAmountPerMtr;
    if (field === "non_refundable_savings_per_mtr") return nonRefundableSavingsPerMtr;
    if (field === "total_dn_amount") return totalDnAmount;

    // Blank/manual fields
    if ([
      "sr_no", "survey_id", "ce_route_lmc_id", "route_lmc_section_id", "route_lmc_subsection_id",
      "hdd_length", "no_of_pits", "pit_ri_rate",
      "new_revised_dn_number", "new_revised_dn_against", "internal_approval_start", "internal_approval_end",
      "ticket_raised_date", "dn_payment_date", "tat_days", "civil_completion_date"
    ].includes(field)) return "";

    // Field mapping from validationResults (by field name or alias)
    const fieldMap: Record<string, string> = {
      "route_type": "Category",
      "route_id / site_id": "SiteID",
      "uid": "UID",
      "po_number": "PO No",
      "po_length": "PO Length (Mtr)",
      "parent_route": "Parent Route Name / HH",
      "application_number": "Application Number",
      "application_length_mtr": "Application Length (Mtr)",
      "application_date": "Application Date",
      "from_location": "From",
      "to_location": "To",
      "authority": "Authority",
      "ward": "Ward",
      "dn_number": "Demand Note Reference number",
      "dn_length_mtr": "Section Length",
      "dn_received_date": "Demand Note Date",
      "ot_length": "Section Length",
      "surface": "Road Types",
      "ri_rate_go_rs": "Rate in Rs",
      "dn_ri_amount": "RI Amount",
      "multiplying_factor": "Multiplication Factor",
      "ground_rent": "Ground Rent",
      "administrative_charge": "Administrative Charge",
      "supervision_charges": "Supervision Charges",
      "chamber_fee": "Chamber Fee",
      "gst": "GST Amount",
      "deposit": "SD Amount"
    };
    const lookup = fieldMap[field] || field;
    // Robust: match ignoring whitespace and case
    const found = validationResults.find(row => normalizeFieldName(row.field) === normalizeFieldName(lookup));
    return found ? found.value : "";
  }

  // Helper to get the source for each field
  function getValidateParserFieldSource(field: string): string {
    // Hardcoded
    if (["lmc_route", "ip1_co_built", "dn_recipient", "project_name", "contract_type", "build_type", "category_type", "trench_type"].includes(field)) return "Hardcoded";
    // Calculated
    if (["ri_budget_amount_per_meter", "projected_budget_ri_amount_dn", "actual_total_non_refundable", "non_refundable_amount_per_mtr", "non_refundable_savings_per_mtr", "total_dn_amount"].includes(field)) return "Calculated";
    // Blank/manual
    if (["sr_no", "survey_id", "ce_route_lmc_id", "route_lmc_section_id", "route_lmc_subsection_id", "hdd_length", "no_of_pits", "pit_ri_rate", "new_revised_dn_number", "new_revised_dn_against", "internal_approval_start", "internal_approval_end", "ticket_raised_date", "dn_payment_date", "tat_days", "civil_completion_date"].includes(field)) return "Blank";
    // Map to source by field
    const fieldMap: Record<string, string> = {
      "route_type": "PO",
      "route_id / site_id": "PO",
      "uid": "PO",
      "po_number": "PO",
      "po_length": "PO",
      "parent_route": "PO",
      "application_number": "DN Application",
      "application_length_mtr": "DN Application",
      "application_date": "DN Application",
      "from_location": "DN Application",
      "to_location": "DN Application",
      "authority": "DN Application",
      "ward": "DN Application",
      "dn_number": "DN",
      "dn_length_mtr": "DN",
      "dn_received_date": "DN",
      "ot_length": "DN",
      "surface": "DN",
      "ri_rate_go_rs": "DN",
      "dn_ri_amount": "DN",
      "multiplying_factor": "DN",
      "ground_rent": "DN",
      "administrative_charge": "DN",
      "supervision_charges": "DN",
      "chamber_fee": "DN",
      "gst": "DN",
      "deposit": "DN"
    };
    return fieldMap[field] || "";
  }

  // Before rendering the Site ID dropdown:
  console.log("Rendering Site ID dropdown with options:", poSiteIdOptions);

  return (
    <>
      {/* Add DN Entry from 3 Files */}
      <Card className="bg-transparent shadow-none border-none p-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-2xl font-semibold text-white flex items-center gap-2">
            <Upload className="h-7 w-7 text-blue-400" /> Add DN Entry from Files
          </CardTitle>
          <CardDescription className="text-slate-400 mt-1 text-base font-normal">
            Upload a PO file, DN Application, and DN file to create a new DN entry in the master database
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
            {/* PO File Card */}
            <div className="bg-[#232a3a]/60 rounded-3xl shadow-lg p-8 flex flex-col gap-6 border border-slate-700 min-h-[200px]">
              <div className="flex flex-col gap-1 mb-2">
                <div className="font-semibold text-lg md:text-xl text-white">PO File</div>
                {poFile && (
                  <div className="text-xs text-slate-400 truncate max-w-full">{poFile.name}</div>
                )}
              </div>
              <div className="flex-1" />
              <div className="relative">
                <Label className="text-slate-400 text-xs mb-1">Site ID</Label>
                <Input
                  className="rounded-lg bg-[#232a3a] border-none focus:ring-2 focus:ring-green-500 text-white"
                  value={poSiteId}
                  onChange={e => setPoSiteId(e.target.value)}
                  onFocus={() => setSiteIdInputFocused(true)}
                  onBlur={() => setTimeout(() => setSiteIdInputFocused(false), 150)}
                  autoComplete="off"
                />
                {siteIdInputFocused && poSiteIdOptions.length > 0 && (
                  <div className="absolute z-20 left-0 right-0 mt-1 bg-[#232a3a] border border-slate-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {poSiteIdOptions.filter(id => id.toLowerCase().includes(poSiteId.toLowerCase())).length === 0 ? (
                      <div className="px-4 py-2 text-slate-400 text-sm">No matching Site IDs</div>
                    ) : (
                      poSiteIdOptions
                        .filter(id => id.toLowerCase().includes(poSiteId.toLowerCase()))
                        .map(id => (
                          <div
                            key={id}
                            className={`px-4 py-2 cursor-pointer hover:bg-green-700/30 text-white text-sm ${poSiteId === id ? "bg-green-700/40 font-semibold" : ""}`}
                            onMouseDown={() => { setPoSiteId(id); setSiteIdInputFocused(false); }}
                          >
                            {id}
                          </div>
                        ))
                    )}
                  </div>
                )}
              </div>
              <Button
                className="w-full bg-gradient-to-r from-green-500 to-green-700 text-white font-semibold rounded-lg shadow hover:from-green-600 hover:to-green-800 transition mt-4"
                onClick={() => document.getElementById("po-file-input")?.click()}
              >
                {poFile ? "Change File" : "Upload File"}
              </Button>
              <input
                id="po-file-input"
                type="file"
                className="hidden"
                onChange={e => handlePoFileChange(e.target.files?.[0] || null)}
              />
            </div>
            {/* DN Application Card */}
            <div className="bg-[#232a3a]/60 rounded-3xl shadow-lg p-8 flex flex-col gap-6 border border-slate-700 min-h-[200px]">
              <div className="flex flex-col gap-1 mb-2">
                <div className="font-semibold text-lg md:text-xl text-white">DN Application (PDF)</div>
                {dnAppFile && (
                  <div className="text-xs text-slate-400 truncate max-w-full">{dnAppFile.name}</div>
                )}
              </div>
              <div className="flex-1" />
              <Button
                className="w-full bg-gradient-to-r from-green-500 to-green-700 text-white font-semibold rounded-lg shadow hover:from-green-600 hover:to-green-800 transition mt-4"
                onClick={() => document.getElementById("dn-app-file-input")?.click()}
              >
                {dnAppFile ? "Change File" : "Upload File"}
              </Button>
              <input id="dn-app-file-input" type="file" className="hidden" accept=".pdf" onChange={e => setDnAppFile(e.target.files?.[0] || null)} />
            </div>
            {/* DN File Card */}
            <div className="bg-[#232a3a]/60 rounded-3xl shadow-lg p-8 flex flex-col gap-6 border border-slate-700 min-h-[200px]">
              <div className="flex flex-col gap-1 mb-2">
                <div className="font-semibold text-lg md:text-xl text-white">DN File (PDF)</div>
                {dnFile && (
                  <div className="text-xs text-slate-400 truncate max-w-full">{dnFile.name}</div>
                )}
              </div>
              <div className="flex-1" />
              <div className="relative">
                <Label className="text-slate-400 text-xs mb-1">Authority</Label>
                <Select value={dnAuthority} onValueChange={setDnAuthority}>
                  <SelectTrigger className="w-full rounded-lg bg-[#232a3a] border-none focus:ring-2 focus:ring-green-500 text-white py-2 px-3">
                    <SelectValue placeholder="Select Authority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MCGM">MCGM</SelectItem>
                    <SelectItem value="MBMC">MBMC</SelectItem>
                    <SelectItem value="KDMC">KDMC</SelectItem>
                    <SelectItem value="NMMC">NMMC</SelectItem>
                    <SelectItem value="MIDC Type 1">MIDC Type 1</SelectItem>
                    <SelectItem value="MIDC Type 2">MIDC Type 2</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full bg-gradient-to-r from-green-500 to-green-700 text-white font-semibold rounded-lg shadow hover:from-green-600 hover:to-green-800 transition mt-4"
                onClick={() => document.getElementById("dn-file-input")?.click()}
              >
                {dnFile ? "Change File" : "Upload File"}
              </Button>
              <input id="dn-file-input" type="file" className="hidden" accept=".pdf" onChange={e => setDnFile(e.target.files?.[0] || null)} />
            </div>
          </div>
          <div className="flex flex-col items-center w-full mt-8 gap-2">
            <Button
              className="w-full max-w-md bg-gradient-to-r from-green-500 to-green-700 text-white font-semibold rounded-lg px-6 py-3 flex items-center justify-center gap-2 shadow-lg hover:from-green-600 hover:to-green-800 transition"
              onClick={handleValidateParsers}
              disabled={validating}
            >
              {validating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Shield className="w-5 h-5 text-green-200" />}
              {validating ? "Validating..." : "Validate Parsers"}
            </Button>
            {validateError && <div className="text-red-400 text-sm font-medium mt-2">{validateError}</div>}
          </div>
          {validationResults.length > 0 && (
            (() => { console.log("Rendering validation table, validationResults:", validationResults); return null; })(),
            <div className="max-h-[60vh] overflow-x-auto rounded-2xl shadow-2xl border border-slate-700 w-full mt-8">
              <Table className="text-xs border-collapse w-full">
                <TableHeader>
                  <TableRow className="bg-[#232a3a] sticky top-0 z-10">
                    <TableHead className="text-gray-200 font-semibold py-2 px-4 border-b border-slate-700 border-t border-x-0 rounded-tl-2xl w-1/4 min-w-[160px]">Field</TableHead>
                    <TableHead className="text-gray-200 font-semibold py-2 px-4 border-b border-slate-700 border-t border-x-0 w-2/5 min-w-[200px]">Value</TableHead>
                    <TableHead className="text-gray-200 font-semibold py-2 px-4 border-b border-slate-700 border-t border-x-0 rounded-tr-2xl w-1/4 min-w-[120px]">Source</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TooltipProvider>
                    {VALIDATE_PARSER_FIELDS.map((field, idx) => {
                      const value = getValidateParserFieldValue(field);
                      const source = getValidateParserFieldSource(field);
                      const isEven = idx % 2 === 0;
                      return (
                        <TableRow
                          key={field}
                          className={
                            `${isEven ? "bg-[#232a3a]/40" : "bg-[#1a1f2b]/30"} hover:bg-[#2d3650]/40 transition-colors border-x border-slate-700` +
                            (idx === 0 ? " rounded-tl-2xl" : "") +
                            (idx === VALIDATE_PARSER_FIELDS.length - 1 ? " rounded-bl-2xl" : "")
                          }
                        >
                          <TableCell className="text-white font-medium py-2 px-4 border-x border-slate-700 align-middle whitespace-nowrap w-1/4 min-w-[160px] text-sm">
                            {field}
                          </TableCell>
                          <TableCell className="text-gray-200 py-2 px-4 truncate border-x border-slate-700 align-middle w-2/5 min-w-[200px] text-sm">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="block truncate cursor-help w-full font-normal">
                                  {value && value.toString().length > 32 ? value.toString().slice(0, 32) + "..." : value}
                                </span>
                              </TooltipTrigger>
                              {value && value.toString().length > 32 && (
                                <TooltipContent className="max-w-xs break-words">
                                  {value}
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </TableCell>
                          <TableCell className="w-1/4 min-w-[120px] py-2 px-4 border-x border-slate-700 align-middle">
                            <Badge
                              className={
                                source === "PO"
                                  ? "bg-blue-700/10 text-blue-200 border-blue-400/10"
                                  : source === "DN"
                                  ? "bg-purple-700/10 text-purple-200 border-purple-400/10"
                                  : source === "DN Application"
                                  ? "bg-orange-700/10 text-orange-200 border-orange-400/10"
                                  : source === "Calculated"
                                  ? "bg-green-700/10 text-green-200 border-green-400/10"
                                  : source === "Blank"
                                  ? "bg-gray-700/10 text-gray-300 border-gray-400/10"
                                  : "bg-slate-700/10 text-slate-100 border-slate-400/10"
                              }
                            >
                              {source}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TooltipProvider>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* DN Master File Upload Section */}
      <Card className="bg-[#232a3a] border border-slate-700 shadow-lg">
        <CardHeader className="border-b border-slate-600">
          <CardTitle className="text-white flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-green-400" />
            DN Master File
          </CardTitle>
          <CardDescription className="text-slate-400">
            Upload your DN Master Excel file to populate the DN master database
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <input type="file" accept=".xlsx,.xls" onChange={handleDnMasterFileChange} className="mb-4" />
          <Button onClick={handleDnMasterUpload} disabled={dnUploading || !dnMasterFile} className="w-full bg-gradient-to-r from-green-400 to-green-600 hover:from-green-500 hover:to-green-700 text-white font-semibold" size="lg">
            {dnUploading ? 'Uploading...' : 'Upload DN Master File'}
          </Button>
          {dnError && <Alert className="bg-red-950/50 border-red-800 text-red-200 mt-4"><AlertCircle className="h-4 w-4" /><AlertDescription>{dnError}</AlertDescription></Alert>}
          {dnSuccess && <Alert className="bg-green-950/50 border-green-800 text-green-200 mt-4"><CheckCircle className="h-4 w-4" /><AlertDescription>{dnSuccess}</AlertDescription></Alert>}
        </CardContent>
      </Card>
    </>
  );
} 