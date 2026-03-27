import { Link } from 'react-router-dom'
import { ROUTES, APP_NAME } from '@/lib/constants'
import { MapPin, Mail, Phone } from 'lucide-react'

const FOOTER_LINKS = {
  Marketplace: [
    { label: 'Browse Providers', to: ROUTES.PROVIDERS },
    { label: 'Looking For Posts', to: ROUTES.LOOKING_FOR },
    { label: 'Post a Request', to: ROUTES.CREATE_POST },
    { label: 'My Bookings', to: ROUTES.MY_BOOKINGS },
  ],
  Account: [
    { label: 'Sign In', to: ROUTES.LOGIN },
    { label: 'Create Account', to: ROUTES.REGISTER },
    { label: 'Provider Dashboard', to: ROUTES.DASHBOARD },
    { label: 'My Profile', to: ROUTES.PROFILE },
  ],
  Support: [
    { label: 'About Us', href: '#' },
    { label: 'Contact', href: '#' },
    { label: 'Terms of Service', href: '#' },
    { label: 'Privacy Policy', href: '#' },
  ],
}

const CITIES = [
  'Gaborone', 'Francistown', 'Maun', 'Kasane',
  'Serowe', 'Mahalapye', 'Palapye', 'Lobatse',
]

export function Footer() {
  return (
    <footer style={{ background: '#1c0770' }} className="text-gray-300">
      {/* Main footer grid */}
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">

          {/* Brand column */}
          <div className="lg:col-span-2">
            <Link
              to={ROUTES.HOME}
              className="inline-flex items-center gap-2 text-white font-bold text-xl"
            >
              <span className="flex size-8 items-center justify-center rounded bg-primary-500 text-white text-sm font-extrabold">
                QC
              </span>
              {APP_NAME}
            </Link>
            <p className="mt-3 text-sm text-gray-400 max-w-xs leading-relaxed">
              Botswana's trusted marketplace for local service providers. From plumbing to photography — we connect you with the right person, fast.
            </p>

            <div className="mt-5 space-y-2 text-sm text-gray-400">
              <div className="flex items-center gap-2">
                <MapPin className="size-4 text-primary-400 shrink-0" />
                <span>Serving 10 cities across Botswana</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="size-4 text-primary-400 shrink-0" />
                <span>quickconnectbw@gmail.com</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="size-4 text-primary-400 shrink-0" />
                <span>+267 76 740 259</span>
              </div>
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(FOOTER_LINKS).map(([section, links]) => (
            <div key={section}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-white mb-4">
                {section}
              </h3>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    {'to' in link ? (
                      <Link
                        to={link.to}
                        className="text-sm text-gray-400 hover:text-white transition-colors"
                      >
                        {link.label}
                      </Link>
                    ) : (
                      <a
                        href={link.href}
                        className="text-sm text-gray-400 hover:text-white transition-colors"
                      >
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Cities served */}
        <div className="mt-10 border-t border-white/10 pt-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
            Cities we serve
          </p>
          <div className="flex flex-wrap gap-2">
            {CITIES.map((city) => (
              <Link
                key={city}
                to={`${ROUTES.PROVIDERS}?city=${encodeURIComponent(city)}`}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-400 hover:text-white hover:border-white/30 transition-colors"
              >
                {city}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{ background: '#120550' }} className="border-t border-white/10">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-gray-500">
            © 2026 {APP_NAME}. All rights reserved. Made with care for Botswana.
          </p>
          <div className="flex items-center gap-4">
            <a href="#" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
              Terms
            </a>
            <a href="#" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
              Privacy
            </a>
            <a href="#" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
              Cookies
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
