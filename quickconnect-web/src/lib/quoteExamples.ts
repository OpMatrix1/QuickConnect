/**
 * Quote request placeholders keyed by service_categories.name (lowercase).
 * Keep in sync with supabase/schema.sql seed categories + any extra categories from migrations (e.g. Solar Installation).
 */
export const QUOTE_PLACEHOLDER_BY_CATEGORY_NAME: Readonly<Record<string, string>> = {
  plumbing: 'e.g. Fix a leaking kitchen tap and replace a faulty toilet cistern.',
  electrical: 'e.g. Install new plug points in the lounge and trace a tripping breaker.',
  cleaning: 'e.g. Deep clean a 3-bedroom house this weekend, including kitchen and bathrooms.',
  painting: 'e.g. Repaint lounge and two bedrooms — walls and ceilings, standard emulsion.',
  carpentry: 'e.g. Build built-in shelves in the study and repair a loose kitchen cabinet door.',
  'gardening & landscaping':
    'e.g. Lawn mowing, hedge trimming, and garden refuse removal (monthly or once-off).',
  'moving & transport':
    'e.g. Move furniture from a 2-bedroom flat to a new address next Saturday.',
  'tutoring & education':
    'e.g. Weekly Maths and Science tutoring for BGCSE, two sessions per week in Gaborone.',
  photography:
    'e.g. Half-day family portrait session outdoors, with edited high-resolution photos.',
  catering:
    'e.g. Buffet lunch for 40 guests with serving staff for a corporate event.',
  'beauty & salon':
    'e.g. Wash, cut, and blow-dry plus bridal makeup trial before the wedding day.',
  'auto repair & mechanic':
    'e.g. Full service, brake check, and diagnose an engine warning light.',
  'it & computer repair':
    'e.g. Laptop is slow and overheating — diagnostics, cleanup, and repair quote.',
  construction:
    'e.g. Build a small boundary wall extension and plaster to match the existing finish.',
  welding: 'e.g. Fabricate a steel gate frame and weld repairs to a trailer chassis.',
  tiling: 'e.g. Retile bathroom floor and shower walls with ceramic tiles.',
  'air conditioning & hvac':
    'e.g. Service bedroom split AC units and check refrigerant / leaks before summer.',
  'security services':
    'e.g. Install CCTV front and rear, plus outdoor motion lights linked to alarm.',
  'event planning':
    'e.g. Plan and coordinate a 50th birthday dinner for 30 guests at a venue.',
  'tailoring & fashion':
    'e.g. Alter wedding dress hem and take in jacket sleeves before the event date.',
  'solar installation':
    'e.g. Quote for home solar panels, inverter, and battery backup for load shedding.',
}

/** When category name is unknown — match loose keywords in combined service text. */
const QUOTE_PLACEHOLDER_KEYWORD_FALLBACK: { keywords: string[]; text: string }[] = [
  { keywords: ['plumb'], text: QUOTE_PLACEHOLDER_BY_CATEGORY_NAME.plumbing },
  { keywords: ['electric'], text: QUOTE_PLACEHOLDER_BY_CATEGORY_NAME.electrical },
  { keywords: ['clean'], text: QUOTE_PLACEHOLDER_BY_CATEGORY_NAME.cleaning },
  { keywords: ['paint'], text: QUOTE_PLACEHOLDER_BY_CATEGORY_NAME.painting },
  { keywords: ['carpent'], text: QUOTE_PLACEHOLDER_BY_CATEGORY_NAME.carpentry },
  { keywords: ['garden', 'landscap'], text: QUOTE_PLACEHOLDER_BY_CATEGORY_NAME['gardening & landscaping'] },
  { keywords: ['mov', 'transport', 'truck'], text: QUOTE_PLACEHOLDER_BY_CATEGORY_NAME['moving & transport'] },
  { keywords: ['tutor', 'education', 'lesson'], text: QUOTE_PLACEHOLDER_BY_CATEGORY_NAME['tutoring & education'] },
  { keywords: ['photograph', 'photo'], text: QUOTE_PLACEHOLDER_BY_CATEGORY_NAME.photography },
  { keywords: ['cater', 'food', 'kitchen'], text: QUOTE_PLACEHOLDER_BY_CATEGORY_NAME.catering },
  { keywords: ['beauty', 'salon', 'hair'], text: QUOTE_PLACEHOLDER_BY_CATEGORY_NAME['beauty & salon'] },
  { keywords: ['auto repair', 'mechanic', 'vehicle'], text: QUOTE_PLACEHOLDER_BY_CATEGORY_NAME['auto repair & mechanic'] },
  { keywords: ['computer', 'it ', 'laptop'], text: QUOTE_PLACEHOLDER_BY_CATEGORY_NAME['it & computer repair'] },
  { keywords: ['construct', 'renovat', 'build'], text: QUOTE_PLACEHOLDER_BY_CATEGORY_NAME.construction },
  { keywords: ['weld'], text: QUOTE_PLACEHOLDER_BY_CATEGORY_NAME.welding },
  { keywords: ['tiling', 'tile '], text: QUOTE_PLACEHOLDER_BY_CATEGORY_NAME.tiling },
  { keywords: ['hvac', 'air cond', 'cooling'], text: QUOTE_PLACEHOLDER_BY_CATEGORY_NAME['air conditioning & hvac'] },
  { keywords: ['security', 'cctv', 'guard'], text: QUOTE_PLACEHOLDER_BY_CATEGORY_NAME['security services'] },
  { keywords: ['event plan', 'wedding plan'], text: QUOTE_PLACEHOLDER_BY_CATEGORY_NAME['event planning'] },
  { keywords: ['tailor', 'fashion', 'alter'], text: QUOTE_PLACEHOLDER_BY_CATEGORY_NAME['tailoring & fashion'] },
  { keywords: ['solar'], text: QUOTE_PLACEHOLDER_BY_CATEGORY_NAME['solar installation'] },
]

export const QUOTE_PLACEHOLDER_DEFAULT =
  'e.g. Describe what you need, where, and when — include size, materials, or headcount if relevant.'

function normalizeCategoryName(name: string): string {
  return name.trim().toLowerCase()
}

/**
 * Picks a placeholder from the provider's service category names (first known category wins).
 * Falls back to keyword matching on combined names, then default.
 */
export function getQuotePlaceholderForCategories(
  categoryNames: (string | null | undefined)[]
): string {
  const ordered = categoryNames.filter((n): n is string => Boolean(n?.trim()))
  const seen = new Set<string>()

  for (const raw of ordered) {
    const key = normalizeCategoryName(raw)
    if (seen.has(key)) continue
    seen.add(key)
    const exact = QUOTE_PLACEHOLDER_BY_CATEGORY_NAME[key]
    if (exact) return exact
  }

  const haystack = ordered.map(normalizeCategoryName).join(' ')
  for (const { keywords, text } of QUOTE_PLACEHOLDER_KEYWORD_FALLBACK) {
    if (keywords.some((k) => haystack.includes(k))) return text
  }

  return QUOTE_PLACEHOLDER_DEFAULT
}
