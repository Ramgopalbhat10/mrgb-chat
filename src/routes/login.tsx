import { createFileRoute, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { HugeiconsIcon } from '@hugeicons/react'
import { GithubIcon } from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth-client'
import { AUTH_BYPASS_ENABLED } from '@/lib/auth-bypass-config'

type LoginSearch = {
  error?: string
}

const isAuthBypassEnabled = createServerFn({ method: 'GET' }).handler(
  () => AUTH_BYPASS_ENABLED,
)

export const Route = createFileRoute('/login')({
  beforeLoad: async () => {
    if (await isAuthBypassEnabled()) {
      throw redirect({ to: '/' })
    }
  },
  component: LoginPage,
  validateSearch: (search: Record<string, unknown>): LoginSearch => {
    return {
      error: typeof search.error === 'string' ? search.error : undefined,
    }
  },
})

function LoginPage() {
  const { error } = Route.useSearch()

  const handleSignIn = async () => {
    await authClient.signIn.social({
      provider: 'github',
      callbackURL: '/',
    })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 p-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Welcome</h1>
          <p className="text-sm text-muted-foreground">
            Sign in with your GitHub account to continue
          </p>
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <Button className="w-full" size="lg" onClick={handleSignIn}>
          <HugeiconsIcon
            icon={GithubIcon}
            size={20}
            strokeWidth={2}
            className="mr-2"
          />
          Sign in with GitHub
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Only authorized users can access this application
        </p>
      </div>
    </div>
  )
}
