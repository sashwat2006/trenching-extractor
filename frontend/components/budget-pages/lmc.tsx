"use client"
import { useState, useRef, useEffect } from "react"
import type React from "react"
import * as XLSX from 'xlsx';
import { supabase } from '@/utils/supabaseClient';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Upload,
  FileSpreadsheet,
  Search,
  CheckCircle,
  AlertCircle,
  Loader2,
  Database,
  FileText,
  X,
  Trash2,
  BarChart3,
  Brain,
  Zap,
} from "lucide-react"
import { parseAndCleanExcel, uploadToSupabase, queryBySiteId, type BudgetData } from "@/lib/lmcLogic"
import { authorities } from "@/constants/authorities"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import PremiumBudgetChart from "./PremiumBudgetChart"
import GenerateEmailDraftModal from "@/components/email/GenerateEmailDraftModal"
import DnManagementSection from "./dn"

const queryColumns = [
  "total_ri_amount",
  "material_cost",
  "execution_cost_including_hh",
  "total_cost_without_deposit",
  "survey_id",
  "existing_new",
];

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

// Helper to convert Excel serial date to ISO string
function excelDateToISO(serial: number): string {
  const utc_days = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400; // seconds
  const date_info = new Date(utc_value * 1000);
  return date_info.toISOString().slice(0, 10);
}

// Helper to normalize DD-MM-YYYY or DD/MM/YYYY to YYYY-MM-DD (ISO)
function normalizeDateStringToISO(val: string): string {
  // If already YYYY-MM-DD, return as is
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  // If DD-MM-YYYY or DD/MM/YYYY, convert to YYYY-MM-DD
  const match = val.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (match) {
    return `${match[3]}-${match[2]}-${match[1]}`;
  }
  return val;
}

// Place fetchDnsBySiteId before useEffect so it's defined
async function fetchDnsBySiteId(siteId: string) {
  const { data, error } = await supabase
    .from("dn_master")
    .select("*")
    .eq("route_id_site_id", siteId);
  if (error) {
    throw error;
  }
  return data;
}

// Helper to get total cost per meter from Budget Table (stub, replace with real logic if needed)
function useBudgetTableTotalCostPerMeter(siteId: string): number | null {
  // TODO: Replace with actual logic to fetch or compute from SupabaseQueryTable
  // For now, return null to show placeholder
  return null;
}

// NOTE: The Full Route tab is included here so that both LMC and Full Route workflows share the same tab system and UI context. This allows users to switch between LMC and Full Route without navigating to a different route or page, keeping the experience consistent and stateful.

