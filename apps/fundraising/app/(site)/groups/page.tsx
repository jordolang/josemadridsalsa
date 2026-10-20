import type { Metadata } from 'next'
import { GroupDirectory } from '@/components/fundraising-site/group-directory'
import { getGroupDirectory } from '@/lib/fundraising-site/groups'

export const revalidate = 300

export const metadata: Metadata = {
  title: { absolute: 'Find Your Group | Jose Madrid Salsa Fundraising' },
  description:
    'Supporting a school, team or club? Find the group you want to help, and every jar of salsa you order raises money for them.',
  alternates: { canonical: '/groups' },
}

export default async function GroupsPage() {
  const groups = await getGroupDirectory().catch(() => null)

  return (
    <div className="container mx-auto px-4 py-10">
      <header className="mx-auto mb-8 max-w-3xl text-center">
        <h1 className="mb-4 font-serif text-3xl font-bold text-foreground lg:text-4xl">Find your group</h1>
        <p className="text-lg text-muted-foreground">
          These groups are taking online orders right now. Pick yours, shop, and every jar you order raises money for them.
        </p>
      </header>
      {groups === null ? (
        <p role="alert" className="mx-auto max-w-xl rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
          The group list can’t be loaded right now. Please try again in a few minutes.
        </p>
      ) : (
        <GroupDirectory groups={groups} />
      )}
    </div>
  )
}
