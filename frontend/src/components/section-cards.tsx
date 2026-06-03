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
  ClubLoadStatistics,
  GroupOccupancyStatistics,
  NewMembersStatistics,
} from "@/lib/dashboard-api"
import { Skeleton } from "@/components/ui/skeleton"

type SectionCardsProps = {
  newMembers: NewMembersStatistics | null
  groupOccupancy: GroupOccupancyStatistics | null
  clubLoad: ClubLoadStatistics | null
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

const sumClubLoad = (clubLoad: ClubLoadStatistics | null) => {
  return (clubLoad?.points ?? []).reduce(
    (totals, point) => ({
      payments: totals.payments + point.payments,
      trainings: totals.trainings + point.trainings,
    }),
    { payments: 0, trainings: 0 }
  )
}

export function SectionCards({
  newMembers,
  groupOccupancy,
  clubLoad,
  isLoading = false,
}: SectionCardsProps) {
  const newMembersCount = newMembers?.current_month_count ?? 0
  const newMembersDelta = newMembers?.delta_count ?? 0
  const newMembersDeltaPercent = newMembers?.delta_percent ?? null

  const occupancyPercent = groupOccupancy?.occupancy_percent ?? 0
  const occupancyAttended = groupOccupancy?.total_attended ?? 0
  const occupancyCapacity = groupOccupancy?.total_capacity ?? 0
  const occupancySessions = groupOccupancy?.sessions_count ?? 0
  const clubLoadTotals = sumClubLoad(clubLoad)
  const operationalEvents = clubLoadTotals.trainings + clubLoadTotals.payments

  const trendIcon =
    newMembersDelta > 0 ? (
      <RiArrowUpLine />
    ) : newMembersDelta < 0 ? (
      <RiArrowDownLine />
    ) : (
      <RiArrowRightLine />
    )

  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-3">
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Member acquisition</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {isLoading ? <Skeleton className="h-9 w-20" /> : newMembersCount}
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
            New members this month
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
          <CardDescription>Seat utilization</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {isLoading ? (
              <Skeleton className="h-9 w-24" />
            ) : (
              formatOccupancyPercent(occupancyPercent)
            )}
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
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Operational events</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {isLoading ? <Skeleton className="h-9 w-24" /> : operationalEvents}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <RiArrowRightLine />
              {isLoading ? "..." : `${clubLoad?.days ?? 90} days`}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Training and payment activity
          </div>
          <div className="text-muted-foreground">
            {isLoading
              ? "Loading data..."
              : `${clubLoadTotals.trainings} trainings / ${clubLoadTotals.payments} payments`}
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
