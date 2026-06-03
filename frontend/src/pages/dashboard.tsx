import { useCallback, useEffect, useRef, useState } from "react"

import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { SectionCards } from "@/components/section-cards"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  getDashboardStatistics,
  type DashboardStatisticsResponse,
} from "@/lib/dashboard-api"

const formatDate = (value: string | undefined) => {
  if (!value) {
    return null
  }

  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

const getDashboardPeriod = (stats: DashboardStatisticsResponse | null) => {
  const startDate = formatDate(stats?.club_load.start_date)
  const endDate = formatDate(stats?.club_load.end_date)

  if (!startDate || !endDate) {
    return "Last 90 days"
  }

  return `${startDate} - ${endDate}`
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStatisticsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestIdRef = useRef(0)

  const loadDashboard = useCallback(async () => {
    const requestId = ++requestIdRef.current
    setIsLoading(true)
    try {
      const response = await getDashboardStatistics({ days: 90 })
      if (requestId !== requestIdRef.current) {
        return
      }
      setStats(response)
      setError(null)
    } catch (loadError) {
      if (requestId !== requestIdRef.current) {
        return
      }
      if (loadError instanceof Error) {
        setError(loadError.message)
      } else {
        setError("Unable to load dashboard data.")
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    void loadDashboard()

    return () => {
      requestIdRef.current += 1
    }
  }, [loadDashboard])

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="flex flex-col gap-3 px-4 lg:px-6">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div className="flex max-w-3xl flex-col gap-2">
            <Badge variant="outline" className="w-fit">
              Demo operations snapshot
            </Badge>
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                Club performance dashboard
              </h1>
              <p className="text-sm text-muted-foreground">
                Membership growth, training utilization, and operational load
                for the Quartermaster demo environment.
              </p>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            {getDashboardPeriod(stats)}
          </div>
        </div>
      </div>
      <SectionCards
        newMembers={stats?.new_members ?? null}
        groupOccupancy={stats?.group_occupancy ?? null}
        clubLoad={stats?.club_load ?? null}
        isLoading={isLoading}
      />
      <div className="px-4 lg:px-6">
        <ChartAreaInteractive
          points={stats?.club_load.points ?? []}
          isLoading={isLoading}
        />
        {error ? (
          <Card className="mt-4 border-destructive/50">
            <CardHeader>
              <CardTitle>Unable to load dashboard data</CardTitle>
              <CardDescription>
                The dashboard is available, but the statistics endpoint did not
                respond successfully.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button
                type="button"
                variant="outline"
                onClick={() => void loadDashboard()}
                disabled={isLoading}
              >
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  )
}
