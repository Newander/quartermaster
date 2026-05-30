import CrudResourcePage from "@/pages/crud-resource-page"

type PublicDeviceIdentityPageProps = {
  currentRoute: string
}

export default function PublicDeviceIdentityPage({
  currentRoute,
}: PublicDeviceIdentityPageProps) {
  return (
    <CrudResourcePage
      currentRoute={currentRoute}
      baseRoute="/public-device-identity"
      schemaRoute="/public-device-identity"
      entityLabel="Urządzenie publiczne"
      emptyMessage="Brak urządzeń publicznych do wyświetlenia."
      detailTitleFields={["id", "assigned_member_id"]}
      deleteSuccessMessage={(record) =>
        `Usunięto urządzenie publiczne #${record.id}.`
      }
    />
  )
}
