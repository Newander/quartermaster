"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { useIsMobile } from "@/hooks/use-mobile"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

import type { ClubLoadPoint } from "@/lib/dashboard-api"

export const description = "An interactive area chart"

type ChartAreaInteractiveProps = {
  points: ClubLoadPoint[]
  isLoading?: boolean
}

type ClubLoadChartPoint = {
  date: string
  trainings: number
  payments: number
}

type TimeRange = "90d" | "30d" | "7d"

const timeRangeOptions: { value: TimeRange; label: string }[] = [
  { value: "90d", label: "90 days" },
  { value: "30d", label: "30 days" },
  { value: "7d", label: "7 days" },
]

const chartConfig = {
  trainings: {
    label: "Trainings",
    color: "hsl(var(--primary))",
  },
  payments: {
    label: "Payments",
    color: "hsl(var(--secondary))",
  },
} satisfies ChartConfig

const toDate = (value: string) => new Date(`${value}T00:00:00`)
const formatChartDate = (value: string) =>
  toDate(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })

export function ChartAreaInteractive({
  points,
  isLoading = false,
}: ChartAreaInteractiveProps) {
  const isMobile = useIsMobile()
  const [timeRange, setTimeRange] = React.useState<TimeRange>("90d")

  React.useEffect(() => {
    if (isMobile) {
      setTimeRange("7d")
    }
  }, [isMobile])

  const filteredData = React.useMemo<ClubLoadChartPoint[]>(() => {
    if (!points.length) {
      return []
    }

    const sorted = [...points].sort((left, right) => left.date.localeCompare(right.date))
    const referenceDate = toDate(sorted[sorted.length - 1].date)

    let daysToSubtract = 90
    if (timeRange === "30d") {
      daysToSubtract = 30
    } else if (timeRange === "7d") {
      daysToSubtract = 7
    }

    const startDate = new Date(referenceDate)
    startDate.setDate(startDate.getDate() - daysToSubtract + 1)

    return sorted
      .filter((item) => toDate(item.date) >= startDate)
      .map((item) => ({
        date: item.date,
        trainings: item.trainings,
        payments: item.payments,
      }))
  }, [points, timeRange])

  const filteredTotals = React.useMemo(
    () =>
      filteredData.reduce(
        (totals, point) => ({
          payments: totals.payments + point.payments,
          trainings: totals.trainings + point.trainings,
        }),
        { payments: 0, trainings: 0 }
      ),
    [filteredData]
  )

  const handleTimeRangeChange = (value: string) => {
    if (value === "90d" || value === "30d" || value === "7d") {
      setTimeRange(value)
    }
  }

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Club load</CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">
            Training sessions and payment records across the selected period
          </span>
          <span className="@[540px]/card:hidden">Activity trend</span>
        </CardDescription>
        <CardAction>
          <ToggleGroup
            type="single"
            value={timeRange}
            onValueChange={handleTimeRangeChange}
            variant="outline"
            className="hidden *:data-[slot=toggle-group-item]:px-4! @[767px]/card:flex"
          >
            {timeRangeOptions.map((option) => (
              <ToggleGroupItem key={option.value} value={option.value}>
                {option.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Select value={timeRange} onValueChange={handleTimeRangeChange}>
            <SelectTrigger
              className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
              size="sm"
              aria-label="Select period"
            >
              <SelectValue placeholder="90 days" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectGroup>
                {timeRangeOptions.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    className="rounded-lg"
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {isLoading ? (
          <Skeleton className="h-[250px] w-full" />
        ) : (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-[250px] w-full"
          >
            <AreaChart data={filteredData}>
              <defs>
                <linearGradient id="fillTrainings" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-trainings)"
                    stopOpacity={0.75}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-trainings)"
                    stopOpacity={0.08}
                  />
                </linearGradient>
                <linearGradient id="fillPayments" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-payments)"
                    stopOpacity={0.65}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-payments)"
                    stopOpacity={0.08}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tickFormatter={(value) => formatChartDate(String(value))}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={28}
                tickMargin={8}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) => formatChartDate(String(value))}
                    indicator="dot"
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Area
                dataKey="payments"
                type="natural"
                fill="url(#fillPayments)"
                stroke="var(--color-payments)"
              />
              <Area
                dataKey="trainings"
                type="natural"
                fill="url(#fillTrainings)"
                stroke="var(--color-trainings)"
              />
            </AreaChart>
          </ChartContainer>
        )}
        {!isLoading && filteredData.length > 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">
            {filteredTotals.trainings} trainings and {filteredTotals.payments}{" "}
            payments in view.
          </p>
        ) : null}
        {!isLoading && filteredData.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            No data for the selected period.
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
