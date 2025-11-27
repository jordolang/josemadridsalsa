'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Loader2, Save, X, Plus, Trash2 } from 'lucide-react'
import type { Recipe } from '@prisma/client'

interface RecipeFormProps {
  recipe?: Recipe
}

export default function RecipeForm({ recipe }: RecipeFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [title, setTitle] = useState(recipe?.title || '')
  const [slug, setSlug] = useState(recipe?.slug || '')
  const [description, setDescription] = useState(recipe?.description || '')
  const [category, setCategory] = useState(recipe?.category || '')
  const [difficulty, setDifficulty] = useState(recipe?.difficulty || 'Easy')
  const [prepTime, setPrepTime] = useState(recipe?.prepTime || '')
  const [cookTime, setCookTime] = useState(recipe?.cookTime || '')
  const [servings, setServings] = useState(recipe?.servings.toString() || '4')
  const [featuredImage, setFeaturedImage] = useState(recipe?.featuredImage || '')
  const [featured, setFeatured] = useState(recipe?.featured || false)
  const [ingredients, setIngredients] = useState<string[]>(recipe?.ingredients || [''])
  const [instructions, setInstructions] = useState<string[]>(recipe?.instructions || [''])
  const [metaTitle, setMetaTitle] = useState(recipe?.metaTitle || '')
  const [metaDescription, setMetaDescription] = useState(recipe?.metaDescription || '')
  const [ogImage, setOgImage] = useState(recipe?.ogImage || '')

  const isEditing = !!recipe

  const handleTitleChange = (value: string) => {
    setTitle(value)
    if (!isEditing) {
      setSlug(value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
    }
  }

  const addIngredient = () => setIngredients([...ingredients, ''])
  const removeIngredient = (index: number) => setIngredients(ingredients.filter((_, i) => i !== index))
  const updateIngredient = (index: number, value: string) => {
    const updated = [...ingredients]
    updated[index] = value
    setIngredients(updated)
  }

  const addInstruction = () => setInstructions([...instructions, ''])
  const removeInstruction = (index: number) => setInstructions(instructions.filter((_, i) => i !== index))
  const updateInstruction = (index: number, value: string) => {
    const updated = [...instructions]
    updated[index] = value
    setInstructions(updated)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const payload = {
        title,
        slug,
        description,
        category,
        difficulty,
        prepTime,
        cookTime,
        servings: parseInt(servings),
        featuredImage,
        featured,
        ingredients: ingredients.filter(i => i.trim()),
        instructions: instructions.filter(i => i.trim()),
        metaTitle: metaTitle || null,
        metaDescription: metaDescription || null,
        ogImage: ogImage || null,
      }

      const url = isEditing ? `/api/admin/recipes/${recipe.id}` : '/api/admin/recipes'
      const method = isEditing ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save recipe')
      }

      router.push('/admin/recipes')
      router.refresh()
    } catch (err: any) {
      setError(err.message)
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Basic Info */}
      <Card className="p-6">
        <h2 className="mb-4 text-xl font-semibold">Basic Information</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input id="title" value={title} onChange={(e) => handleTitleChange(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">Slug *</Label>
            <Input id="slug" value={slug} onChange={(e) => setSlug(e.target.value)} required />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">Category *</Label>
            <Input id="category" value={category} onChange={(e) => setCategory(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="difficulty">Difficulty *</Label>
            <select id="difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="w-full rounded-md border px-3 py-2">
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="prepTime">Prep Time *</Label>
            <Input id="prepTime" value={prepTime} onChange={(e) => setPrepTime(e.target.value)} placeholder="e.g., 15 minutes" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cookTime">Cook Time *</Label>
            <Input id="cookTime" value={cookTime} onChange={(e) => setCookTime(e.target.value)} placeholder="e.g., 30 minutes" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="servings">Servings *</Label>
            <Input id="servings" type="number" value={servings} onChange={(e) => setServings(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="featuredImage">Featured Image URL *</Label>
            <Input id="featuredImage" value={featuredImage} onChange={(e) => setFeaturedImage(e.target.value)} required />
          </div>
        </div>
      </Card>

      {/* Ingredients */}
      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Ingredients</h2>
          <Button type="button" size="sm" onClick={addIngredient}><Plus className="mr-2 h-4 w-4" />Add</Button>
        </div>
        <div className="space-y-2">
          {ingredients.map((ing, i) => (
            <div key={i} className="flex gap-2">
              <Input value={ing} onChange={(e) => updateIngredient(i, e.target.value)} placeholder="e.g., 2 cups tomatoes, diced" />
              {ingredients.length > 1 && (
                <Button type="button" size="sm" variant="ghost" onClick={() => removeIngredient(i)}><Trash2 className="h-4 w-4" /></Button>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Instructions */}
      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Instructions</h2>
          <Button type="button" size="sm" onClick={addInstruction}><Plus className="mr-2 h-4 w-4" />Add</Button>
        </div>
        <div className="space-y-2">
          {instructions.map((inst, i) => (
            <div key={i} className="flex gap-2">
              <span className="mt-2 text-sm font-medium text-slate-600">{i + 1}.</span>
              <Textarea value={inst} onChange={(e) => updateInstruction(i, e.target.value)} placeholder="Describe this step" rows={2} />
              {instructions.length > 1 && (
                <Button type="button" size="sm" variant="ghost" onClick={() => removeInstruction(i)}><Trash2 className="h-4 w-4" /></Button>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* SEO */}
      <Card className="p-6">
        <h2 className="mb-4 text-xl font-semibold">SEO</h2>
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="metaTitle">Meta Title</Label>
            <Input id="metaTitle" value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="metaDescription">Meta Description</Label>
            <Textarea id="metaDescription" value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} rows={3} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ogImage">OG Image URL</Label>
            <Input id="ogImage" value={ogImage} onChange={(e) => setOgImage(e.target.value)} />
          </div>
        </div>
      </Card>

      {/* Settings */}
      <Card className="p-6">
        <h2 className="mb-4 text-xl font-semibold">Settings</h2>
        <div className="flex items-center justify-between">
          <div>
            <Label>Featured Recipe</Label>
            <p className="text-sm text-slate-500">Show on homepage</p>
          </div>
          <Switch checked={featured} onCheckedChange={(checked: boolean) => setFeatured(checked)} />
        </div>
      </Card>

      {/* Actions */}
      <div className="flex gap-4">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : <><Save className="mr-2 h-4 w-4" />{isEditing ? 'Update' : 'Create'}</>}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push('/admin/recipes')} disabled={isSubmitting}>
          <X className="mr-2 h-4 w-4" />Cancel
        </Button>
      </div>
    </form>
  )
}
