import CrudResourcePage from "@/pages/crud-resource-page"
import { syncScheduleRelations } from "@/lib/schedule-relations"

type SchedulePageProps = {
  currentRoute: string
}

export default function SchedulePage({ currentRoute }: SchedulePageProps) {
  return (
    <CrudResourcePage
      currentRoute={currentRoute}
      baseRoute="/schedule"
      schemaRoute="/training/schedule"
      entityLabel="Schedule"
      emptyMessage="No schedules to display."
      detailTitleFields={["day_of_week", "start_time"]}
      deleteSuccessMessage={(record) => `Deleted schedule #${record.id}.`}
      syncRelations={syncScheduleRelations}
    />
  )
}
