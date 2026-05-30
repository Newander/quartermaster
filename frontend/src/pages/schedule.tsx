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
      entityLabel="Grafik"
      emptyMessage="Brak grafików do wyświetlenia."
      detailTitleFields={["day_of_week", "start_time"]}
      deleteSuccessMessage={(record) => `Usunięto grafik #${record.id}.`}
      syncRelations={syncScheduleRelations}
    />
  )
}
