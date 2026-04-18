import { useState, useEffect } from 'react'
import { useNavigate, Navigate, useParams } from 'react-router-dom'
import { Upload, X, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { ROUTES } from '@/lib/constants'
import type { ServiceCategory } from '@/lib/types'
import {
  Button,
  Input,
  Textarea,
  Select,
  Card,
  CardHeader,
  CardContent,
  Spinner,
  EmptyState,
} from '@/components/ui'

const URGENCY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'emergency', label: 'Emergency' },
] as const

type FormErrors = Partial<Record<string, string>>

type EditablePost = {
  id: string
  customer_id: string
  category_id: string
  title: string
  description: string
  budget_min: number | null
  budget_max: number | null
  location_address: string | null
  preferred_date: string | null
  preferred_time: string | null
  urgency: 'low' | 'medium' | 'high' | 'emergency'
  status: string
  images: string[] | null
}

export function EditPost() {
  const { id } = useParams<{ id: string }>()
  const { user, profile, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [categories, setCategories] = useState<ServiceCategory[]>([])
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [errors, setErrors] = useState<FormErrors>({})
  const [post, setPost] = useState<EditablePost | null>(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [budgetMin, setBudgetMin] = useState('')
  const [budgetMax, setBudgetMax] = useState('')
  const [locationAddress, setLocationAddress] = useState('')
  const [preferredDate, setPreferredDate] = useState('')
  const [preferredTime, setPreferredTime] = useState('')
  const [urgency, setUrgency] = useState<'low' | 'medium' | 'high' | 'emergency'>('medium')
  const [existingImages, setExistingImages] = useState<string[]>([])
  const [newImageFiles, setNewImageFiles] = useState<File[]>([])

  useEffect(() => {
    async function fetchCategories() {
      const { data } = await supabase
        .from('service_categories')
        .select('id, name')
        .order('name')
      setCategories((data || []) as ServiceCategory[])
    }
    fetchCategories()
  }, [])

  useEffect(() => {
    async function fetchPost() {
      if (!id || !user) return
      setInitialLoading(true)
      try {
        const { data, error } = await supabase
          .from('looking_for_posts')
          .select(
            'id, customer_id, category_id, title, description, budget_min, budget_max, location_address, preferred_date, preferred_time, urgency, status, images'
          )
          .eq('id', id)
          .single()

        if (error) throw error
        const row = data as EditablePost
        if (!row || row.customer_id !== user.id) {
          setPost(null)
          return
        }

        setPost(row)
        setTitle(row.title ?? '')
        setDescription(row.description ?? '')
        setCategoryId(row.category_id ?? '')
        setBudgetMin(row.budget_min != null ? String(row.budget_min) : '')
        setBudgetMax(row.budget_max != null ? String(row.budget_max) : '')
        setLocationAddress(row.location_address ?? '')
        setPreferredDate(row.preferred_date ?? '')
        setPreferredTime(row.preferred_time ?? '')
        setUrgency(row.urgency ?? 'medium')
        setExistingImages(row.images ?? [])
      } catch (err) {
        setErrors({
          submit: err instanceof Error ? err.message : 'Failed to load post',
        })
      } finally {
        setInitialLoading(false)
      }
    }

    fetchPost()
  }, [id, user?.id])

  function validate(): FormErrors {
    const err: FormErrors = {}
    if (!title.trim()) err.title = 'Title is required'
    else if (title.trim().length < 5) err.title = 'Title must be at least 5 characters'
    else if (title.length > 60) err.title = 'Title must be 60 characters or less'
    if (!description.trim()) err.description = 'Description is required'
    else if (description.trim().length < 10) err.description = 'Description must be at least 10 characters'
    if (!categoryId) err.categoryId = 'Please select a category'
    const min = budgetMin ? parseFloat(budgetMin) : null
    const max = budgetMax ? parseFloat(budgetMax) : null
    if (min != null && (isNaN(min) || min < 0)) err.budgetMin = 'Enter a valid amount'
    if (max != null && (isNaN(max) || max < 0)) err.budgetMax = 'Enter a valid amount'
    if (min != null && max != null && min > max) {
      err.budgetMax = 'Max budget must be greater than min'
    }
    if (preferredDate) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (new Date(preferredDate) < today) err.preferredDate = 'Preferred date cannot be in the past'
    }
    setErrors(err)
    return err
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (Object.keys(validate()).length > 0) return
    if (!user || profile?.role !== 'customer' || !id) return

    setLoading(true)
    try {
      const uploadedUrls: string[] = []
      if (newImageFiles.length > 0) {
        for (let i = 0; i < newImageFiles.length; i++) {
          const file = newImageFiles[i]
          const ext = file.name.split('.').pop() || 'jpg'
          const path = `${user.id}/${Date.now()}-${i}.${ext}`
          const { error: uploadError } = await supabase.storage
            .from('post-images')
            .upload(path, file, { upsert: true })
          if (uploadError) {
            setErrors({ submit: `Failed to upload image: ${uploadError.message}` })
            setLoading(false)
            return
          }
          const { data: urlData } = supabase.storage.from('post-images').getPublicUrl(path)
          uploadedUrls.push(urlData.publicUrl)
        }
      }

      const mergedImages = [...existingImages, ...uploadedUrls]
      const { error } = await supabase
        .from('looking_for_posts')
        .update({
          category_id: categoryId,
          title: title.trim(),
          description: description.trim(),
          budget_min: budgetMin ? parseFloat(budgetMin) : null,
          budget_max: budgetMax ? parseFloat(budgetMax) : null,
          location_address: locationAddress.trim() || null,
          preferred_date: preferredDate || null,
          preferred_time: preferredTime || null,
          urgency,
          images: mergedImages.length > 0 ? mergedImages : null,
        } as never)
        .eq('id', id)
        .eq('customer_id', user.id)

      if (error) {
        setErrors({ submit: error.message })
        return
      }

      navigate(ROUTES.POST_DETAIL.replace(':id', id))
    } catch (err) {
      setErrors({ submit: err instanceof Error ? err.message : 'Something went wrong' })
    } finally {
      setLoading(false)
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    const valid = files.filter((f) => f.type.startsWith('image/') && f.size < 5 * 1024 * 1024)
    const remaining = Math.max(0, 5 - existingImages.length)
    setNewImageFiles((prev) => [...prev, ...valid].slice(0, remaining))
  }

  function removeExistingImage(index: number) {
    setExistingImages((prev) => prev.filter((_, i) => i !== index))
  }

  function removeNewImage(index: number) {
    setNewImageFiles((prev) => prev.filter((_, i) => i !== index))
  }

  if (authLoading || initialLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to={ROUTES.LOGIN} replace />
  }

  if (profile?.role !== 'customer') {
    return <Navigate to={ROUTES.HOME} replace />
  }

  if (!post || post.customer_id !== user.id) {
    return (
      <EmptyState
        icon={<AlertCircle className="size-12 text-gray-400" />}
        title="Post unavailable"
        description="You can only edit your own Looking For posts."
        action={
          <Button variant="outline" onClick={() => navigate(ROUTES.LOOKING_FOR)}>
            Back to posts
          </Button>
        }
      />
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Edit Post</h1>
        <p className="mt-1 text-gray-600">
          Update details so providers can send better responses.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card padding="lg">
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">Post Details</h2>
          </CardHeader>
          <CardContent className="space-y-6">
            {errors.submit && (
              <div className="rounded-lg border border-danger-200 bg-danger-50 p-4 text-sm text-danger-700">
                {errors.submit}
              </div>
            )}

            <div>
              <Input
                label="Title"
                placeholder="e.g. Plumber for bathroom repair"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                error={errors.title}
                maxLength={60}
                required
              />
              <p className="mt-1 text-xs text-gray-400">{title.length}/60</p>
            </div>

            <Textarea
              label="Description"
              placeholder="Describe what you need in detail..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              error={errors.description}
              rows={4}
              required
            />

            <Select
              label="Category"
              options={[
                { value: '', label: 'Select a category' },
                ...categories.map((c) => ({ value: c.id, label: c.name })),
              ]}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              error={errors.categoryId}
              required
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Budget Min (P)"
                type="number"
                min={0}
                step={0.01}
                placeholder="0"
                value={budgetMin}
                onChange={(e) => setBudgetMin(e.target.value)}
                error={errors.budgetMin}
              />
              <Input
                label="Budget Max (P)"
                type="number"
                min={0}
                step={0.01}
                placeholder="0"
                value={budgetMax}
                onChange={(e) => setBudgetMax(e.target.value)}
                error={errors.budgetMax}
              />
            </div>

            <Input
              label="Location / Address"
              placeholder="e.g. Block 5, Gaborone"
              value={locationAddress}
              onChange={(e) => setLocationAddress(e.target.value)}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Preferred Date"
                type="date"
                value={preferredDate}
                onChange={(e) => setPreferredDate(e.target.value)}
                error={errors.preferredDate}
              />
              <Input
                label="Preferred Time"
                type="time"
                value={preferredTime}
                onChange={(e) => setPreferredTime(e.target.value)}
              />
            </div>

            <Select
              label="Urgency"
              options={URGENCY_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              value={urgency}
              onChange={(e) => setUrgency(e.target.value as typeof urgency)}
            />

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Images (optional, max 5)
              </label>
              <div className="flex flex-wrap gap-4">
                {existingImages.map((url, i) => (
                  <div
                    key={`existing-${i}`}
                    className="relative flex size-20 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50"
                  >
                    <img src={url} alt={`Existing ${i + 1}`} className="size-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeExistingImage(i)}
                      className="absolute right-1 top-1 rounded-full bg-black/50 p-1 text-white hover:bg-black/70"
                      aria-label="Remove image"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
                {newImageFiles.map((file, i) => (
                  <div
                    key={`new-${i}`}
                    className="relative flex size-20 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50"
                  >
                    <img
                      src={URL.createObjectURL(file)}
                      alt={`Upload ${i + 1}`}
                      className="size-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeNewImage(i)}
                      className="absolute right-1 top-1 rounded-full bg-black/50 p-1 text-white hover:bg-black/70"
                      aria-label="Remove image"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
                {existingImages.length + newImageFiles.length < 5 && (
                  <label className="flex size-20 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 text-gray-500 transition-colors hover:border-primary-300 hover:bg-primary-50/50 hover:text-primary-600">
                    <Upload className="size-6" />
                    <span className="mt-1 text-xs">Add</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </label>
                )}
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <Button type="submit" variant="primary" loading={loading} disabled={loading}>
                Save Changes
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(ROUTES.POST_DETAIL.replace(':id', post.id))}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}
