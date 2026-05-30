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
      schemaRoute="/training/training-form"
      entityLabel="Forma treningowa"
      emptyMessage="Brak form treningowych do wyświetlenia."
      detailTitleFields={["name"]}
      deleteSuccessMessage={(record) =>
        `Usunięto formę treningową #${record.id}.`
      }
    />
  )
}
