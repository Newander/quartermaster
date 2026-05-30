import * as React from "react"
import {RiArrowDownSLine} from "@remixicon/react"

import {cn} from "@/lib/utils"

type NativeSelectProps = React.ComponentProps<"select"> & {
    containerClassName?: string
}

function NativeSelect({
                          className,
                          containerClassName,
                          children,
                          ...props
                      }: NativeSelectProps) {
    return (
        <div className={cn("relative w-full", containerClassName)}>
            <select
                data-slot="native-select"
                className={cn(
                    "h-8 w-full appearance-none rounded-lg border border-input bg-transparent px-2.5 pr-8 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
                    className
                )}
                {...props}
            >
                {children}
            </select>
            <RiArrowDownSLine className="pointer-events-none absolute top-1/2 right-2 size-4 -translate-y-1/2 text-muted-foreground"/>
        </div>
    )
}

export {NativeSelect}
