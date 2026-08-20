import { NotFoundContent } from '@/components/store/not-found-content'

/**
 * 404 for every storefront route, so it renders inside the public chrome and
 * the visitor keeps the nav and footer to get back out with.
 *
 * No `metadata` export: Next only reads metadata from `layout` and `page`, so a
 * segment-level `not-found` inherits the layout's title. The response carries a
 * real 404 status, which is what search engines act on.
 */
export default function PublicNotFound() {
  return <NotFoundContent />
}
