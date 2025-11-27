import { redirect } from 'next/navigation'

export default function DocsIndexPage() {
  // Redirect /docs to /docs/index which should be handled by the [[...slug]] route
  redirect('/docs/index')
}
