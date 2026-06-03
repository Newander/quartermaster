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
      entityLabel="Public device"
      emptyMessage="No public devices to display."
      detailTitleFields={["id", "assigned_member_id"]}
      deleteSuccessMessage={(record) =>
        `Deleted public device #${record.id}.`
      }
    />
  )
}
