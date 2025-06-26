"use client"
import { useState, useRef, useEffect } from "react"
import type React from "react"

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
} from "lucide-react"
import { parseAndCleanExcel, uploadToSupabase, queryBySiteId, type BudgetData } from "@/lib/lmcLogic"
import { authorities } from "@/constants/authorities"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import CostBreakdownStackedBar from "./CostBreakdownStackedBar"
import PremiumBudgetChart from "./PremiumBudgetChart"
import GenerateEmailDraftModal from "@/components/email/GenerateEmailDraftModal"

const queryColumns = [
  "Total RI Amount",
  "Material Cost",
  "Execution Cost  including HH",
  "Total Cost (Without Deposit)",
]

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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)
    setSuccess(null)
    const f = e.target.files?.[0] || null
    setFile(f)
    if (f) {
      try {
        const cleaned = await parseAndCleanExcel(f)
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
      const { error: supabaseError } = await uploadToSupabase(preview)
      if (supabaseError) {
        setError("Supabase error: " + supabaseError.message + " (" + supabaseError.details + ")")
        return
      }
      setSuccess("LMC Master File updated successfully!")
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

  return (
    <div className="min-h-screen bg-[#1a1f2e] text-slate-100">
      {/* Header */}
      <div className="border-b border-slate-700 bg-[#1a1f2e]">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-white">LMC Budget Approval System</h1>
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
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 bg-[#2a3441] border border-slate-600">
            <TabsTrigger
              value="upload"
              className="flex items-center gap-2 data-[state=active]:bg-[#1a1f2e] data-[state=active]:text-white"
            >
              Upload & Manage
            </TabsTrigger>
            <TabsTrigger
              value="analysis"
              className="flex items-center gap-2 data-[state=active]:bg-[#1a1f2e] data-[state=active]:text-white"
            >
              Budget Analysis
            </TabsTrigger>
          </TabsList>

          {/* Upload & Manage Tab */}
          <TabsContent value="upload" className="space-y-8">
            {/* Upload Section - Only LMC Master File Upload */}
            <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
              {/* LMC Master File Upload */}
              <Card className="bg-[#232a3a] border border-slate-700 shadow-lg">
                <CardHeader className="border-b border-slate-600">
                  <CardTitle className="text-white flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5 text-orange-400" />
                    LMC Master File
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    Upload your LMC Excel file to update budget data
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  {/* Upload Area */}
                  <div
                    className="border-2 border-dashed border-orange-400 rounded-lg p-6 text-center hover:border-orange-500 focus-within:border-orange-500 transition-colors cursor-pointer bg-orange-900/20"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <FileSpreadsheet className="h-10 w-10 text-orange-400 mx-auto mb-3" />
                    <h3 className="text-base font-medium text-white mb-2">
                      {file ? "Change Excel File" : "Upload Excel File"}
                    </h3>
                    <p className="text-orange-400 text-xs mt-1">Supports .xlsx and .xls files</p>
                  </div>

                  {/* Upload Button */}
                  <Button
                    onClick={handleUpload}
                    disabled={uploading || !file || preview.length === 0}
                    className="w-full bg-gradient-to-r from-orange-400 to-orange-600 hover:from-orange-500 hover:to-orange-700 text-white font-semibold"
                    size="lg"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Database className="mr-2 h-4 w-4 text-orange-400" />
                        Upload to Database
                      </>
                    )}
                  </Button>

                  {/* Status Messages */}
                  {error && (
                    <Alert className="bg-red-950/50 border-red-800 text-red-200">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  {success && (
                    <Alert className="bg-green-950/50 border-green-800 text-green-200">
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription>{success}</AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </div>

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
                              <TableCell key={j} className="text-slate-200 font-mono text-sm">
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
          </TabsContent>

          {/* Budget Analysis Tab */}
          <TabsContent value="analysis" className="space-y-8">
            {/* DN Budget Analysis (with Demand Notes upload UI inside) */}
            <Card className="bg-[#232a3a] border-slate-700 shadow-xl rounded-2xl backdrop-blur-md">
              <CardHeader className="border-b border-slate-700 pb-4">
                <CardTitle className="text-white flex items-center gap-2 text-2xl font-semibold tracking-tight">
                  <BarChart3 className="h-6 w-6 text-orange-400" />
                   Demand Note Budget Analysis
                </CardTitle>
                <CardDescription className="text-slate-400 mt-1 text-base">
                  Analyze uploaded demand notes and extract budget information using AI-powered processing
                </CardDescription>
              </CardHeader>
              <CardContent className="p-8 space-y-8">
                {/* Two-column layout for upload and site ID */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Left: Authority and PDF upload */}
                  <div className="space-y-6 bg-[#1a1f2e]/60 rounded-xl p-6 border border-slate-700">
                    {/* Authority Dropdown */}
                    <div>
                      <Label className="text-slate-300 font-medium mb-2 block text-lg">
                        Select Authority
                      </Label>
                      <Select value={selectedAuthority} onValueChange={setSelectedAuthority}>
                        <SelectTrigger className="w-full bg-[#232a3a] border border-slate-600 text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-orange-500 transition-all">
                          <SelectValue placeholder="-- Choose Authority --" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#232a3a] border border-slate-600 text-white rounded-lg">
                          {authorities.map((auth) => (
                            <SelectItem key={auth.id} value={auth.id}>
                              {auth.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Upload Area */}
                    <div
                      className="border-2 border-dashed border-slate-600 rounded-xl p-6 text-center hover:border-orange-400 transition-colors cursor-pointer bg-[#232a3a]/60"
                      onClick={() => pdfInputRef.current?.click()}
                    >
                      <input
                        type="file"
                        accept=".pdf"
                        multiple
                        ref={pdfInputRef}
                        onChange={handlePdfChange}
                        className="hidden"
                      />
                      <FileText className="h-10 w-10 text-orange-400 mx-auto mb-3" />
                      <h3 className="text-base font-semibold text-white mb-1">Upload Demand Notes</h3>
                      <p className="text-slate-400 text-sm">Click to browse or drag & drop multiple PDFs</p>
                      <p className="text-slate-500 text-xs mt-1">Only PDF files are supported</p>
                    </div>

                    {/* PDF Files List */}
                    {pdfFiles.length > 0 && (
                      <div className="space-y-2 mt-2 bg-[#232a3a]/80 rounded-lg p-3 border border-slate-700">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-slate-300 text-sm font-medium">Selected Files ({pdfFiles.length})</span>
                          <Button
                            onClick={clearAllPdfs}
                            variant="ghost"
                            size="sm"
                            className="text-slate-400 hover:text-red-400 px-2 py-1"
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Clear All
                          </Button>
                        </div>
                        <div className="divide-y divide-slate-700 max-h-32 overflow-y-auto">
                          {pdfFiles.map((file, index) => (
                            <div
                              key={index}
                              className="flex items-center justify-between py-2 first:pt-0 last:pb-0"
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <FileText className="h-4 w-4 text-orange-400 flex-shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <p className="text-slate-200 text-sm truncate font-mono">{file.name}</p>
                                  <p className="text-slate-500 text-xs">{formatFileSize(file.size)}</p>
                                </div>
                              </div>
                              <Button
                                onClick={() => removePdfFile(index)}
                                variant="ghost"
                                size="sm"
                                className="text-slate-400 hover:text-red-400 flex-shrink-0 px-2"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Status Messages */}
                    {pdfError && (
                      <Alert className="bg-red-950/50 border-red-800 text-red-200 mt-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{pdfError}</AlertDescription>
                      </Alert>
                    )}
                  </div>

                  {/* Right: Site ID input */}
                  <div className="space-y-6 bg-[#1a1f2e]/60 rounded-xl p-6 border border-slate-700 flex flex-col justify-between">
                    <div>
                      <h4 className="text-white text-lg font-semibold mb-4">Site ID <span className="text-red-400">*</span></h4>
                      <Input
                        id="siteId"
                        type="text"
                        value={siteId}
                        onChange={(e) => setSiteId(e.target.value)}
                        placeholder="Enter Site ID"
                        required
                        className="bg-[#232a3a] border border-slate-600 text-white placeholder:text-slate-500 font-mono px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Parse Demand Notes button below both columns */}
                <div className="flex justify-center mt-10">
                  <Button
                    onClick={() => handleDnAnalysis(selectedAuthority)}
                    disabled={analysisLoading || !selectedAuthority || pdfFiles.length === 0 || !siteId.trim()}
                    className="bg-gradient-to-r from-orange-500 to-orange-700 hover:from-orange-600 hover:to-orange-800 text-white px-10 py-4 text-lg font-bold rounded-xl shadow-lg transition-all duration-150"
                    size="lg"
                  >
                    {analysisLoading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Brain className="mr-2 h-5 w-5" />
                        Perform Budget Analysis
                      </>
                    )}
                  </Button>
                </div>

                {analysisError && (
                  <Alert className="bg-red-950/50 border-red-800 text-red-200 mt-6">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{analysisError}</AlertDescription>
                  </Alert>
                )}

                {analysisResult && (
                  <div className="space-y-6 mt-8">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-semibold text-white">Analysis Results</h3>
                      <Badge variant="secondary" className="bg-orange-600 text-white">
                        Analysis Complete
                      </Badge>
                    </div>

                    {selectedAuthority === "mcgm" && Array.isArray(analysisResult.results) && (
                      <div className="bg-[#1a1f2e] rounded-lg border border-slate-600 overflow-hidden mt-4 p-6">
                        <h3 className="text-2xl font-bold text-white mb-2">Cost Table</h3>
                        <Table>
                          <TableHeader>
                            <TableRow className="border-slate-600">
                              <TableHead className="text-slate-300 font-medium text-center px-2 py-2 text-base">DN</TableHead>
                              <TableHead className="text-slate-300 font-medium text-center px-2 py-2 text-base">Section Length</TableHead>
                              <TableHead className="text-slate-300 font-medium text-center px-2 py-2 text-base">RI Cost</TableHead>
                              <TableHead className="text-slate-300 font-medium text-center px-2 py-2 text-base">Material Cost</TableHead>
                              <TableHead className="text-slate-300 font-medium text-center px-2 py-2 text-base">Service Cost</TableHead>
                              <TableHead className="text-slate-300 font-medium text-center px-2 py-2 text-base">Total Cost</TableHead>
                              <TableHead className="text-slate-300 font-medium text-center px-2 py-2 text-base">Total Cost Per Meter</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {analysisResult.results.map((item: any, idx: number) => {
                              // Calculate Projected Actual per meter cost
                              let projectedCost = "-"
                              const ri = parseFloat(item.ri_cost)
                              const sl = parseFloat(item.section_length)
                              if (!isNaN(ri) && !isNaN(sl) && sl > 0) {
                                projectedCost = (ri / sl).toFixed(2)
                              }
                              // Calculate Material and Service Costs
                              const materialCost = !isNaN(sl) ? (sl * 270) : 0
                              const serviceCost = !isNaN(sl) ? (sl * 1100) : 0
                              const totalCost = (!isNaN(ri) ? ri : 0) + materialCost + serviceCost
                              const totalPerMeterCost = (totalCost && sl) ? (totalCost / sl).toFixed(2) : "-"
                              return (
                                <TableRow key={idx} className="border-slate-600">
                                  <TableCell className="text-white font-mono text-center px-2 py-2 text-base">{item.demand_note_reference ?? '-'}</TableCell>
                                  <TableCell className="text-white font-mono text-center px-2 py-2 text-base">{item.section_length ?? "-"}</TableCell>
                                  <TableCell className="text-white font-mono text-center px-2 py-2 text-base">{item.ri_cost ?? "-"}</TableCell>
                                  <TableCell className="text-white font-mono text-center px-2 py-2 text-base">{materialCost ? materialCost.toLocaleString() : "-"}</TableCell>
                                  <TableCell className="text-white font-mono text-center px-2 py-2 text-base">{serviceCost ? serviceCost.toLocaleString() : "-"}</TableCell>
                                  <TableCell className="text-white font-mono text-center px-2 py-2 text-base">{totalCost ? totalCost.toLocaleString() : "-"}</TableCell>
                                  <TableCell className="text-white font-mono text-center px-2 py-2 text-base">{totalPerMeterCost}</TableCell>
                                </TableRow>
                              )})}
                              {/* Summary Row */}
                              {(() => {
                                // Sum section_length and ri_cost, handling non-numeric gracefully
                                let totalSectionLength: number = 0
                                let totalRiCost = 0
                                let totalMaterialCost = 0
                                let totalServiceCost = 0
                                let totalTotalCost = 0
                                let totalProjectedCost = "-"
                                analysisResult.results.forEach((item: any) => {
                                  const sl = parseFloat(item.section_length)
                                  if (!isNaN(sl)) {
                                    totalSectionLength += sl
                                    totalMaterialCost += sl * 270
                                    totalServiceCost += sl * 1100
                                    totalTotalCost += (parseFloat(item.ri_cost) || 0) + (sl * 270) + (sl * 1100)
                                  }
                                  const ri = parseFloat(item.ri_cost)
                                  if (!isNaN(ri)) {
                                    totalRiCost += ri
                                  }
                                })
                                if (totalSectionLength > 0) {
                                  totalProjectedCost = (totalRiCost / totalSectionLength).toFixed(2)
                                }
                                let totalPerMeterCostSummary = "-"
                                if (totalTotalCost > 0 && totalSectionLength > 0) {
                                  totalPerMeterCostSummary = (totalTotalCost / totalSectionLength).toFixed(2)
                                }
                                return (
                                  <TableRow className="border-slate-600 font-bold bg-[#232a3a]">
                                    <TableCell className="text-white font-mono text-center px-2 py-2 text-base">Total</TableCell>
                                    <TableCell className="text-white font-mono text-center px-2 py-2 text-base">{totalSectionLength}</TableCell>
                                    <TableCell className="text-white font-mono text-center px-2 py-2 text-base">{totalRiCost}</TableCell>
                                    <TableCell className="text-white font-mono text-center px-2 py-2 text-base">{totalMaterialCost.toLocaleString()}</TableCell>
                                    <TableCell className="text-white font-mono text-center px-2 py-2 text-base">{totalServiceCost.toLocaleString()}</TableCell>
                                    <TableCell className="text-white font-mono text-center px-2 py-2 text-base">{totalTotalCost.toLocaleString()}</TableCell>
                                    <TableCell className="text-white font-mono text-center px-2 py-2 text-base">{totalPerMeterCostSummary}</TableCell>
                                  </TableRow>
                                )
                              })()}
                          </TableBody>
                        </Table>
                      </div>
                    )}

                    {/* Fallback for other authorities */}
                    {selectedAuthority !== "mcgm" && Array.isArray(analysisResult.results) && (
                      <div className="bg-[#1a1f2e] rounded-lg border border-slate-600 overflow-hidden mt-4">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-slate-600">
                              <TableHead className="text-slate-300 font-medium">Filename</TableHead>
                              <TableHead className="text-slate-300 font-medium">Result</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {analysisResult.results.map((item: any, idx: number) => (
                              <TableRow key={idx} className="border-slate-600">
                                <TableCell className="text-slate-200">{item.filename}</TableCell>
                                <TableCell className="text-slate-200">{item.parsed || item.error || "-"}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}

                    {/* Supabase Query Table for Site ID */}
                    {siteId && (
                      <div className="mt-10 bg-[#1a1f2e] rounded-lg border border-slate-600 overflow-hidden p-6">
                        <h3 className="text-2xl font-bold text-white mb-2">Budget Table</h3>
                        <SupabaseQueryTable siteId={siteId} onBudgetedCostPerMeter={setBudgetedCostPerMeter} onBudgetTableRow={setBudgetTableRow} />
                      </div>
                    )}

                    {/* Projected Savings Cards Row */}
                    <div className="flex flex-col md:flex-row gap-6 justify-center items-stretch w-full">
                      <ProjectedSavingsCard
                        budgetedCostPerMeter={(() => {
                          // Get Total Cost (Without Deposit) and CE-Length-Mtr from budget table row
                          if (budgetTableRow && budgetTableRow["Total Cost (Without Deposit)"] && budgetTableRow["CE-Length-Mtr"]) {
                            const totalCost = parseFloat(budgetTableRow["Total Cost (Without Deposit)"])
                            const length = parseFloat(budgetTableRow["CE-Length-Mtr"])
                            if (!isNaN(totalCost) && !isNaN(length) && length > 0) {
                              return parseFloat((totalCost / length).toFixed(2))
                            }
                          }
                          return null
                        })()}
                        actualCostPerMeter={(() => {
                          // Get total actual cost and section length from summary row of PDF table
                          if (selectedAuthority === "mcgm" && Array.isArray(analysisResult?.results)) {
                            let totalSectionLength: number = 0
                            let totalActualCost = 0
                            analysisResult.results.forEach((item: any) => {
                              const sl = parseFloat(item.section_length)
                              if (!isNaN(sl)) totalSectionLength += sl
                              const ri = parseFloat(item.ri_cost)
                              const material = !isNaN(sl) ? sl * 270 : 0
                              const service = !isNaN(sl) ? sl * 1100 : 0
                              if (!isNaN(ri)) totalActualCost += ri + material + service
                            })
                            if (totalSectionLength > 0) {
                              return parseFloat((totalActualCost / totalSectionLength).toFixed(2))
                            }
                          }
                          return null
                        })()}
                      />
                      <ProjectedTotalSavingsCard
                        totalBudget={(() => {
                          // Projected savings per meter * total section length
                          let savingsPerMeter = null;
                          let budgetedPerMeter: number = 0;
                          let actualPerMeter = null;
                          let totalSectionLength: number = 0;
                          let budgetedTotal = null;
                          let actualTotal = null;
                          if (
                            budgetTableRow &&
                            budgetTableRow["Total Cost (Without Deposit)"] &&
                            budgetTableRow["CE-Length-Mtr"] &&
                            Array.isArray(analysisResult?.results)
                          ) {
                            const totalCost = parseFloat(budgetTableRow["Total Cost (Without Deposit)"]);
                            const length = parseFloat(budgetTableRow["CE-Length-Mtr"]);
                            totalSectionLength = 0;
                            analysisResult.results.forEach((item: any) => {
                              const sl = parseFloat(item.section_length);
                              if (!isNaN(sl)) totalSectionLength += sl;
                            });
                            if (!isNaN(totalCost) && !isNaN(length) && length > 0 && totalSectionLength > 0) {
                              budgetedPerMeter = totalCost / length;
                              budgetedTotal = budgetedPerMeter * totalSectionLength;
                            }
                            // Actual total
                            let totalActualCost = 0;
                            let totalActualSectionLength = 0;
                            let totalActualPerMeter = null;
                            analysisResult.results.forEach((item: any) => {
                              const sl = parseFloat(item.section_length);
                              const ri = parseFloat(item.ri_cost);
                              const material = !isNaN(sl) ? sl * 270 : 0;
                              const service = !isNaN(sl) ? sl * 1100 : 0;
                              if (!isNaN(sl)) totalActualSectionLength += sl;
                              if (!isNaN(ri)) totalActualCost += ri + material + service;
                            });
                            if (totalActualSectionLength > 0) {
                              actualPerMeter = parseFloat((totalActualCost / totalActualSectionLength).toFixed(2));
                              savingsPerMeter = budgetedPerMeter - actualPerMeter;
                              actualTotal = totalActualCost;
                              console.log({ budgetedPerMeter, actualPerMeter, savingsPerMeter, totalSectionLength, budgetedTotal, actualTotal });
                              return parseFloat((savingsPerMeter * totalSectionLength).toFixed(2));
                            }
                          }
                          console.log({ budgetedPerMeter, actualPerMeter, savingsPerMeter, totalSectionLength, budgetedTotal, actualTotal });
                          return null;
                        })()}
                        budgetedTotal={(() => {
                          if (
                            budgetTableRow &&
                            budgetTableRow["Total Cost (Without Deposit)"] &&
                            budgetTableRow["CE-Length-Mtr"] &&
                            Array.isArray(analysisResult?.results)
                          ) {
                            const totalCost = parseFloat(budgetTableRow["Total Cost (Without Deposit)"]);
                            const length = parseFloat(budgetTableRow["CE-Length-Mtr"]);
                            let totalSectionLength = 0;
                            analysisResult.results.forEach((item: any) => {
                              const sl = parseFloat(item.section_length);
                              if (!isNaN(sl)) totalSectionLength += sl;
                            });
                            if (!isNaN(totalCost) && !isNaN(length) && length > 0 && totalSectionLength > 0) {
                              const budgetedPerMeter = totalCost / length;
                              return budgetedPerMeter * totalSectionLength;
                            }
                          }
                          return null;
                        })()}
                        actualTotal={(() => {
                          if (selectedAuthority === "mcgm" && Array.isArray(analysisResult?.results)) {
                            let totalActualCost = 0;
                            analysisResult.results.forEach((item: any) => {
                              const sl = parseFloat(item.section_length);
                              const ri = parseFloat(item.ri_cost);
                              const material = !isNaN(sl) ? sl * 270 : 0;
                              const service = !isNaN(sl) ? sl * 1100 : 0;
                              if (!isNaN(ri)) totalActualCost += ri + material + service;
                            });
                            return totalActualCost;
                          }
                          return null;
                        })()}
                      />
                    </div>
                    {/* Generate Budget Approval Request Button */}
                    <div className="flex justify-center mt-8">
                      <Button
                        className="w-full max-w-xs bg-white hover:bg-gray-100 text-[#1d2636] font-inter font-semibold tracking-tight text-[15px] rounded-lg border border-[#232f47] flex items-center gap-2 shadow-sm px-4 py-2.5 transition-colors justify-center"
                        onClick={() => setShowBudgetApprovalModal(true)}
                      >
                        <svg className="text-black text-lg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M4 4h16v16H4z"/><path d="M9 9h6v6H9z"/></svg>
                        Generate Budget Approval Request
                      </Button>
                    </div>
                    {/* Show the PremiumBudgetChart again */}
                    {(() => {
                      if (!budgetTableRow || !Array.isArray(analysisResult?.results) || !siteId) return null;
                      // Budgeted values from Supabase
                      const budgeted = {
                        RI: parseFloat(budgetTableRow["Total RI Amount"]) || 0,
                        Material: parseFloat(budgetTableRow["Material Cost"]) || 0,
                        Service: parseFloat(budgetTableRow["Execution Cost  including HH"]) || 0,
                      };
                      // Actual values from cost table (sum across all DNs for this site)
                      let actualRI = 0, actualMaterial = 0, actualService = 0;
                      analysisResult.results.forEach((item: any) => {
                        const sl = parseFloat(item.section_length);
                        const ri = parseFloat(item.ri_cost);
                        if (!isNaN(ri)) actualRI += ri;
                        if (!isNaN(sl)) {
                          actualMaterial += sl * 270;
                          actualService += sl * 1100;
                        }
                      });
                      const actual = {
                        RI: actualRI,
                        Material: actualMaterial,
                        Service: actualService,
                      };
                      return <PremiumBudgetChart siteData={{ SiteID: siteId, budgeted, actual }} />;
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      <GenerateEmailDraftModal
        open={showBudgetApprovalModal}
        onClose={() => setShowBudgetApprovalModal(false)}
        defaultSubject={(() => {
          if (!budgetTableRow) return "";
          return `Budget Approval Request for Site: ${budgetTableRow["SiteID"] || ""}`;
        })()}
        defaultBody={(() => {
          if (!budgetTableRow) return "";
          return `Hello,\n\nI am requesting budget approval for Site: ${budgetTableRow["SiteID"] || ""}. Please review the attached budget details and approve as appropriate.`;
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
    "SiteID",
    "CE-Length-Mtr",
    "Total RI Amount",
    "Material Cost",
    "Execution Cost  including HH",
    "Total Cost (Without Deposit)",
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
    const totalCost = parseFloat(row["Total Cost (Without Deposit)"])
    const length = parseFloat(row["CE-Length-Mtr"])
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
    "Total Cost Per Meter",
  ]

  const totalCost = d?.["Total Cost (Without Deposit)"]
  const surveyedLength = d?.["CE-Length-Mtr"]
  const totalCostPerMeter = (typeof totalCost === 'number' && typeof surveyedLength === 'number' && surveyedLength > 0)
    ? (totalCost / surveyedLength).toFixed(2)
    : "-"

  const displayValues = [
    d?.["SiteID"] || siteId,
    d?.["CE-Length-Mtr"],
    d?.["Total RI Amount"],
    d?.["Material Cost"],
    d?.["Execution Cost  including HH"],
    d?.["Total Cost (Without Deposit)"],
    totalCostPerMeter,
  ]

  return (
    <>
      {loading && <div className="text-slate-400 mt-4">Loading site data...</div>}
      {error && <Alert className="bg-red-950/50 border-red-800 text-red-200 mt-4"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
      {!loading && !error && (!data || (Array.isArray(data) && data.length === 0)) && siteId && (
        <div className="text-red-400 text-sm mt-2">Site ID not found in database.</div>
      )}
      {!loading && !error && data && !(Array.isArray(data) && data.length === 0) && (
        <Table>
          <TableHeader>
            <TableRow className="border-slate-600">
              {displayColumns.map((col) => (
                <TableHead key={col} className="text-slate-300 font-medium text-center px-2 py-2 text-base">{col}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow className="border-slate-600">
              {displayValues.map((val, idx) => (
                <TableCell key={idx} className="text-white font-mono text-center px-2 py-2 text-base">{val ?? "-"}</TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
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
        (Budgeted: <span className="font-mono text-white/90">{budgetedCostPerMeter}</span> ₹/m &nbsp;|&nbsp; Actual: <span className="font-mono text-white/90">{actualCostPerMeter}</span> ₹/m)
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