import { Card, CardContent } from "@/components/ui/card"
import { Activity, Database, Zap } from "lucide-react"
import type { Analytics } from "@/types"

interface AnalyticsCardsProps {
  analytics: Analytics
}

export function AnalyticsCards({ analytics }: AnalyticsCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card className="bg-[#1a2942] text-white border border-[#28354e] shadow-md">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-300 text-sm font-medium">Total Processed</p>
              <p className="text-3xl font-bold mt-1">{analytics.totalProcessed.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-[#28354e] rounded-xl">
              <Database className="h-6 w-6 text-[#6b8cbc]" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-[#1a2942] text-white border border-[#28354e] shadow-md">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-300 text-sm font-medium">Avg Processing</p>
              <p className="text-3xl font-bold mt-1">{analytics.avgProcessingTime}s</p>
            </div>
            <div className="p-3 bg-[#28354e] rounded-xl">
              <Zap className="h-6 w-6 text-[#6b8cbc]" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-[#1a2942] text-white border border-[#28354e] shadow-md">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-300 text-sm font-medium">Active Authorities</p>
              <p className="text-3xl font-bold mt-1">{analytics.activeAuthorities}</p>
            </div>
            <div className="p-3 bg-[#28354e] rounded-xl">
              <Activity className="h-6 w-6 text-[#6b8cbc]" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
