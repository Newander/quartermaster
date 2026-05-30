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
  CardDescription,
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

type MonthPickerProps = {
  id?: string
  value: string
  onChange: (value: string) => void
  nullable?: boolean
  placeholder?: string
  disabled?: boolean
}

type MonthPickerViewMode = "months" | "years" | "decades"

const parseDateValue = (value: string) => {
  const normalizedValue = value.trim()
  const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(normalizedValue)

  if (!match) {
    return null
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const parsedDay = match[3] ? Number(match[3]) : 1
  const day = Number.isInteger(parsedDay) && parsedDay >= 1 && parsedDay <= 31
    ? parsedDay
    : 1
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return null
  }
  const parsedDate = new Date(year, month - 1, day)

  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate
}

const formatMonthDateValue = (value: Date) => {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, "0")

  return `${year}-${month}-01`
}

const getDisplayValue = (value: string) => {
  const parsedDate = parseDateValue(value)

  if (!parsedDate) {
    return null
  }

  return new Intl.DateTimeFormat("pl-PL", {
    month: "long",
    year: "numeric",
  }).format(parsedDate)
}

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

const getCenturyRange = (value: Date) => {
  const startYear = Math.floor(value.getFullYear() / 100) * 100
  return {
    startYear,
    endYear: startYear + 99,
  }
}

const getDecadeLabel = (value: Date) => {
  const { startYear, endYear } = getDecadeRange(value)
  return `${startYear} - ${endYear}`
}

const getCenturyLabel = (value: Date) => {
  const { startYear, endYear } = getCenturyRange(value)
  return `${startYear} - ${endYear}`
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

export function MonthPicker({
  id,
  value,
  onChange,
  nullable = false,
  placeholder = "Wybierz miesiąc i rok",
  disabled = false,
}: MonthPickerProps) {
  const [open, setOpen] = React.useState(false)
  const [viewMode, setViewMode] = React.useState<MonthPickerViewMode>("months")
  const selectedDate = React.useMemo(() => parseDateValue(value), [value])
  const [viewDate, setViewDate] = React.useState<Date>(
    selectedDate ?? new Date()
  )

  React.useEffect(() => {
    if (open) {
      setViewDate(selectedDate ?? new Date())
      setViewMode("months")
    }
  }, [open, selectedDate])

  const months = React.useMemo(() => getMonthOptions(viewDate), [viewDate])
  const years = React.useMemo(() => getYearOptions(viewDate), [viewDate])
  const decades = React.useMemo(() => getDecadeOptions(viewDate), [viewDate])
  const displayValue = React.useMemo(() => getDisplayValue(value), [value])

  const viewTitle = React.useMemo(() => {
    if (viewMode === "years") {
      return getDecadeLabel(viewDate)
    }

    if (viewMode === "decades") {
      return getCenturyLabel(viewDate)
    }

    return getYearLabel(viewDate)
  }, [viewDate, viewMode])

  const canExpandView = viewMode !== "decades"
  const previousLabel =
    viewMode === "months"
      ? "Poprzedni rok"
      : viewMode === "years"
        ? "Poprzednia dekada"
        : "Poprzednie stulecie"
  const nextLabel =
    viewMode === "months"
      ? "Następny rok"
      : viewMode === "years"
        ? "Następna dekada"
        : "Następne stulecie"

  const handlePrevious = () => {
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

  const handleSelectMonth = (monthDate: Date) => {
    if (disabled) {
      return
    }

    onChange(formatMonthDateValue(monthDate))
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
      <PopoverContent align="start" className="w-[22rem] p-0">
        <Card
          size="sm"
          className="gap-0 border-0 bg-transparent py-0 shadow-none ring-0"
        >
          <CardHeader className="grid grid-cols-[auto_1fr_auto] items-start gap-1 border-b py-3">
            <Button
              variant="ghost"
              size="icon-xs"
              disabled={disabled}
              onClick={handlePrevious}
              aria-label={previousLabel}
            >
              <RiArrowLeftSLine />
            </Button>
            <div className="flex flex-col items-center gap-0.5">
              <CardTitle className="flex justify-center text-sm">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={disabled || !canExpandView}
                  onClick={() => {
                    if (viewMode === "months") {
                      setViewMode("years")
                      return
                    }

                    if (viewMode === "years") {
                      setViewMode("decades")
                    }
                  }}
                  className="h-7 px-2"
                >
                  {viewTitle}
                </Button>
              </CardTitle>
              <CardDescription className="text-[11px]">
                Wybierz miesiąc i rok
              </CardDescription>
            </div>
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
            {viewMode === "months" ? (
              <div className="grid grid-cols-4 gap-1">
                {months.map((monthDate) => {
                  const isSelectedMonth =
                    !!selectedDate &&
                    selectedDate.getFullYear() === monthDate.getFullYear() &&
                    selectedDate.getMonth() === monthDate.getMonth()

                  return (
                    <Button
                      key={monthDate.toISOString()}
                      variant={isSelectedMonth ? "default" : "ghost"}
                      size="sm"
                      disabled={disabled}
                      className={cn(
                        "h-10 rounded-lg text-sm capitalize",
                        isSelectedMonth && "shadow-sm"
                      )}
                      onClick={() => handleSelectMonth(monthDate)}
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
              onClick={() => handleSelectMonth(new Date())}
            >
              Bieżący miesiąc
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
