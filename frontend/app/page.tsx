"use client"

import { useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useFileProcessing } from "@/hooks/useFileProcessing"
import { authorities } from "@/constants/authorities"
import { exportToExcel } from "@/utils/export"
import { SignInPage } from "@/components/auth/SignInPage"
import { Header } from "@/components/layout/Header"
import { AnalyticsCards } from "@/components/dashboard/AnalyticsCards"
import { AuthorityParser } from "@/components/parser/AuthorityParser"
import { ResultsTable } from "@/components/results/ResultsTable"

export default function CloudExtelParser() {
  const { user, isAuthenticated, isLoggingIn, handleMicrosoftLogin, handleLogout } = useAuth()
  const { files, isProcessing, progress, extractedData, processingStatus, handleFileUpload, simulateProcessing } =
    useFileProcessing()

  const [activeAuthority, setActiveAuthority] = useState("kdmc")
  const [analytics] = useState({
    totalProcessed: 1247,
    avgProcessingTime: 2.3,
    activeAuthorities: 6,
  })

  if (!isAuthenticated) {
    return <SignInPage isLoggingIn={isLoggingIn} onLogin={handleMicrosoftLogin} />
  }

  return (
    <div className="min-h-screen bg-black">
      <Header user={user!} analytics={analytics} onLogout={handleLogout} />

      <div className="max-w-7xl mx-auto p-6 space-y-8">
        <AnalyticsCards analytics={analytics} />

        <AuthorityParser
          authorities={authorities}
          activeAuthority={activeAuthority}
          onAuthorityChange={setActiveAuthority}
          files={files}
          isProcessing={isProcessing}
          progress={progress}
          processingStatus={processingStatus}
          onFileUpload={handleFileUpload}
          onStartProcessing={simulateProcessing}
        />

        <ResultsTable data={extractedData} authorities={authorities} onExport={() => exportToExcel(extractedData)} />
      </div>
    </div>
  )
}
