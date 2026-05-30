import * as React from "react"
import {
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiCalendarScheduleLine,
  RiLoader4Line,
} from "@remixicon/react"
import { toast } from "sonner"

import { RecordDetailSheet } from "@/components/record-detail-sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { backendApi } from "@/lib/backend-api"
import { navigateTo } from "@/lib/router"
import { syncScheduleRelations } from "@/lib/schedule-relations"

const HARMONOGRAM_ROUTE = "/harmonogram"
const HARMONOGRAM_ROUTE_PREFIX = `${HARMONOGRAM_ROUTE}/`
const SCHEDULE_SCHEMA_ROUTE = "/training/schedule"
const READ_ONLY_FIELDS = ["id", "created_at", "updated_at", "deleted_at", "is_deleted"]
const DEFAULT_WEEK_START_HOUR = 9
const DEFAULT_WEEK_END_HOUR = 23
const WEEK_HOUR_HEIGHT_PX = 48
const WEEK_EVENT_MIN_HEIGHT_PX = 24

type CalendarViewMode = "week" | "month"
type DayOfWeek =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday"

type HarmonogramInstructor = {
  id: number
  member_id: number
  first_name: string
  last_name: string
  specialization: string
}

type HarmonogramEvent = {
  schedule_id: number
  occurrence_date: string
  day_of_week: DayOfWeek
  schedule_cycle: string
  start_time: string
  end_time: string
  max_participants: number | null
  training_form_id: number
  training_form_name: string
  season_id: number
  season_name: string
  instructors: HarmonogramInstructor[]
}

type HarmonogramResponse = {
  total: number
  events: HarmonogramEvent[]
}

type ScheduleRecord = Record<string, unknown> & {
  id: number
  day_of_week?: string
  start_time?: string
}

type DragPayload = {
  scheduleId: number
  startTime: string
  endTime: string
}

type HarmonogramPageProps = {
  currentRoute: string
}

type WeekEventLayoutItem = {
  event: HarmonogramEvent
  visibleStart: number
  visibleEnd: number
  column: number
  columns: number
}

const monthTitleFormatter = new Intl.DateTimeFormat("pl-PL", {
  month: "long",
  year: "numeric",
})

const dayHeaderFormatter = new Intl.DateTimeFormat("pl-PL", {
  weekday: "short",
  day: "2-digit",
})

const dayShortFormatter = new Intl.DateTimeFormat("pl-PL", {
  weekday: "short",
})

const fullDayFormatter = new Intl.DateTimeFormat("pl-PL", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric",
})

const toDateKey = (value: Date) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`

const startOfDay = (value: Date) =>
  new Date(value.getFullYear(), value.getMonth(), value.getDate())

const addDays = (value: Date, days: number) => {
  const next = startOfDay(value)
  next.setDate(next.getDate() + days)
  return next
}

const addMonths = (value: Date, months: number) =>
  new Date(value.getFullYear(), value.getMonth() + months, value.getDate())

const startOfWeek = (value: Date) => {
  const normalized = startOfDay(value)
  const mondayOffset = (normalized.getDay() + 6) % 7
  normalized.setDate(normalized.getDate() - mondayOffset)
  return normalized
}

const endOfWeek = (value: Date) => addDays(startOfWeek(value), 6)

const startOfMonth = (value: Date) =>
  new Date(value.getFullYear(), value.getMonth(), 1)

const endOfMonth = (value: Date) =>
  new Date(value.getFullYear(), value.getMonth() + 1, 0)

const toTimeLabel = (timeValue: string) => timeValue.slice(0, 5)

const parseMinutes = (timeValue: string) => {
  const [hours, minutes] = timeValue.split(":").map((chunk) => Number(chunk))
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return 0
  }

  return hours * 60 + minutes
}

const minutesToTime = (totalMinutes: number) => {
  const safeMinutes = Math.max(0, Math.min(totalMinutes, 23 * 60 + 59))
  const hours = Math.floor(safeMinutes / 60)
  const minutes = safeMinutes % 60
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`
}

