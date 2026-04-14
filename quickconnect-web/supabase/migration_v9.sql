-- Migration v9: Category-themed avatar & banner for all service providers
-- Run after migration_v8.sql (banner_url column).
--
-- Rules:
--   * Primary category = first active service (services.created_at ASC) for that provider.
--   * If they have no active services, category = 'General' (neutral assets).
--   * Avatars: UI Avatars (deterministic initials + category color).
--   * Banners: Placehold (deterministic category-themed text banner).
--
-- IMPORTANT: This OVERWRITES existing avatar_url and banner_url for every profile linked to
-- service_providers. Custom uploads will be replaced. Re-run any time services/categories change
-- to refresh theming. To skip a provider, run a targeted UPDATE after this migration.

UPDATE public.profiles p
SET
  avatar_url =
    'https://ui-avatars.com/api/?size=256&bold=true&rounded=true&name='
    || replace(coalesce(sp.business_name, p.full_name, 'Provider'), ' ', '+')
    || '&background='
    || (CASE coalesce(svc.category_name, 'General')
      WHEN 'Plumbing' THEN '0284c7'
      WHEN 'Electrical' THEN 'd97706'
      WHEN 'Cleaning' THEN '059669'
      WHEN 'Painting' THEN '7c3aed'
      WHEN 'Carpentry' THEN '92400e'
      WHEN 'Gardening & Landscaping' THEN '166534'
      WHEN 'Moving & Transport' THEN '4f46e5'
      WHEN 'Tutoring & Education' THEN '0369a1'
      WHEN 'Photography' THEN 'a21caf'
      WHEN 'Catering' THEN 'c2410c'
      WHEN 'Beauty & Salon' THEN 'be185d'
      WHEN 'Auto Repair & Mechanic' THEN '1f2937'
      WHEN 'IT & Computer Repair' THEN '0d9488'
      WHEN 'Construction' THEN '57534e'
      WHEN 'Welding' THEN 'b45309'
      WHEN 'Tiling' THEN '475569'
      WHEN 'Air Conditioning & HVAC' THEN '0369a1'
      WHEN 'Security Services' THEN '1e3a8a'
      WHEN 'Event Planning' THEN '7c2d12'
      WHEN 'Tailoring & Fashion' THEN '86198f'
      WHEN 'Solar Installation' THEN 'ca8a04'
      ELSE '64748b'
    END)
    || '&color=ffffff',
  banner_url =
    CASE coalesce(svc.category_name, 'General')
      WHEN 'Plumbing' THEN 'https://placehold.co/1200x400/0b6cbf/ffffff/png?text=Plumbing+Services'
      WHEN 'Electrical' THEN 'https://placehold.co/1200x400/d97706/ffffff/png?text=Electrical+Services'
      WHEN 'Cleaning' THEN 'https://placehold.co/1200x400/059669/ffffff/png?text=Cleaning+Services'
      WHEN 'Painting' THEN 'https://placehold.co/1200x400/7c3aed/ffffff/png?text=Painting+Services'
      WHEN 'Carpentry' THEN 'https://placehold.co/1200x400/92400e/ffffff/png?text=Carpentry+Services'
      WHEN 'Gardening & Landscaping' THEN 'https://placehold.co/1200x400/166534/ffffff/png?text=Gardening+and+Landscaping'
      WHEN 'Moving & Transport' THEN 'https://placehold.co/1200x400/4f46e5/ffffff/png?text=Moving+and+Transport'
      WHEN 'Tutoring & Education' THEN 'https://placehold.co/1200x400/0369a1/ffffff/png?text=Tutoring+and+Education'
      WHEN 'Photography' THEN 'https://placehold.co/1200x400/a21caf/ffffff/png?text=Photography+Services'
      WHEN 'Catering' THEN 'https://placehold.co/1200x400/c2410c/ffffff/png?text=Catering+Services'
      WHEN 'Beauty & Salon' THEN 'https://placehold.co/1200x400/be185d/ffffff/png?text=Beauty+and+Salon'
      WHEN 'Auto Repair & Mechanic' THEN 'https://placehold.co/1200x400/1f2937/ffffff/png?text=Auto+Repair+and+Mechanic'
      WHEN 'IT & Computer Repair' THEN 'https://placehold.co/1200x400/0d9488/ffffff/png?text=IT+and+Computer+Repair'
      WHEN 'Construction' THEN 'https://placehold.co/1200x400/57534e/ffffff/png?text=Construction+Services'
      WHEN 'Welding' THEN 'https://placehold.co/1200x400/b45309/ffffff/png?text=Welding+Services'
      WHEN 'Tiling' THEN 'https://placehold.co/1200x400/475569/ffffff/png?text=Tiling+Services'
      WHEN 'Air Conditioning & HVAC' THEN 'https://placehold.co/1200x400/0369a1/ffffff/png?text=Air+Conditioning+and+HVAC'
      WHEN 'Security Services' THEN 'https://placehold.co/1200x400/1e3a8a/ffffff/png?text=Security+Services'
      WHEN 'Event Planning' THEN 'https://placehold.co/1200x400/7c2d12/ffffff/png?text=Event+Planning'
      WHEN 'Tailoring & Fashion' THEN 'https://placehold.co/1200x400/86198f/ffffff/png?text=Tailoring+and+Fashion'
      WHEN 'Solar Installation' THEN 'https://placehold.co/1200x400/ca8a04/ffffff/png?text=Solar+Installation'
      ELSE 'https://placehold.co/1200x400/64748b/ffffff/png?text=QuickConnect+Provider'
    END
FROM public.service_providers sp
LEFT JOIN LATERAL (
  SELECT sc.name AS category_name
  FROM public.services s
  INNER JOIN public.service_categories sc ON sc.id = s.category_id
  WHERE s.provider_id = sp.id
    AND coalesce(s.is_active, true) = true
  ORDER BY s.created_at ASC
  LIMIT 1
) svc ON true
WHERE sp.profile_id = p.id;
