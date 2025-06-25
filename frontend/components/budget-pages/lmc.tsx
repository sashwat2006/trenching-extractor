"use client"
import { useState, useRef } from "react"
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

  const handleDnAnalysis = async () => {
    setAnalysisLoading(true)
    setAnalysisError(null)
    setAnalysisResult(null)

    try {
      // Simulate DN analysis - replace with your actual analysis logic
      await new Promise((resolve) => setTimeout(resolve, 3000))

      // Mock analysis result
      const mockResult = {
        totalDemandNotes: 15,
        totalAmount: 2450000,
        averageAmount: 163333,
        processedSuccessfully: 14,
        errors: 1,
        breakdown: [
          { category: "Material Cost", amount: 980000, percentage: 40 },
          { category: "Labor Cost", amount: 735000, percentage: 30 },
          { category: "Equipment Cost", amount: 490000, percentage: 20 },
          { category: "Other Costs", amount: 245000, percentage: 10 },
        ],
      }

      setAnalysisResult(mockResult)
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

  return (
    <div className="min-h-screen bg-[#1a1f2e] text-slate-100">
      {/* Header */}
      <div className="border-b border-slate-700 bg-[#1a1f2e]">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-white">LMC Budget Approval System</h1>
              <p className="text-slate-400 mt-1">Upload and track your budget data</p>
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

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Upload Section - Split into two columns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LMC Master File Upload */}
          <Card className="bg-[#2a3441] border-slate-600">
            <CardHeader className="border-b border-slate-600">
              <CardTitle className="text-white flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-blue-400" />
                LMC Master File
              </CardTitle>
              <CardDescription className="text-slate-400">
                Upload your LMC Excel file to update budget data
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Upload Area */}
              <div
                className="border-2 border-dashed border-slate-500 rounded-lg p-6 text-center hover:border-slate-400 transition-colors cursor-pointer bg-[#1a1f2e]/50"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                />
                <FileSpreadsheet className="h-10 w-10 text-slate-400 mx-auto mb-3" />
                <h3 className="text-base font-medium text-white mb-2">
                  {file ? "Change Excel File" : "Upload Excel File"}
                </h3>
                <p className="text-slate-400 text-sm">
                  {file ? `Selected: ${file.name}` : "Click to browse or drag & drop"}
                </p>
                <p className="text-slate-500 text-xs mt-1">Supports .xlsx and .xls files</p>
              </div>

              {/* Preview Summary */}
              {preview.length > 0 && (
                <div className="bg-[#1a1f2e] rounded-lg p-4 border border-slate-600">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-300 text-sm font-medium">Data Preview</span>
                    <Badge variant="secondary" className="bg-slate-600 text-slate-200">
                      {preview.length} rows
                    </Badge>
                  </div>
                  <p className="text-slate-400 text-xs">File parsed successfully. Ready for upload.</p>
                </div>
              )}

              {/* Upload Button */}
              <Button
                onClick={handleUpload}
                disabled={uploading || !file || preview.length === 0}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                size="lg"
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Database className="mr-2 h-4 w-4" />
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

          {/* Demand Notes Upload */}
          <Card className="bg-[#2a3441] border-slate-600">
            <CardHeader className="border-b border-slate-600">
              <CardTitle className="text-white flex items-center gap-2">
                <FileText className="h-5 w-5 text-purple-400" />
                Demand Notes
              </CardTitle>
              <CardDescription className="text-slate-400">
                Upload multiple PDF demand notes for processing
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Upload Area */}
              <div
                className="border-2 border-dashed border-slate-500 rounded-lg p-6 text-center hover:border-slate-400 transition-colors cursor-pointer bg-[#1a1f2e]/50"
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
                <FileText className="h-10 w-10 text-slate-400 mx-auto mb-3" />
                <h3 className="text-base font-medium text-white mb-2">Upload Demand Notes</h3>
                <p className="text-slate-400 text-sm">Click to browse or drag & drop multiple PDFs</p>
                <p className="text-slate-500 text-xs mt-1">Only PDF files are supported</p>
              </div>

              {/* PDF Files List */}
              {pdfFiles.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300 text-sm font-medium">Selected Files ({pdfFiles.length})</span>
                    <Button
                      onClick={clearAllPdfs}
                      variant="ghost"
                      size="sm"
                      className="text-slate-400 hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Clear All
                    </Button>
                  </div>

                  <div className="bg-[#1a1f2e] rounded-lg border border-slate-600 max-h-40 overflow-y-auto">
                    {pdfFiles.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 border-b border-slate-700 last:border-b-0"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <FileText className="h-4 w-4 text-purple-400 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-slate-200 text-sm truncate">{file.name}</p>
                            <p className="text-slate-500 text-xs">{formatFileSize(file.size)}</p>
                          </div>
                        </div>
                        <Button
                          onClick={() => removePdfFile(index)}
                          variant="ghost"
                          size="sm"
                          className="text-slate-400 hover:text-red-400 flex-shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Upload Button */}
              <Button
                onClick={handlePdfUpload}
                disabled={pdfUploading || pdfFiles.length === 0}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                size="lg"
              >
                {pdfUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading PDFs...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload {pdfFiles.length > 0 ? `${pdfFiles.length} ` : ""}Demand Notes
                  </>
                )}
              </Button>

              {/* Status Messages */}
              {pdfError && (
                <Alert className="bg-red-950/50 border-red-800 text-red-200">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{pdfError}</AlertDescription>
                </Alert>
              )}

              {pdfSuccess && (
                <Alert className="bg-green-950/50 border-green-800 text-green-200">
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>{pdfSuccess}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Data Preview Section - Only show when Excel file is uploaded */}
        {preview.length > 0 && (
          <Card className="bg-[#2a3441] border-slate-600">
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

        {/* DN Budget Analysis - Full Width */}
        <Card className="bg-[#2a3441] border-slate-600">
          <CardHeader className="border-b border-slate-600">
            <CardTitle className="text-white flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-orange-400" />
              Perform DN Budget Analysis
            </CardTitle>
            <CardDescription className="text-slate-400">
              Analyze uploaded demand notes and extract budget information using AI-powered processing
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Brain className="h-8 w-8 text-orange-400" />
                <div>
                  <p className="text-slate-300 font-medium">AI-Powered Document Analysis</p>
                  <p className="text-slate-400 text-sm">
                    Parse and analyze all uploaded demand notes to extract budget information
                  </p>
                </div>
              </div>
              <Button
                onClick={handleDnAnalysis}
                disabled={analysisLoading}
                className="bg-orange-600 hover:bg-orange-700 text-white"
                size="lg"
              >
                {analysisLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Brain className="mr-2 h-4 w-4" />
                    Parse Demand Notes
                  </>
                )}
              </Button>
            </div>

            {analysisError && (
              <Alert className="bg-red-950/50 border-red-800 text-red-200">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{analysisError}</AlertDescription>
              </Alert>
            )}

            {analysisResult && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-white">Analysis Results</h3>
                  <Badge variant="secondary" className="bg-orange-600 text-white">
                    Analysis Complete
                  </Badge>
                </div>

                {/* Summary Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-[#1a1f2e] rounded-lg p-4 border border-slate-600">
                    <p className="text-slate-400 text-sm font-medium">Total Notes</p>
                    <p className="text-white text-3xl font-bold mt-1">{analysisResult.totalDemandNotes}</p>
                  </div>
                  <div className="bg-[#1a1f2e] rounded-lg p-4 border border-slate-600">
                    <p className="text-slate-400 text-sm font-medium">Total Amount</p>
                    <p className="text-white text-3xl font-bold mt-1">{formatCurrency(analysisResult.totalAmount)}</p>
                  </div>
                  <div className="bg-[#1a1f2e] rounded-lg p-4 border border-slate-600">
                    <p className="text-slate-400 text-sm font-medium">Processed</p>
                    <p className="text-green-400 text-3xl font-bold mt-1">{analysisResult.processedSuccessfully}</p>
                  </div>
                  <div className="bg-[#1a1f2e] rounded-lg p-4 border border-slate-600">
                    <p className="text-slate-400 text-sm font-medium">Errors</p>
                    <p className="text-red-400 text-3xl font-bold mt-1">{analysisResult.errors}</p>
                  </div>
                </div>

                {/* Cost Breakdown Table */}
                <div className="bg-[#1a1f2e] rounded-lg border border-slate-600 overflow-hidden">
                  <div className="p-4 border-b border-slate-600">
                    <h4 className="text-white font-semibold">Cost Breakdown Analysis</h4>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-600">
                        <TableHead className="text-slate-300 font-medium">Category</TableHead>
                        <TableHead className="text-slate-300 font-medium text-right">Amount</TableHead>
                        <TableHead className="text-slate-300 font-medium text-center">Percentage</TableHead>
                        <TableHead className="text-slate-300 font-medium text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analysisResult.breakdown.map((item: any, index: number) => (
                        <TableRow key={index} className="border-slate-600">
                          <TableCell className="text-slate-200 font-medium">{item.category}</TableCell>
                          <TableCell className="text-white font-mono text-right text-lg">
                            {formatCurrency(item.amount)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="text-slate-200">
                              {item.percentage}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary" className="bg-green-600 text-white">
                              Extracted
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Query Budget Data - Full Width */}
        <Card className="bg-[#2a3441] border-slate-600">
          <CardHeader className="border-b border-slate-600">
            <CardTitle className="text-white flex items-center gap-2">
              <Search className="h-5 w-5 text-green-400" />
              Query Budget Data
            </CardTitle>
            <CardDescription className="text-slate-400">
              Search for budget information by Site ID from the LMC master database
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="flex items-center gap-4">
              <div className="flex-1 max-w-md">
                <Label htmlFor="siteId" className="text-slate-300 font-medium">
                  Site ID
                </Label>
                <Input
                  id="siteId"
                  type="text"
                  value={siteId}
                  onChange={(e) => setSiteId(e.target.value)}
                  placeholder="Enter Site ID to search"
                  className="bg-[#1a1f2e] border-slate-500 text-white placeholder:text-slate-500 font-mono mt-2"
                />
              </div>
              <Button
                onClick={handleQuery}
                disabled={queryLoading || !siteId.trim()}
                className="bg-green-600 hover:bg-green-700 text-white mt-7"
                size="lg"
              >
                {queryLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Search Budget
                  </>
                )}
              </Button>
            </div>

            {queryError && (
              <Alert className="bg-red-950/50 border-red-800 text-red-200">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{queryError}</AlertDescription>
              </Alert>
            )}

            {queryResult && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-white">Budget Query Results</h3>
                  <Badge variant="secondary" className="bg-green-600 text-white">
                    Site ID: {siteId}
                  </Badge>
                </div>

                <div className="bg-[#1a1f2e] rounded-lg border border-slate-600 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-600">
                        {queryColumns.map((col) => (
                          <TableHead key={col} className="text-slate-300 font-medium text-center">
                            {col}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow className="border-slate-600">
                        {queryColumns.map((col) => (
                          <TableCell key={col} className="text-white font-mono text-center text-xl font-bold">
                            {formatNumber(queryResult[col])}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}