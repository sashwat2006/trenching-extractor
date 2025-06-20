import { Card, CardContent } from "@/components/ui/card"
import { Activity, Database, Zap } from "lucide-react"
import type { Analytics } from "@/types"

interface AnalyticsCardsProps {
  analytics: Analytics
}

export function AnalyticsCards({ analytics }: AnalyticsCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card className="bg-gradient-to-br from-cyan-500 to-cyan-600 text-white border-0 shadow-lg">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-cyan-100 text-sm font-medium">Total Processed</p>
              <p className="text-3xl font-bold mt-1">{analytics.totalProcessed.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-white/20 rounded-xl">
              <Database className="h-6 w-6 text-white" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-0 shadow-lg">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm font-medium">Avg Processing</p>
              <p className="text-3xl font-bold mt-1">{analytics.avgProcessingTime}s</p>
            </div>
            <div className="p-3 bg-white/20 rounded-xl">
              <Zap className="h-6 w-6 text-white" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0 shadow-lg">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm font-medium">Active Authorities</p>
              <p className="text-3xl font-bold mt-1">{analytics.activeAuthorities}</p>
            </div>
            <div className="p-3 bg-white/20 rounded-xl">
              <Activity className="h-6 w-6 text-white" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
