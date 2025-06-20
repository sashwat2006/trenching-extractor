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
    <div className="min-h-screen bg-black">
      <Header user={user!} analytics={analytics} onLogout={handleLogout} />
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        <AnalyticsCards analytics={analytics} />

        {/* Authority selection tabs */}
        <div className="flex gap-0 mb-8 border-b border-cyan-700">
          {authorities.map((authority) => (
            <button
              key={authority.id}
              className={`px-6 py-2 -mb-px text-base font-medium focus:outline-none transition-colors duration-150 border-b-2
                ${activeAuthority === authority.id
                  ? 'border-cyan-400 text-cyan-300 bg-gray-900 font-semibold'
                  : 'border-transparent text-gray-400 hover:text-cyan-200 bg-transparent'}
              rounded-t-md`}
              style={{ borderRadius: '8px 8px 0 0' }}
              onClick={() => setActiveAuthority(authority.id)}
            >
              <span className="mr-2">{authority.icon}</span> {authority.name}
            </button>
          ))}
        </div>

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
  )
}