export default function LmcPage() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<BudgetData[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // PDF files state
  const [pdfFiles, setPdfFiles] = useState<File[]>([])
  const [pdfUploading, setPdfUploading] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)
  const [pdfSuccess, setPdfSuccess] = useState<string | null>(null)
  const pdfInputRef = useRef<HTMLInputElement>(null)

  // Query state
  const [siteId, setSiteId] = useState("")
  const [siteIdOptions, setSiteIdOptions] = useState<string[]>([])
  const [siteIdDropdownOpen, setSiteIdDropdownOpen] = useState(false)
  const [siteIdInputValue, setSiteIdInputValue] = useState("")
  const [queryResult, setQueryResult] = useState<any | null>(null)
  const [queryError, setQueryError] = useState<string | null>(null)
  const [queryLoading, setQueryLoading] = useState(false)

  // DN Analysis state
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [analysisResult, setAnalysisResult] = useState<any | null>(null)
  // Authority selection state
  const [selectedAuthority, setSelectedAuthority] = useState("")
  const [budgetedCostPerMeter, setBudgetedCostPerMeter] = useState<number|null>(null)
  // Store the latest loaded budget table row for use in savings card
  const [budgetTableRow, setBudgetTableRow] = useState<any | null>(null)

  const [activeTab, setActiveTab] = useState("upload")

  // Helper: enable analysis tab only if at least one Excel and one PDF file are uploaded
  const hasUploadedFiles = file && preview.length > 0 && pdfFiles.length > 0

  const [showBudgetApprovalModal, setShowBudgetApprovalModal] = useState(false)

  const [existingDns, setExistingDns] = useState<any[]>([])

  // Add state to control when analysis is performed
  const [analysisTriggered, setAnalysisTriggered] = useState(false);

  // DN Master Excel upload state and handlers
  const [dnMasterFile, setDnMasterFile] = useState<File | null>(null);
  const [dnUploading, setDnUploading] = useState(false);
  const [dnError, setDnError] = useState<string | null>(null);
  const [dnSuccess, setDnSuccess] = useState<string | null>(null);
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
      const formData = new FormData();
      formData.append('file', dnMasterFile);
      const response = await fetch('http://localhost:8000/api/upload-dn-master', {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();
      if (!response.ok || result.success === false) {
        let errorMsg = result.errors ? result.errors.join('\n') : (result.detail || result.message || 'Upload failed');
        setDnError(errorMsg);
        return;
      }
      setDnSuccess('All rows upserted successfully for DN Master!');
    } catch (err: any) {
      setDnError(err.message || 'Upload failed');
    } finally {
      setDnUploading(false);
      setDnMasterFile(null);
      const input = document.getElementById('dn-master-file-input') as HTMLInputElement | null;
      if (input) input.value = '';
    }
  };

  // Fetch all unique Site IDs from Supabase on mount
  useEffect(() => {
    async function fetchSiteIds() {
      const { data, error } = await supabase
        .from("dn_master")
        .select("route_id_site_id")
        .neq("route_id_site_id", null);
      if (!error && data) {
        const unique = Array.from(new Set(data.map((row: any) => row.route_id_site_id).filter(Boolean)));
        setSiteIdOptions(unique);
      }
    }
    fetchSiteIds();
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)
    setSuccess(null)
    const f = e.target.files?.[0] || null
    setFile(f)
    if (f) {
      try {
        console.time('parseAndCleanExcel');
        const cleaned = await parseAndCleanExcel(f)
        console.timeEnd('parseAndCleanExcel');
        setPreview(cleaned)
      } catch (err: any) {
        setError("Failed to parse Excel file: " + (err.message || err))
        setPreview([])
      }
    } else {
      setPreview([])
    }
  }

  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPdfError(null)
    setPdfSuccess(null)
    const files = Array.from(e.target.files || [])
    const pdfFiles = files.filter((file) => file.type === "application/pdf")

    if (files.length !== pdfFiles.length) {
      setPdfError("Only PDF files are allowed")
      return
    }

    setPdfFiles((prev) => [...prev, ...pdfFiles])
  }

  const removePdfFile = (index: number) => {
    setPdfFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const clearAllPdfs = () => {
    setPdfFiles([])
    setPdfError(null)
    setPdfSuccess(null)
    if (pdfInputRef.current) pdfInputRef.current.value = ""
  }

  const handleUpload = async () => {
    if (!file || preview.length === 0) {
      setError("No file or preview data")
      return
    }
    setUploading(true)
    setError(null)
    setSuccess(null)
    try {
      console.time('uploadToSupabase');
      const { error: supabaseError } = await uploadToSupabase(preview)
      console.timeEnd('uploadToSupabase');
      if (supabaseError) {
        setError("Supabase error: " + supabaseError.message + " (" + supabaseError.details + ")")
        return
      }
      setSuccess("All rows upserted successfully for LMC Master!")
    } catch (err: any) {
      setError("Upload failed: " + (err.message || err))
    } finally {
      setUploading(false)
    }
  }

  const handlePdfUpload = async () => {
    if (pdfFiles.length === 0) {
      setPdfError("No PDF files selected")
      return
    }

    setPdfUploading(true)
    setPdfError(null)
    setPdfSuccess(null)

    try {
      // Simulate PDF upload - replace with your actual upload logic
      await new Promise((resolve) => setTimeout(resolve, 2000))
      setPdfSuccess(`Successfully uploaded ${pdfFiles.length} demand note${pdfFiles.length > 1 ? "s" : ""}!`)
      setPdfFiles([])
      if (pdfInputRef.current) pdfInputRef.current.value = ""
    } catch (err: any) {
      setPdfError("PDF upload failed: " + (err.message || err))
    } finally {
      setPdfUploading(false)
    }
  }

  const handleQuery = async (e: React.FormEvent) => {
    e.preventDefault()
    setQueryError(null)
    setQueryResult(null)
    setQueryLoading(true)
    try {
      const { data, error } = await queryBySiteId(siteId, queryColumns)
      if (error) {
        setQueryError(error.message)
      } else {
        setQueryResult(data)
      }
    } catch (err: any) {
      setQueryError("Query failed: " + (err.message || err))
    } finally {
      setQueryLoading(false)
    }
  }

  const handleDnAnalysis = async (authorityId: string) => {
    setAnalysisLoading(true)
    setAnalysisError(null)
    setAnalysisResult(null)

    try {
      const formData = new FormData()
      pdfFiles.forEach((file) => formData.append("files", file))
      formData.append("authority", authorityId)

      const res = await fetch("http://localhost:8000/actual_cost_extraction/", {
        method: "POST",
        body: formData,
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.detail || errorData.error || "Failed to parse demand notes")
      }
      const result = await res.json()
      setAnalysisResult(result)
      // Reset DN uploads after successful parse, but keep siteId so budget table and pop-up cards remain visible
      setPdfFiles([])
      if (pdfInputRef.current) pdfInputRef.current.value = ""
    } catch (err: any) {
      setAnalysisError("DN Analysis failed: " + (err.message || err))
    } finally {
      setAnalysisLoading(false)
    }
  }

  const formatNumber = (val: any) => {
    if (typeof val === "number") {
      return (Math.round(val * 100) / 100).toLocaleString()
    }
    if (!isNaN(Number(val)) && val !== null && val !== "" && val !== undefined) {
      return (Math.round(Number(val) * 100) / 100).toLocaleString()
    }
    return String(val)
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount)
  }

  useEffect(() => {
    setBudgetTableRow(undefined);
  }, [siteId]);

  useEffect(() => {
    if (!siteId) {
      setExistingDns([]);
      return;
    }
    fetchDnsBySiteId(siteId)
      .then(setExistingDns)
      .catch((err: any) => setQueryError("Failed to fetch DNs: " + err.message));
  }, [siteId]);

  // Place this above the return statement in LmcPage
  const uploadedDns = Array.isArray(analysisResult?.results) ? analysisResult.results : [];
  const mergedDns = [
    ...uploadedDns,
    ...existingDns.filter(
      dbDn => !uploadedDns.some((upDn: any) => upDn.demand_note_reference === dbDn.demand_note_reference)
    ),
  ];

  const handleBudgetAnalysis = () => {
    if (!siteId.trim()) return;
    setAnalysisTriggered(true);
  };

  // --- Add to your state section (if not already present) ---
  const [poMasterFile, setPoMasterFile] = useState<File | null>(null);
  const [poMasterUploading, setPoMasterUploading] = useState(false);
  const [poMasterError, setPoMasterError] = useState<string | null>(null);
  const [poMasterSuccess, setPoMasterSuccess] = useState<string | null>(null);

  // --- Add these handler functions ---
  const handlePoMasterFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPoMasterFile(e.target.files?.[0] || null);
    setPoMasterError(null);
    setPoMasterSuccess(null);
  };

  const handlePoMasterUpload = async () => {
    if (!poMasterFile) {
      setPoMasterError("Please select a PO Master Excel file.");
      return;
    }
    setPoMasterUploading(true);
    setPoMasterError(null);
    setPoMasterSuccess(null);
    try {
      console.time('poMasterUpload');
      const formData = new FormData();
      formData.append("file", poMasterFile);
      const res = await fetch("http://localhost:8000/api/upload-po-master", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.detail || result.message || "Upload failed");
      }
      console.timeEnd('poMasterUpload');
      setPoMasterSuccess("All rows upserted successfully for PO Master!");
    } catch (err: any) {
      let msg = "Upload failed";
      if (err?.message) {
        msg = err.message;
      } else if (typeof err === "string") {
        msg = err;
      } else if (err && typeof err === "object") {
        msg = JSON.stringify(err);
      }
      setPoMasterError(msg);
    } finally {
      setPoMasterUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1a1f2e] text-slate-100">
      {/* Header */}
      <div className="border-b border-slate-700 bg-[#101624]">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-white">CloudExtel Budget Analysis & Approval Hub</h1>
              <p className="text-slate-400 mt-1">Upload and analyze your budget data</p>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-slate-300">System Online</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Custom Tab Bar */}
        <div className="relative w-full flex border border-slate-700 rounded-xl bg-[#101624] mb-8" style={{height: 56}}>
          {['upload', 'analysis'].map((tab, idx) => (
            <button
              key={tab}
              className={`flex-1 h-full flex items-center justify-center font-inter font-semibold text-lg transition-colors duration-150 z-10
                ${activeTab === tab ? 'text-white' : 'text-white/60'}`}
              style={{position: 'relative'}}
              onClick={() => setActiveTab(tab)}
              tabIndex={0}
              type="button"
            >
              {tab === 'upload' ? 'Upload & Manage' : 'Budget Analysis'}
            </button>
          ))}
          {/* Sliding underline */}
          <span
            className="absolute bottom-0 left-0 h-1 rounded-b-xl bg-white transition-all duration-300"
            style={{
              width: '50%',
              transform: activeTab === 'upload' ? 'translateX(0%)' : 'translateX(100%)',
            }}
          />
        </div>

        {/* Tab Content */}
        {activeTab === 'upload' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full mb-8">
              {/* Master PO File Card (move to left) */}
              <Card className="flex-1 flex flex-col h-full bg-[#101624] shadow-2xl border-none p-0 rounded-3xl">
                <CardHeader className="pb-1 flex flex-col gap-1 border-b border-slate-800/60 bg-[#101624]">
                  <div className="min-h-[48px] flex flex-col justify-center">
                    <CardTitle className="text-2xl font-semibold text-white flex items-center gap-2 tracking-normal">
                      <FileSpreadsheet className="h-7 w-7 text-blue-400 drop-shadow-lg" />
                      <span>Master PO File</span>
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col h-full pt-0 pb-4 px-4">
                  <div className="flex-1 flex flex-col justify-end w-full">
                    <div
                      className="w-full min-h-[120px] max-w-5xl bg-[#101624] border-2 border-dashed border-blue-500 rounded-2xl flex flex-col items-center justify-center py-4 px-4 mb-0 mt-3 cursor-pointer transition hover:bg-[#16203a]"
                      onClick={() => {
                        if (poMasterUploading) return;
                        document.getElementById('po-master-file-input')?.click();
                      }}
                      tabIndex={0}
                      role="button"
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { document.getElementById('po-master-file-input')?.click(); } }}
                    >
                      <FileSpreadsheet className="h-14 w-14 text-blue-400 mb-1" />
                      <div className="font-semibold text-lg text-white mb-0.5">Upload Excel File</div>
                      <div className="text-xs text-slate-400">Supports .xlsx and .xls files</div>
                      <input
                        id="po-master-file-input"
                        type="file"
                        accept=".xlsx,.xls"
                        className="hidden"
                        onChange={handlePoMasterFileChange}
                      />
                    </div>
                    <div className="min-h-[20px] text-xs text-blue-300 mt-1">{poMasterFile ? poMasterFile.name : ""}</div>
                    <Button
                      className="w-full bg-gradient-to-r from-blue-500 to-blue-700 text-white font-semibold rounded-md shadow-lg hover:from-blue-600 hover:to-blue-800 transition py-2 text-base flex items-center gap-2 justify-center"
                      onClick={() => {
                        if (!poMasterFile || poMasterUploading) return;
                        handlePoMasterUpload();
                      }}
                    >
                      {poMasterUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5 mr-1" />}
                      {poMasterUploading ? 'Uploading...' : 'Upload to Database'}
                    </Button>
                    <div className="min-h-[32px] w-full">
                      {poMasterError && <Alert className="bg-blue-950/50 border-blue-800 text-blue-200 mt-4"><AlertCircle className="h-4 w-4" /><AlertDescription>{poMasterError}</AlertDescription></Alert>}
                      {poMasterSuccess && <Alert className="bg-blue-950/50 border-blue-800 text-blue-200 mt-4"><CheckCircle className="h-4 w-4" /><AlertDescription>{poMasterSuccess}</AlertDescription></Alert>}
                    </div>
                  </div>
                </CardContent>
              </Card>
              {/* Master Budget File Card (middle) */}
              <Card className="flex-1 flex flex-col h-full bg-[#101624] shadow-2xl border-none p-0 rounded-3xl">
                <CardHeader className="pb-1 flex flex-col gap-1 border-b border-slate-800/60 bg-[#101624]">
                  <div className="min-h-[48px] flex flex-col justify-center">
                    <CardTitle className="text-2xl font-semibold text-white flex items-center gap-2 tracking-normal">
                      <FileSpreadsheet className="h-7 w-7 text-blue-400 drop-shadow-lg" />
                      <span>Master Budget File</span>
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col h-full pt-0 pb-4 px-4">
                  <div className="flex-1 flex flex-col justify-end w-full">
                    <div
                      className="w-full min-h-[120px] max-w-5xl bg-[#101624] border-2 border-dashed border-blue-500 rounded-2xl flex flex-col items-center justify-center py-4 px-4 mb-0 mt-3 cursor-pointer transition hover:bg-[#16203a]"
                      onClick={() => {
                        if (uploading) return;
                        document.getElementById('lmc-master-file-input')?.click();
                      }}
                      tabIndex={0}
                      role="button"
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { document.getElementById('lmc-master-file-input')?.click(); } }}
                    >
                      <FileSpreadsheet className="h-14 w-14 text-blue-400 mb-1" />
                      <div className="font-semibold text-lg text-white mb-0.5">Upload Excel File</div>
                      <div className="text-xs text-slate-400">Supports .xlsx and .xls files</div>
                      <input
                        id="lmc-master-file-input"
                        type="file"
                        accept=".xlsx,.xls"
                        className="hidden"
                        onChange={handleFileChange}
                      />
                    </div>
                    <div className="min-h-[20px] text-xs text-blue-300 mt-1">{file ? file.name : ""}</div>
                    <Button
                      className="w-full bg-gradient-to-r from-blue-500 to-blue-700 text-white font-semibold rounded-md shadow-lg hover:from-blue-600 hover:to-blue-800 transition py-2 text-base flex items-center gap-2 justify-center"
                      onClick={handleUpload}
                    >
                      {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5 mr-1" />}
                      {uploading ? 'Uploading...' : 'Upload to Database'}
                    </Button>
                    <div className="min-h-[32px] w-full">
                      {error && <Alert className="bg-blue-950/50 border-blue-800 text-blue-200 mt-4"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
                      {success && <Alert className="bg-blue-950/50 border-blue-800 text-blue-200 mt-4"><CheckCircle className="h-4 w-4" /><AlertDescription>{success}</AlertDescription></Alert>}
                    </div>
                  </div>
                </CardContent>
              </Card>
              {/* Master DN File Card (move to right) */}
              <Card className="flex-1 flex flex-col h-full bg-[#101624] shadow-2xl border-none p-0 rounded-3xl">
                <CardHeader className="pb-1 flex flex-col gap-1 border-b border-slate-800/60 bg-[#101624]">
                  <div className="min-h-[48px] flex flex-col justify-center">
                    <CardTitle className="text-2xl font-semibold text-white flex items-center gap-2 tracking-normal">
                      <FileSpreadsheet className="h-7 w-7 text-blue-400 drop-shadow-lg" />
                      <span>Master DN File</span>
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col h-full pt-0 pb-4 px-4">
                  <div className="flex-1 flex flex-col justify-end w-full">
                    <div
                      className="w-full min-h-[120px] max-w-5xl bg-[#101624] border-2 border-dashed border-blue-500 rounded-2xl flex flex-col items-center justify-center py-4 px-4 mb-0 mt-3 cursor-pointer transition hover:bg-[#16203a]"
                      onClick={() => {
                        if (dnUploading) return;
                        document.getElementById('dn-master-file-input')?.click();
                      }}
                      tabIndex={0}
                      role="button"
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { document.getElementById('dn-master-file-input')?.click(); } }}
                    >
                      <FileSpreadsheet className="h-14 w-14 text-blue-400 mb-1" />
                      <div className="font-semibold text-lg text-white mb-0.5">Upload Excel File</div>
                      <div className="text-xs text-slate-400">Supports .xlsx and .xls files</div>
                      <input
                        id="dn-master-file-input"
                        type="file"
                        accept=".xlsx,.xls"
                        className="hidden"
                        onChange={handleDnMasterFileChange}
                      />
                    </div>
                    <div className="min-h-[20px] text-xs text-blue-300 mt-1">{dnMasterFile ? dnMasterFile.name : ""}</div>
                    <Button
                      className="w-full bg-gradient-to-r from-blue-500 to-blue-700 text-white font-semibold rounded-md shadow-lg hover:from-blue-600 hover:to-blue-800 transition py-2 text-base flex items-center gap-2 justify-center"
                      onClick={() => {
                        if (!dnMasterFile || dnUploading) return;
                        handleDnMasterUpload();
                      }}
                    >
                      {dnUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5 mr-1" />}
                      {dnUploading ? 'Uploading...' : 'Upload to Database'}
                    </Button>
                    <div className="min-h-[32px] w-full">
                      {dnError && <Alert className="bg-blue-950/50 border-blue-800 text-blue-200 mt-4"><AlertCircle className="h-4 w-4" /><AlertDescription>{dnError}</AlertDescription></Alert>}
                      {dnSuccess && <Alert className="bg-blue-950/50 border-blue-800 text-blue-200 mt-4"><CheckCircle className="h-4 w-4" /><AlertDescription>{dnSuccess}</AlertDescription></Alert>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Render DN management section below LMC Master File upload */}
            <DnManagementSection />

            {/* Data Preview Section - Only show when Excel file is uploaded */}
            {preview.length > 0 && (
              <Card className="bg-[#232a3a] border border-slate-700 shadow-lg">
                <CardHeader className="border-b border-slate-600">
                  <CardTitle className="text-white">LMC Data Preview</CardTitle>
                  <CardDescription className="text-slate-400">
                    Preview of your uploaded Excel data (showing first 5 rows)
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="bg-[#1a1f2e] rounded-lg border border-slate-600 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-slate-600 hover:bg-slate-700/50">
                          {Object.keys(preview[0]).map((col) => (
                            <TableHead key={col} className="text-slate-300 font-medium">
                              {col}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.slice(0, 5).map((row, i) => (
                          <TableRow key={i} className="border-slate-600 hover:bg-slate-700/30">
                            {Object.values(row).map((val, j) => (
                              <TableCell key={j} className="text-slate-200 font-sans text-sm">
                                {formatNumber(val)}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {preview.length > 5 && (
                    <p className="text-slate-400 text-sm text-center mt-4">
                      Showing first 5 rows of {preview.length} total rows
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}
        {activeTab === 'analysis' && (
          <Card className="bg-[#101624] border-none shadow-2xl rounded-3xl backdrop-blur-md">
            <CardHeader className="border-b border-slate-700 pb-4">
              <CardTitle className="text-white flex items-center gap-2 text-2xl font-semibold tracking-tight">
                <BarChart3 className="h-6 w-6 text-orange-400" />
                 Budget Analysis
              </CardTitle>
              <CardDescription className="text-slate-400 mt-1 text-base">
                Enter a Site ID and click "Perform Budget Analysis" to view budget and actuals for that site.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              {/* Site ID input and button sectioned off */}
              <div className="bg-gradient-to-br from-[#1e293b] to-[#0f172a] border border-slate-700 shadow-xl rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-6 w-full mb-8">
                <div className="flex flex-col sm:flex-row items-center w-full gap-4">
                  <div className="flex flex-col w-60 max-w-xs">
                    <label htmlFor="siteId" className="text-slate-200 font-semibold text-base mb-1 font-sans tracking-wide">
                      Site ID <span className="text-red-500">*</span>
                    </label>
                    <Popover open={siteIdDropdownOpen} onOpenChange={setSiteIdDropdownOpen}>
                      <PopoverTrigger asChild>
                        <Input
                          id="siteId"
                          type="text"
                          value={siteIdInputValue}
                          onChange={e => {
                            setSiteIdInputValue(e.target.value);
                            setSiteId(e.target.value);
                            setAnalysisTriggered(false);
                          }}
                          onFocus={() => setSiteIdDropdownOpen(true)}
                          placeholder="Enter or select Site ID"
                          className="font-sans text-base bg-[#161c2d] border border-slate-600 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all w-full"
                          autoComplete="off"
                        />
                      </PopoverTrigger>
                      <PopoverContent className="w-60 p-0 max-h-56 overflow-y-auto bg-[#161c2d] border border-slate-700 rounded-lg shadow-xl">
                        {siteIdOptions.filter(id => id.toLowerCase().includes(siteIdInputValue.toLowerCase())).length === 0 ? (
                          <div className="px-4 py-2 text-slate-400 text-sm">No matching Site IDs</div>
                        ) : (
                          siteIdOptions
                            .filter(id => id.toLowerCase().includes(siteIdInputValue.toLowerCase()))
                            .map(id => (
                              <div
                                key={id}
                                className={cn(
                                  "px-4 py-2 cursor-pointer hover:bg-blue-700/30 text-white text-sm rounded transition-all",
                                  siteId === id && "bg-blue-700/40 font-semibold"
                                )}
                                onMouseDown={() => {
                                  setSiteId(id);
                                  setSiteIdInputValue(id);
                                }}
                              >
                                {id}
                              </div>
                            ))
                        )}
                      </PopoverContent>
                    </Popover>
                  </div>
                  <button
                    onClick={handleBudgetAnalysis}
                    className="bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white font-bold text-base px-8 py-3 rounded-lg flex items-center gap-2 shadow-md focus:outline-none focus:ring-2 focus:ring-blue-400"
                    style={{ minWidth: '220px' }}
                  >
                    <Zap className="h-6 w-6 mr-2" />
                    Perform Budget Analysis
                  </button>
                </div>
              </div>
              {/* Only show analysis if triggered and siteId is present */}
              {analysisTriggered && siteId && (
                <>
                  {/* Prior Analysis Section */}
                  <div className="mb-8 bg-[#101624] shadow-2xl rounded-3xl border-none">
                    <div className="border-b border-slate-800/60 pb-3 px-6 pt-4 bg-[#101624]">
                      <h2 className="text-white text-2xl font-bold font-sans mb-2 mt-6">Prior Analysis</h2>
                    </div>
                    <div className="p-6 text-white">
                      <AnalysisTableWithPopups data={mergedDns.filter(dn => new Date(dn.dn_received_date) < new Date(mergedDns[mergedDns.length - 1].dn_received_date))} budgetedCostPerMeter={budgetedCostPerMeter} />
                    </div>
                  </div>
                  <div className="w-full h-0.5 bg-white/80 my-8 rounded-full" />
                  <div className="mb-8 bg-[#101624] shadow-2xl rounded-3xl border-none">
                    <div className="border-b border-slate-800/60 pb-3 px-6 pt-4 bg-[#101624]">
                      <h2 className="text-white text-2xl font-bold font-sans mb-2 mt-6">Current Analysis</h2>
                    </div>
                    <div className="p-6 text-white">
                      <AnalysisTableWithPopups data={mergedDns.filter(dn => new Date(dn.dn_received_date) >= new Date(mergedDns[mergedDns.length - 1].dn_received_date))} budgetedCostPerMeter={budgetedCostPerMeter} />
                    </div>
                  </div>
                  <div className="w-full h-0.5 bg-white/80 my-8 rounded-full" />
                  <div className="mb-8 bg-[#101624] shadow-2xl rounded-3xl border-none">
                    <div className="border-b border-slate-800/60 pb-3 px-6 pt-4 bg-[#101624]">
                      <h2 className="text-white text-2xl font-bold font-sans mb-2 mt-6">Post Analysis</h2>
                    </div>
                    <div className="p-6 text-white">
                      <AnalysisTableWithPopups data={mergedDns} budgetedCostPerMeter={budgetedCostPerMeter} />
                    </div>
                  </div>
                  <div className="w-full h-0.5 bg-white/80 my-8 rounded-full" />

                  {/* Budget Table Section (restored) */}
                  <div className="mt-10 bg-[#1a1f2e] rounded-lg border border-slate-600 overflow-hidden p-6">
                    <h3 className="text-2xl font-bold text-white mb-2">Budget Table</h3>
                    <SupabaseQueryTable siteId={siteId} onBudgetedCostPerMeter={setBudgetedCostPerMeter} onBudgetTableRow={setBudgetTableRow} />
                  </div>
                  {budgetTableRow && (
                    <div className="flex justify-center mt-6">
                      <button
                        className="flex items-center gap-3 bg-gradient-to-r from-green-500 to-green-700 hover:from-green-600 hover:to-green-800 text-white font-bold px-8 py-4 rounded-xl shadow-lg text-lg transition-all"
                        onClick={() => setShowBudgetApprovalModal(true)}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25H4.5a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-.659 1.591l-7.5 7.5a2.25 2.25 0 01-3.182 0l-7.5-7.5A2.25 2.25 0 012.25 6.993V6.75" />
                        </svg>
                        Generate Budget Approval Email
                      </button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
      <GenerateEmailDraftModal
        open={showBudgetApprovalModal}
        onClose={() => setShowBudgetApprovalModal(false)}
        defaultSubject={(() => {
          if (!budgetTableRow) return "";
          return `Budget Approval Request | Site: ${budgetTableRow["siteid_routeid"] || ""}`;
        })()}
        defaultBody={(() => {
          if (!budgetTableRow) return "";
          return `Hello,\n\nI am requesting budget approval for the following site:\n\n` +
            `Site ID: ${budgetTableRow["siteid_routeid"] || "-"}\n` +
            `Surveyed Length: ${budgetTableRow["ce_length_mtr"] || "-"} mtr\n` +
            `RI Cost: ₹${budgetTableRow["total_ri_amount"] || "-"}\n` +
            `Material Cost: ₹${budgetTableRow["material_cost"] || "-"}\n` +
            `Service Cost: ₹${budgetTableRow["execution_cost_including_hh"] || "-"}\n` +
            `Total Cost: ₹${budgetTableRow["total_cost_without_deposit"] || "-"}\n` +
            `Total Cost Per Meter: ₹${budgetTableRow["total_cost_without_deposit"] && budgetTableRow["ce_length_mtr"] ? (parseFloat(budgetTableRow["total_cost_without_deposit"]) / parseFloat(budgetTableRow["ce_length_mtr"])) .toLocaleString(undefined, { maximumFractionDigits: 2 }) : "-"}/mtr\n\n` +
            `Please review the above budget details and approve as appropriate.\n\nThank you.`;
        })()}
        summaryRow={budgetTableRow || {}}
      />
    </div>
  )
}

// SupabaseQueryTable component
function SupabaseQueryTable({ siteId, onBudgetedCostPerMeter, onBudgetTableRow }: { siteId: string, onBudgetedCostPerMeter?: (v: number|null) => void, onBudgetTableRow?: (row: any) => void }) {
  const [data, setData] = useState<any | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const columns = [
    "siteid_routeid",
    "ce_length_mtr",
    "total_ri_amount",
    "material_cost",
    "execution_cost_including_hh",
    "total_cost_without_deposit",
    "survey_id",
    "existing_new",
  ]

  useEffect(() => {
    setLoading(true)
    setError(null)
    setData(null)
    queryBySiteId(siteId, columns)
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setData(data)
      })
      .catch((err) => setError(err.message || String(err)))
      .finally(() => setLoading(false))
  }, [siteId])

  // If data is an array, use the first element
  const d = Array.isArray(data) ? data[0] : data;
  useEffect(() => {
    if (onBudgetTableRow) {
      onBudgetTableRow(d || null)
    }
    // eslint-disable-next-line
  }, [d])

  // Helper to compute Budgeted Total Cost/Meter
  function getBudgetedCostPerMeter(row: any) {
    if (!row) return null
    const totalCost = parseFloat(row["total_cost_without_deposit"])
    const length = parseFloat(row["ce_length_mtr"])
    if (!isNaN(totalCost) && !isNaN(length) && length > 0) {
      return parseFloat((totalCost / length).toFixed(2))
    }
    return null
  }
  const budgetedCostPerMeter = getBudgetedCostPerMeter(d)

  useEffect(() => {
    if (onBudgetedCostPerMeter) {
      onBudgetedCostPerMeter(typeof budgetedCostPerMeter === 'number' && !isNaN(budgetedCostPerMeter) ? budgetedCostPerMeter : null)
    }
    // eslint-disable-next-line
  }, [budgetedCostPerMeter])

  // Prepare display columns and values
  const displayColumns = [
    "Site ID",
    "Surveyed Length",
    "RI Cost",
    "Material Cost",
    "Service Cost",
    "Total Cost",    
    "Total Cost/Meter",
    "Existing/New",
  ]

  const totalCost = d?.["total_cost_without_deposit"]
  const surveyedLength = d?.["ce_length_mtr"]
  const totalCostPerMeter = (typeof totalCost === 'number' && typeof surveyedLength === 'number' && surveyedLength > 0)
    ? (totalCost / surveyedLength).toFixed(2)
    : "-"

  const displayValues = [
    d?.["siteid_routeid"] || siteId,
    d?.["ce_length_mtr"],
    d?.["total_ri_amount"],
    d?.["material_cost"],
    d?.["execution_cost_including_hh"],
    d?.["total_cost_without_deposit"],
    totalCostPerMeter,
    d?.["existing_new"],
  ]

  return (
    <>
      {loading && <div className="text-slate-400 mt-4">Loading site data...</div>}
      {error && <Alert className="bg-red-950/50 border-red-800 text-red-200 mt-4"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
      {!loading && !error && (!data || (Array.isArray(data) && data.length === 0)) && siteId && (
        <div className="text-red-400 text-sm mt-2">Site ID not found in database.</div>
      )}
      {!loading && !error && data && !(Array.isArray(data) && data.length === 0) && (
        <div className="w-full max-w-none overflow-x-visible rounded-lg border border-slate-700 bg-[#181f2a] mt-2">
          <Table className="w-full text-left max-w-none">
            <TableHeader>
              <TableRow className="border-slate-600">
                {displayColumns.map((col) => (
                  <TableHead key={col} className="text-slate-300 font-sans font-medium text-center px-2 py-2 text-base">{col}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="border-slate-600">
                {displayValues.map((val, idx) => (
                  <TableCell key={idx} className="text-white font-sans text-center px-2 py-2 text-base">{val ?? "-"}</TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </>
  )
}

// ProjectedSavingsCard component
function ProjectedSavingsCard({ budgetedCostPerMeter, actualCostPerMeter }: { budgetedCostPerMeter: number|null, actualCostPerMeter: number|null }) {
  if (typeof budgetedCostPerMeter !== "number" || typeof actualCostPerMeter !== "number") return null
  const savings = budgetedCostPerMeter - actualCostPerMeter
  const isPositive = savings >= 0
  return (
    <div
      className={`w-full md:w-1/2 mx-auto mt-6 rounded-xl p-4 flex flex-col items-center transition-all duration-200
        ${isPositive
          ? "bg-gradient-to-br from-green-400 via-green-600 to-green-500 text-white"
          : "bg-gradient-to-br from-red-400 via-red-600 to-red-500 text-white"}
        backdrop-blur-lg border-none ring-1 ring-white/20 font-inter`}
    >
      <div className="text-base font-semibold font-inter mb-1 flex items-center gap-2">
        Projected Savings per Meter
        {isPositive ? (
          <span className="ml-2 text-white font-inter">▲</span>
        ) : (
          <span className="ml-2 text-white font-inter">▼</span>
        )}
      </div>
      <div className={`text-3xl font-extrabold font-inter ${isPositive ? "text-white" : "text-white"}`}
        style={{ textShadow: '0 1px 3px #000, 0 1px 0 #fff' }}>
        {savings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₹/m
      </div>
      <div className="mt-1 text-white/80 text-xs font-inter">
        (Budgeted: <span className="font-sans text-white/90">{budgetedCostPerMeter}</span> ₹/m &nbsp;|&nbsp; Actual: <span className="font-sans text-white/90">{actualCostPerMeter}</span> ₹/m)
      </div>
    </div>
  )
}

function ProjectedTotalSavingsCard({ totalBudget, budgetedTotal, actualTotal }: { totalBudget: number|null, budgetedTotal: number|null, actualTotal: number|null }) {
  console.log("ProjectedTotalSavingsCard totalBudget:", totalBudget, budgetedTotal, actualTotal);
  if (typeof totalBudget !== "number" || isNaN(totalBudget)) return null;
  const isPositive = totalBudget >= 0;
  return (
    <div
      className={`w-full md:w-1/2 mx-auto mt-6 rounded-xl p-4 flex flex-col items-center transition-all duration-200
        ${isPositive
          ? "bg-gradient-to-br from-green-400 via-green-600 to-green-500 text-white"
          : "bg-gradient-to-br from-red-400 via-red-600 to-red-500 text-white"}
        backdrop-blur-lg border-none ring-1 ring-white/20 font-inter`}
    >
      <div className="text-base font-semibold font-inter mb-1 flex items-center gap-2">
        Projected Savings Against Total Budget
        {isPositive ? (
          <span className="ml-2 text-white font-inter">▲</span>
        ) : (
          <span className="ml-2 text-white font-inter">▼</span>
        )}
      </div>
      <div className="text-3xl font-extrabold font-inter text-white" style={{ textShadow: '0 1px 3px #000, 0 1px 0 #fff' }}>
        {totalBudget.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₹
      </div>
      <div className="mt-1 text-white/80 text-xs font-inter">
        (Budgeted: {budgetedTotal?.toLocaleString(undefined, { maximumFractionDigits: 2 })} ₹ | Actual: {actualTotal?.toLocaleString(undefined, { maximumFractionDigits: 2 })} ₹)
      </div>
    </div>
  );
}

// Reusable analysis table with popups
function AnalysisTableWithPopups({ data, budgetedCostPerMeter }: { data: any[], budgetedCostPerMeter: number | null }) {
  if (!data || data.length === 0) {
    return <div className="text-red-400 text-sm mt-2">No DNs found for this selection.</div>;
  }
  let totalLength = 0, totalCost = 0;
  data.forEach(row => {
    const dnLength = Number(row.dn_length_mtr) || 0;
    const nonRefundable = Number(row.actual_total_non_refundable) || 0;
    const materialsCost = dnLength * 270;
    const serviceCost = dnLength * 1100;
    const rowTotalCost = nonRefundable + materialsCost + serviceCost;
    totalLength += dnLength;
    totalCost += rowTotalCost;
  });
  const totalCostPerMeterCurrent = totalLength > 0 ? totalCost / totalLength : null;
  const totalCostPerMeterBudget = budgetedCostPerMeter;
  const projectedSavingsPerMeter = (typeof totalCostPerMeterBudget === 'number' && typeof totalCostPerMeterCurrent === 'number')
    ? totalCostPerMeterBudget - totalCostPerMeterCurrent
    : null;
  return (
    <>
      <Table className="w-full mx-auto text-xs">
        <TableHeader>
          <TableRow className="border-slate-600">
            <TableHead className="text-slate-300 font-sans font-medium px-2 py-2 text-base">DN Number</TableHead>
            <TableHead className="text-slate-300 font-sans font-medium px-2 py-2 text-base">DN Date</TableHead>
            <TableHead className="text-slate-300 font-sans font-medium px-2 py-2 text-base">DN Length</TableHead>
            <TableHead className="text-slate-300 font-sans font-medium px-2 py-2 text-base">Non Refundable Cost</TableHead>
            <TableHead className="text-slate-300 font-sans font-medium px-2 py-2 text-base">Materials Cost</TableHead>
            <TableHead className="text-slate-300 font-sans font-medium px-2 py-2 text-base">Service Cost</TableHead>
            <TableHead className="text-slate-300 font-sans font-medium px-2 py-2 text-base">Total Cost</TableHead>
            <TableHead className="text-slate-300 font-sans font-medium px-2 py-2 text-base">Total Cost/Meter</TableHead>
            <TableHead className="text-slate-300 font-sans font-medium px-2 py-2 text-base">Proj. Savings/Meter</TableHead>
            <TableHead className="text-slate-300 font-sans font-medium px-2 py-2 text-base">Proj. Savings</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, idx) => {
            const dnLength = Number(row.dn_length_mtr) || 0;
            const nonRefundable = Number(row.actual_total_non_refundable) || 0;
            const materialsCost = dnLength * 270;
            const serviceCost = dnLength * 1100;
            const totalCost = nonRefundable + materialsCost + serviceCost;
            const totalCostPerMeter = dnLength ? totalCost / dnLength : null;
            const projSavingsPerMtr = (typeof totalCostPerMeterBudget === 'number' && typeof totalCostPerMeter === 'number')
              ? totalCostPerMeterBudget - totalCostPerMeter
              : null;
            const projSavings = (typeof projSavingsPerMtr === 'number' && dnLength > 0)
              ? projSavingsPerMtr * dnLength
              : null;
            return (
              <TableRow key={idx} className="border-slate-700 py-3">
                <TableCell className="text-slate-200 font-sans text-sm px-2 py-3">{row.dn_number || "-"}</TableCell>
                <TableCell className="text-slate-200 font-sans text-sm px-2 py-3">{row.dn_received_date ? new Date(row.dn_received_date).toLocaleDateString() : "-"}</TableCell>
                <TableCell className="text-slate-200 font-sans text-sm px-2 py-3">{dnLength || "-"}</TableCell>
                <TableCell className="text-slate-200 font-sans text-sm px-2 py-3">{Number.isFinite(nonRefundable) ? `₹${nonRefundable.toLocaleString()}` : "-"}</TableCell>
                <TableCell className="text-slate-200 font-sans text-sm px-2 py-3">{materialsCost ? `₹${materialsCost.toLocaleString()}` : "-"}</TableCell>
                <TableCell className="text-slate-200 font-sans text-sm px-2 py-3">{serviceCost ? `₹${serviceCost.toLocaleString()}` : "-"}</TableCell>
                <TableCell className="text-slate-200 font-sans text-sm px-2 py-3">{totalCost ? `₹${totalCost.toLocaleString()}` : "-"}</TableCell>
                <TableCell className="text-slate-200 font-sans text-sm px-2 py-3">{totalCostPerMeter ? `₹${totalCostPerMeter.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "-"}</TableCell>
                <TableCell className="text-slate-200 font-sans text-sm px-2 py-3">{projSavingsPerMtr ? `₹${projSavingsPerMtr.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "-"}</TableCell>
                <TableCell className="text-slate-200 font-sans text-sm px-2 py-3">{projSavings ? `₹${projSavings.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "-"}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </>
  );
}