import { useState, useRef, useEffect } from "react";
import * as XLSX from 'xlsx';
import { supabase } from '@/utils/supabaseClient';
import { queryBySiteId } from "@/lib/lmcLogic";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, FileText, Shield, XCircle, Loader2, ChevronDown, Search } from "lucide-react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

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
  "surface_wise_length",
  "surface_wise_ri_amount",
  "dn_ri_amount",
  "surface_wise_multiplication_factor",
  "ground_rent",
  "administrative_charge",
  "supervision_charges",
  "chamber_fee",
  "gst",
  "ri_budget_amount_per_meter",
  "projected_budget_ri_amount_dn",
  "actual_total_non_refundable",
  "non_refundable_amount_per_mtr",
  "proj_non_refundable_savings_per_mtr",
  "proj_savings_per_dn",
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

  // New state for sending to Master DN
  const [sendingToMasterDN, setSendingToMasterDN] = useState(false);
  const [sendToMasterDNSuccess, setSendToMasterDNSuccess] = useState<string | null>(null);
  const [sendToMasterDNError, setSendToMasterDNError] = useState<string | null>(null);

  const { toast } = useToast();

  // Fetch RI Cost per Meter from Supabase when poSiteId changes
  useEffect(() => {
    if (poSiteId) {
      console.log("[DEBUG] Fetching budget for poSiteId:", poSiteId);
      queryBySiteId(poSiteId, ["ri_cost_per_meter"]).then(res => {
        console.log("[DEBUG] Budget DB result for poSiteId", poSiteId, ":", res);
        setRiCostPerMeter(res.data?.ri_cost_per_meter ?? null);
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

  // 1. On mount, fetch all unique route_id_site_id values from po_master
  useEffect(() => {
    async function fetchSiteIdsFromDB() {
      const { data, error } = await supabase
        .from("po_master")
        .select("route_id_site_id")
        .neq("route_id_site_id", null);
      if (!error && data) {
        const unique = Array.from(new Set(data.map((row: any) => row.route_id_site_id).filter(Boolean)));
        setPoSiteIdOptions(unique);
      }
    }
    fetchSiteIdsFromDB();
  }, []);

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
      console.time('dnMasterUpload');
      const formData = new FormData();
      formData.append('file', dnMasterFile);
      const response = await fetch('http://localhost:8000/api/upload-dn-master', {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();
      console.timeEnd('dnMasterUpload');
      if (!response.ok || result.success === false) {
        let errorMsg = result.errors ? result.errors.join('\n') : (result.detail || result.message || 'Upload failed');
        setDnError(errorMsg);
        return;
      }
      setDnSuccess(result.message || 'Upload successful! New and updated rows processed.');
    } catch (err: any) {
      setDnError(err.message || 'Upload failed');
    } finally {
      setDnUploading(false);
      setDnMasterFile(null);
      const input = document.getElementById('dn-master-file-input') as HTMLInputElement | null;
      if (input) input.value = '';
    }
  };

  // When a PO file is selected, extract Site IDs
  const handlePoFileChange = async (file: File | null) => {
    setPoSiteId("");
    setPoSiteIdOptions([]);
    if (!file) return;
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const normalizeCol = (str: string) => String(str).toLowerCase().replace(/\s|\_|\//g, '');
      let found = false;
      for (const sheetName of workbook.SheetNames) {
        const ws = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(ws, { header: 1 });
        if (!json.length) continue;
        const headerRow = (json[0] as any[]).map((h: any) => normalizeCol(h));
        const idx = headerRow.findIndex((h: string) => h === 'routeidsiteid');
        if (idx !== -1) {
          const values = json.slice(1).map((row: any) => row[idx]).filter(Boolean);
          const unique = Array.from(new Set(values.map((v: any) => String(v).trim())));
          setPoSiteIdOptions(unique);
          found = true;
          break;
        }
      }
      if (!found) setPoSiteIdOptions([]);
    } catch (err) {
      setPoSiteIdOptions([]);
    }
    if (poSiteIdOptions.length === 0) {
      setValidateError("No 'Route ID / Site ID' column found in uploaded file.");
    }
  };

  const handlePoParse = async () => {
    if (!poSiteId) {
      alert("Please select a Site ID.");
      return;
    }
    setPoUploading(true);
    setPoParseResult(null);
    try {
      console.time('poParse');
      const formData = new FormData();
      formData.append("site_id", poSiteId);
      const res = await fetch("http://localhost:8000/api/parse-po", {
        method: "POST",
        body: formData,
      });
      const result = await res.json();
      console.timeEnd('poParse');
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
      console.time('dnParse');
      const formData = new FormData();
      formData.append("dn_file", dnFile);
      formData.append("authority", dnAuthority);
      const res = await fetch("http://localhost:8000/api/parse-dn", {
        method: "POST",
        body: formData,
      });
      const result = await res.json();
      console.timeEnd('dnParse');
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
    if (!poSiteId || !dnAppFile || !dnFile || !dnAuthority) {
      setValidateError("Please upload all files and fill all required fields.");
      return;
    }
    setValidating(true);
    setValidationResults([]);
    try {
      console.time('validateParsers');
      // Prepare requests
      const poForm = new FormData();
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
      console.timeEnd('validateParsers');
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
    // Always check for an edited value first
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
      "surface_wise_ri_amount": "Surface-wise RI Amount",
      "dn_ri_amount": "RI Amount",
      "surface_wise_multiplication_factor": "Surface-wise Multiplication Factor",
      "ground_rent": "Ground Rent",
      "administrative_charge": "Administrative Charge",
      "supervision_charges": "Supervision Charges",
      "chamber_fee": "Chamber Fee",
      "gst": "GST Amount",
      "deposit": "SD Amount"
    };
    const lookup = fieldMap[field] || field;
    const found = validationResults.find(row => normalizeFieldName(row.field) === normalizeFieldName(lookup));
    if (found) return found.value;
    // fallback for hardcoded fields
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
    if (field === "proj_non_refundable_savings_per_mtr") return nonRefundableSavingsPerMtr;
    if (field === "total_dn_amount") return totalDnAmount;
    if (field === "proj_savings_per_dn") {
      const savingsPerMtr = parseFloat(getValidateParserFieldValue("proj_non_refundable_savings_per_mtr") ?? "");
      const dnLength = parseFloat(getValidateParserFieldValue("dn_length_mtr") ?? "");
      if (!isNaN(savingsPerMtr) && !isNaN(dnLength)) {
        return (savingsPerMtr * dnLength).toFixed(2);
      }
      return null;
    }
    // Blank/manual fields
    if ([
      "survey_id", "ce_route_lmc_id", "route_lmc_section_id", "route_lmc_subsection_id",
      "hdd_length", "no_of_pits", "pit_ri_rate",
      "new_revised_dn_number", "new_revised_dn_against", "internal_approval_start", "internal_approval_end",
      "ticket_raised_date", "dn_payment_date", "tat_days", "civil_completion_date"
    ].includes(field)) return "";
    return "";
  }

  // Helper to get the source for each field
  function getValidateParserFieldSource(field: string): string {
    // Hardcoded
    if (["lmc_route", "ip1_co_built", "dn_recipient", "project_name", "contract_type", "build_type", "category_type", "trench_type"].includes(field)) return "Hardcoded";
    // Calculated
    if (["ri_budget_amount_per_meter", "projected_budget_ri_amount_dn", "actual_total_non_refundable", "non_refundable_amount_per_mtr", "proj_non_refundable_savings_per_mtr", "total_dn_amount", "proj_savings_per_dn"].includes(field)) return "Calculated";
    // Blank/manual
    if (["survey_id", "ce_route_lmc_id", "route_lmc_section_id", "route_lmc_subsection_id", "hdd_length", "no_of_pits", "pit_ri_rate", "new_revised_dn_number", "new_revised_dn_against", "internal_approval_start", "internal_approval_end", "ticket_raised_date", "dn_payment_date", "tat_days", "civil_completion_date"].includes(field)) return "Blank";
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
      "surface_wise_ri_amount": "DN",
      "dn_ri_amount": "DN",
      "surface_wise_multiplication_factor": "DN",
      "ground_rent": "DN",
      "administrative_charge": "DN",
      "supervision_charges": "DN",
      "chamber_fee": "DN",
      "gst": "DN",
      "deposit": "DN",
      "surface_wise_length": "DN"
    };
    return fieldMap[field] || "";
  }

  // Handler for editing a value in the validation table
  const handleValidationEdit = (idx: number, newValue: string) => {
    setValidationResults(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], value: newValue };
      return updated;
    });
  };

  // Before rendering the Site ID dropdown:
  console.log("Rendering Site ID dropdown with options:", poSiteIdOptions);

  const handleSendToMasterDN = async () => {
    setSendingToMasterDN(true);
    setSendToMasterDNSuccess(null);
    setSendToMasterDNError(null);
    // Build the data array to always include every field in VALIDATE_PARSER_FIELDS
    const data = VALIDATE_PARSER_FIELDS.map(field => ({
      field,
      value: getValidateParserFieldValue(field)
    }));
    try {
      console.time('sendToMasterDN');
      const response = await fetch('http://localhost:8000/api/send-to-master-dn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
      });
      if (!response.ok) {
        let errorMsg = 'Error sending to Master DN Database.';
        try {
          const errorData = await response.json();
          if (response.status === 409 && errorData.error?.includes('already exists')) {
            errorMsg = 'A Demand Note with this number already exists in the master database.';
          } else if (errorData.error) {
            errorMsg = errorData.error;
          }
        } catch {}
        setSendToMasterDNError(errorMsg);
        toast({
          title: 'Error',
          description: errorMsg,
          variant: 'destructive',
        });
        return;
      }
      console.timeEnd('sendToMasterDN');
      setSendToMasterDNSuccess('Successfully sent to Master DN Database!');
      toast({
        title: 'Success',
        description: 'Successfully sent to Master DN Database!',
      });
    } catch (err: any) {
      setSendToMasterDNError(err.message || 'Error sending to Master DN Database.');
      toast({
        title: 'Error',
        description: err.message || 'Error sending to Master DN Database.',
        variant: 'destructive',
      });
    } finally {
      setSendingToMasterDN(false);
    }
  };

  return (
    <>
      {/* Add DN Entry from 3 Files */}
      <Card className="bg-[#101624] shadow-2xl border-none p-0 rounded-3xl">
        <CardHeader className="pb-2 flex flex-col gap-2 border-b border-slate-800/60 bg-[#101624]">
          <CardTitle className="text-2xl font-semibold text-white flex items-center gap-2 tracking-normal">
            <Upload className="h-8 w-8 text-blue-400 drop-shadow-lg" />
            <span>Automated DN Entry & Budget Integration
            </span>
          </CardTitle>
          <CardDescription className="text-slate-400 mt-1 text-base font-normal leading-snug">
          Upload and parse POs, Applications, and DNs to power accurate Budget vs Actual financial analysis.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0 pb-6 px-4">
          <div className="w-full flex flex-col items-center mb-8">
            <div className="w-full max-w-2xl flex flex-row gap-4 items-center justify-center">
              {/* Site ID / Route ID Autocomplete Dropdown */}
              <div className="relative flex-1">
                <input
                  type="text"
                  className="w-full bg-[#232a3a] border border-green-600 rounded-lg px-4 py-2 text-white text-base font-inter placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                  value={poSiteId}
                  onChange={e => setPoSiteId(e.target.value)}
                  onFocus={() => setSiteIdInputFocused(true)}
                  onBlur={() => setTimeout(() => setSiteIdInputFocused(false), 150)}
                  autoComplete="off"
                  placeholder="Enter or select Site ID / Route ID"
                />
                {siteIdInputFocused && poSiteIdOptions.length > 0 && (
                  <div className="absolute left-0 right-0 mt-1 z-30 bg-[#232a3a] border border-green-600 rounded-lg shadow-2xl max-h-48 overflow-y-auto">
                    {poSiteIdOptions.filter(id => id.toLowerCase().includes(poSiteId.toLowerCase())).length === 0 ? (
                      <div className="px-4 py-2 text-slate-400 text-sm">No matching Site IDs</div>
                    ) : (
                      poSiteIdOptions
                        .filter(id => id.toLowerCase().includes(poSiteId.toLowerCase()))
                        .map(id => (
                          <div
                            key={id}
                            className={`px-4 py-2 cursor-pointer hover:bg-green-700/30 text-white text-sm rounded transition-all ${poSiteId === id ? "bg-green-700/40 font-semibold" : ""}`}
                            onMouseDown={() => { setPoSiteId(id); setSiteIdInputFocused(false); }}
                          >
                            {id}
                          </div>
                        ))
                    )}
                  </div>
                )}
              </div>
              {/* Authority Dropdown */}
              <div className="flex-1">
                <Select value={dnAuthority} onValueChange={setDnAuthority}>
                  <SelectTrigger className="w-full rounded-lg bg-[#232a3a] border border-purple-600 focus:ring-2 focus:ring-purple-500 text-white py-2 px-4 text-base shadow-inner">
                    <SelectValue placeholder="Select Authority" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl bg-[#181e2a] border border-slate-700 shadow-2xl backdrop-blur-md">
                    <SelectItem value="MCGM" className="text-slate-100 data-[state=checked]:bg-purple-700/40 data-[highlighted]:bg-purple-700/20 data-[highlighted]:text-white">MCGM</SelectItem>
                    <SelectItem value="MBMC" className="text-slate-100 data-[state=checked]:bg-purple-700/40 data-[highlighted]:bg-purple-700/20 data-[highlighted]:text-white">MBMC</SelectItem>
                    <SelectItem value="KDMC" className="text-slate-100 data-[state=checked]:bg-purple-700/40 data-[highlighted]:bg-purple-700/20 data-[highlighted]:text-white">KDMC</SelectItem>
                    <SelectItem value="NMMC" className="text-slate-100 data-[state=checked]:bg-purple-700/40 data-[highlighted]:bg-purple-700/20 data-[highlighted]:text-white">NMMC</SelectItem>
                    <SelectItem value="MIDC Type 1" className="text-slate-100 data-[state=checked]:bg-purple-700/40 data-[highlighted]:bg-purple-700/20 data-[highlighted]:text-white">MIDC Type 1</SelectItem>
                    <SelectItem value="MIDC Type 2" className="text-slate-100 data-[state=checked]:bg-purple-700/40 data-[highlighted]:bg-purple-700/20 data-[highlighted]:text-white">MIDC Type 2</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full mb-8">
            {/* DN Application Card */}
            <Card className="flex-1 flex flex-col h-full bg-[#101624] shadow-2xl border-none p-0 rounded-3xl">
              <CardHeader className="pb-1 flex flex-col gap-1 border-b border-slate-800/60 bg-[#101624]">
                <div className="min-h-[48px] flex flex-col justify-center">
                  <CardTitle className="text-2xl font-semibold text-white flex items-center gap-2 tracking-normal">
                    <FileText className="h-7 w-7 text-orange-400 drop-shadow-lg" />
                    <span>DN Application</span>
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col h-full pt-0 pb-4 px-4">
                <div className="flex flex-col h-full justify-between w-full">
                  <div
                    className="w-full min-h-[120px] max-w-5xl bg-[#101624] border-2 border-dashed border-orange-500 rounded-2xl flex flex-col items-center justify-center py-4 px-4 mb-0 mt-3 cursor-pointer transition hover:bg-[#16203a]"
                    onClick={() => document.getElementById('dn-app-file-input')?.click()}
                    tabIndex={0}
                    role="button"
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { document.getElementById('dn-app-file-input')?.click(); } }}
                  >
                    <FileText className="h-14 w-14 text-orange-400 mb-1" />
                    <div className="font-semibold text-lg text-white mb-0.5">Upload File</div>
                    <div className="text-xs text-slate-400">Supports .pdf files</div>
                    <input
                      id="dn-app-file-input"
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      onChange={e => setDnAppFile(e.target.files?.[0] || null)}
                    />
                  </div>
                  <div className="w-full mt-4 mb-4 min-h-[48px] flex items-center">
                    <div className="w-full invisible">placeholder</div>
                  </div>
                  {dnAppFile && (
                    <div className="text-xs text-orange-300 mt-2 truncate w-full text-center">{dnAppFile.name}</div>
                  )}
                </div>
              </CardContent>
            </Card>
            {/* Demand Note Card */}
            <Card className="flex-1 flex flex-col h-full bg-[#101624] shadow-2xl border-none p-0 rounded-3xl">
              <CardHeader className="pb-1 flex flex-col gap-1 border-b border-slate-800/60 bg-[#101624]">
                <div className="min-h-[48px] flex flex-col justify-center">
                  <CardTitle className="text-2xl font-semibold text-white flex items-center gap-2 tracking-normal">
                    <FileText className="h-7 w-7 text-purple-400 drop-shadow-lg" />
                    <span>Demand Note</span>
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col h-full pt-0 pb-4 px-4">
                <div className="flex flex-col h-full justify-between w-full">
                  <div
                    className="w-full min-h-[120px] max-w-5xl bg-[#101624] border-2 border-dashed border-purple-500 rounded-2xl flex flex-col items-center justify-center py-4 px-4 mb-0 mt-3 cursor-pointer transition hover:bg-[#16203a]"
                    onClick={() => document.getElementById('dn-file-input')?.click()}
                    tabIndex={0}
                    role="button"
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { document.getElementById('dn-file-input')?.click(); } }}
                  >
                    <FileText className="h-14 w-14 text-purple-400 mb-1" />
                    <div className="font-semibold text-lg text-white mb-0.5">Upload File</div>
                    <div className="text-xs text-slate-400">Supports .pdf files</div>
                    <input
                      id="dn-file-input"
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      onChange={e => setDnFile(e.target.files?.[0] || null)}
                    />
                  </div>
                  {dnFile && (
                    <div className="text-xs text-purple-300 mt-2 truncate w-full text-center">{dnFile.name}</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="flex flex-col items-center w-full mt-10 gap-2">
            <Button
              className="w-full max-w-md bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-md px-8 py-4 flex items-center justify-center gap-3 shadow-2xl transition text-lg tracking-wide drop-shadow-lg"
              onClick={handleValidateParsers}
              disabled={validating}
            >
              {validating ? <Loader2 className="w-6 h-6 animate-spin" /> : <Shield className="w-6 h-6 text-white" />}
              {validating ? "Validating..." : "Validate Parsers"}
            </Button>
            {validateError && <div className="text-red-400 text-base font-medium mt-2">{validateError}</div>}
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
                        const isEven = idx % 2 === 0;
                        // Use robust mapping for value
                        const value = getValidateParserFieldValue(field) ?? '';
                        const source = getValidateParserFieldSource(field);
                        // Find the index in validationResults using normalization and alias mapping
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
                          "surface_wise_ri_amount": "Surface-wise RI Amount",
                          "dn_ri_amount": "RI Amount",
                          "surface_wise_multiplication_factor": "Surface-wise Multiplication Factor",
                          "ground_rent": "Ground Rent",
                          "administrative_charge": "Administrative Charge",
                          "supervision_charges": "Supervision Charges",
                          "chamber_fee": "Chamber Fee",
                          "gst": "GST Amount",
                          "deposit": "SD Amount"
                        };
                        const lookup = fieldMap[field] || field;
                        const normalizeFieldName = (name: string) => name.replace(/\s+/g, '').toLowerCase();
                        const resultIdx = validationResults.findIndex(row => normalizeFieldName(row.field) === normalizeFieldName(lookup));
                        let badgeClass = "bg-slate-700/10 text-slate-100 border-slate-400/10";
                        if (source === "PO") badgeClass = "bg-blue-700/10 text-blue-200 border-blue-400/10";
                        else if (source === "DN") badgeClass = "bg-purple-700/10 text-purple-200 border-purple-400/10";
                        else if (source === "DN Application") badgeClass = "bg-orange-700/10 text-orange-200 border-orange-400/10";
                        else if (source === "Calculated") badgeClass = "bg-green-700/10 text-green-200 border-green-400/10";
                        else if (source === "Blank") badgeClass = "bg-gray-700/10 text-gray-300 border-gray-400/10";
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
                            <TableCell className="text-gray-200 py-2 px-4 border-x border-slate-700 align-middle w-2/5 min-w-[200px] text-sm">
                              <input
                                type="text"
                                value={value}
                                onChange={e => {
                                  if (resultIdx !== -1) {
                                    handleValidationEdit(resultIdx, e.target.value);
                                  } else {
                                    // If not found, add a new entry with the normalized field name
                                    setValidationResults(prev => ([...prev, { field: lookup, value: e.target.value, source }]));
                                  }
                                }}
                                className="w-full rounded bg-[#232a3a] border border-slate-700 text-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                                style={{ background: 'rgba(35,42,58,0.85)' }}
                              />
                            </TableCell>
                            <TableCell className="w-1/4 min-w-[120px] py-2 px-4 border-x border-slate-700 align-middle">
                              <Badge className={badgeClass}>{source}</Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TooltipProvider>
                </TableBody>
              </Table>
            </div>
          )}
          {validationResults.length > 0 && (
            <div className="flex flex-col items-center w-full mt-6 gap-4">
              <Button
                className="w-full max-w-md bg-gradient-to-r from-blue-500 to-blue-700 text-white font-semibold rounded-md shadow-lg hover:from-blue-600 hover:to-blue-800 transition py-3 text-base flex items-center justify-center gap-3"
                onClick={handleSendToMasterDN}
                disabled={sendingToMasterDN}
              >
                {sendingToMasterDN ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5 mr-1" />}
                {sendingToMasterDN ? 'Uploading...' : 'Upload to Database'}
              </Button>
              {sendToMasterDNSuccess && <div className="text-green-400 text-base font-medium mt-2">{sendToMasterDNSuccess}</div>}
              {sendToMasterDNError && <div className="text-red-400 text-base font-medium mt-2">{sendToMasterDNError}</div>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* DN Master Database Management Section (Redesigned) */}
      <div className="w-full mb-8">
        <Card className="bg-[#101624] shadow-2xl border-none p-0 rounded-3xl flex flex-col">
          <CardHeader className="pb-2 flex flex-col gap-2 border-b border-slate-800/60 bg-[#101624]">
            <CardTitle className="text-2xl font-semibold text-white flex items-center gap-2 tracking-normal">
              <FileSpreadsheet className="h-7 w-7 text-blue-400 drop-shadow-lg" />
              <span>Download Master Files</span>
            </CardTitle>
            <CardDescription className="text-slate-400 mt-1 text-base font-normal leading-snug">
              Download the latest Master DN, Master Budget, or Master PO database as an Excel file for offline analysis or backup.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center flex-1 pt-0 pb-8 px-6">
            <div className="w-full flex flex-col md:flex-row gap-4 mt-6 items-center justify-center">
              <Button
                className="max-w-sm w-full bg-gradient-to-r from-blue-500 to-blue-700 text-white font-semibold rounded-lg shadow-md hover:from-blue-600 hover:to-blue-800 transition py-5 text-base flex items-center justify-center gap-3 tracking-wide"
                onClick={() => window.open('http://localhost:8000/api/download-master-dn', '_blank')}
              >
                Download Master DN Database
              </Button>
              <Button
                className="max-w-sm w-full bg-gradient-to-r from-blue-500 to-blue-700 text-white font-semibold rounded-lg shadow-md hover:from-blue-600 hover:to-blue-800 transition py-5 text-base flex items-center justify-center gap-3 tracking-wide"
                onClick={() => window.open('http://localhost:8000/api/download-master-budget', '_blank')}
              >
                Download Master Budget Database
              </Button>
              <Button
                className="max-w-sm w-full bg-gradient-to-r from-blue-500 to-blue-700 text-white font-semibold rounded-lg shadow-md hover:from-blue-600 hover:to-blue-800 transition py-5 text-base flex items-center justify-center gap-3 tracking-wide"
                onClick={() => window.open('http://localhost:8000/api/download-master-po', '_blank')}
              >
                Download Master PO Database
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
} 