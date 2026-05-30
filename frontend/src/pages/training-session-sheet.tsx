import * as React from "react"
import { RiAddLine, RiDeleteBinLine, RiLoader4Line, RiSave3Line } from "@remixicon/react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { backendApi } from "@/lib/backend-api"
import { navigateTo } from "@/lib/router"

const BASE_ROUTE = "/training-session-sheet"
const BASE_ROUTE_PREFIX = `${BASE_ROUTE}/`
const HARMONOGRAM_WINDOW_DAYS = 90

type TrainingFormInfo = {
  name?: string | null
}

type ScheduleInfo = {
  id: number
  training_form?: TrainingFormInfo | null
}

type TrainingSessionRecord = {
  id: number
  schedule_id: number
  session_date: string
  is_cancelled: boolean
  schedule?: ScheduleInfo | null
}

type TrainingSessionListResponse = {
  total: number
  records: TrainingSessionRecord[]
}

type MemberRecord = {
  id: number
  first_name: string
  last_name: string
  is_deleted?: boolean
}

type MemberListResponse = {
  total: number
  records: MemberRecord[]
}

type AttendanceRecord = {
  id: number
  session_id: number
  member_id: number
  attended: boolean
  notes?: string | null
  source?: string | null
  self_reported_at?: string | null
  instructor_verified_at?: string | null
}

type AttendanceListResponse = {
  total: number
  records: AttendanceRecord[]
}

type AttendanceRow = {
  member_id: number
  attendance_id: number | null
  attended: boolean
  notes: string
  source: string | null
  self_reported_at: string | null
  instructor_verified_at: string | null
}

type HarmonogramEvent = {
  schedule_id: number
  occurrence_date: string
  start_time: string
  end_time: string
}

type HarmonogramResponse = {
  total: number
  events: HarmonogramEvent[]
}

type TrainingSessionSheetPageProps = {
  currentRoute: string
}

const dateFormatter = new Intl.DateTimeFormat("pl-PL", {
  day: "2-digit",
  month: "long",
  year: "numeric",
})

const timeFormatter = (value: string) => value.slice(0, 5)

const timestampFormatter = new Intl.DateTimeFormat("pl-PL", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
})

const parseSessionIdFromRoute = (route: string): number | null => {
  if (!route.startsWith(BASE_ROUTE_PREFIX)) {
    return null
  }

  const parsedId = Number(route.slice(BASE_ROUTE_PREFIX.length))
  return Number.isInteger(parsedId) && parsedId > 0 ? parsedId : null
}

