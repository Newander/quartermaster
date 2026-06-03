"use client"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  RiArrowDownLine,
  RiArrowRightLine,
  RiArrowUpLine,
} from "@remixicon/react"

import type {
  GroupOccupancyStatistics,
  NewMembersStatistics,
} from "@/lib/dashboard-api"

type SectionCardsProps = {
  newMembers: NewMembersStatistics | null
  groupOccupancy: GroupOccupancyStatistics | null
  isLoading?: boolean
}

const formatSignedPercent = (value: number | null) => {
  if (value === null) {
    return "n/d"
  }
  const sign = value > 0 ? "+" : ""
  return `${sign}${value.toFixed(1)}%`
}

const formatSignedNumber = (value: number) => {
  if (value > 0) {
    return `+${value}`
  }
  return `${value}`
}

const formatOccupancyPercent = (value: number) => `${value.toFixed(1)}%`

export function SectionCards({
  newMembers,
  groupOccupancy,
  isLoading = false,
}: SectionCardsProps) {
  const newMembersCount = newMembers?.current_month_count ?? 0
  const newMembersDelta = newMembers?.delta_count ?? 0
  const newMembersDeltaPercent = newMembers?.delta_percent ?? null

  const occupancyPercent = groupOccupancy?.occupancy_percent ?? 0
  const occupancyAttended = groupOccupancy?.total_attended ?? 0
  const occupancyCapacity = groupOccupancy?.total_capacity ?? 0
  const occupancySessions = groupOccupancy?.sessions_count ?? 0

  const trendIcon =
    newMembersDelta > 0 ? (
      <RiArrowUpLine />
    ) : newMembersDelta < 0 ? (
      <RiArrowDownLine />
    ) : (
      <RiArrowRightLine />
    )

  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 dark:*:data-[slot=card]:bg-card">
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>New members</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {isLoading ? "..." : newMembersCount}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              {trendIcon}
              {isLoading
                ? "..."
                : newMembersDeltaPercent !== null
                  ? formatSignedPercent(newMembersDeltaPercent)
                  : formatSignedNumber(newMembersDelta)}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Month-over-month change
          </div>
          <div className="text-muted-foreground">
            {isLoading
              ? "Loading data..."
              : `Previous month: ${newMembers?.previous_month_count ?? 0}`}
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Group occupancy</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {isLoading ? "..." : formatOccupancyPercent(occupancyPercent)}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <RiArrowRightLine />
              {isLoading ? "..." : `${occupancySessions} sessions`}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Attendance against available seats
          </div>
          <div className="text-muted-foreground">
            {isLoading
              ? "Loading data..."
              : `${occupancyAttended} attendances / ${occupancyCapacity} seats`}
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
