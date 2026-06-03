"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"

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
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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

const chartConfig = {
  trainings: {
    label: "Training",
    color: "var(--primary)",
  },
  payments: {
    label: "Payments",
    color: "var(--primary)",
  },
} satisfies ChartConfig

const toDate = (value: string) => new Date(`${value}T00:00:00`)

export function ChartAreaInteractive({
  points,
  isLoading = false,
}: ChartAreaInteractiveProps) {
  const isMobile = useIsMobile()
  const [timeRange, setTimeRange] = React.useState("90d")

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

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Club load</CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">
            Training sessions and payments from the last 3 months
          </span>
          <span className="@[540px]/card:hidden">Last 3 months</span>
        </CardDescription>
        <CardAction>
          <ToggleGroup
            type="single"
            value={timeRange}
            onValueChange={setTimeRange}
            variant="outline"
            className="hidden *:data-[slot=toggle-group-item]:px-4! @[767px]/card:flex"
          >
            <ToggleGroupItem value="90d">3 months</ToggleGroupItem>
            <ToggleGroupItem value="30d">30 dni</ToggleGroupItem>
            <ToggleGroupItem value="7d">7 dni</ToggleGroupItem>
          </ToggleGroup>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger
              className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
              size="sm"
              aria-label="Select period"
            >
              <SelectValue placeholder="3 months" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="360d" className="rounded-lg">
                1 year
              </SelectItem>
              <SelectItem value="180d" className="rounded-lg">
                6 months
              </SelectItem>
              <SelectItem value="90d" className="rounded-lg">
                3 months
              </SelectItem>
              <SelectItem value="30d" className="rounded-lg">
                30 dni
              </SelectItem>
              <SelectItem value="7d" className="rounded-lg">
                7 dni
              </SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
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
                  stopOpacity={1.0}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-trainings)"
                  stopOpacity={0.1}
                />
              </linearGradient>
              <linearGradient id="fillPayments" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-payments)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-payments)"
                  stopOpacity={0.1}
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
              tickFormatter={(value) => {
                const parsedDate = toDate(String(value))
                return parsedDate.toLocaleDateString("pl-PL", {
                  month: "short",
                  day: "numeric",
                })
              }}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => {
                    return toDate(String(value)).toLocaleDateString("pl-PL", {
                      month: "short",
                      day: "numeric",
                    })
                  }}
                  indicator="dot"
                />
              }
            />
            <Area
              dataKey="payments"
              type="natural"
              fill="url(#fillPayments)"
              stroke="var(--color-payments)"
              stackId="a"
            />
            <Area
              dataKey="trainings"
              type="natural"
              fill="url(#fillTrainings)"
              stroke="var(--color-trainings)"
              stackId="a"
            />
          </AreaChart>
        </ChartContainer>
        {!isLoading && filteredData.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            No data for the selected period.
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
