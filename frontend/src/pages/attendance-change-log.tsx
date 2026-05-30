import CrudResourcePage from "@/pages/crud-resource-page"

type AttendanceChangeLogPageProps = {
  currentRoute: string
}

export default function AttendanceChangeLogPage({
  currentRoute,
}: AttendanceChangeLogPageProps) {
  return (
    <CrudResourcePage
      currentRoute={currentRoute}
      baseRoute="/attendance-change-log"
      schemaRoute="/attendance-change-log"
      entityLabel="Zmiana obecności"
      emptyMessage="Brak zmian obecności do wyświetlenia."
      detailTitleFields={["session_id", "member_id", "changed_by"]}
      disableUpdate
      deleteSuccessMessage={(record) =>
        `Usunięto wpis historii obecności #${record.id}.`
      }
    />
  )
}
