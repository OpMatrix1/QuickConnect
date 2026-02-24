import { useEffect, useState, useCallback } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  UserX,
  UserCheck,
  Trash2,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { ROUTES } from '@/lib/constants'
import { formatDate, getInitials } from '@/lib/utils'
import type { Profile } from '@/lib/types'
import {
  Button,
  Card,
  CardHeader,
  CardContent,
  Modal,
  Badge,
  Avatar,
  Spinner,
  EmptyState,
} from '@/components/ui'

const ROLE_OPTIONS = [
  { value: '', label: 'All roles' },
  { value: 'customer', label: 'Customer' },
  { value: 'provider', label: 'Provider' },
  { value: 'admin', label: 'Admin' },
] as const

const ITEMS_PER_PAGE = 10

export function AdminUsers() {
  const { user, profile, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [users, setUsers] = useState<Profile[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    if (!user || profile?.role !== 'admin') return

    setLoading(true)
    setError(null)
    try {
      let query = supabase
        .from('profiles')
        .select('*', { count: 'exact' })

      if (search.trim()) {
        query = query.ilike('full_name', `%${search.trim()}%`)
      }
      if (roleFilter) {
        query = query.eq('role', roleFilter as 'customer' | 'provider' | 'admin')
      }

      const from = (page - 1) * ITEMS_PER_PAGE
      const to = from + ITEMS_PER_PAGE - 1
      const { data, count, error: fetchError } = await query
        .order('created_at', { ascending: false })
        .range(from, to)

      if (fetchError) throw fetchError
      setUsers((data || []) as Profile[])
      setTotalCount(count ?? 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [user?.id, profile?.role, page, search, roleFilter])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const handleSuspend = async (targetUser: Profile) => {
    setActionLoading(targetUser.id)
    try {
      const { error: updateError } = await supabase.from('profiles').update({ is_active: false } as { is_active: boolean }).eq('id', targetUser.id)
      if (updateError) throw updateError
      await fetchUsers()
      setSelectedUser((prev) =>
        prev?.id === targetUser.id ? { ...prev, is_active: false } : prev
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to suspend user')
    } finally {
      setActionLoading(null)
    }
  }

  const handleUnsuspend = async (targetUser: Profile) => {
    setActionLoading(targetUser.id)
    try {
      const { error: updateError } = await supabase.from('profiles').update({ is_active: true } as { is_active: boolean }).eq('id', targetUser.id)
      if (updateError) throw updateError
      await fetchUsers()
      setSelectedUser((prev) =>
        prev?.id === targetUser.id ? { ...prev, is_active: true } : prev
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unsuspend user')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async (targetUser: Profile) => {
    if (!confirm(`Are you sure you want to delete ${targetUser.full_name}? This cannot be undone.`))
      return
    setActionLoading(targetUser.id)
    try {
      const { error: deleteError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', targetUser.id)
      if (deleteError) throw deleteError
      await fetchUsers()
      setDetailModalOpen(false)
      setSelectedUser(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user')
    } finally {
      setActionLoading(null)
    }
  }

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)

  if (authLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!user || !profile) {
    return <Navigate to={ROUTES.LOGIN} replace />
  }

  if (profile.role !== 'admin') {
    return <Navigate to={ROUTES.HOME} replace />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
          User Management
        </h1>
        <p className="mt-1 text-gray-600">
          Search, filter, and manage platform users
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-danger-50 p-4 text-sm text-danger-600">
          {error}
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                placeholder="Search by name..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                className="block w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value)
                setPage(1)
              }}
              className="rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
            >
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value || 'all'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-16">
              <Spinner size="lg" />
            </div>
          ) : users.length === 0 ? (
            <EmptyState
              icon={<Search className="size-12" />}
              title="No users found"
              description="Try adjusting your search or filters"
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50/80">
                      <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        User
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Email
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Role
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        City
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Joined
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Status
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {users.map((u) => (
                      <tr
                        key={u.id}
                        className="transition-colors hover:bg-gray-50/50"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <Avatar
                              src={u.avatar_url}
                              fallback={getInitials(u.full_name || '?')}
                              size="md"
                            />
                            <span className="font-medium text-gray-900">
                              {u.full_name || '—'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {(u as Profile & { email?: string }).email ?? '—'}
                        </td>
                        <td className="px-6 py-4">
                          <Badge
                            variant={
                              u.role === 'admin'
                                ? 'danger'
                                : u.role === 'provider'
                                  ? 'primary'
                                  : 'default'
                            }
                          >
                            {u.role}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {u.city || '—'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {formatDate(u.created_at)}
                        </td>
                        <td className="px-6 py-4">
                          <Badge
                            variant={
                              (u as Profile & { is_active?: boolean }).is_active !== false
                                ? 'success'
                                : 'danger'
                            }
                          >
                            {(u as Profile & { is_active?: boolean }).is_active !== false
                              ? 'Active'
                              : 'Suspended'}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              icon={<Eye className="size-4" />}
                              onClick={() => {
                                setSelectedUser(u)
                                setDetailModalOpen(true)
                              }}
                            />
                            {(u as Profile & { is_active?: boolean }).is_active !== false ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                icon={<UserX className="size-4 text-warning-600" />}
                                loading={actionLoading === u.id}
                                onClick={() => handleSuspend(u)}
                              />
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                icon={<UserCheck className="size-4 text-success-600" />}
                                loading={actionLoading === u.id}
                                onClick={() => handleUnsuspend(u)}
                              />
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              icon={<Trash2 className="size-4 text-danger-500" />}
                              loading={actionLoading === u.id}
                              onClick={() => handleDelete(u)}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4">
                  <p className="text-sm text-gray-600">
                    Showing {(page - 1) * ITEMS_PER_PAGE + 1} to{' '}
                    {Math.min(page * ITEMS_PER_PAGE, totalCount)} of {totalCount}{' '}
                    users
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      icon={<ChevronLeft className="size-4" />}
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      icon={<ChevronRight className="size-4" />}
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <UserDetailModal
        isOpen={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false)
          setSelectedUser(null)
        }}
        user={selectedUser}
        onSuspend={() => selectedUser && handleSuspend(selectedUser)}
        onUnsuspend={() => selectedUser && handleUnsuspend(selectedUser)}
        onDelete={() => selectedUser && handleDelete(selectedUser)}
        actionLoading={actionLoading === selectedUser?.id}
      />
    </div>
  )
}

function UserDetailModal({
  isOpen,
  onClose,
  user,
  onSuspend,
  onUnsuspend,
  onDelete,
  actionLoading,
}: {
  isOpen: boolean
  onClose: () => void
  user: Profile | null
  onSuspend: () => void
  onUnsuspend: () => void
  onDelete: () => void
  actionLoading: boolean
}) {
  const [providerId, setProviderId] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen || !user || user.role !== 'provider') {
      setProviderId(null)
      return
    }
    supabase
      .from('service_providers')
      .select('id')
      .eq('profile_id', user.id)
      .maybeSingle()
      .then(({ data }) => setProviderId((data as { id?: string } | null)?.id ?? null))
  }, [isOpen, user?.id, user?.role])

  if (!user) return null

  const isActive = (user as Profile & { is_active?: boolean }).is_active !== false

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="User Details" size="lg">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Avatar
            src={user.avatar_url}
            fallback={getInitials(user.full_name || '?')}
            size="xl"
          />
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {user.full_name || 'Unknown'}
            </h3>
            <p className="text-sm text-gray-500">
              {(user as Profile & { email?: string }).email ?? 'Email not available'}
            </p>
            <div className="mt-2 flex gap-2">
              <Badge
                variant={
                  user.role === 'admin'
                    ? 'danger'
                    : user.role === 'provider'
                      ? 'primary'
                      : 'default'
                }
              >
                {user.role}
              </Badge>
              <Badge variant={isActive ? 'success' : 'danger'}>
                {isActive ? 'Active' : 'Suspended'}
              </Badge>
            </div>
          </div>
        </div>

        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-gray-500">Phone</dt>
            <dd className="mt-1 text-gray-900">{user.phone || '—'}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">City</dt>
            <dd className="mt-1 text-gray-900">{user.city || '—'}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Joined</dt>
            <dd className="mt-1 text-gray-900">{formatDate(user.created_at)}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">User ID</dt>
            <dd className="mt-1 font-mono text-sm text-gray-600">{user.id}</dd>
          </div>
        </dl>

        <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-4">
          {providerId && (
            <Link to={ROUTES.PROVIDER_PROFILE.replace(':id', providerId)}>
              <Button size="sm" variant="outline" icon={<Eye className="size-4" />}>
                View Profile
              </Button>
            </Link>
          )}
          {isActive ? (
            <Button
              size="sm"
              variant="outline"
              icon={<UserX className="size-4" />}
              onClick={onSuspend}
              loading={actionLoading}
            >
              Suspend
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              icon={<UserCheck className="size-4" />}
              onClick={onUnsuspend}
              loading={actionLoading}
            >
              Unsuspend
            </Button>
          )}
          <Button
            size="sm"
            variant="danger"
            icon={<Trash2 className="size-4" />}
            onClick={() => {
              if (confirm('Delete this user? This cannot be undone.')) {
                onDelete()
              }
            }}
            loading={actionLoading}
          >
            Delete
          </Button>
        </div>
      </div>
    </Modal>
  )
}
