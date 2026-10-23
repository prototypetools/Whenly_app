/* eslint-disable no-restricted-globals */
/**
 * Service worker Whenly.
 *
 * Tugasnya HANYA menampilkan notifikasi push dan menangani klik.
 * Sengaja tidak melakukan caching/fetch interception supaya tidak
 * mengganggu perilaku Next.js saat development maupun setelah deploy.
 */

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (error) {
    data = { title: 'Whenly', body: event.data ? event.data.text() : 'Ada pengingat langganan.' };
  }

  const title = data.title || 'Whenly';
  const options = {
    body: data.body || 'Ada pengingat langganan.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: data.tag || 'whenly-reminder',
    renotify: true,
    requireInteraction: Boolean(data.requireInteraction),
    data: { url: data.url || '/renewals' },
    vibrate: [80, 40, 80],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetPath = (event.notification.data && event.notification.data.url) || '/renewals';

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const base = self.location.origin;
      const absoluteTarget = new URL(targetPath, base).href;

      for (const client of allClients) {
        if (client.url === absoluteTarget && 'focus' in client) return client.focus();
      }

      const anyClient = allClients.find((client) => new URL(client.url).origin === base);
      if (anyClient && 'navigate' in anyClient) {
        await anyClient.navigate(absoluteTarget);
        return anyClient.focus();
      }

      return self.clients.openWindow(absoluteTarget);
    })(),
  );
});
