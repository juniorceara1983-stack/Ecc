/**
 * ECC – Service Worker
 * Cada app (index / admin) usa um cache-key distinto para que as instalações
 * sejam completamente independentes e não se sobreponham.
 *
 * Cache names:
 *   ecc-casais-v1   → usado quando o SW é registrado via index.html
 *   ecc-admin-v1    → usado quando o SW é registrado via admin.html
 *
 * O nome do cache é determinado pelo parâmetro ?app=<nome> passado no registro.
 */

'use strict';

const APP_PARAM   = new URL(self.location.href).searchParams.get('app') || 'casais';
const CACHE_NAME  = `ecc-${APP_PARAM}-v1`;

// Recursos a pré-cachear para cada app
const ASSETS_CASAIS = [
  './index.html',
  './css/style.css',
  './js/app.js',
  './manifest.json',
];

const ASSETS_ADMIN = [
  './admin.html',
  './css/style.css',
  './js/app.js',
  './manifest-admin.json',
];

const ASSETS = APP_PARAM === 'admin' ? ASSETS_ADMIN : ASSETS_CASAIS;

// ── Install ────────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// ── Activate – remove caches antigos do mesmo "app" ────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith(`ecc-${APP_PARAM}-`) && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch – Cache-first com fallback para rede ─────────────────────────────────
self.addEventListener('fetch', (event) => {
  // Ignora requisições não-GET e origens externas
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // Armazena apenas respostas bem-sucedidas de recursos locais
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
