import { useState, useEffect, useRef } from 'react'
import { Navigate } from 'react-router-dom'
import {
  Camera,
  Save,
  Briefcase,
  MapPin,
  Plus,
  Pencil,
  Trash2,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { ROUTES } from '@/lib/constants'
import { formatDate, CITIES } from '@/lib/utils'
import type { Profile, ServiceProvider, Service, ServiceArea, ServiceCategory } from '@/lib/types'
import {
  Button,
  Input,
  Textarea,
  Select,
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  Modal,
  Badge,
  Avatar,
  Spinner,
  EmptyState,
} from '@/components/ui'
import { formatCurrency } from '@/lib/utils'

type ServiceWithCategory = Service & { service_categories: ServiceCategory | null }

const PRICE_TYPE_OPTIONS = [
  { value: 'fixed', label: 'Fixed' },
  { value: 'hourly', label: 'Hourly' },
  { value: 'quote', label: 'Quote' },
] as const

export function Profile() {
  const { user, profile, loading: authLoading, updateProfile, refreshProfile } = useAuth()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form state
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [bio, setBio] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [businessDescription, setBusinessDescription] = useState('')

  // Provider data
  const [provider, setProvider] = useState<ServiceProvider | null>(null)
  const [services, setServices] = useState<ServiceWithCategory[]>([])
  const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>([])
  const [categories, setCategories] = useState<ServiceCategory[]>([])
  const [loadingProvider, setLoadingProvider] = useState(false)

  // Modals
  const [serviceModalOpen, setServiceModalOpen] = useState(false)
  const [editingService, setEditingService] = useState<Service | null>(null)
  const [areaModalOpen, setAreaModalOpen] = useState(false)
  const [editingArea, setEditingArea] = useState<ServiceArea | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '')
      setPhone(profile.phone || '')
      setCity(profile.city || '')
      setBio((profile as { bio?: string }).bio || '')
    }
  }, [profile])

  useEffect(() => {
    if (!user || profile?.role !== 'provider') return

    async function fetchProviderData() {
      setLoadingProvider(true)
      try {
        let { data: providerData } = await supabase
          .from('service_providers')
          .select('*')
          .eq('profile_id', user!.id)
          .single()

        // Auto-create the service_providers row if it doesn't exist yet
        if (!providerData) {
          const { data: created } = await supabase
            .from('service_providers')
            .insert({ profile_id: user!.id, business_name: profile?.full_name || 'My Business' } as never)
            .select()
            .single()
          providerData = created
        }

        const providerRow = providerData as ServiceProvider | null
        if (providerRow) {
          setProvider(providerRow)
          setBusinessName(providerRow.business_name || '')
          setBusinessDescription(providerRow.description || '')

          const { data: servicesData } = await supabase
            .from('services')
            .select('*, service_categories(name)')
            .eq('provider_id', providerRow.id)
            .order('created_at', { ascending: false })
          setServices((servicesData || []) as ServiceWithCategory[])

          const { data: areasData } = await supabase
            .from('service_areas')
            .select('*')
            .eq('provider_id', providerRow.id)
          setServiceAreas((areasData || []) as ServiceArea[])
        }

        const { data: cats } = await supabase
          .from('service_categories')
          .select('id, name')
          .order('name')
        setCategories((cats || []) as ServiceCategory[])
      } finally {
        setLoadingProvider(false)
      }
    }

    fetchProviderData()
  }, [user?.id, profile?.role])

  const handleSaveProfile = async () => {
    if (!user || !profile) return
    setError(null)
    setSuccess(null)

    if (!fullName.trim() || fullName.trim().length < 2) {
      setError('Full name must be at least 2 characters')
      return
    }
    if (phone) {
      const cleaned = phone.replace(/[\s()+-]/g, '')
      if (!/^(267)?[0-9]{8}$/.test(cleaned)) {
        setError('Enter a valid Botswana phone number (e.g. +267 71 234 567)')
        return
      }
    }
    if (profile.role === 'provider' && !businessName.trim()) {
      setError('Business name is required for providers')
      return
    }

    setSaving(true)
    try {
      const { error: profileError } = await updateProfile({
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        city: city || null,
        bio: bio.trim() || null,
      })
      if (profileError) throw new Error(profileError)

      if (profile.role === 'provider') {
        if (provider) {
          const { error: providerError } = await supabase
            .from('service_providers')
            .update({ business_name: businessName.trim(), description: businessDescription.trim() || null } as never)
            .eq('id', provider.id)
          if (providerError) throw new Error(providerError.message)
        } else {
          const { data: newProvider, error: providerError } = await supabase
            .from('service_providers')
            .insert({ profile_id: user.id, business_name: businessName.trim() || profile.full_name || 'My Business', description: businessDescription.trim() || null } as never)
            .select()
            .single()
          if (providerError) throw new Error(providerError.message)
          setProvider(newProvider as ServiceProvider)
        }
      }

      await refreshProfile()
      setSuccess('Profile saved successfully')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be less than 2MB')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setAvatarUploading(true)
    setError(null)
    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `${user.id}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true })
      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
      const { error: updateError } = await updateProfile({ avatar_url: urlData.publicUrl })
      if (updateError) throw new Error(updateError)
      await refreshProfile()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload avatar')
    } finally {
      setAvatarUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

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

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Profile</h1>
        <p className="mt-1 text-gray-600">Manage your account and preferences</p>
      </div>

      {error && (
        <div className="rounded-lg bg-danger-50 p-4 text-sm text-danger-600">{error}</div>
      )}
      {success && (
        <div className="rounded-lg bg-success-50 p-4 text-sm text-success-600">{success}</div>
      )}

      {/* Avatar */}
      <Card>
        <CardContent className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarUpload}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={avatarUploading}
            className="group relative"
          >
            <Avatar
              src={profile.avatar_url}
              fallback={profile.full_name || '?'}
              size="xl"
            />
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
              {avatarUploading ? (
                <Spinner size="md" className="border-white" />
              ) : (
                <Camera className="size-8 text-white" />
              )}
            </span>
          </button>
          <div className="flex-1 text-center sm:text-left">
            <p className="font-medium text-gray-900">Profile photo</p>
            <p className="text-sm text-gray-500">
              Click to upload a new photo. JPG, PNG or GIF. Max 2MB.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Basic info */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Basic Information</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            label="Full Name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your full name"
          />
          <Input
            label="Phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+267 XX XXX XXXX"
          />
          <Select
            label="City"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            options={[
              { value: '', label: 'Select city' },
              ...CITIES.map((c) => ({ value: c, label: c })),
            ]}
          />
          <Textarea
            label="Bio / Description"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell us a bit about yourself"
            rows={4}
          />
        </CardContent>
      </Card>

      {/* Provider section */}
      {profile.role === 'provider' && (
        <>
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900">Business Information</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                label="Business Name"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Your business or trade name"
              />
              <Textarea
                label="Business Description"
                value={businessDescription}
                onChange={(e) => setBusinessDescription(e.target.value)}
                placeholder="Describe your services and expertise"
                rows={4}
              />
            </CardContent>
          </Card>

          {/* Services */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Services</h2>
              <Button
                size="sm"
                icon={<Plus className="size-4" />}
                onClick={() => {
                  setEditingService(null)
                  setServiceModalOpen(true)
                }}
              >
                Add Service
              </Button>
            </CardHeader>
            <CardContent>
              {loadingProvider ? (
                <div className="flex justify-center py-8">
                  <Spinner size="lg" />
                </div>
              ) : services.length === 0 ? (
                <EmptyState
                  icon={<Briefcase className="size-12" />}
                  title="No services yet"
                  description="Add services you offer to attract more customers"
                  action={
                    <Button
                      variant="primary"
                      icon={<Plus className="size-4" />}
                      onClick={() => {
                        setEditingService(null)
                        setServiceModalOpen(true)
                      }}
                    >
                      Add Service
                    </Button>
                  }
                />
              ) : (
                <ul className="space-y-3">
                  {services.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50/50 p-4"
                    >
                      <div>
                        <p className="font-medium text-gray-900">{s.title}</p>
                        <p className="text-sm text-gray-500">
                          {s.service_categories?.name ?? 'Uncategorized'} •{' '}
                          {s.price_type === 'quote'
                            ? 'Quote'
                            : s.price_min != null && s.price_max != null
                              ? `${formatCurrency(s.price_min)} - ${formatCurrency(s.price_max)}`
                              : s.price_min != null
                                ? formatCurrency(s.price_min)
                                : '—'}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<Pencil className="size-4" />}
                          onClick={() => {
                            setEditingService(s)
                            setServiceModalOpen(true)
                          }}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<Trash2 className="size-4 text-danger-500" />}
                          onClick={async () => {
                            if (!confirm('Delete this service?')) return
                            await supabase.from('services').delete().eq('id', s.id)
                            setServices((prev) => prev.filter((x) => x.id !== s.id))
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Service Areas */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Service Areas</h2>
              <Button
                size="sm"
                icon={<Plus className="size-4" />}
                onClick={() => {
                  setEditingArea(null)
                  setAreaModalOpen(true)
                }}
              >
                Add Area
              </Button>
            </CardHeader>
            <CardContent>
              {serviceAreas.length === 0 ? (
                <EmptyState
                  icon={<MapPin className="size-12" />}
                  title="No service areas"
                  description="Add cities and areas you serve"
                  action={
                    <Button
                      variant="primary"
                      icon={<Plus className="size-4" />}
                      onClick={() => {
                        setEditingArea(null)
                        setAreaModalOpen(true)
                      }}
                    >
                      Add Area
                    </Button>
                  }
                />
              ) : (
                <ul className="space-y-3">
                  {serviceAreas.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50/50 p-4"
                    >
                      <div>
                        <p className="font-medium text-gray-900">{a.city}</p>
                        <p className="text-sm text-gray-500">
                          {a.area_name || 'General'} • {a.radius_km ?? '—'} km radius
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<Pencil className="size-4" />}
                          onClick={() => {
                            setEditingArea(a)
                            setAreaModalOpen(true)
                          }}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<Trash2 className="size-4 text-danger-500" />}
                          onClick={async () => {
                            if (!confirm('Remove this area?')) return
                            await supabase.from('service_areas').delete().eq('id', a.id)
                            setServiceAreas((prev) => prev.filter((x) => x.id !== a.id))
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <ServiceModal
            isOpen={serviceModalOpen}
            onClose={() => {
              setServiceModalOpen(false)
              setEditingService(null)
            }}
            providerId={provider?.id ?? ''}
            service={editingService}
            categories={categories}
            onSaved={async (s) => {
              const service = s as Service
              const cat = categories.find((c) => c.id === service.category_id)
              const withCat = { ...service, service_categories: cat ? { ...cat } : null } as ServiceWithCategory
              if (editingService) {
                setServices((prev) =>
                  prev.map((x) => (x.id === service.id ? { ...x, ...withCat } : x))
                )
              } else {
                setServices((prev) => [withCat, ...prev])
                if (user && cat) {
                  await supabase.from('notifications').insert({
                    user_id: user.id,
                    type: 'service_linked',
                    title: 'Now listed in a new category',
                    body: `You're now listed under "${cat.name}". Customers in that category will be able to find you.`,
                    data: { service_id: service.id, category_id: cat.id },
                  } as never)
                }
              }
              setServiceModalOpen(false)
              setEditingService(null)
            }}
          />

          <ServiceAreaModal
            isOpen={areaModalOpen}
            onClose={() => {
              setAreaModalOpen(false)
              setEditingArea(null)
            }}
            providerId={provider?.id ?? ''}
            area={editingArea}
            onSaved={(a) => {
              const area = a as ServiceArea
              if (editingArea) {
                setServiceAreas((prev) =>
                  prev.map((x) => (x.id === area.id ? { ...x, ...area } : x))
                )
              } else {
                setServiceAreas((prev) => [area, ...prev])
              }
              setAreaModalOpen(false)
              setEditingArea(null)
            }}
          />
        </>
      )}

      {/* Account section */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Account</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <p className="mt-1 text-gray-900">{user.email}</p>
            <p className="text-sm text-gray-500">Email cannot be changed</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Role:</span>
            <Badge
              variant={
                profile.role === 'admin'
                  ? 'danger'
                  : profile.role === 'provider'
                    ? 'primary'
                    : 'default'
              }
            >
              {profile.role}
            </Badge>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Member since</label>
            <p className="mt-1 text-gray-900">{formatDate(profile.created_at)}</p>
          </div>
        </CardContent>
        <CardFooter>
          <Button
            variant="primary"
            icon={<Save className="size-4" />}
            loading={saving}
            onClick={handleSaveProfile}
          >
            Save Changes
          </Button>
        </CardFooter>
      </Card>

    </div>
  )
}

