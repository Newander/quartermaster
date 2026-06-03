import CrudResourcePage from "@/pages/crud-resource-page"

type TrainingFormPageProps = {
  currentRoute: string
}

export default function TrainingFormPage({
  currentRoute,
}: TrainingFormPageProps) {
  return (
    <CrudResourcePage
      currentRoute={currentRoute}
      baseRoute="/training-form"
      schemaRoute="/training/forms"
      entityLabel="Training form"
      emptyMessage="No training forms to display."
      detailTitleFields={["name"]}
      deleteSuccessMessage={(record) =>
        `Deleted training form #${record.id}.`
      }
    />
  )
}
