import { redirect } from 'next/navigation'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { HtmlTemplateUploader } from './_components/html-template-uploader'

export const metadata = {
  title: 'Upload HTML Template',
}

export default async function UploadHtmlTemplatePage() {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'content:write'))) {
    redirect('/admin')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Upload HTML Template</h1>
        <p className="text-muted-foreground">
          Upload a raw .html file, tweak it in the split-view editor, then save it as a
          reusable template you can mass-send to your contacts.
        </p>
      </div>

      <HtmlTemplateUploader />
    </div>
  )
}
