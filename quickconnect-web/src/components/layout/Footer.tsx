import { Link } from 'react-router-dom'
import { ROUTES, APP_NAME } from '@/lib/constants'

export function Footer() {

  return (
    <footer className="border-t border-gray-200 bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Branding */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Link
              to={ROUTES.HOME}
              className="text-xl font-bold text-primary-600 hover:text-primary-700"
            >
              {APP_NAME}
            </Link>
            <p className="mt-2 text-sm text-gray-600">
              Made with care for Botswana
            </p>
          </div>

          {/* Links */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Quick Links</h3>
            <ul className="mt-4 space-y-2">
              <li>
                <Link
                  to={ROUTES.HOME}
                  className="text-sm text-gray-600 hover:text-primary-600 transition-colors"
                >
                  Home
                </Link>
              </li>
              <li>
                <a
                  href="#"
                  className="text-sm text-gray-600 hover:text-primary-600 transition-colors"
                >
                  About
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="text-sm text-gray-600 hover:text-primary-600 transition-colors"
                >
                  Contact
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="text-sm text-gray-600 hover:text-primary-600 transition-colors"
                >
                  Terms
                </a>
              </li>
            </ul>
          </div>

          {/* Copyright */}
          <div className="sm:col-span-2 lg:col-span-1 lg:text-right">
            <p className="text-sm text-gray-500">
              © 2026 {APP_NAME}. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
