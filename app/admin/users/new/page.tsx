import { User } from 'lucide-react'
import UserForm from '@/components/admin/UserForm'

export default function NewUserPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <User className="h-8 w-8 text-blue-600" />
        <h1 className="text-3xl font-bold">Create User</h1>
      </div>
      <UserForm />
    </div>
  )
}