const jsDayToScheduleDay = (value: number): DayOfWeek => {
  switch (value) {
    case 0:
      return "sunday"
    case 1:
      return "monday"
    case 2:
      return "tuesday"
    case 3:
      return "wednesday"
    case 4:
      return "thursday"
    case 5:
      return "friday"
    default:
      return "saturday"
  }
}

const getScheduleIdFromRoute = (route: string): number | null => {
  if (!route.startsWith(HARMONOGRAM_ROUTE_PREFIX)) {
    return null
  }

  const parsedId = Number(route.slice(HARMONOGRAM_ROUTE_PREFIX.length))
  return Number.isInteger(parsedId) && parsedId > 0 ? parsedId : null
}

const getInstructorSummary = (event: HarmonogramEvent) => {
  const names = event.instructors
    .map((instructor) => `${instructor.first_name} ${instructor.last_name}`.trim())
    .filter(Boolean)

  return names.length > 0 ? names.join(", ") : "Brak instruktora"
}

const weekRangeLabel = (anchorDate: Date) => {
  const weekStart = startOfWeek(anchorDate)
  const weekEnd = addDays(weekStart, 6)

  return `${fullDayFormatter.format(weekStart)} - ${fullDayFormatter.format(weekEnd)}`
}

const getHourSlots = () =>
  Array.from(
    { length: DEFAULT_WEEK_END_HOUR - DEFAULT_WEEK_START_HOUR + 1 },
    (_, index) => DEFAULT_WEEK_START_HOUR + index
  )

const getMonthGridDays = (anchorDate: Date) => {
  const firstOfMonth = startOfMonth(anchorDate)
  const lastOfMonth = endOfMonth(anchorDate)
  const gridStart = startOfWeek(firstOfMonth)
  const gridEnd = endOfWeek(lastOfMonth)
  const result: Date[] = []

  for (let cursor = gridStart; cursor <= gridEnd; cursor = addDays(cursor, 1)) {
    result.push(cursor)
  }

  return result
}

const buildWeekDayLayout = (
  dayEvents: HarmonogramEvent[],
  dayStartMinutes: number,
  dayEndMinutes: number
): WeekEventLayoutItem[] => {
  const prepared = dayEvents
    .map((event) => {
      const eventStart = parseMinutes(event.start_time)
      const eventEnd = parseMinutes(event.end_time)
      const visibleStart = Math.max(eventStart, dayStartMinutes)
      const visibleEnd = Math.min(eventEnd, dayEndMinutes)

      return {
        event,
        visibleStart,
        visibleEnd,
      }
    })
    .filter((item) => item.visibleEnd > item.visibleStart)
    .sort((left, right) => {
      if (left.visibleStart !== right.visibleStart) {
        return left.visibleStart - right.visibleStart
      }

      if (left.visibleEnd !== right.visibleEnd) {
        return right.visibleEnd - left.visibleEnd
      }

      return left.event.schedule_id - right.event.schedule_id
    })

  const result: WeekEventLayoutItem[] = []
  let active: Array<{ end: number; column: number }> = []
  let clusterIndexes: number[] = []
  let clusterMaxColumns = 0

  const finalizeCluster = () => {
    if (clusterIndexes.length === 0) {
      return
    }

    for (const index of clusterIndexes) {
      result[index].columns = Math.max(clusterMaxColumns, 1)
    }

    clusterIndexes = []
    clusterMaxColumns = 0
  }

  for (const item of prepared) {
    active = active.filter((entry) => entry.end > item.visibleStart)

    if (active.length === 0) {
      finalizeCluster()
    }

    const usedColumns = new Set(active.map((entry) => entry.column))
    let column = 0
    while (usedColumns.has(column)) {
      column += 1
    }

    result.push({
      event: item.event,
      visibleStart: item.visibleStart,
      visibleEnd: item.visibleEnd,
      column,
      columns: 1,
    })

    const insertedIndex = result.length - 1
    clusterIndexes.push(insertedIndex)

    active.push({
      end: item.visibleEnd,
      column,
    })

    clusterMaxColumns = Math.max(clusterMaxColumns, active.length)
  }

  finalizeCluster()
  return result
}

