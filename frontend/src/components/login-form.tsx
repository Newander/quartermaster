import { useState, type ComponentProps, type FormEvent } from "react"
import {
  RiArrowRightLine,
  RiKey2Line,
  RiShieldUserLine,
  RiUserLine,
} from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

const DEMO_IDENTIFIER = "admin_hema"
const DEMO_PASSWORD = "supersecretpassword123"

type LoginFormValues = {
  identifier: string
  password: string
}

export function LoginForm({
  className,
  onLogin,
  error,
  isSubmitting,
  ...props
}: ComponentProps<"div"> & {
  onLogin?: (values: LoginFormValues) => void | Promise<void>
  error?: string | null
  isSubmitting?: boolean
}) {
  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onLogin?.({ identifier, password })
  }

  const fillDemoCredentials = () => {
    setIdentifier(DEMO_IDENTIFIER)
    setPassword(DEMO_PASSWORD)
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="gap-1.5">
          <div className="mb-2 flex size-10 items-center justify-center rounded-lg border bg-primary/10 text-primary">
            <RiShieldUserLine aria-hidden="true" />
          </div>
          <CardTitle className="text-xl">Sign in</CardTitle>
          <CardDescription>Use your club administrator account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="identifier">Email or username</FieldLabel>
                <div className="relative">
                  <RiUserLine
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    id="identifier"
                    type="text"
                    autoComplete="username"
                    placeholder="admin_hema"
                    value={identifier}
                    onChange={(event) => setIdentifier(event.target.value)}
                    disabled={isSubmitting}
                    className="pl-8"
                    required
                  />
                </div>
              </Field>
              <Field>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <div className="relative">
                  <RiKey2Line
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={isSubmitting}
                    className="pl-8"
                    required
                  />
                </div>
                <FieldDescription>
                  Use the password provided by the club administrator.
                </FieldDescription>
              </Field>

              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Demo access</p>
                    <dl className="mt-2 grid gap-1 text-xs text-muted-foreground">
                      <div className="flex items-center justify-between gap-3">
                        <dt>Username</dt>
                        <dd className="font-mono text-foreground">
                          {DEMO_IDENTIFIER}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt>Password</dt>
                        <dd className="font-mono text-foreground">
                          {DEMO_PASSWORD}
                        </dd>
                      </div>
                    </dl>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={fillDemoCredentials}
                    disabled={isSubmitting}
                  >
                    Fill
                  </Button>
                </div>
              </div>

              <Field>
                <Button type="submit" disabled={isSubmitting} className="w-full">
                  {isSubmitting ? "Signing in..." : "Sign in"}
                  <RiArrowRightLine data-icon="inline-end" />
                </Button>
                <FieldError>{error}</FieldError>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
