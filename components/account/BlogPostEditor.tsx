'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Save, Send, ArrowLeft, Trash2 } from 'lucide-react'
import Link from 'next/link'

const BLOG_CATEGORIES = [
  'Business Tips',
  'Community News',
  'Food & Recipes',
  'Local Events',
  'Craftsmanship',
  'Small Business Spotlight',
  'Health & Wellness',
  'Behind the Scenes',
  'General',
]

interface BlogPostEditorProps {
  post?: {
    id: string
    title: string
    content: string
    excerpt: string | null
    featuredImage: string | null
    category: string | null
    status: string
  }
}

export function BlogPostEditor({ post }: BlogPostEditorProps) {
  const router = useRouter()
  const isEditing = !!post

  const [title, setTitle] = useState(post?.title || '')
  const [content, setContent] = useState(post?.content || '')
  const [excerpt, setExcerpt] = useState(post?.excerpt || '')
  const [featuredImage, setFeaturedImage] = useState(post?.featuredImage || '')
  const [category, setCategory] = useState(post?.category || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async (submitForReview = false) => {
    if (!title.trim()) {
      setError('Title is required')
      return
    }
    if (!content.trim()) {
      setError('Content is required')
      return
    }

    setSaving(true)
    setError('')

    try {
      const payload = {
        title: title.trim(),
        content: content.trim(),
        excerpt: excerpt.trim() || null,
        featuredImage: featuredImage.trim() || null,
        category: category || null,
        status: submitForReview ? 'PUBLISHED' : 'DRAFT',
      }

      const url = isEditing
        ? `/api/account/blog/posts/${post.id}`
        : '/api/account/blog/posts'

      const res = await fetch(url, {
        method: isEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save post')
      }

      router.push('/account/blog')
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!post || !confirm('Are you sure you want to delete this post?')) return

    setSaving(true)
    try {
      const res = await fetch(`/api/account/blog/posts/${post.id}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete post')
      }

      router.push('/account/blog')
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/account/blog">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">
            {isEditing ? 'Edit Post' : 'Create New Post'}
          </h1>
          {post?.status && (
            <Badge variant="outline">{post.status.replace('_', ' ')}</Badge>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-4 space-y-4">
            <div>
              <label className="text-sm font-medium">Title *</label>
              <Input
                placeholder="Enter your post title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 text-lg"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Excerpt (summary)</label>
              <textarea
                placeholder="Write a brief summary of your post..."
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[80px]"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Content *</label>
              <textarea
                placeholder="Write your blog post content here... You can use plain text to share your story, tips, updates, or articles with the Zanesville community."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[400px] font-mono"
              />
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card className="p-4 space-y-4">
            <h3 className="font-medium">Post Settings</h3>

            <div>
              <label className="text-sm font-medium">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select a category</option>
                {BLOG_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium">Featured Image URL</label>
              <Input
                placeholder="https://..."
                value={featuredImage}
                onChange={(e) => setFeaturedImage(e.target.value)}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Paste a URL to an image for your post header
              </p>
            </div>
          </Card>

          <Card className="p-4 space-y-3">
            <h3 className="font-medium">Actions</h3>
            <Button
              onClick={() => handleSave(false)}
              disabled={saving}
              variant="outline"
              className="w-full"
            >
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Saving...' : 'Save Draft'}
            </Button>
            <Button
              onClick={() => handleSave(true)}
              disabled={saving}
              className="w-full bg-salsa-500 hover:bg-salsa-600"
            >
              <Send className="mr-2 h-4 w-4" />
              {saving ? 'Submitting...' : 'Submit for Review'}
            </Button>
            {isEditing && (
              <Button
                onClick={handleDelete}
                disabled={saving}
                variant="outline"
                className="w-full text-red-600 hover:bg-red-50"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Post
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              Posts submitted for review will be published after an admin approves them.
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}
