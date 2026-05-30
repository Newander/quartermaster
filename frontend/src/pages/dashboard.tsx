import { useEffect, useState } from "react"

import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { SectionCards } from "@/components/section-cards"
import {
  getDashboardStatistics,
  type DashboardStatisticsResponse,
} from "@/lib/dashboard-api"

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStatisticsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    const loadDashboard = async () => {
      try {
        const response = await getDashboardStatistics({ days: 90 })
        if (!isMounted) {
          return
        }
        setStats(response)
        setError(null)
      } catch (loadError) {
        if (!isMounted) {
          return
        }
        if (loadError instanceof Error) {
          setError(loadError.message)
        } else {
          setError("Nie udało się pobrać danych panelu.")
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadDashboard()

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <SectionCards
        newMembers={stats?.new_members ?? null}
        groupOccupancy={stats?.group_occupancy ?? null}
        isLoading={isLoading}
      />
      <div className="px-4 lg:px-6">
        <ChartAreaInteractive
          points={stats?.club_load.points ?? []}
          isLoading={isLoading}
        />
        {error ? (
          <p className="mt-2 text-sm text-destructive">{error}</p>
        ) : null}
      </div>
    </div>
  )
}
