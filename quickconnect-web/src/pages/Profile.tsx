import { useState, useEffect, useRef, useMemo } from 'react'
import { Navigate, Link, useSearchParams } from 'react-router-dom'
import {
  Camera,
  Save,
  Briefcase,
  MapPin,
  Plus,
  Pencil,
  Trash2,
  User,
  Shield,
  Lock,
  ImageIcon,
  Info,
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
import { isProviderListingComplete, PROVIDER_LISTING_REQUIREMENTS_SHORT } from '@/lib/providerListing'

type ServiceWithCategory = Service & { service_categories: ServiceCategory | null }

const PRICE_TYPE_OPTIONS = [
  { value: 'fixed', label: 'Fixed' },
  { value: 'hourly', label: 'Hourly' },
  { value: 'quote', label: 'Quote' },
] as const

type SettingsSection = 'account' | 'privacy' | 'security' | 'business'

const SECTION_LABELS: Record<SettingsSection, string> = {
  account: 'Account',
  privacy: 'Privacy',
  security: 'Security',
  business: 'Business',
}

export function Profile() {
  const { user, profile, loading: authLoading, updateProfile, refreshProfile, changePassword } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [saving, setSaving] = useState(false)
  const [savingBusiness, setSavingBusiness] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordFieldError, setPasswordFieldError] = useState<string | null>(null)

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
  const [bannerUploading, setBannerUploading] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const bannerInputRef = useRef<HTMLInputElement>(null)

  const isProvider = profile?.role === 'provider'

  const section: SettingsSection = useMemo(() => {
    const raw = searchParams.get('section')
    if (raw === 'privacy' || raw === 'security' || raw === 'business' || raw === 'account') {
      if (raw === 'business' && !isProvider) return 'account'
      return raw
    }
    return 'account'
  }, [searchParams, isProvider])

  const setSection = (next: SettingsSection) => {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev)
      if (next === 'account') p.delete('section')
      else p.set('section', next)
      return p
    })
  }

  const navItems: { id: SettingsSection; icon: React.ReactNode }[] = useMemo(
    () => [
      { id: 'account', icon: <User className="size-4 shrink-0" /> },
      { id: 'privacy', icon: <Shield className="size-4 shrink-0" /> },
      { id: 'security', icon: <Lock className="size-4 shrink-0" /> },
      ...(isProvider ? [{ id: 'business' as const, icon: <Briefcase className="size-4 shrink-0" /> }] : []),
    ],
    [isProvider]
  )

  const providerListingReady = useMemo(() => {
    if (!isProvider || !provider) return true
    return isProviderListingComplete({
      description: provider.description,
      services: services.map((s) => ({ is_active: s.is_active })),
    })
  }, [isProvider, provider, services])

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

  const validatePersonalFields = () => {
    if (!fullName.trim() || fullName.trim().length < 2) {
      setError('Full name must be at least 2 characters')
      return false
    }
    if (phone) {
      const cleaned = phone.replace(/[\s()+-]/g, '')
      if (!/^(267)?[0-9]{8}$/.test(cleaned)) {
        setError('Enter a valid Botswana phone number (e.g. +267 71 234 567)')
        return false
      }
    }
    return true
  }

  const handleSaveAccount = async () => {
    if (!user || !profile) return
    setError(null)
    setSuccess(null)
    if (!validatePersonalFields()) return

    setSaving(true)
    try {
      const { error: profileError } = await updateProfile({
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        city: city || null,
        bio: bio.trim() || null,
      })
      if (profileError) throw new Error(profileError)
      await refreshProfile()
      setSuccess('Profile saved successfully')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveBusiness = async () => {
    if (!user || !profile || profile.role !== 'provider') return
    setError(null)
    setSuccess(null)
    if (!businessName.trim()) {
      setError('Business name is required for providers')
      return
    }

    setSavingBusiness(true)
    try {
      if (provider) {
        const { error: providerError } = await supabase
          .from('service_providers')
          .update({ business_name: businessName.trim(), description: businessDescription.trim() || null } as never)
          .eq('id', provider.id)
        if (providerError) throw new Error(providerError.message)
      } else {
        const { data: newProvider, error: providerError } = await supabase
          .from('service_providers')
          .insert({
            profile_id: user.id,
            business_name: businessName.trim() || profile.full_name || 'My Business',
            description: businessDescription.trim() || null,
          } as never)
          .select()
          .single()
        if (providerError) throw new Error(providerError.message)
        setProvider(newProvider as ServiceProvider)
      }
      await refreshProfile()
      setSuccess('Business profile saved successfully')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save business profile')
    } finally {
      setSavingBusiness(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordFieldError(null)
    setError(null)
    setSuccess(null)
    if (newPassword.length < 6) {
      setPasswordFieldError('New password must be at least 6 characters')
      return
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordFieldError('New passwords do not match')
      return
    }
    setPasswordSaving(true)
    try {
      const { error: pwErr } = await changePassword(currentPassword, newPassword)
      if (pwErr) {
        setError(pwErr)
        return
      }
      setCurrentPassword('')
      setNewPassword('')
      setConfirmNewPassword('')
      setSuccess('Password updated successfully')
    } catch {
      setError('Unable to update password. Please try again.')
    } finally {
      setPasswordSaving(false)
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

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }
    if (file.size > 3 * 1024 * 1024) {
      setError('Banner image must be less than 3MB')
      if (bannerInputRef.current) bannerInputRef.current.value = ''
      return
    }

    setBannerUploading(true)
    setError(null)
    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `${user.id}/banner-${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true })
      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
      const { error: updateError } = await updateProfile({ banner_url: urlData.publicUrl })
      if (updateError) throw new Error(updateError)
      await refreshProfile()
      setSuccess('Banner updated')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload banner')
    } finally {
      setBannerUploading(false)
      if (bannerInputRef.current) bannerInputRef.current.value = ''
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
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Settings</h1>
        <p className="mt-1 text-gray-600">Manage your account, privacy, and security</p>
      </div>

      {error && (
        <div className="rounded-lg bg-danger-50 p-4 text-sm text-danger-600">{error}</div>
      )}
      {success && (
        <div className="rounded-lg bg-success-50 p-4 text-sm text-success-600">{success}</div>
      )}

      {isProvider && provider && !providerListingReady && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <div className="flex gap-3">
            <Info className="size-5 shrink-0 text-amber-700" aria-hidden />
            <div>
              <p className="font-semibold text-amber-900">Listing incomplete</p>
              <p className="mt-1 text-amber-900/90">{PROVIDER_LISTING_REQUIREMENTS_SHORT}</p>
              <button
                type="button"
                onClick={() => setSection('business')}
                className="mt-2 font-medium text-primary-700 underline hover:text-primary-800"
              >
                Open Business settings
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-10">
        <nav
          className="flex gap-2 overflow-x-auto pb-1 lg:w-52 lg:flex-shrink-0 lg:flex-col lg:overflow-visible lg:pb-0"
          aria-label="Settings sections"
        >
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSection(item.id)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors whitespace-nowrap lg:whitespace-normal ${
                section === item.id
                  ? 'bg-primary-50 text-primary-800 ring-1 ring-primary-200'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              {item.icon}
              {SECTION_LABELS[item.id]}
            </button>
          ))}
        </nav>

        <div className="min-w-0 flex-1 space-y-6">
          {section === 'account' && (
            <>
              <Card className="overflow-hidden p-0">
                <div className="relative">
                  <input
                    ref={bannerInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleBannerUpload}
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                  />
                  <div className="relative h-36 sm:h-44">
                    {profile.banner_url ? (
                      <img
                        src={profile.banner_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full bg-gradient-to-br from-primary-100 via-accent-50 to-primary-50" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent pointer-events-none" />
                    <button
                      type="button"
                      onClick={() => bannerInputRef.current?.click()}
                      disabled={bannerUploading}
                      className="absolute right-3 top-3 inline-flex items-center gap-2 rounded-full bg-black/50 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/60 disabled:opacity-60"
                    >
                      {bannerUploading ? (
                        <Spinner size="sm" className="border-white" />
                      ) : (
                        <ImageIcon className="size-3.5" />
                      )}
                      Banner
                    </button>
                  </div>
                  <div className="relative -mt-14 flex justify-center px-4 sm:-mt-16 sm:justify-start sm:px-8">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={avatarUploading}
                      className="group relative rounded-full ring-4 ring-white shadow-md"
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
                  </div>
                  <div className="px-4 pb-4 pt-3 text-center sm:px-8 sm:text-left">
                    <p className="font-semibold text-gray-900">{profile.full_name}</p>
                    <p className="mt-1 text-sm text-gray-500">
                      Banner and profile photo — JPG, PNG or GIF. Photo max 2MB.
                    </p>
                  </div>
                </div>
              </Card>

              <Card>
                <CardHeader>
                  <h2 className="text-lg font-semibold text-gray-900">Basic information</h2>
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

              <Card>
                <CardHeader>
                  <h2 className="text-lg font-semibold text-gray-900">Account details</h2>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <p className="mt-1 text-gray-900">{user.email}</p>
                    <p className="text-sm text-gray-500">Email cannot be changed here</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">Role</span>
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
                    onClick={handleSaveAccount}
                  >
                    Save changes
                  </Button>
                </CardFooter>
              </Card>
            </>
          )}

          {section === 'privacy' && (
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-gray-900">Privacy</h2>
                <p className="text-sm text-gray-500">
                  Control how your information is used on QuickConnect
                </p>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-gray-600">
                <p>
                  We use your profile and activity to run the marketplace — for example showing your
                  services to customers, enabling bookings, and notifications you opt into.
                </p>
                <ul className="list-disc space-y-2 pl-5">
                  <li>Your public provider profile is visible to customers when you offer services.</li>
                  <li>Messages are shared between you and the people you chat with.</li>
                  <li>You can request account help or data questions through support.</li>
                </ul>
                <p className="text-gray-500">
                  Full legal text can live in your Terms and Privacy Policy pages when those are
                  published.
                </p>
              </CardContent>
            </Card>
          )}

          {section === 'security' && (
            <>
              <Card>
                <CardHeader>
                  <h2 className="text-lg font-semibold text-gray-900">Sign-in email</h2>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-900">{user.email}</p>
                  <p className="mt-1 text-sm text-gray-500">
                    To change email, contact support or use your provider dashboard settings when
                    available.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <h2 className="text-lg font-semibold text-gray-900">Password</h2>
                  <p className="text-sm text-gray-500">Use a strong password you don&apos;t use elsewhere</p>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleChangePassword} className="space-y-4">
                    {passwordFieldError && (
                      <div className="rounded-lg bg-danger-50 p-3 text-sm text-danger-600">
                        {passwordFieldError}
                      </div>
                    )}
                    <Input
                      label="Current password"
                      type="password"
                      autoComplete="current-password"
                      value={currentPassword}
                      onChange={(e) => {
                        setCurrentPassword(e.target.value)
                        setPasswordFieldError(null)
                      }}
                    />
                    <Input
                      label="New password"
                      type="password"
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value)
                        setPasswordFieldError(null)
                      }}
                    />
                    <Input
                      label="Confirm new password"
                      type="password"
                      autoComplete="new-password"
                      value={confirmNewPassword}
                      onChange={(e) => {
                        setConfirmNewPassword(e.target.value)
                        setPasswordFieldError(null)
                      }}
                    />
                    <div className="flex flex-wrap items-center gap-3">
                      <Button type="submit" loading={passwordSaving}>
                        Update password
                      </Button>
                      <Link
                        to={ROUTES.FORGOT_PASSWORD}
                        className="text-sm font-medium text-primary-600 hover:text-primary-700"
                      >
                        Forgot password?
                      </Link>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </>
          )}

          {section === 'business' && profile.role === 'provider' && (
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
            <CardFooter>
              <Button
                variant="primary"
                icon={<Save className="size-4" />}
                loading={savingBusiness}
                onClick={handleSaveBusiness}
              >
                Save business profile
              </Button>
            </CardFooter>
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
        </>
      )}
        </div>
      </div>

      {profile.role === 'provider' && (
        <>
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
                    data: {
                      service_id: service.id,
                      category_id: cat.id,
                      path: `${ROUTES.PROFILE}?section=business`,
                    },
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
