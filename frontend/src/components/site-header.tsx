import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { ThemeToggle } from "@/components/theme-toggle"

type SiteHeaderProps = {
  title: string
}

export function SiteHeader({ title }: SiteHeaderProps) {
  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b bg-background/95 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full min-w-0 items-center gap-2 px-4 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="data-[orientation=vertical]:h-4"
        />
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <h1 className="truncate text-base font-medium">{title}</h1>
              <Badge variant="outline" className="hidden sm:inline-flex">
                Demo
              </Badge>
            </div>
            <p className="hidden truncate text-xs text-muted-foreground md:block">
              Quartermaster CRM operations console
            </p>
          </div>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Badge variant="secondary" className="hidden md:inline-flex">
            Local stack
          </Badge>
          <ThemeToggle showLabel={false} />
        </div>
      </div>
    </header>
  )
}
