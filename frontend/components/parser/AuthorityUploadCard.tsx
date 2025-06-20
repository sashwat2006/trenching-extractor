"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input as UITextInput } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FileText, Loader2, Sparkles } from "lucide-react";
import type { AuthorityConfig } from "@/types";
// Update the import to match the actual exports from useFileProcessing
import { processNonRefundableWithBackend, processSDWithBackend } from "@/hooks/useFileProcessing";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface AuthorityUploadCardProps {
  authority: AuthorityConfig;
  files: File[];
  isProcessing: boolean;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onStartProcessing: () => void;
}

export function AuthorityUploadCard({
  authority,
  files,
  isProcessing,
  onFileUpload,
  onStartProcessing,
}: AuthorityUploadCardProps) {
  // Blue-highlighted fields for MCGM (Non-Refundable)
  const blueHeadersNonRefund = [
    "LM/BB/FTTH", "GO RATE", "Total Route (MTR)", "Not part of capping (License Fee/Rental Payment /Way Leave charges etc.)",
    "REASON FOR DELAY (>2 DAYS)", "PO No.", "Route Name(As per CWIP)", "Section Name for ROW(As per CWIP)"
  ];
  // Blue-highlighted fields for MCGM (SD Output)
  const blueHeadersSD = [
    "Execution Partner GBPA PO No.", "Partner PO circle", "Unique route id", "NFA no."
  ];
  // Only show manual fields for MCGM
  const showManualFields = authority.id === "mcgm";
  const [manualFieldsNonRefund, setManualFieldsNonRefund] = useState<{ [key: string]: string }>({});
  const [manualFieldsSD, setManualFieldsSD] = useState<{ [key: string]: string }>({});
  const [showManualFieldsState, setShowManualFieldsState] = useState(false);
  const [parsedFile, setParsedFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [previewNonRefund, setPreviewNonRefund] = useState<any[] | null>(null);
  const [previewSD, setPreviewSD] = useState<any[] | null>(null);

  // Dummy preview data for Non-Refundable and SD outputs
  const previewDataNonRefund = [
    {
      "Demand Note No.": "783339212",
      "LM/BB/FTTH": manualFieldsNonRefund["LM/BB/FTTH"] || "Airtel",
      "GO RATE": manualFieldsNonRefund["GO RATE"] || "Yes",
      "Total Route (MTR)": manualFieldsNonRefund["Total Route (MTR)"] || "375",
      // ... add more columns as needed ...
    },
  ];
  const previewDataSD = [
    {
      "Demand Note No.": "783339212",
      "Execution Partner GBPA PO No.": manualFieldsSD["Execution Partner GBPA PO No."] || "PO1234",
      "Partner PO circle": manualFieldsSD["Partner PO circle"] || "Circle1",
      "Unique route id": manualFieldsSD["Unique route id"] || "URID001",
      // ... add more columns as needed ...
    },
  ];

  // Helper to render a preview table
  const renderPreviewTable = (data: any[], title?: string, compactHeaders: boolean = false) => {
    if (!data || data.length === 0) return null;
    const chopHeader = (header: string) => {
      if (!compactHeaders) return header;
      if (header.length > 12) return header.slice(0, 10) + '…';
      return header;
    };
    return (
      <div className="w-full overflow-x-auto hide-scrollbar">
        <table className="min-w-full text-[12px] text-left text-white table-fixed font-inter rounded-lg">
          <thead>
            <tr>
              {Object.keys(data[0] || {}).map((header) => (
                <th
                  key={header}
                  title={compactHeaders && header.length > 12 ? header : undefined}
                  className="px-2 py-1 bg-[#232f47] text-white font-medium border-b border-[#232f47] whitespace-normal font-inter tracking-tight rounded-t"
                  style={{ wordBreak: 'normal', whiteSpace: 'normal', fontSize: '12px', height: '20px', lineHeight: '1.1', letterSpacing: '0em', minWidth: '80px' }}
                >
                  {chopHeader(header)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr
                key={i}
                className={
                  (i % 2 === 0 ? "bg-[#232f47]/40" : "bg-[#181e29]/40") +
                  " hover:bg-[#232f47]/60 transition-colors"
                }
              >
                {Object.values(row).map((val, j) => (
                  <td
                    key={j}
                    className="px-2 py-1 border-b border-[#232f47] whitespace-normal font-inter align-top text-white"
                    style={{ wordBreak: 'normal', whiteSpace: 'normal', fontSize: '12px', height: '18px', lineHeight: '1.2' }}
                  >
                    {String(val)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // --- LIVE PREVIEW LOGIC ---
  // For live preview, merge manual fields into preview rows if available
  const getLivePreviewNonRefund = () => {
    if (!previewNonRefund || previewNonRefund.length === 0) return [];
    return previewNonRefund.map((row) => {
      let updated = { ...row };
      blueHeadersNonRefund.forEach((field) => {
        if (manualFieldsNonRefund[field] !== undefined && manualFieldsNonRefund[field] !== "") {
          updated[field] = manualFieldsNonRefund[field];
        }
      });
      return updated;
    });
  };
  const getLivePreviewSD = () => {
    if (!previewSD || previewSD.length === 0) return [];
    return previewSD.map((row) => {
      let updated = { ...row };
      blueHeadersSD.forEach((field) => {
        if (manualFieldsSD[field] !== undefined && manualFieldsSD[field] !== "") {
          updated[field] = manualFieldsSD[field];
        }
      });
      return updated;
    });
  };

  // Fetch preview from backend
  const fetchPreview = async (type: "non_refundable" | "sd", file: File, manualFields: { [key: string]: string }) => {
    const endpoint = type === "non_refundable" ? "/api/preview/non_refundable" : "/api/preview/sd";
    const formData = new FormData();
    formData.append("file", file);
    formData.append("authority", authority.id);
    formData.append("manualFields", JSON.stringify(manualFields));
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Failed to fetch preview");
      const data = await res.json();
      if (type === "non_refundable") setPreviewNonRefund(data.rows || data); // support both {rows:[]} and []
      else setPreviewSD(data.rows || data);
    } catch (err) {
      if (type === "non_refundable") setPreviewNonRefund([]);
      else setPreviewSD([]);
    }
  };

  // Handlers and logic
  const handleManualFieldChangeNonRefund = (field: string, value: string) => {
    setManualFieldsNonRefund((prev) => ({ ...prev, [field]: value }));
  };
  const handleManualFieldChangeSD = (field: string, value: string) => {
    setManualFieldsSD((prev) => ({ ...prev, [field]: value }));
  };
  const handleParseFile = async () => {
    if (!files.length) return;
    setIsParsing(true);
    setTimeout(async () => {
      setParsedFile(files[0]);
      setShowManualFieldsState(true);
      setIsParsing(false);
      // Fetch previews after parsing
      await fetchPreview("non_refundable", files[0], manualFieldsNonRefund);
      await fetchPreview("sd", files[0], manualFieldsSD);
    }, 1000);
  };
  const handleDownloadNonRefund = async () => {
    if (!parsedFile) return;
    try {
      await processNonRefundableWithBackend({
        authority: authority.id,
        file: parsedFile,
        manualFields: manualFieldsNonRefund,
      });
    } catch (err) {
      alert("Processing failed: " + err);
    }
  };
  // Step 3: Download SD Output
  const handleDownloadSD = async () => {
    if (!parsedFile) return;
    try {
      await processSDWithBackend({
        authority: authority.id,
        file: parsedFile,
        manualFields: manualFieldsSD,
      });
    } catch (err) {
      alert("Processing failed: " + err);
    }
  };

  // List of implemented authority IDs (add more as you implement them)
  const implementedAuthorities = ["mcgm"];
  const isImplemented = implementedAuthorities.includes(authority.id);

  return (
    <Card className="border border-gray-800 bg-gray-900">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-white font-inter font-semibold tracking-tight text-lg">
          <div className={`w-3 h-3 rounded-full ${authority.color}`} />
          {authority.fullName}
        </CardTitle>
        <CardDescription className="text-gray-400">
          Specialized parser for {authority.name} demand notes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isImplemented ? (
          <div className="flex flex-col items-center justify-center p-8 bg-gray-800/60 rounded-xl border-2 border-dashed border-gray-700 text-center">
            <FileText className="h-12 w-12 text-gray-500 mx-auto mb-4" />
            <span className="text-lg text-gray-300 font-semibold mb-2">Coming Soon</span>
            <span className="text-gray-400">The parser for <b>{authority.name}</b> is not yet available.<br/>Please check back later.</span>
          </div>
        ) : (
          <>
            <div className="border-2 border-dashed border-gray-700 rounded-xl p-8 text-center hover:border-gray-600 transition-colors bg-gray-800/50">
              <FileText className="h-12 w-12 text-gray-500 mx-auto mb-4" />
              <Label htmlFor={`file-upload-${authority.id}`} className="cursor-pointer">
                <span className="font-medium text-white text-lg">Upload {authority.name} PDFs</span>
                <p className="text-sm text-gray-400 mt-2">Optimized for {authority.name} format</p>
              </Label>
              <UITextInput
                id={`file-upload-${authority.id}`}
                type="file"
                multiple
                accept=".pdf"
                onChange={onFileUpload}
                className="hidden"
                disabled={!isImplemented}
              />
              {/* Show uploaded file name if present */}
              {files.length > 0 && (
                <div className="mt-4 text-cyan-300 text-sm font-mono truncate">{files[0].name}</div>
              )}
            </div>
            {files.length > 0 && !showManualFieldsState && (
              <Button
                onClick={handleParseFile}
                disabled={isParsing || !isImplemented}
                className="w-full h-12 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-200 border-0"
              >
                {isParsing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Parsing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Parse File
                  </>
                )}
              </Button>
            )}
            {showManualFieldsState && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                {/* Manual Fields (left column) */}
                <div className="flex flex-col gap-8">
                  {/* Non-Refundable Manual Fields */}
                  <div className="p-4 bg-gray-800 rounded-xl border border-[#232f47] h-[500px] flex flex-col">
                    <h4 className="text-white font-semibold mb-2 font-inter tracking-tight text-base">Non-Refundable Output Manual Fields</h4>
                    <div className="grid grid-cols-2 gap-4 flex-1">
                      {blueHeadersNonRefund.map((field) => (
                        <div key={field} className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-white mb-1 capitalize font-inter">{field}</label>
                          <UITextInput
                            value={manualFieldsNonRefund[field] || ""}
                            onChange={(e) => handleManualFieldChangeNonRefund(field, e.target.value)}
                            className="rounded-md border border-[#2c3e50] bg-[#0f1a2b] hover:border-neutral-500 focus:border-neutral-400 text-sm text-white px-4 py-2 shadow-sm transition-all font-inter font-normal"
                            autoComplete="off"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex-shrink-0 mt-2 flex items-end">
                      <Button
                        onClick={handleDownloadNonRefund}
                        disabled={isProcessing}
                        className="w-full h-12 bg-[#22272e] hover:bg-[#31363c] text-white font-inter font-semibold tracking-tight shadow-sm transition-all border-0"
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4 mr-2" />
                            Download Non-Refundable Excel
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                  {/* SD Manual Fields */}
                  <div className="p-4 bg-gray-800 rounded-xl border border-[#232f47] h-[280px] flex flex-col justify-between">
                    <h4 className="text-white font-semibold mb-2 font-inter tracking-tight text-base">SD Output Manual Fields</h4>
                    <div className="grid grid-cols-2 gap-4 flex-1">
                      {blueHeadersSD.map((field) => (
                        <div key={field} className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-white mb-1 capitalize font-inter">{field}</label>
                          <UITextInput
                            value={manualFieldsSD[field] || ""}
                            onChange={(e) => handleManualFieldChangeSD(field, e.target.value)}
                            className="rounded-md border border-[#2c3e50] bg-[#0f1a2b] hover:border-neutral-500 focus:border-neutral-400 text-sm text-white px-4 py-2 shadow-sm transition-all font-inter font-normal"
                            autoComplete="off"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex-shrink-0 mt-2 flex items-end">
                      <Button
                        onClick={handleDownloadSD}
                        disabled={isProcessing}
                        className="w-full h-12 bg-[#22272e] hover:bg-[#31363c] text-white font-inter font-semibold tracking-tight shadow-sm transition-all border-0"
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4 mr-2" />
                            Download SD Excel
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
                {/* Preview Tables (right column, stacked vertically) */}
                <div className="flex flex-col gap-8 w-full">
                  <div className="w-full">
                    <h4 className="text-white font-inter font-bold mb-3 text-lg tracking-tight">Non-Refundable Output Preview</h4>
                    <div className="bg-[#181e29] rounded-xl border border-[#232f47] p-2 shadow-none h-[240px] min-h-[160px] max-h-none overflow-visible">
                      {isParsing ? (
                        <div className="text-center text-cyan-300 py-4 min-h-[80px]">Loading preview...</div>
                      ) : renderPreviewTable(getLivePreviewNonRefund(), undefined, true)}
                    </div>
                  </div>
                  <div className="w-full">
                    <h4 className="text-white font-inter font-bold mb-3 text-lg tracking-tight">SD Output Preview</h4>
                    <div className="bg-[#181e29] rounded-xl border border-[#232f47] p-2 shadow-none h-[240px] min-h-[160px] max-h-none overflow-visible">
                      {isParsing ? (
                        <div className="text-center text-cyan-300 py-4 min-h-[80px]">Loading preview...</div>
                      ) : renderPreviewTable(getLivePreviewSD(), undefined)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
