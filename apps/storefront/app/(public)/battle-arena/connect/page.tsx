import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StateSchema, isAllowedReturnUrl } from '@/lib/arena-game/rules'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Sign in to Battle Arena - Jose Madrid Salsa',
  description: 'Use your Jose Madrid Salsa account to play the Battle Arena game.',
  robots: { index: false, follow: false },
}

type SearchParams = Promise<{ return_to?: string; state?: string; error?: string }>

/**
 * Where the Battle Arena game sends players to sign in. A signed-out visitor goes through the
 * normal sign-in page and lands back here; a signed-in one confirms with one press, and
 * /api/arena/auth/authorize sends them back to the game signed in.
 */
export default async function BattleArenaConnectPage({ searchParams }: { searchParams: SearchParams }) {
  const { return_to: returnTo = '', state = '', error } = await searchParams
  const valid = !error && isAllowedReturnUrl(returnTo) && StateSchema.safeParse(state).success

  if (!valid) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-lg items-center px-4 py-16">
        <Card className="w-full p-8 text-center">
          <h1 className="mb-3 text-2xl font-bold">This sign-in link does not work</h1>
          <p className="text-muted-foreground">
            Go back to the Battle Arena game and press <strong>Sign in</strong> again.
          </p>
        </Card>
      </main>
    )
  }

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    const here = `/battle-arena/connect?${new URLSearchParams({ return_to: returnTo, state })}`
    redirect(`/auth/signin?${new URLSearchParams({ callbackUrl: here })}`)
  }

  const name = session.user.name || session.user.email
  const signOut = `/api/auth/signout?${new URLSearchParams({ callbackUrl: `/battle-arena/connect?${new URLSearchParams({ return_to: returnTo, state })}` })}`

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg items-center px-4 py-16">
      <Card className="w-full p-8 text-center">
        <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-orange-600">José Madrid Salsa Battle Arena</p>
        <h1 className="mb-3 text-2xl font-bold">Play as {name}?</h1>
        <p className="mb-6 text-muted-foreground">
          The game will use your account for your fighter name, your fundraising group, and your wins and knockouts on
          the leaderboards. It never sees your password, email or orders.
        </p>
        <form method="post" action="/api/arena/auth/authorize">
          <input type="hidden" name="return_to" value={returnTo} />
          <input type="hidden" name="state" value={state} />
          <Button type="submit" size="lg" className="w-full">
            Play as {name}
          </Button>
        </form>
        <p className="mt-4 text-sm text-muted-foreground">
          Not you? <Link href={signOut} className="underline">Sign in with another account</Link>
        </p>
      </Card>
    </main>
  )
}
