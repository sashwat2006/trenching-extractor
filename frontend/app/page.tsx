"use client"

import { useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useFileProcessing } from "@/hooks/useFileProcessing"
import { authorities } from "@/constants/authorities"
import { exportToExcel } from "@/utils/export"
import { SignInPage } from "@/components/auth/SignInPage"
import { Header } from "@/components/layout/Header"
import { AnalyticsCards } from "@/components/dashboard/AnalyticsCards"
import { AuthorityUploadCard } from "@/components/parser/AuthorityUploadCard"
import { ResultsTable } from "@/components/results/ResultsTable"
import { AuthoritySidebar } from "@/components/layout/AuthoritySidebar"

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

  const selectedAuthority = authorities.find(a => a.id === activeAuthority);

  if (!isAuthenticated) {
    return <SignInPage isLoggingIn={isLoggingIn} onLogin={handleMicrosoftLogin} />
  }

  return (
    <div className="min-h-screen bg-blue flex">
      <AuthoritySidebar selected={activeAuthority} onSelect={setActiveAuthority} />
      <div className="flex-1 transition-all duration-300 sidebar-margin">
        <Header 
          user={user!} 
          analytics={analytics} 
          pageTitle={selectedAuthority ? selectedAuthority.name : "Master Dashboard"} 
          onLogout={handleLogout} 
        />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-8">
          <AnalyticsCards analytics={analytics} />

          {/* Render the selected authority's upload card full width */}
          {selectedAuthority && (
            <AuthorityUploadCard
              authority={selectedAuthority}
              files={files[selectedAuthority.id] || []}
              isProcessing={isProcessing[selectedAuthority.id] || false}
              onFileUpload={(e) => handleFileUpload(selectedAuthority.id, e)}
              onStartProcessing={() => simulateProcessing(selectedAuthority)}
            />
          )}

          <ResultsTable data={extractedData} authorities={authorities} onExport={() => exportToExcel(extractedData)} />
        </div>
      </div>
    </div>
  )
}
