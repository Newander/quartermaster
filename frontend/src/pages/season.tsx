import CrudResourcePage from "@/pages/crud-resource-page"

type SeasonPageProps = {
  currentRoute: string
}

export default function SeasonPage({ currentRoute }: SeasonPageProps) {
  return (
    <CrudResourcePage
      currentRoute={currentRoute}
      baseRoute="/season"
      schemaRoute="/training/seasons"
      entityLabel="Season"
      emptyMessage="No seasons to display."
      detailTitleFields={["name"]}
      deleteSuccessMessage={(record) => `Deleted season #${record.id}.`}
    />
  )
}
