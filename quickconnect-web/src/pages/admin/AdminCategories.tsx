import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import {
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  MessageSquare,
  FolderOpen,
  AlertCircle,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { ROUTES } from '@/lib/constants'
import { formatRelativeTime, CATEGORY_REQUEST_STATUS_CONFIG } from '@/lib/utils'
import type { ServiceCategory } from '@/lib/types'
import {
  Button,
  Card,
  CardHeader,
  CardContent,
  Badge,
  Input,
  Textarea,
  Modal,
  Spinner,
  EmptyState,
} from '@/components/ui'

interface CategoryRequestWithProfile {
  id: string
  requested_by: string
  name: string
  icon: string | null
  description: string | null
  status: 'pending' | 'approved' | 'declined'
  admin_feedback: string | null
  created_at: string
  profiles: { full_name: string }
}

type Tab = 'categories' | 'requests'

export function AdminCategories() {
  const { user, profile, loading: authLoading } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>('categories')

  const [categories, setCategories] = useState<ServiceCategory[]>([])
  const [requests, setRequests] = useState<CategoryRequestWithProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [addModal, setAddModal] = useState(false)
  const [editModal, setEditModal] = useState<ServiceCategory | null>(null)
  const [deleteModal, setDeleteModal] = useState<ServiceCategory | null>(null)
  const [reviewModal, setReviewModal] = useState<CategoryRequestWithProfile | null>(null)

  const [formName, setFormName] = useState('')
  const [formIcon, setFormIcon] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [feedbackText, setFeedbackText] = useState('')
  const [reviewAction, setReviewAction] = useState<'approve' | 'decline' | null>(null)

  const pendingCount = requests.filter((r) => r.status === 'pending').length

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    setError(null)
    try {
      const [catRes, reqRes] = await Promise.all([
        supabase.from('service_categories').select('*').order('name'),
        supabase
          .from('category_requests')
          .select('*, profiles!category_requests_requested_by_fkey(full_name)')
          .order('created_at', { ascending: false }),
      ])

      if (catRes.error) throw catRes.error
      if (reqRes.error) throw reqRes.error

      setCategories((catRes.data || []) as ServiceCategory[])
      setRequests((reqRes.data || []) as unknown as CategoryRequestWithProfile[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  function openAddModal() {
    setFormName('')
    setFormIcon('')
    setFormDescription('')
    setFormError(null)
    setAddModal(true)
  }

  function openEditModal(cat: ServiceCategory) {
    setFormName(cat.name)
    setFormIcon(cat.icon || '')
    setFormDescription(cat.description || '')
    setFormError(null)
    setEditModal(cat)
  }

  async function handleAddCategory() {
    if (!formName.trim()) {
      setFormError('Name is required')
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      const { error } = await supabase.from('service_categories').insert({
        name: formName.trim(),
        icon: formIcon.trim() || null,
        description: formDescription.trim() || null,
      } as any)
      if (error) throw error
      setAddModal(false)
      await fetchData()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to add category')
    } finally {
      setSaving(false)
    }
  }

  async function handleEditCategory() {
    if (!editModal) return
    if (!formName.trim()) {
      setFormError('Name is required')
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      const { error } = await supabase
        .from('service_categories')
        .update({
          name: formName.trim(),
          icon: formIcon.trim() || null,
          description: formDescription.trim() || null,
        } as any)
        .eq('id', editModal.id)
      if (error) throw error
      setEditModal(null)
      await fetchData()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to update category')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteCategory() {
    if (!deleteModal) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('service_categories')
        .delete()
        .eq('id', deleteModal.id)
      if (error) throw error
      setDeleteModal(null)
      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete category')
    } finally {
      setSaving(false)
    }
  }

  async function handleReviewRequest(action: 'approve' | 'decline') {
    if (!reviewModal || !user) return
    setSaving(true)
    try {
      const updates: Record<string, unknown> = {
        status: action === 'approve' ? 'approved' : 'declined',
        reviewed_by: user.id,
        admin_feedback: feedbackText.trim() || null,
      }

      const { error: updateError } = await supabase
        .from('category_requests')
        .update(updates as any)
        .eq('id', reviewModal.id)
      if (updateError) throw updateError

      if (action === 'approve') {
        const { error: insertError } = await supabase.from('service_categories').insert({
          name: reviewModal.name,
          icon: reviewModal.icon || null,
          description: reviewModal.description || null,
        } as any)
        if (insertError) throw insertError
      }

      await supabase.from('notifications').insert({
        user_id: reviewModal.requested_by,
        type: 'category_request_reviewed',
        title: action === 'approve' ? 'Category request approved!' : 'Category request declined',
        body:
          action === 'approve'
            ? `Your requested category "${reviewModal.name}" has been added to QuickConnect.`
            : `Your category request "${reviewModal.name}" was declined.${feedbackText.trim() ? ` Feedback: ${feedbackText.trim()}` : ''}`,
        data: { category_request_id: reviewModal.id },
      } as any)

      setReviewModal(null)
      setFeedbackText('')
      setReviewAction(null)
      await fetchData()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to process request')
    } finally {
      setSaving(false)
    }
  }

  if (authLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!user || !profile || profile.role !== 'admin') {
    return <Navigate to={ROUTES.HOME} replace />
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            Manage Categories
          </h1>
          <p className="mt-1 text-gray-600">
            Add, edit, and delete service categories. Review provider requests.
          </p>
        </div>
        {activeTab === 'categories' && (
          <Button
            variant="primary"
            icon={<Plus className="size-5" />}
            onClick={openAddModal}
          >
            Add Category
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-danger-200 bg-danger-50 p-4 text-sm text-danger-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 font-medium underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-4">
        <button
          onClick={() => setActiveTab('categories')}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'categories'
              ? 'bg-primary-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Categories ({categories.length})
        </button>
        <button
          onClick={() => setActiveTab('requests')}
          className={`relative rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'requests'
              ? 'bg-primary-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Requests
          {pendingCount > 0 && (
            <span className="ml-1.5 inline-flex size-5 items-center justify-center rounded-full bg-danger-500 text-[10px] font-bold text-white">
              {pendingCount}
            </span>
          )}
        </button>
      </div>

      {/* Categories Tab */}
      {activeTab === 'categories' && (
        <>
          {categories.length === 0 ? (
            <EmptyState
              icon={<FolderOpen className="size-12" />}
              title="No categories"
              description="Add your first service category to get started."
              action={
                <Button variant="primary" onClick={openAddModal}>
                  Add Category
                </Button>
              }
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((cat) => (
                <Card key={cat.id} padding="md">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-gray-900">{cat.name}</h3>
                      {cat.description && (
                        <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                          {cat.description}
                        </p>
                      )}
                      {cat.icon && (
                        <p className="mt-1 text-xs text-gray-400">Icon: {cat.icon}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        onClick={() => openEditModal(cat)}
                        className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-primary-600"
                        title="Edit"
                      >
                        <Pencil className="size-4" />
                      </button>
                      <button
                        onClick={() => setDeleteModal(cat)}
                        className="rounded-lg p-2 text-gray-400 hover:bg-danger-50 hover:text-danger-600"
                        title="Delete"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Requests Tab */}
      {activeTab === 'requests' && (
        <>
          {requests.length === 0 ? (
            <EmptyState
              icon={<MessageSquare className="size-12" />}
              title="No category requests"
              description="When providers request new categories, they will appear here."
            />
          ) : (
            <div className="space-y-3">
              {requests.map((req) => {
                const config =
                  CATEGORY_REQUEST_STATUS_CONFIG[
                    req.status as keyof typeof CATEGORY_REQUEST_STATUS_CONFIG
                  ]
                return (
                  <Card key={req.id} padding="md">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900">{req.name}</h3>
                          <Badge
                            variant={
                              req.status === 'approved'
                                ? 'success'
                                : req.status === 'declined'
                                  ? 'danger'
                                  : 'warning'
                            }
                          >
                            {config?.label ?? req.status}
                          </Badge>
                        </div>
                        {req.description && (
                          <p className="mt-1 text-sm text-gray-600">{req.description}</p>
                        )}
                        <p className="mt-1 text-sm text-gray-500">
                          Requested by{' '}
                          <span className="font-medium">{req.profiles?.full_name}</span>{' '}
                          &bull; {formatRelativeTime(req.created_at)}
                        </p>
                        {req.admin_feedback && (
                          <p className="mt-2 rounded-lg bg-gray-50 p-2 text-sm text-gray-600">
                            <strong>Feedback:</strong> {req.admin_feedback}
                          </p>
                        )}
                      </div>
                      {req.status === 'pending' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setReviewModal(req)
                            setFeedbackText('')
                            setReviewAction(null)
                            setFormError(null)
                          }}
                        >
                          Review
                        </Button>
                      )}
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Add Category Modal */}
      <Modal
        isOpen={addModal}
        onClose={() => setAddModal(false)}
        title="Add Category"
        size="md"
      >
        <div className="space-y-4">
          {formError && (
            <div className="rounded-lg border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700">
              {formError}
            </div>
          )}
          <Input
            label="Category Name"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="e.g. Solar Installation"
            required
          />
          <Input
            label="Icon (Lucide icon name)"
            value={formIcon}
            onChange={(e) => setFormIcon(e.target.value)}
            placeholder="e.g. sun"
          />
          <Textarea
            label="Description"
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            placeholder="Describe this category..."
            rows={3}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAddModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddCategory} loading={saving}>
              Add Category
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Category Modal */}
      <Modal
        isOpen={!!editModal}
        onClose={() => setEditModal(null)}
        title="Edit Category"
        size="md"
      >
        <div className="space-y-4">
          {formError && (
            <div className="rounded-lg border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700">
              {formError}
            </div>
          )}
          <Input
            label="Category Name"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            required
          />
          <Input
            label="Icon (Lucide icon name)"
            value={formIcon}
            onChange={(e) => setFormIcon(e.target.value)}
          />
          <Textarea
            label="Description"
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            rows={3}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditModal(null)}>
              Cancel
            </Button>
            <Button onClick={handleEditCategory} loading={saving}>
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteModal}
        onClose={() => setDeleteModal(null)}
        title="Delete Category"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-danger-500" />
            <p className="text-gray-700">
              Are you sure you want to delete{' '}
              <strong>{deleteModal?.name}</strong>? This will also affect all
              services and posts linked to this category.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteModal(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeleteCategory} loading={saving}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>

      {/* Review Request Modal */}
      <Modal
        isOpen={!!reviewModal}
        onClose={() => setReviewModal(null)}
        title="Review Category Request"
        size="md"
      >
        {reviewModal && (
          <div className="space-y-4">
            {formError && (
              <div className="rounded-lg border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700">
                {formError}
              </div>
            )}
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="font-semibold text-gray-900">{reviewModal.name}</p>
              {reviewModal.description && (
                <p className="mt-1 text-sm text-gray-600">{reviewModal.description}</p>
              )}
              <p className="mt-2 text-sm text-gray-500">
                Requested by {reviewModal.profiles?.full_name}
              </p>
            </div>
            <Textarea
              label="Feedback to provider (optional)"
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="Explain your decision..."
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setReviewModal(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                icon={<X className="size-4" />}
                onClick={() => handleReviewRequest('decline')}
                loading={saving && reviewAction === 'decline'}
                disabled={saving}
              >
                Decline
              </Button>
              <Button
                icon={<Check className="size-4" />}
                onClick={() => {
                  setReviewAction('approve')
                  handleReviewRequest('approve')
                }}
                loading={saving && reviewAction === 'approve'}
                disabled={saving}
              >
                Approve & Add
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
