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
      entityLabel="Attendance change"
      emptyMessage="No attendance changes to display."
      detailTitleFields={["session_id", "member_id", "changed_by"]}
      disableUpdate
      deleteSuccessMessage={(record) =>
        `Deleted attendance history entry #${record.id}.`
      }
    />
  )
}
