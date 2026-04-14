/* eslint-disable no-undef */
// Loaded via Workbox importScripts; handles Web Push for Android + desktop browsers.
self.addEventListener('push', function (event) {
  let title = 'QuickConnect'
  let body = ''
  let url = self.registration.scope
  let tag = 'qc-push'

  try {
    if (event.data) {
      const payload = event.data.json()
      if (payload.title) title = String(payload.title)
      if (payload.body != null) body = String(payload.body)
      if (payload.data && typeof payload.data.url === 'string') url = payload.data.url
      if (payload.tag) tag = String(payload.tag)
    }
  } catch (_) {
    if (event.data) {
      const t = event.data.text()
      if (t) body = t
    }
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: new URL('pwa-192x192.png', self.registration.scope).href,
      badge: new URL('pwa-64x64.png', self.registration.scope).href,
      tag,
      data: { url },
    }),
  )
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  const url = event.notification.data && event.notification.data.url
    ? event.notification.data.url
    : self.registration.scope

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const c = clientList[i]
        if (c.url.startsWith(self.location.origin) && 'focus' in c) {
          var p = 'navigate' in c ? c.navigate(url) : Promise.resolve()
          return p.then(function () {
            return c.focus()
          })
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
    }),
  )
})
