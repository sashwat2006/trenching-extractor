"use client"

import type React from "react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BarChart3 } from "lucide-react"
import type { AuthorityConfig } from "@/types"
import { AuthorityUploadCard } from "./AuthorityUploadCard"
import { ProcessingStatusCard } from "./ProcessingStatusCard"

interface AuthorityParserProps {
  authorities: AuthorityConfig[]
  activeAuthority: string
  onAuthorityChange: (authority: string) => void
  files: { [key: string]: File[] }
  isProcessing: { [key: string]: boolean }
  progress: { [key: string]: number }
  processingStatus: { [key: string]: string }
  onFileUpload: (authorityId: string, event: React.ChangeEvent<HTMLInputElement>) => void
  onStartProcessing: (authority: AuthorityConfig) => void
}

export function AuthorityParser({
  authorities,
  activeAuthority,
  onAuthorityChange,
  files,
  isProcessing,
  progress,
  processingStatus,
  onFileUpload,
  onStartProcessing,
}: AuthorityParserProps) {
  return (
    <Card className="shadow-lg border border-gray-800 bg-gray-900">
      <CardHeader className="pb-6">
        <CardTitle className="flex items-center gap-3 text-white">
          <div className="p-2 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-lg">
            <BarChart3 className="h-5 w-5 text-white" />
          </div>
          Authority-Specific Parsers
        </CardTitle>
        <CardDescription className="text-gray-400">
          Advanced NLP models trained for each municipal authority's document format
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeAuthority} onValueChange={onAuthorityChange}>
          <TabsList className="grid w-full grid-cols-6 mb-8 bg-gray-800 p-1 border border-gray-700">
            {authorities.map((authority) => (
              <TabsTrigger
                key={authority.id}
                value={authority.id}
                className="flex items-center gap-1 text-xs data-[state=active]:bg-gray-700 data-[state=active]:text-white text-gray-400"
              >
                <span>{authority.icon}</span>
                {authority.name}
              </TabsTrigger>
            ))}
          </TabsList>

          {authorities.map((authority) => (
            <TabsContent key={authority.id} value={authority.id} className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <AuthorityUploadCard
                  authority={authority}
                  files={files[authority.id] || []}
                  isProcessing={isProcessing[authority.id] || false}
                  onFileUpload={(e) => onFileUpload(authority.id, e)}
                  onStartProcessing={() => onStartProcessing(authority)}
                />
                {/* Remove parser config card, show nothing or add future info here */}
              </div>

              {isProcessing[authority.id] && (
                <ProcessingStatusCard
                  authority={authority}
                  status={processingStatus[authority.id] || ""}
                  progress={progress[authority.id] || 0}
                />
              )}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  )
}
