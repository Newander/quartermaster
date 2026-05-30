import * as React from "react"
import {
  RiCalendarScheduleLine,
  RiLoader4Line,
  RiRefreshLine,
  RiShieldCheckLine,
  RiSwordLine,
  RiTimeLine,
  RiUserUnfollowLine,
} from "@remixicon/react"
import { toast } from "sonner"

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
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import {
  PublicMemberSearchSelect,
  type PublicMemberSearchRecord,
} from "@/components/public-member-search-select"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { ApiError, api } from "@/lib/api-client"
import { cn } from "@/lib/utils"

const PUBLIC_DEVICE_TOKEN_STORAGE_KEY = "hema_public_device_token"
const PUBLIC_DEVICE_TOKEN_HEADER = "X-Public-Device-Token"

type PublicMember = {
  id: number
  first_name: string
  last_name: string
}

type PublicDeviceResponse = {
  device_id: number
  device_token?: string | null
  has_assigned_member: boolean
  assigned_member?: PublicMember | null
}

type PublicSessionAttendanceItem = {
  session_id: number
  schedule_id: number
  training_form_name: string
  start_time: string
  end_time: string
  instructors: string[]
  is_cancelled: boolean
  attended: boolean | null
  attendance_id: number | null
  source: string | null
  self_reported_at: string | null
  instructor_verified_at: string | null
  updated_at: string | null
}

type PublicAttendanceDay = {
  date: string
  is_today: boolean
  sessions: PublicSessionAttendanceItem[]
}

type PublicAttendanceDaysResponse = {
  member: PublicMember
  start_date: string
  end_date: string
  today: string
  days: PublicAttendanceDay[]
}

const memberName = (member: PublicMember | null | undefined) =>
  member ? `${member.first_name} ${member.last_name}`.trim() : ""

const formatDate = (value: string) => {
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat("pl-PL", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(parsed)
}

const formatDayChip = (value: string, isToday: boolean) => {
  if (isToday) {
    return {
      label: "Dzisiaj",
      description: formatShortDate(value),
    }
  }

  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) {
    return {
      label: value,
      description: "",
    }
  }

  return {
    label: new Intl.DateTimeFormat("pl-PL", {
      weekday: "short",
    }).format(parsed),
    description: formatShortDate(value),
  }
}

const formatShortDate = (value: string) => {
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit",
    month: "2-digit",
  }).format(parsed)
}

const formatTrainingCount = (count: number) => {
  if (count === 1) {
    return "1 trening"
  }

  if (count > 1 && count < 5) {
    return `${count} treningi`
  }

  return `${count} treningów`
}

const hasSessions = (day: PublicAttendanceDay) => day.sessions.length > 0

const getTodayDay = (days: PublicAttendanceDay[]) =>
  days.find((day) => day.is_today) ?? null

const getSelectableAttendanceDays = (days: PublicAttendanceDay[]) => {
  const todayDay = getTodayDay(days)

  return days.filter((day) => day.date === todayDay?.date || hasSessions(day))
}

const getStoredPublicDeviceToken = () => {
  if (typeof window === "undefined") {
    return null
  }
  return window.localStorage.getItem(PUBLIC_DEVICE_TOKEN_STORAGE_KEY)
}

const setStoredPublicDeviceToken = (token: string) => {
  window.localStorage.setItem(PUBLIC_DEVICE_TOKEN_STORAGE_KEY, token)
}

const publicHeaders = (deviceToken: string) => ({
  [PUBLIC_DEVICE_TOKEN_HEADER]: deviceToken,
})