const toDateLabel = (value: string) => {
  const parsed = new Date(`${value}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? value : dateFormatter.format(parsed)
}

const addDays = (isoDate: string, days: number) => {
  const parsed = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) {
    return isoDate
  }

  parsed.setDate(parsed.getDate() + days)
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`
}

const toTimestampLabel = (value: string | null) => {
  if (!value) {
    return null
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : timestampFormatter.format(parsed)
}

const getMemberFullName = (member?: MemberRecord) => {
  if (!member) {
    return "Nieznany członek"
  }

  return `${member.first_name} ${member.last_name}`.trim()
}

const toSessionLabel = (session: TrainingSessionRecord) => {
  const trainingFormName = session.schedule?.training_form?.name
  const suffix = trainingFormName ? ` · ${trainingFormName}` : ""
  return `${session.session_date} · #${session.id}${suffix}`
}

const toAttendanceRow = (attendance: AttendanceRecord): AttendanceRow => ({
  member_id: attendance.member_id,
  attendance_id: attendance.id,
  attended: attendance.attended,
  notes: attendance.notes ?? "",
  source: attendance.source ?? null,
  self_reported_at: attendance.self_reported_at ?? null,
  instructor_verified_at: attendance.instructor_verified_at ?? null,
})

const dedupeAttendances = (records: AttendanceRecord[]) => {
  const sorted = [...records].sort((left, right) => right.id - left.id)
  const byMember = new Map<number, AttendanceRecord>()
  for (const record of sorted) {
    if (!byMember.has(record.member_id)) {
      byMember.set(record.member_id, record)
    }
  }

  return [...byMember.values()]
}

export default function TrainingSessionSheetPage({
  currentRoute,
}: TrainingSessionSheetPageProps) {
  const routeSessionId = React.useMemo(
    () => parseSessionIdFromRoute(currentRoute),
    [currentRoute]
  )
  const [selectedSessionId, setSelectedSessionId] = React.useState<string>(
    routeSessionId ? String(routeSessionId) : ""
  )
  const [sessions, setSessions] = React.useState<TrainingSessionRecord[]>([])
  const [members, setMembers] = React.useState<MemberRecord[]>([])
  const [rows, setRows] = React.useState<AttendanceRow[]>([])
  const [removedAttendanceIds, setRemovedAttendanceIds] = React.useState<number[]>([])
  const [selectedSession, setSelectedSession] =
    React.useState<TrainingSessionRecord | null>(null)
  const [harmonogramEvents, setHarmonogramEvents] = React.useState<HarmonogramEvent[]>([])
  const [memberToAdd, setMemberToAdd] = React.useState<string>("")
  const [isLoadingSessions, setIsLoadingSessions] = React.useState(false)
  const [isLoadingMembers, setIsLoadingMembers] = React.useState(false)
  const [isLoadingSessionData, setIsLoadingSessionData] = React.useState(false)
  const [isLoadingHarmonogram, setIsLoadingHarmonogram] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)
  const [sessionDataRevision, setSessionDataRevision] = React.useState(0)

  React.useEffect(() => {
    setSelectedSessionId(routeSessionId ? String(routeSessionId) : "")
  }, [routeSessionId])

  React.useEffect(() => {
    let isCancelled = false
    const abortController = new AbortController()

    const loadSessions = async () => {
      setIsLoadingSessions(true)
      try {
        const response = await backendApi.client.get<TrainingSessionListResponse>(
          "/training/training-session",
          {
            query: {
              skip: 0,
              limit: 1000,
              order_by_col: "session_date",
              order_by_asc: "desc",
            },
            signal: abortController.signal,
          }
        )
        if (!isCancelled) {
          setSessions(response.records)
        }
      } catch (error) {
        if (!isCancelled && !abortController.signal.aborted) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Nie udało się pobrać listy sesji."
          )
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingSessions(false)
        }
      }
    }

    void loadSessions()

    return () => {
      isCancelled = true
      abortController.abort()
    }
  }, [])

  React.useEffect(() => {
    let isCancelled = false
    const abortController = new AbortController()

    const loadMembers = async () => {
      setIsLoadingMembers(true)
      try {
        const response = await backendApi.client.get<MemberListResponse>("/member", {
          query: {
            skip: 0,
            limit: 3000,
            order_by_col: "last_name",
            order_by_asc: "asc",
            filters: JSON.stringify({
              is_deleted: false,
            }),
          },
          signal: abortController.signal,
        })

        if (!isCancelled) {
          setMembers(response.records)
        }
      } catch (error) {
        if (!isCancelled && !abortController.signal.aborted) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Nie udało się pobrać listy członków."
          )
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingMembers(false)
        }
      }
    }

    void loadMembers()

    return () => {
      isCancelled = true
      abortController.abort()
    }
  }, [])

  React.useEffect(() => {
    if (!selectedSessionId) {
      setSelectedSession(null)
      setRows([])
      setRemovedAttendanceIds([])
      setHarmonogramEvents([])
      return
    }

    let isCancelled = false
    const abortController = new AbortController()
    const numericSessionId = Number(selectedSessionId)

    const loadSessionData = async () => {
      setIsLoadingSessionData(true)
      try {
        const [sessionRecord, attendanceResponse] = await Promise.all([
          backendApi.client.get<TrainingSessionRecord>(
            `/training/training-session/${numericSessionId}`,
            {
              signal: abortController.signal,
            }
          ),
          backendApi.client.get<AttendanceListResponse>("/training/attendance", {
            query: {
              skip: 0,
              limit: 1000,
              filters: JSON.stringify({
                session_id: numericSessionId,
              }),
            },
            signal: abortController.signal,
          }),
        ])

        if (isCancelled) {
          return
        }

        const dedupedAttendances = dedupeAttendances(attendanceResponse.records)

        setSelectedSession(sessionRecord)
        setRows(dedupedAttendances.map(toAttendanceRow))
        setRemovedAttendanceIds([])
        setMemberToAdd("")
      } catch (error) {
        if (!isCancelled && !abortController.signal.aborted) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Nie udało się pobrać danych sesji."
          )
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingSessionData(false)
        }
      }
    }

    void loadSessionData()

    return () => {
      isCancelled = true
      abortController.abort()
    }
  }, [selectedSessionId, sessionDataRevision])

  React.useEffect(() => {
    if (!selectedSession?.schedule_id) {
      setHarmonogramEvents([])
      return
    }

    let isCancelled = false
    const abortController = new AbortController()
    const startDate = addDays(selectedSession.session_date, -HARMONOGRAM_WINDOW_DAYS)
    const endDate = addDays(selectedSession.session_date, HARMONOGRAM_WINDOW_DAYS)

    const loadHarmonogram = async () => {
      setIsLoadingHarmonogram(true)
      try {
        const response = await backendApi.client.get<HarmonogramResponse>(
          "/training/harmonogram",
          {
            query: {
              start_date: startDate,
              end_date: endDate,
            },
            signal: abortController.signal,
          }
        )

        if (!isCancelled) {
          setHarmonogramEvents(
            response.events
              .filter((event) => event.schedule_id === selectedSession.schedule_id)
              .sort((left, right) =>
                `${left.occurrence_date}${left.start_time}`.localeCompare(
                  `${right.occurrence_date}${right.start_time}`
                )
              )
          )
        }
      } catch (error) {
        if (!isCancelled && !abortController.signal.aborted) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Nie udało się pobrać terminów z harmonogramu."
          )
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingHarmonogram(false)
        }
      }
    }

    void loadHarmonogram()

    return () => {
      isCancelled = true
      abortController.abort()
    }
  }, [selectedSession])

  const membersById = React.useMemo(
    () =>
      members.reduce<Record<number, MemberRecord>>((accumulator, member) => {
        accumulator[member.id] = member
        return accumulator
      }, {}),
    [members]
  )

  const previousEvents = React.useMemo(() => {
    if (!selectedSession) {
      return []
    }

    return harmonogramEvents
      .filter((event) => event.occurrence_date < selectedSession.session_date)
      .slice(-5)
      .reverse()
  }, [harmonogramEvents, selectedSession])

  const upcomingEvents = React.useMemo(() => {
    if (!selectedSession) {
      return []
    }

    return harmonogramEvents
      .filter((event) => event.occurrence_date > selectedSession.session_date)
      .slice(0, 5)
  }, [harmonogramEvents, selectedSession])

  const addableMembers = React.useMemo(() => {
    const alreadyAdded = new Set(rows.map((row) => row.member_id))
    return members.filter((member) => !alreadyAdded.has(member.id))
  }, [members, rows])

  const handleSessionSelect = (value: string) => {
    navigateTo(`${BASE_ROUTE}/${value}`)
  }

  const handleAddMember = () => {
    const memberId = Number(memberToAdd)
    if (!Number.isInteger(memberId) || memberId <= 0) {
      return
    }

    if (rows.some((row) => row.member_id === memberId)) {
      toast.error("Ten członek jest już na liście.")
      return
    }

    setRows((current) => [
      ...current,
      {
        member_id: memberId,
        attendance_id: null,
        attended: true,
        notes: "",
        source: null,
        self_reported_at: null,
        instructor_verified_at: null,
      },
    ])
    setMemberToAdd("")
  }

  const handleRowChange = (
    memberId: number,
    nextPatch: Partial<Pick<AttendanceRow, "attended" | "notes">>
  ) => {
    setRows((current) =>
      current.map((row) =>
        row.member_id === memberId
          ? {
              ...row,
              ...nextPatch,
            }
          : row
      )
    )
  }

  const handleRemoveRow = (memberId: number) => {
    setRows((current) => {
      const rowToRemove = current.find((row) => row.member_id === memberId)
      if (rowToRemove?.attendance_id) {
        setRemovedAttendanceIds((removed) => [
          ...new Set([...removed, rowToRemove.attendance_id as number]),
        ])
      }
      return current.filter((row) => row.member_id !== memberId)
    })
  }

  const handleSave = async () => {
    if (!selectedSessionId) {
      return
    }

    const numericSessionId = Number(selectedSessionId)
    const deletedIds = new Set<number>()

    setIsSaving(true)
    try {
      for (const attendanceId of removedAttendanceIds) {
        await backendApi.client.delete(`/training/attendance/${attendanceId}`)
        deletedIds.add(attendanceId)
      }

      for (const row of rows) {
        const normalizedNotes = row.notes.trim()
        if (row.attendance_id) {
          if (deletedIds.has(row.attendance_id)) {
            continue
          }
          if (!row.attended) {
            await backendApi.client.delete(`/training/attendance/${row.attendance_id}`)
            deletedIds.add(row.attendance_id)
            continue
          }

          await backendApi.client.put(`/training/attendance/${row.attendance_id}`, {
            session_id: numericSessionId,
            member_id: row.member_id,
            attended: row.attended,
            notes: normalizedNotes || null,
          })
          continue
        }

        if (!row.attended) {
          continue
        }

        await backendApi.client.post("/training/attendance", {
          session_id: numericSessionId,
          member_id: row.member_id,
          attended: true,
          notes: normalizedNotes || null,
        })
      }

      toast.success("Lista obecności została zapisana.")
      setSessionDataRevision((current) => current + 1)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Nie udało się zapisać listy obecności."
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 lg:px-6">
        <Card>
          <CardHeader className="gap-3">
            <CardTitle>Lista obecności sesji</CardTitle>
            <CardDescription>
              Wybierz konkretną sesję treningową i uzupełnij listę obecności.
            </CardDescription>
            <div className="max-w-xl">
              <Select value={selectedSessionId} onValueChange={handleSessionSelect}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Wybierz sesję treningową" />
                </SelectTrigger>
                <SelectContent>
                  {isLoadingSessions ? (
                    <SelectItem value="__loading" disabled>
                      Ładowanie sesji...
                    </SelectItem>
                  ) : sessions.length > 0 ? (
                    sessions.map((session) => (
                      <SelectItem key={session.id} value={String(session.id)}>
                        {toSessionLabel(session)}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="__empty" disabled>
                      Brak sesji treningowych.
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {!selectedSessionId ? (
              <p className="text-sm text-muted-foreground">
                Po wybraniu sesji pojawi się tabela obecności oraz terminy z harmonogramu.
              </p>
            ) : isLoadingSessionData ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <RiLoader4Line className="size-4 animate-spin" />
                Ładowanie danych sesji...
              </div>
            ) : (
              <>
                <div className="grid gap-4 lg:grid-cols-2">
                  <Card className="border-dashed">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Poprzednie terminy</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {isLoadingHarmonogram ? (
                        <p className="text-sm text-muted-foreground">
                          Ładowanie harmonogramu...
                        </p>
                      ) : previousEvents.length > 0 ? (
                        <ul className="space-y-2 text-sm">
                          {previousEvents.map((event) => (
                            <li key={`${event.occurrence_date}-${event.start_time}`}>
                              {toDateLabel(event.occurrence_date)} ·{" "}
                              {timeFormatter(event.start_time)}-{timeFormatter(event.end_time)}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Brak wcześniejszych terminów w oknie harmonogramu.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                  <Card className="border-dashed">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Nadchodzące terminy</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {isLoadingHarmonogram ? (
                        <p className="text-sm text-muted-foreground">
                          Ładowanie harmonogramu...
                        </p>
                      ) : upcomingEvents.length > 0 ? (
                        <ul className="space-y-2 text-sm">
                          {upcomingEvents.map((event) => (
                            <li key={`${event.occurrence_date}-${event.start_time}`}>
                              {toDateLabel(event.occurrence_date)} ·{" "}
                              {timeFormatter(event.start_time)}-{timeFormatter(event.end_time)}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Brak kolejnych terminów w oknie harmonogramu.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Select value={memberToAdd} onValueChange={setMemberToAdd}>
                    <SelectTrigger className="w-full min-w-64 sm:w-96">
                      <SelectValue
                        placeholder={
                          isLoadingMembers
                            ? "Ładowanie członków..."
                            : "Wybierz członka do dodania"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {addableMembers.length > 0 ? (
                        addableMembers.map((member) => (
                          <SelectItem key={member.id} value={String(member.id)}>
                            {getMemberFullName(member)}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="__no-members" disabled>
                          Brak członków do dodania.
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <Button onClick={handleAddMember} disabled={!memberToAdd}>
                    <RiAddLine data-icon="inline-start" />
                    Dodaj członka
                  </Button>
                  <Button onClick={handleSave} disabled={isSaving || !selectedSessionId}>
                    {isSaving ? (
                      <RiLoader4Line data-icon="inline-start" className="animate-spin" />
                    ) : (
                      <RiSave3Line data-icon="inline-start" />
                    )}
                    Zapisz listę
                  </Button>
                </div>

                <div className="overflow-hidden rounded-lg border">
                  <Table>
                    <TableHeader className="bg-border">
                      <TableRow>
                        <TableHead>Członek</TableHead>
                        <TableHead className="w-28">Obecny</TableHead>
                        <TableHead className="w-44">Źródło</TableHead>
                        <TableHead>Notatka</TableHead>
                        <TableHead className="w-28 text-right">Akcje</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.length > 0 ? (
                        rows.map((row) => (
                          <TableRow key={row.member_id}>
                            <TableCell>
                              {getMemberFullName(membersById[row.member_id])}
                            </TableCell>
                            <TableCell>
                              <Checkbox
                                checked={row.attended}
                                onCheckedChange={(checked) =>
                                  handleRowChange(row.member_id, {
                                    attended: checked === true,
                                  })
                                }
                                aria-label={`Obecność członka ${row.member_id}`}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                {row.source === "external_device" ? (
                                  <Badge variant="secondary" className="w-fit">
                                    Urządzenie
                                  </Badge>
                                ) : row.source === "instructor" ? (
                                  <Badge variant="outline" className="w-fit">
                                    Instruktor
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="w-fit">
                                    Nowy wpis
                                  </Badge>
                                )}
                                {toTimestampLabel(row.self_reported_at) ? (
                                  <span className="text-xs text-muted-foreground">
                                    Samo: {toTimestampLabel(row.self_reported_at)}
                                  </span>
                                ) : null}
                                {toTimestampLabel(row.instructor_verified_at) ? (
                                  <span className="text-xs text-muted-foreground">
                                    Instr.: {toTimestampLabel(row.instructor_verified_at)}
                                  </span>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Input
                                value={row.notes}
                                onChange={(event) =>
                                  handleRowChange(row.member_id, {
                                    notes: event.target.value,
                                  })
                                }
                                placeholder="Notatka (opcjonalnie)"
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => handleRemoveRow(row.member_id)}
                                aria-label="Usuń wiersz"
                              >
                                <RiDeleteBinLine />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell
                            colSpan={5}
                            className="h-24 text-center text-muted-foreground"
                          >
                            Lista jest pusta. Dodaj członków i oznacz obecność.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