export default function HarmonogramPage({ currentRoute }: HarmonogramPageProps) {
  const [viewMode, setViewMode] = React.useState<CalendarViewMode>("week")
  const [anchorDate, setAnchorDate] = React.useState<Date>(() => startOfDay(new Date()))
  const [events, setEvents] = React.useState<HarmonogramEvent[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [reloadKey, setReloadKey] = React.useState(0)
  const [isMoving, setIsMoving] = React.useState(false)

  const selectedScheduleId = React.useMemo(
    () => getScheduleIdFromRoute(currentRoute),
    [currentRoute]
  )

  const rangeStart = React.useMemo(
    () => (viewMode === "week" ? startOfWeek(anchorDate) : startOfMonth(anchorDate)),
    [anchorDate, viewMode]
  )
  const rangeEnd = React.useMemo(
    () => (viewMode === "week" ? addDays(startOfWeek(anchorDate), 6) : endOfMonth(anchorDate)),
    [anchorDate, viewMode]
  )
  const rangeStartKey = React.useMemo(() => toDateKey(rangeStart), [rangeStart])
  const rangeEndKey = React.useMemo(() => toDateKey(rangeEnd), [rangeEnd])

  React.useEffect(() => {
    let isCancelled = false
    const abortController = new AbortController()

    const loadEvents = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await backendApi.client.get<HarmonogramResponse>(
          "/training/harmonogram",
          {
            query: {
              start_date: rangeStartKey,
              end_date: rangeEndKey,
            },
            signal: abortController.signal,
          }
        )

        if (!isCancelled) {
          setEvents(response.events)
        }
      } catch (loadError) {
        if (!isCancelled && !abortController.signal.aborted) {
          setEvents([])
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Nie udało się pobrać harmonogramu."
          )
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadEvents()

    return () => {
      isCancelled = true
      abortController.abort()
    }
  }, [rangeEndKey, rangeStartKey, reloadKey])

  const eventsByDate = React.useMemo(() => {
    const mappedEvents = new Map<string, HarmonogramEvent[]>()

    for (const event of events) {
      const currentEvents = mappedEvents.get(event.occurrence_date) ?? []
      currentEvents.push(event)
      mappedEvents.set(event.occurrence_date, currentEvents)
    }

    for (const [dayKey, dayEvents] of mappedEvents.entries()) {
      dayEvents.sort((left, right) => {
        const leftStart = parseMinutes(left.start_time)
        const rightStart = parseMinutes(right.start_time)
        if (leftStart !== rightStart) {
          return leftStart - rightStart
        }
        return left.schedule_id - right.schedule_id
      })
      mappedEvents.set(dayKey, dayEvents)
    }

    return mappedEvents
  }, [events])

  const weekStart = React.useMemo(() => startOfWeek(anchorDate), [anchorDate])
  const weekDays = React.useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart]
  )
  const hourSlots = React.useMemo(() => getHourSlots(), [])
  const monthGridDays = React.useMemo(() => getMonthGridDays(anchorDate), [anchorDate])
  const weekStartMinutes = React.useMemo(() => hourSlots[0] * 60, [hourSlots])
  const weekEndMinutes = React.useMemo(
    () => weekStartMinutes + hourSlots.length * 60,
    [hourSlots.length, weekStartMinutes]
  )

  const refreshData = React.useCallback(() => {
    setReloadKey((current) => current + 1)
  }, [])

  const handleMoveSchedule = React.useCallback(
    async (payload: DragPayload, targetDate: Date, targetHour: number) => {
      const duration = Math.max(
        30,
        parseMinutes(payload.endTime) - parseMinutes(payload.startTime)
      )
      const minuteOffset = parseMinutes(payload.startTime) % 60
      const nextStartMinutes = targetHour * 60 + minuteOffset
      const nextEndMinutes = nextStartMinutes + duration

      if (nextEndMinutes > 24 * 60) {
        toast.error("Przeniesienie przekracza koniec dnia.")
        return
      }

      setIsMoving(true)
      try {
        await backendApi.client.put<
          { status: string; schedule_id: number },
          { day_of_week: DayOfWeek; start_time: string; end_time: string }
        >(`/training/schedule/${payload.scheduleId}/move`, {
          day_of_week: jsDayToScheduleDay(targetDate.getDay()),
          start_time: minutesToTime(nextStartMinutes),
          end_time: minutesToTime(nextEndMinutes),
        })
        toast.success("Grafik został przeniesiony.")
        refreshData()
      } catch (moveError) {
        toast.error(
          moveError instanceof Error
            ? moveError.message
            : "Nie udało się przenieść grafiku."
        )
      } finally {
        setIsMoving(false)
      }
    },
    [refreshData]
  )

  const handleDrop = React.useCallback(
    async (event: React.DragEvent<HTMLDivElement>, targetDate: Date, targetHour: number) => {
      event.preventDefault()

      try {
        const rawPayload =
          event.dataTransfer.getData("application/json") ||
          event.dataTransfer.getData("text/plain")
        if (!rawPayload) {
          return
        }

        const payload = JSON.parse(rawPayload) as DragPayload
        if (!payload.scheduleId || !payload.startTime || !payload.endTime) {
          return
        }

        await handleMoveSchedule(payload, targetDate, targetHour)
      } catch {
        toast.error("Nie udało się odczytać danych przeciągania.")
      }
    },
    [handleMoveSchedule]
  )

  const handlePrevious = () => {
    setAnchorDate((current) =>
      viewMode === "week" ? addDays(current, -7) : addMonths(current, -1)
    )
  }

  const handleNext = () => {
    setAnchorDate((current) =>
      viewMode === "week" ? addDays(current, 7) : addMonths(current, 1)
    )
  }

  const handleToday = () => {
    setAnchorDate(startOfDay(new Date()))
  }

  const handleOpenSchedule = (scheduleId: number) => {
    navigateTo(`${HARMONOGRAM_ROUTE}/${scheduleId}`)
  }

  const handleCloseSheet = () => {
    navigateTo(HARMONOGRAM_ROUTE, { replace: true })
  }

  const updateScheduleRecord = React.useCallback(
    async (scheduleId: number, payload: Record<string, unknown>) => {
      const updated = await backendApi.client.put<ScheduleRecord, Record<string, unknown>>(
        `${SCHEDULE_SCHEMA_ROUTE}/${scheduleId}`,
        payload
      )
      refreshData()
      return updated
    },
    [refreshData]
  )

  const syncRelations = React.useCallback(
    async (scheduleId: number, relations: Record<string, unknown>) => {
      await syncScheduleRelations(scheduleId, relations)
      refreshData()
    },
    [refreshData]
  )

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 lg:px-6">
        <Card>
          <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex flex-col gap-1">
              <CardTitle className="flex items-center gap-2">
                <RiCalendarScheduleLine />
                Harmonogram
              </CardTitle>
              <CardDescription>
                Widok kalendarza dla grafików treningowych z obsługą tygodnia i miesiąca.
              </CardDescription>
            </div>
            <Tabs
              value={viewMode}
              onValueChange={(value) =>
                setViewMode(value === "month" ? "month" : "week")
              }
            >
              <TabsList>
                <TabsTrigger value="week">Tydzień</TabsTrigger>
                <TabsTrigger value="month">Miesiąc</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="icon" onClick={handlePrevious}>
                <RiArrowLeftSLine />
                <span className="sr-only">Poprzedni zakres</span>
              </Button>
              <Button variant="outline" size="icon" onClick={handleNext}>
                <RiArrowRightSLine />
                <span className="sr-only">Następny zakres</span>
              </Button>
              <Button variant="outline" onClick={handleToday}>
                Dzisiaj
              </Button>
              <Badge variant="secondary" className="h-7">
                {viewMode === "week"
                  ? weekRangeLabel(anchorDate)
                  : monthTitleFormatter.format(anchorDate)}
              </Badge>
              {isMoving ? (
                <Badge variant="outline" className="h-7">
                  <RiLoader4Line className="animate-spin" data-icon="inline-start" />
                  Przenoszenie...
                </Badge>
              ) : null}
            </div>

            {isLoading ? (
              <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">
                Ładowanie harmonogramu...
              </div>
            ) : error ? (
              <div className="flex min-h-64 items-center justify-center text-sm text-destructive">
                {error}
              </div>
            ) : viewMode === "week" ? (
              <div className="overflow-x-auto rounded-lg border">
                <div className="grid min-w-[980px] grid-cols-[76px_repeat(7,minmax(128px,1fr))]">
                  <div className="border-b bg-muted/30 p-2 text-xs font-medium text-muted-foreground uppercase">
                    Czas
                  </div>
                  {weekDays.map((day) => (
                    <div
                      key={toDateKey(day)}
                      className="border-b border-l-2 bg-muted/30 p-2 text-sm font-semibold"
                    >
                      {dayHeaderFormatter.format(day)}
                    </div>
                  ))}

                  <div className="bg-muted/10">
                    {hourSlots.map((hour) => (
                      <div
                        key={`time-${hour}`}
                        className="h-12 border-t border-border/80 px-2 pt-1 text-xs text-muted-foreground"
                      >
                        {String(hour).padStart(2, "0")}:00
                      </div>
                    ))}
                  </div>
                  {weekDays.map((day, dayIndex) => {
                    const dayKey = toDateKey(day)
                    const dayEvents = eventsByDate.get(dayKey) ?? []
                    const dayLayout = buildWeekDayLayout(
                      dayEvents,
                      weekStartMinutes,
                      weekEndMinutes
                    )

                    return (
                      <div
                        key={`column-${dayKey}`}
                        className={`relative border-l-2 ${
                          dayIndex % 2 === 0 ? "bg-background" : "bg-muted/10"
                        }`}
                      >
                        <div className="pointer-events-none">
                          {hourSlots.map((hour) => (
                            <div
                              key={`${dayKey}-line-${hour}`}
                              className="h-12 border-t border-border/80"
                            />
                          ))}
                        </div>
                        <div className="absolute inset-0 z-10">
                          {hourSlots.map((hour) => (
                            <div
                              key={`${dayKey}-drop-${hour}`}
                              className="h-12 border-t border-transparent"
                              onDragOver={(event) => event.preventDefault()}
                              onDrop={(event) => void handleDrop(event, day, hour)}
                            />
                          ))}
                        </div>
                        <div className="absolute inset-0 z-20 p-1.5">
                          {dayLayout.map((layoutItem) => {
                            const { event: eventItem, visibleStart, visibleEnd, column, columns } =
                              layoutItem
                            const topOffset =
                              ((visibleStart - weekStartMinutes) / 60) * WEEK_HOUR_HEIGHT_PX
                            const eventHeight = Math.max(
                              WEEK_EVENT_MIN_HEIGHT_PX,
                              ((visibleEnd - visibleStart) / 60) * WEEK_HOUR_HEIGHT_PX - 4
                            )
                            const columnWidthPercent = 100 / columns
                            const leftPercent = column * columnWidthPercent

                            return (
                              <button
                                key={`${eventItem.schedule_id}-${eventItem.occurrence_date}-${eventItem.start_time}`}
                                type="button"
                                draggable
                                style={{
                                  top: `${topOffset + 2}px`,
                                  height: `${eventHeight}px`,
                                  left: `calc(${leftPercent}% + 1px)`,
                                  width: `calc(${columnWidthPercent}% - 2px)`,
                                }}
                                onDragStart={(dragEvent) => {
                                  const payload: DragPayload = {
                                    scheduleId: eventItem.schedule_id,
                                    startTime: eventItem.start_time,
                                    endTime: eventItem.end_time,
                                  }
                                  dragEvent.dataTransfer.setData(
                                    "application/json",
                                    JSON.stringify(payload)
                                  )
                                  dragEvent.dataTransfer.effectAllowed = "move"
                                }}
                                onClick={() => handleOpenSchedule(eventItem.schedule_id)}
                                className="absolute overflow-hidden rounded-md border bg-primary/10 px-2 py-1 text-left text-xs transition-colors hover:bg-primary/20"
                              >
                                <p className="font-medium">
                                  {toTimeLabel(eventItem.start_time)} -{" "}
                                  {toTimeLabel(eventItem.end_time)}
                                </p>
                                <p className="truncate">{eventItem.training_form_name}</p>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <div className="grid min-w-[900px] grid-cols-7">
                  {Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(anchorDate), index)).map(
                    (day) => (
                      <div
                        key={`month-header-${toDateKey(day)}`}
                        className="border-b bg-muted/30 p-2 text-sm font-medium"
                      >
                        {dayShortFormatter.format(day)}
                      </div>
                    )
                  )}

                  {monthGridDays.map((day) => {
                    const dayKey = toDateKey(day)
                    const monthEvents = eventsByDate.get(dayKey) ?? []
                    const isOutsideCurrentMonth =
                      day.getMonth() !== anchorDate.getMonth()

                    return (
                      <div
                        key={dayKey}
                        className="min-h-36 border-b border-r p-2 last:border-r-0"
                      >
                        <p
                          className={`text-sm font-medium ${
                            isOutsideCurrentMonth
                              ? "text-muted-foreground"
                              : "text-foreground"
                          }`}
                        >
                          {day.getDate()}
                        </p>
                        <div className="mt-2 flex flex-col gap-1">
                          {monthEvents.map((eventItem) => (
                            <button
                              key={`${eventItem.schedule_id}-${eventItem.occurrence_date}-${eventItem.start_time}`}
                              type="button"
                              onClick={() => handleOpenSchedule(eventItem.schedule_id)}
                              className="rounded-md border bg-muted/40 px-2 py-1 text-left text-xs transition-colors hover:bg-muted"
                              title={`${eventItem.training_form_name} · ${toTimeLabel(eventItem.start_time)}-${toTimeLabel(eventItem.end_time)}`}
                            >
                              <p className="font-medium">
                                {toTimeLabel(eventItem.start_time)} {eventItem.training_form_name}
                              </p>
                              <p className="truncate text-muted-foreground">
                                {getInstructorSummary(eventItem)}
                              </p>
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {!isLoading && !error && events.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Brak zaplanowanych zajęć w wybranym zakresie.
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <RecordDetailSheet<ScheduleRecord>
        api={backendApi}
        schemaRoute={SCHEDULE_SCHEMA_ROUTE}
        baseRoute={HARMONOGRAM_ROUTE}
        recordId={selectedScheduleId}
        entityLabel="Grafik"
        readOnlyFields={READ_ONLY_FIELDS}
        onClose={handleCloseSheet}
        loadRecord={(scheduleId) =>
          backendApi.client.get<ScheduleRecord>(`${SCHEDULE_SCHEMA_ROUTE}/${scheduleId}`)
        }
        updateRecord={updateScheduleRecord}
        syncRelations={syncRelations}
        getRecordTitle={(record, recordId) => {
          const dayOfWeek = typeof record?.day_of_week === "string" ? record.day_of_week : ""
          const startTime =
            typeof record?.start_time === "string" ? toTimeLabel(record.start_time) : ""
          const titlePart = `${dayOfWeek} ${startTime}`.trim()
          return titlePart.length > 0 ? titlePart : `Grafik #${recordId}`
        }}
      />
    </div>
  )
}