function ServiceModal({
  isOpen,
  onClose,
  providerId,
  service,
  categories,
  onSaved,
}: {
  isOpen: boolean
  onClose: () => void
  providerId: string
  service: Service | null
  categories: ServiceCategory[]
  onSaved: (s: Service) => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [priceMin, setPriceMin] = useState('')
  const [priceMax, setPriceMax] = useState('')
  const [priceType, setPriceType] = useState<'fixed' | 'hourly' | 'quote'>('fixed')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (service) {
      setTitle(service.title)
      setDescription(service.description || '')
      setCategoryId(service.category_id)
      setPriceMin(service.price_min?.toString() ?? '')
      setPriceMax(service.price_max?.toString() ?? '')
      setPriceType(service.price_type)
    } else {
      setTitle('')
      setDescription('')
      setCategoryId('')
      setPriceMin('')
      setPriceMax('')
      setPriceType('fixed')
    }
  }, [service, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!title.trim()) {
      setError('Title is required')
      return
    }
    if (!categoryId) {
      setError('Please select a category')
      return
    }
    if (priceType !== 'quote') {
      const min = priceMin ? parseFloat(priceMin) : null
      const max = priceMax ? parseFloat(priceMax) : null
      if (min !== null && (isNaN(min) || min < 0)) {
        setError('Min price must be a valid non-negative amount')
        return
      }
      if (max !== null && (isNaN(max) || max < 0)) {
        setError('Max price must be a valid non-negative amount')
        return
      }
      if (min !== null && max !== null && min > max) {
        setError('Max price must be greater than or equal to min price')
        return
      }
    }

    setSaving(true)
    try {
      const payload = {
        provider_id: providerId,
        category_id: categoryId,
        title: title.trim(),
        description: description.trim() || null,
        price_min: priceMin ? parseFloat(priceMin) : null,
        price_max: priceMax ? parseFloat(priceMax) : null,
        price_type: priceType,
      }

      if (service) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error: err } = await supabase.from('services').update(payload as never).eq('id', service.id).select().single()
        if (err) throw err
        onSaved(data as Service)
      } else {
        const { data, error: err } = await supabase.from('services').insert(payload as never).select().single()
        if (err) throw err
        onSaved(data as Service)
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={service ? 'Edit Service' : 'Add Service'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-danger-50 p-3 text-sm text-danger-600">{error}</div>
        )}
        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Plumbing Repair"
          required
        />
        <Textarea
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe this service"
          rows={3}
        />
        <Select
          label="Category"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          options={[
            { value: '', label: 'Select category' },
            ...categories.map((c) => ({ value: c.id, label: c.name })),
          ]}
          required
        />
        <Select
          label="Price Type"
          value={priceType}
          onChange={(e) => setPriceType(e.target.value as 'fixed' | 'hourly' | 'quote')}
          options={PRICE_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        />
        {(priceType === 'fixed' || priceType === 'hourly') && (
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Min Price (P)"
              type="number"
              min={0}
              step={0.01}
              value={priceMin}
              onChange={(e) => setPriceMin(e.target.value)}
              placeholder="0"
            />
            <Input
              label="Max Price (P)"
              type="number"
              min={0}
              step={0.01}
              value={priceMax}
              onChange={(e) => setPriceMax(e.target.value)}
              placeholder="0"
            />
          </div>
        )}
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={saving} icon={<Save className="size-4" />}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function ServiceAreaModal({
  isOpen,
  onClose,
  providerId,
  area,
  onSaved,
}: {
  isOpen: boolean
  onClose: () => void
  providerId: string
  area: ServiceArea | null
  onSaved: (a: ServiceArea) => void
}) {
  const [city, setCity] = useState('')
  const [areaName, setAreaName] = useState('')
  const [radiusKm, setRadiusKm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (area) {
      setCity(area.city)
      setAreaName(area.area_name || '')
      setRadiusKm(area.radius_km?.toString() ?? '')
    } else {
      setCity('')
      setAreaName('')
      setRadiusKm('')
    }
  }, [area, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!city.trim()) {
      setError('City is required')
      return
    }

    setSaving(true)
    try {
      const payload = {
        provider_id: providerId,
        city: city.trim(),
        area_name: areaName.trim() || null,
        radius_km: radiusKm ? parseFloat(radiusKm) : null,
      }

      if (area) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error: err } = await supabase.from('service_areas').update(payload as never).eq('id', area.id).select().single()
        if (err) throw err
        onSaved(data as ServiceArea)
      } else {
        const { data, error: err } = await supabase.from('service_areas').insert(payload as never).select().single()
        if (err) throw err
        onSaved(data as ServiceArea)
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={area ? 'Edit Service Area' : 'Add Service Area'} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-danger-50 p-3 text-sm text-danger-600">{error}</div>
        )}
        <Select
          label="City"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          options={[
            { value: '', label: 'Select city' },
            ...CITIES.map((c) => ({ value: c, label: c })),
          ]}
          required
        />
        <Input
          label="Area / Neighbourhood (optional)"
          value={areaName}
          onChange={(e) => setAreaName(e.target.value)}
          placeholder="e.g. Block 7, Extension 2"
        />
        <Input
          label="Radius (km)"
          type="number"
          min={0}
          step={0.5}
          value={radiusKm}
          onChange={(e) => setRadiusKm(e.target.value)}
          placeholder="e.g. 10"
        />
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={saving} icon={<Save className="size-4" />}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  )
}
