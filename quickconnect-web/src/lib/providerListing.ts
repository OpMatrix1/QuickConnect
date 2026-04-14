/**
 * Providers must complete their listing before appearing in browse/search.
 * Keeps empty or draft profiles out of public discovery.
 */
export function isProviderListingComplete(provider: {
  description?: string | null
  services?: { is_active?: boolean }[] | null
}): boolean {
  if (!provider.description?.trim()) return false
  const services = provider.services ?? []
  return services.some((s) => s.is_active !== false)
}

/** Shown at signup when someone chooses Service Provider */
export const PROVIDER_SIGNUP_LISTING_NOTICE =
  'After you verify your email and sign in, add a business description and at least one active service under Settings → Business. Until then, you will not appear in Find Service Providers or on the home page.'

/** Short line for banners / tooltips */
export const PROVIDER_LISTING_REQUIREMENTS_SHORT =
  'Add a business description and at least one active service to show up when customers browse.'