export default function PublicAttendancePage() {
  const [deviceToken, setDeviceToken] = React.useState<string | null>(null)
  const [assignedMember, setAssignedMember] =
    React.useState<PublicMember | null>(null)
  const [days, setDays] = React.useState<PublicAttendanceDay[]>([])
  const [selectedDayDate, setSelectedDayDate] = React.useState("")
  const [selectedMember, setSelectedMember] =
    React.useState<PublicMemberSearchRecord | null>(null)
  const [pendingSessionId, setPendingSessionId] = React.useState<number | null>(
    null
  )
  const [isBootstrapping, setIsBootstrapping] = React.useState(true)
  const [isLoadingDays, setIsLoadingDays] = React.useState(false)
  const [isAssigningMemberId, setIsAssigningMemberId] = React.useState<
    number | null
  >(null)
  const [isRemovingMember, setIsRemovingMember] = React.useState(false)

  const loadDays = React.useCallback(
    async (token: string, options: { showLoading?: boolean } = {}) => {
      const showLoading = options.showLoading ?? true

      if (showLoading) {
        setIsLoadingDays(true)
      }
      try {
        const response = await api.get<PublicAttendanceDaysResponse>(
          "/public/attendance/days",
          {
            auth: false,
            headers: publicHeaders(token),
          }
        )
        setAssignedMember(response.member)
        setDays(response.days)
      } catch (error) {
        if (error instanceof ApiError && error.status === 409) {
          setAssignedMember(null)
          setDays([])
          return
        }
        toast.error(
          error instanceof Error
            ? error.message
            : "Nie udało się załadować zajęć."
        )
      } finally {
        if (showLoading) {
          setIsLoadingDays(false)
        }
      }
    },
    []
  )

  const todayDay = React.useMemo(() => getTodayDay(days), [days])
  const selectableAttendanceDays = React.useMemo(
    () => getSelectableAttendanceDays(days),
    [days]
  )
  const selectedAttendanceDay = React.useMemo(
    () =>
      selectableAttendanceDays.find((day) => day.date === selectedDayDate) ??
      null,
    [selectableAttendanceDays, selectedDayDate]
  )

  const selectedDaySessionCount = selectedAttendanceDay?.sessions.length ?? 0

  React.useEffect(() => {
    setSelectedDayDate((currentDate) => {
      if (selectableAttendanceDays.some((day) => day.date === currentDate)) {
        return currentDate
      }

      return todayDay?.date ?? selectableAttendanceDays[0]?.date ?? ""
    })
  }, [selectableAttendanceDays, todayDay])

  React.useEffect(() => {
    let isMounted = true

    const bootstrap = async () => {
      try {
        const storedToken = getStoredPublicDeviceToken()
        const response = await api.post<PublicDeviceResponse>(
          "/public/attendance/device",
          { device_token: storedToken },
          { auth: false }
        )
        const resolvedToken = response.device_token ?? storedToken
        if (!resolvedToken) {
          throw new Error("Serwer nie zwrócił tokenu urządzenia.")
        }

        setStoredPublicDeviceToken(resolvedToken)
        if (!isMounted) {
          return
        }
        setDeviceToken(resolvedToken)
        setAssignedMember(response.assigned_member ?? null)

        if (response.assigned_member) {
          await loadDays(resolvedToken)
        }
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Nie udało się przygotować urządzenia."
        )
      } finally {
        if (isMounted) {
          setIsBootstrapping(false)
        }
      }
    }

    void bootstrap()

    return () => {
      isMounted = false
    }
  }, [loadDays])

  const handleAssignMember = async (member: PublicMember) => {
    if (!deviceToken) {
      return
    }

    setIsAssigningMemberId(member.id)
    try {
      const response = await api.put<PublicDeviceResponse>(
        "/public/attendance/device/assigned-member",
        { member_id: member.id },
        {
          auth: false,
          headers: publicHeaders(deviceToken),
        }
      )
      setAssignedMember(response.assigned_member ?? null)
      setSelectedMember(null)
      await loadDays(deviceToken)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Nie udało się przypisać użytkownika."
      )
    } finally {
      setIsAssigningMemberId(null)
    }
  }

  const handleRemoveMember = async () => {
    if (!deviceToken) {
      return
    }

    setIsRemovingMember(true)
    try {
      await api.delete<PublicDeviceResponse>(
        "/public/attendance/device/assigned-member",
        {
          auth: false,
          headers: publicHeaders(deviceToken),
        }
      )
      setAssignedMember(null)
      setDays([])
      setSelectedDayDate("")
      setSelectedMember(null)
      toast.success("Przypisany użytkownik został usunięty.")
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Nie udało się usunąć przypisanego użytkownika."
      )
    } finally {
      setIsRemovingMember(false)
    }
  }

  const renderAttendanceDay = (day: PublicAttendanceDay) => (
    <section key={day.date} className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold capitalize">
            {formatDate(day.date)}
          </h2>
          <p className="text-sm text-muted-foreground">
            {formatTrainingCount(day.sessions.length)}
          </p>
        </div>
        {day.is_today ? <Badge variant="secondary">Dzisiaj</Badge> : null}
      </div>

      {day.sessions.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-background p-4 text-sm text-muted-foreground">
          Tego dnia nie ma zajęć.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {day.sessions.map((sessionItem) => {
            const isPending = pendingSessionId === sessionItem.session_id
            const hasExternalAttendance =
              sessionItem.attended && sessionItem.source === "external_device"
            const hasInstructorAttendance =
              sessionItem.attended && sessionItem.source === "instructor"
            const attendanceStatusText = hasInstructorAttendance
              ? "Obecność potwierdzona przez instruktora."
              : hasExternalAttendance
                ? "Obecność zapisana z tego urządzenia."
                : "Obecność nie jest jeszcze zaznaczona."

            return (
              <Card
                key={sessionItem.session_id}
                className={cn(
                  "overflow-hidden",
                  sessionItem.attended && "border-primary/40 bg-primary/3",
                  sessionItem.is_cancelled && "opacity-60"
                )}
              >
                <CardHeader className="gap-0 pb-3">
                  <div className="grid grid-cols-[4.75rem_1fr_auto] items-start gap-3">
                    <div className="flex flex-col items-center rounded-md border bg-background px-2 py-2 text-center">
                      <RiTimeLine
                        className="mb-1 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <span className="text-base leading-none font-semibold">
                        {sessionItem.start_time}
                      </span>
                      <span className="mt-1 text-xs text-muted-foreground">
                        {sessionItem.end_time}
                      </span>
                    </div>
                    <div className="min-w-0 pt-0.5">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <RiSwordLine
                          className="shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <span className="truncate">
                          {sessionItem.training_form_name}
                        </span>
                      </CardTitle>
                      <CardDescription className="mt-1 truncate">
                        {sessionItem.instructors.length > 0
                          ? sessionItem.instructors.join(", ")
                          : "Instruktor nie został wskazany"}
                      </CardDescription>
                    </div>
                    {hasExternalAttendance ? (
                      <Badge variant="secondary">Zaznaczone</Badge>
                    ) : hasInstructorAttendance ? (
                      <Badge variant="outline">Instruktor</Badge>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div
                    className={cn(
                      "flex min-h-9 items-center gap-2 rounded-md px-3 py-2 text-sm",
                      sessionItem.attended
                        ? "bg-secondary text-secondary-foreground"
                        : "bg-muted/60 text-muted-foreground"
                    )}
                  >
                    {sessionItem.attended ? (
                      <RiShieldCheckLine aria-hidden="true" />
                    ) : (
                      <RiTimeLine aria-hidden="true" />
                    )}
                    {attendanceStatusText}
                  </div>
                  {sessionItem.is_cancelled ? (
                    <Badge variant="outline" className="w-fit">
                      Odwołane
                    </Badge>
                  ) : (
                    <div
                      className={cn(
                        "flex min-h-16 cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors",
                        sessionItem.attended
                          ? "border-primary bg-primary/5"
                          : "border-input bg-background hover:bg-muted/50",
                        isPending && "cursor-wait opacity-70"
                      )}
                    >
                      <Checkbox
                        checked={sessionItem.attended === true}
                        disabled={isPending}
                        onCheckedChange={(checked) =>
                          void handleAttendanceChange(
                            sessionItem,
                            checked === true
                          )
                        }
                        aria-label="Byłem"
                      />
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5 text-left disabled:cursor-wait"
                        disabled={isPending}
                        onClick={() =>
                          void handleAttendanceChange(
                            sessionItem,
                            sessionItem.attended !== true
                          )
                        }
                      >
                        <span className="text-sm font-medium">Byłem</span>
                        <span className="text-xs text-muted-foreground">
                          Kliknij, aby zmienić status obecności.
                        </span>
                      </button>
                      <div className="flex size-4 shrink-0 items-center justify-center">
                        {isPending ? (
                          <RiLoader4Line
                            className="animate-spin text-muted-foreground"
                            aria-hidden="true"
                          />
                        ) : null}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </section>
  )

  const handleAttendanceChange = async (
    sessionItem: PublicSessionAttendanceItem,
    nextAttended: boolean
  ) => {
    if (!deviceToken) {
      return
    }

    const previousDays = days
    setPendingSessionId(sessionItem.session_id)
    setDays((currentDays) =>
      currentDays.map((day) => ({
        ...day,
        sessions: day.sessions.map((currentSession) =>
          currentSession.session_id === sessionItem.session_id
            ? {
                ...currentSession,
                attended: nextAttended,
                source: "external_device",
              }
            : currentSession
        ),
      }))
    )

    try {
      await api.put(
        `/public/attendance/sessions/${sessionItem.session_id}`,
        { attended: nextAttended },
        {
          auth: false,
          headers: publicHeaders(deviceToken),
        }
      )
      await loadDays(deviceToken, { showLoading: false })
    } catch (error) {
      setDays(previousDays)
      toast.error(
        error instanceof Error
          ? error.message
          : "Nie udało się zapisać obecności."
      )
    } finally {
      setPendingSessionId(null)
    }
  }

  if (isBootstrapping) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-muted/30 p-4 text-sm text-muted-foreground">
        <RiLoader4Line className="animate-spin" aria-hidden="true" />
        <span className="ml-2">Ładowanie...</span>
      </main>
    )
  }

  return (
    <main className="min-h-svh bg-muted/30">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4 p-4">
        <header className="flex flex-col gap-4 rounded-lg border bg-background p-4">
          <div className="flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <RiSwordLine aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-muted-foreground">
                HEMA Garden
              </p>
              <h1 className="truncate text-2xl font-semibold tracking-tight">
                {assignedMember
                  ? memberName(assignedMember)
                  : "Wybierz uczestnika"}
              </h1>
              {assignedMember ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  Obecności z ostatniego tygodnia
                </p>
              ) : null}
            </div>
          </div>
          {assignedMember ? (
            <div className="flex items-center justify-between gap-3 rounded-md bg-muted/60 p-2">
              <div className="min-w-0 text-sm text-muted-foreground">
                To urządzenie jest przypisane do wybranego uczestnika.
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0"
                onClick={handleRemoveMember}
                disabled={isRemovingMember}
              >
                {isRemovingMember ? (
                  <RiLoader4Line
                    data-icon="inline-start"
                    className="animate-spin"
                  />
                ) : (
                  <RiUserUnfollowLine data-icon="inline-start" />
                )}
                Usuń
              </Button>
            </div>
          ) : null}
        </header>

        {!assignedMember ? (
          <Card>
            <CardHeader>
              <CardTitle>Przypisz użytkownika</CardTitle>
              <CardDescription>
                To urządzenie będzie pamiętać jednego wybranego uczestnika.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="member-search">
                    Wyszukaj uczestnika
                  </FieldLabel>
                  <PublicMemberSearchSelect
                    value={selectedMember}
                    disabled={isAssigningMemberId !== null}
                    onSelect={(member) => {
                      setSelectedMember(member)
                      void handleAssignMember(member)
                    }}
                  />
                  <FieldDescription>
                    Po wyborze uczestnika to urządzenie będzie otwierać jego
                    zajęcia.
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>
        ) : (
          <section className="flex flex-col gap-4">
            {isLoadingDays ? (
              <div className="flex items-center justify-center gap-2 rounded-lg border bg-background p-6 text-sm text-muted-foreground">
                <RiLoader4Line className="animate-spin" aria-hidden="true" />
                Ładowanie zajęć...
              </div>
            ) : null}

            {selectableAttendanceDays.length > 0 ? (
              <section className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Wybierz dzień</p>
                      <p className="text-xs text-muted-foreground">
                        {formatTrainingCount(selectedDaySessionCount)} w
                        wybranym dniu
                      </p>
                    </div>
                    <RiCalendarScheduleLine
                      className="shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                  </div>
                  <ScrollArea className="-mx-4 px-4">
                    <ToggleGroup
                      type="single"
                      value={selectedDayDate}
                      onValueChange={(value) => {
                        if (value) {
                          setSelectedDayDate(value)
                        }
                      }}
                      spacing={2}
                      className="w-max pb-3"
                    >
                      {selectableAttendanceDays.map((day) => {
                        const dayChip = formatDayChip(day.date, day.is_today)

                        return (
                          <ToggleGroupItem
                            key={day.date}
                            value={day.date}
                            aria-label={formatDate(day.date)}
                            className="h-auto min-w-20 flex-col gap-1 px-3 py-2"
                          >
                            <span className="text-sm font-medium capitalize">
                              {dayChip.label}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {dayChip.description}
                            </span>
                          </ToggleGroupItem>
                        )
                      })}
                    </ToggleGroup>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                </div>

                {selectedAttendanceDay
                  ? renderAttendanceDay(selectedAttendanceDay)
                  : null}
              </section>
            ) : null}

            {days.length === 0 && !isLoadingDays ? (
              <div className="rounded-lg border border-dashed bg-background p-6 text-sm text-muted-foreground">
                W dostępnym okresie nie ma zajęć.
              </div>
            ) : null}
          </section>
        )}

        {assignedMember ? (
          <Button
            variant="ghost"
            className="self-center"
            onClick={() => void loadDays(deviceToken ?? "")}
            disabled={!deviceToken || isLoadingDays}
          >
            <RiRefreshLine data-icon="inline-start" />
            Odśwież
          </Button>
        ) : null}
      </div>
    </main>
  )
}
