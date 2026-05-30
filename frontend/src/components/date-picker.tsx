import * as React from "react"
import {
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiCalendarLine,
} from "@remixicon/react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

type DatePickerProps = {
  id?: string
  value: string
  onChange: (value: string) => void
  nullable?: boolean
  placeholder?: string
  disabled?: boolean
}

type CalendarViewMode = "days" | "months" | "years" | "decades"

const WEEKDAY_LABELS = ["Pon", "Wt", "Sr", "Czw", "Pt", "Sob", "Niedz"] as const

const parseDateValue = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)

  if (!match) {
    return null
  }

  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  const parsedDate = new Date(year, month, day)

  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate
}

const formatDateValue = (value: Date) => {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, "0")
  const day = String(value.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

const getMonthLabel = (value: Date) =>
  new Intl.DateTimeFormat("pl-PL", {
    month: "long",
    year: "numeric",
  }).format(value)

const getMonthShortLabel = (value: Date) =>
  new Intl.DateTimeFormat("pl-PL", {
    month: "short",
  }).format(value)

const getYearLabel = (value: Date) => String(value.getFullYear())

const getDecadeRange = (value: Date) => {
  const startYear = Math.floor(value.getFullYear() / 10) * 10
  return {
    startYear,
    endYear: startYear + 9,
  }
}

const getDecadeLabel = (value: Date) => {
  const { startYear, endYear } = getDecadeRange(value)
  return `${startYear} - ${endYear}`
}

const getCenturyRange = (value: Date) => {
  const startYear = Math.floor(value.getFullYear() / 100) * 100
  return {
    startYear,
    endYear: startYear + 99,
  }
}

const getCenturyLabel = (value: Date) => {
  const { startYear, endYear } = getCenturyRange(value)
  return `${startYear} - ${endYear}`
}

const getDisplayValue = (value: string) => {
  const parsedDate = parseDateValue(value)

  if (!parsedDate) {
    return null
  }

  return new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(parsedDate)
}

const isSameDay = (left: Date | null, right: Date) =>
  !!left &&
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate()

const getCalendarDays = (viewDate: Date) => {
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const firstDay = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const leadingEmptyDays = (firstDay.getDay() + 6) % 7
  const totalSlots = Math.ceil((leadingEmptyDays + daysInMonth) / 7) * 7

  return Array.from({ length: totalSlots }, (_, index) => {
    const dayNumber = index - leadingEmptyDays + 1

    if (dayNumber < 1 || dayNumber > daysInMonth) {
      return null
    }

    return new Date(year, month, dayNumber)
  })
}

const getMonthOptions = (viewDate: Date) =>
  Array.from(
    { length: 12 },
    (_, monthIndex) => new Date(viewDate.getFullYear(), monthIndex, 1)
  )

const getYearOptions = (viewDate: Date) => {
  const { startYear } = getDecadeRange(viewDate)
  const rangeStart = startYear - 1

  return Array.from({ length: 12 }, (_, index) => rangeStart + index)
}

const getDecadeOptions = (viewDate: Date) => {
  const { startYear } = getCenturyRange(viewDate)
  const rangeStart = startYear - 10

  return Array.from({ length: 12 }, (_, index) => rangeStart + index * 10)
}

export function DatePicker({
  id,
  value,
  onChange,
  nullable = false,
  placeholder = "Wybierz datę",
  disabled = false,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [viewMode, setViewMode] = React.useState<CalendarViewMode>("days")
  const selectedDate = React.useMemo(() => parseDateValue(value), [value])
  const [viewDate, setViewDate] = React.useState<Date>(
    selectedDate ?? new Date()
  )

  React.useEffect(() => {
    if (open) {
      setViewDate(selectedDate ?? new Date())
      setViewMode("days")
    }
  }, [open, selectedDate])

  const days = React.useMemo(() => getCalendarDays(viewDate), [viewDate])
  const months = React.useMemo(() => getMonthOptions(viewDate), [viewDate])
  const years = React.useMemo(() => getYearOptions(viewDate), [viewDate])
  const decades = React.useMemo(() => getDecadeOptions(viewDate), [viewDate])
  const displayValue = React.useMemo(() => getDisplayValue(value), [value])

  const viewTitle = React.useMemo(() => {
    if (viewMode === "months") {
      return getYearLabel(viewDate)
    }

    if (viewMode === "years") {
      return getDecadeLabel(viewDate)
    }

    if (viewMode === "decades") {
      return getCenturyLabel(viewDate)
    }

    return getMonthLabel(viewDate)
  }, [viewDate, viewMode])

  const canExpandView = viewMode !== "decades"
  const previousLabel =
    viewMode === "days"
      ? "Poprzedni miesiąc"
      : viewMode === "months"
        ? "Poprzedni rok"
        : viewMode === "years"
          ? "Poprzednia dekada"
          : "Poprzednie stulecie"
  const nextLabel =
    viewMode === "days"
      ? "Następny miesiąc"
      : viewMode === "months"
        ? "Następny rok"
        : viewMode === "years"
          ? "Następna dekada"
          : "Następne stulecie"

  const handlePrevious = () => {
    if (viewMode === "days") {
      setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))
      return
    }

    if (viewMode === "months") {
      setViewDate(new Date(viewDate.getFullYear() - 1, viewDate.getMonth(), 1))
      return
    }

    if (viewMode === "years") {
      setViewDate(new Date(viewDate.getFullYear() - 10, viewDate.getMonth(), 1))
      return
    }

    setViewDate(new Date(viewDate.getFullYear() - 100, viewDate.getMonth(), 1))
  }

  const handleNext = () => {
    if (viewMode === "days") {
      setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))
      return
    }

    if (viewMode === "months") {
      setViewDate(new Date(viewDate.getFullYear() + 1, viewDate.getMonth(), 1))
      return
    }

    if (viewMode === "years") {
      setViewDate(new Date(viewDate.getFullYear() + 10, viewDate.getMonth(), 1))
      return
    }

    setViewDate(new Date(viewDate.getFullYear() + 100, viewDate.getMonth(), 1))
  }

  const handleSelect = (nextDate: Date) => {
    if (disabled) {
      return
    }

    onChange(formatDateValue(nextDate))
    setOpen(false)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        if (!disabled) {
          setOpen(nextOpen)
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !displayValue && "text-muted-foreground"
          )}
        >
          <span className="truncate">{displayValue ?? placeholder}</span>
          <RiCalendarLine data-icon="inline-end" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[20rem] p-0">
        <Card
          size="sm"
          className="gap-0 border-0 bg-transparent py-0 shadow-none ring-0"
        >
          <CardHeader className="grid grid-cols-[auto_1fr_auto] items-center gap-1 border-b py-3">
            <Button
              variant="ghost"
              size="icon-xs"
              disabled={disabled}
              onClick={handlePrevious}
              aria-label={previousLabel}
            >
              <RiArrowLeftSLine />
            </Button>
            <CardTitle className="flex justify-center text-sm">
              <Button
                variant="ghost"
                size="sm"
                disabled={disabled || !canExpandView}
                onClick={() => {
                  if (viewMode === "days") {
                    setViewMode("months")
                    return
                  }

                  if (viewMode === "months") {
                    setViewMode("years")
                    return
                  }

                  if (viewMode === "years") {
                    setViewMode("decades")
                  }
                }}
                className="h-7 px-2 capitalize"
              >
                {viewTitle}
              </Button>
            </CardTitle>
            <Button
              variant="ghost"
              size="icon-xs"
              disabled={disabled}
              onClick={handleNext}
              aria-label={nextLabel}
            >
              <RiArrowRightSLine />
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 px-3 py-3">
            {viewMode === "days" ? (
              <div className="grid grid-cols-7 gap-1">
                {WEEKDAY_LABELS.map((weekday) => (
                  <div
                    key={weekday}
                    className="flex h-7 items-center justify-center text-xs font-medium text-muted-foreground"
                  >
                    {weekday}
                  </div>
                ))}
                {days.map((day, index) =>
                  day ? (
                    <Button
                      key={day.toISOString()}
                      variant={
                        isSameDay(selectedDate, day) ? "default" : "ghost"
                      }
                      size="icon-xs"
                      disabled={disabled}
                      className={cn(
                        "size-8 rounded-lg text-sm",
                        isSameDay(selectedDate, day) && "shadow-sm"
                      )}
                      onClick={() => handleSelect(day)}
                    >
                      {day.getDate()}
                    </Button>
                  ) : (
                    <div key={`empty-${index}`} className="size-8" />
                  )
                )}
              </div>
            ) : null}
            {viewMode === "months" ? (
              <div className="grid grid-cols-3 gap-1">
                {months.map((monthDate) => {
                  const isSelectedMonth =
                    !!selectedDate &&
                    selectedDate.getFullYear() === viewDate.getFullYear() &&
                    selectedDate.getMonth() === monthDate.getMonth()

                  return (
                    <Button
                      key={monthDate.toISOString()}
                      variant={isSelectedMonth ? "default" : "ghost"}
                      size="sm"
                      disabled={disabled}
                      className={cn(
                        "h-9 rounded-lg text-sm capitalize",
                        isSelectedMonth && "shadow-sm"
                      )}
                      onClick={() => {
                        setViewDate(
                          new Date(
                            viewDate.getFullYear(),
                            monthDate.getMonth(),
                            1
                          )
                        )
                        setViewMode("days")
                      }}
                    >
                      {getMonthShortLabel(monthDate)}
                    </Button>
                  )
                })}
              </div>
            ) : null}
            {viewMode === "years" ? (
              <div className="grid grid-cols-3 gap-1">
                {years.map((year) => {
                  const { startYear, endYear } = getDecadeRange(viewDate)
                  const isOutOfDecade = year < startYear || year > endYear
                  const isSelectedYear =
                    !!selectedDate && selectedDate.getFullYear() === year

                  return (
                    <Button
                      key={year}
                      variant={isSelectedYear ? "default" : "ghost"}
                      size="sm"
                      disabled={disabled}
                      className={cn(
                        "h-9 rounded-lg text-sm",
                        isSelectedYear && "shadow-sm",
                        isOutOfDecade && "text-muted-foreground"
                      )}
                      onClick={() => {
                        setViewDate(new Date(year, viewDate.getMonth(), 1))
                        setViewMode("months")
                      }}
                    >
                      {year}
                    </Button>
                  )
                })}
              </div>
            ) : null}
            {viewMode === "decades" ? (
              <div className="grid grid-cols-3 gap-1">
                {decades.map((decadeStart) => {
                  const decadeEnd = decadeStart + 9
                  const { startYear, endYear } = getCenturyRange(viewDate)
                  const isOutOfCentury =
                    decadeEnd < startYear || decadeStart > endYear
                  const selectedYear = selectedDate?.getFullYear() ?? null
                  const isSelectedDecade =
                    selectedYear !== null &&
                    selectedYear >= decadeStart &&
                    selectedYear <= decadeEnd

                  return (
                    <Button
                      key={decadeStart}
                      variant={isSelectedDecade ? "default" : "ghost"}
                      size="sm"
                      disabled={disabled}
                      className={cn(
                        "h-9 rounded-lg text-sm",
                        isSelectedDecade && "shadow-sm",
                        isOutOfCentury && "text-muted-foreground"
                      )}
                      onClick={() => {
                        setViewDate(
                          new Date(decadeStart, viewDate.getMonth(), 1)
                        )
                        setViewMode("years")
                      }}
                    >
                      {`${decadeStart}-${decadeEnd}`}
                    </Button>
                  )
                })}
              </div>
            ) : null}
          </CardContent>
          <CardFooter className="justify-between gap-2 border-t bg-transparent px-3 py-3">
            <Button
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={() => handleSelect(new Date())}
            >
              Dzisiaj
            </Button>
            {nullable ? (
              <Button
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={() => {
                  onChange("")
                  setOpen(false)
                }}
              >
                Wyczyść
              </Button>
            ) : null}
          </CardFooter>
        </Card>
      </PopoverContent>
    </Popover>
  )
}
