import { DataTable } from "@/components/data-table"
import type { DataTableRowAction } from "@/components/data-table-row-actions"
import { RecordDetailSheet } from "@/components/record-detail-sheet"
import * as React from "react"
import {
  backendApi,
  type Instructor,
  type InstructorUpdateInput,
} from "@/lib/backend-api"
import { Card, CardContent } from "@/components/ui/card"
import { navigateTo } from "@/lib/router"
import { RiArchiveLine, RiEyeLine } from "@remixicon/react"
import { toast } from "sonner"

const INSTRUCTOR_ROUTE_PREFIX = "/instructor/"
const INSTRUCTOR_SCHEMA_ROUTE = "/instructor"
const INSTRUCTOR_EXCLUDED_COLUMNS = [
  "created_at",
  "updated_at",
  "id",
]

const getInstructorIdFromRoute = (route: string) => {
  if (!route.startsWith(INSTRUCTOR_ROUTE_PREFIX)) {
    return null
  }

  const recordId = Number(route.slice(INSTRUCTOR_ROUTE_PREFIX.length))
  return Number.isInteger(recordId) && recordId > 0 ? recordId : null
}

const getInstructorName = (instructor: Instructor) =>
  instructor.member
    ? `${instructor.member.first_name} ${instructor.member.last_name}`
    : `Instruktor #${instructor.id}`

type InstructorsPageProps = {
  currentRoute: string
}

export default function InstructorsPage({
  currentRoute,
}: InstructorsPageProps) {
  const selectedInstructorId = getInstructorIdFromRoute(currentRoute)
  const [reloadKey, setReloadKey] = React.useState(0)

  const handleArchive = React.useCallback(async (instructor: Instructor | null) => {
    if (!instructor) {
      toast.error("Unable to identify the record to archive.")
      return
    }

    try {
      await backendApi.deleteByRoute(INSTRUCTOR_SCHEMA_ROUTE, instructor.id)
      toast.success(`Archived ${getInstructorName(instructor)}.`)
      setReloadKey((current) => current + 1)
      navigateTo(INSTRUCTOR_SCHEMA_ROUTE, { replace: true })
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to archive the instructor."
      )
    }
  }, [])

  const instructorRowActions: DataTableRowAction<Instructor>[] = [
    {
      label: "Open details",
      icon: RiEyeLine,
      onSelect: (instructor) => navigateTo(`/instructor/${instructor.id}`),
    },
    {
      label: "Archive",
      icon: RiArchiveLine,
      variant: "destructive",
      onSelect: (instructor) => void handleArchive(instructor),
    },
  ]

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 lg:px-6">
        <Card>
          <CardContent>
            <DataTable
              api={backendApi}
              schemaRoute={INSTRUCTOR_SCHEMA_ROUTE}
              reloadKey={reloadKey}
              currentRoute={currentRoute}
              createRouteBase={INSTRUCTOR_SCHEMA_ROUTE}
              excludedColumns={INSTRUCTOR_EXCLUDED_COLUMNS}
              withRowSelection
              getRowId={(row: Instructor) => row.id.toString()}
              emptyMessage="No instructors to display."
              rowActions={instructorRowActions}
            />
          </CardContent>
        </Card>
      </div>
      <RecordDetailSheet<Instructor>
        api={backendApi}
        schemaRoute={INSTRUCTOR_SCHEMA_ROUTE}
        baseRoute={INSTRUCTOR_SCHEMA_ROUTE}
        recordId={selectedInstructorId}
        entityLabel="Instructor"
        readOnlyFields={INSTRUCTOR_EXCLUDED_COLUMNS}
        onClose={() => navigateTo(INSTRUCTOR_SCHEMA_ROUTE, { replace: true })}
        loadRecord={(instructorId) => backendApi.instructor.getById(instructorId)}
        updateRecord={(instructorId, payload) =>
          backendApi.instructor.update(
            instructorId,
            payload as InstructorUpdateInput
          )
        }
        onArchive={handleArchive}
        getRecordTitle={(instructor, instructorId) =>
          instructor
            ? getInstructorName(instructor)
            : `Instruktor #${instructorId}`
        }
      />
    </div>
  )
}
