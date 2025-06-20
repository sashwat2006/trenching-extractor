import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Loader2 } from "lucide-react"
import type { AuthorityConfig } from "@/types"

interface ProcessingStatusCardProps {
  authority: AuthorityConfig
  status: string
  progress: number
}

export function ProcessingStatusCard({ authority, status, progress }: ProcessingStatusCardProps) {
  return (
    <Card className="border border-gray-800 bg-gray-900">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-white">
          <Loader2 className="h-5 w-5 animate-spin text-cyan-500" />
          Processing {authority.name} Documents
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex justify-between text-sm text-gray-300">
            <span>{status}</span>
            <span className="font-medium">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="w-full h-2 bg-gray-800" />
        </div>
      </CardContent>
    </Card>
  )
}
