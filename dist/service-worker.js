const PRECACHE = 'prefetch-cache-1'
const RUNTIME = 'runtime'

const PRECACHE_URLS = [
  'index.html',
  './',
  'app.css',
  'main.js',
  'img/favicon.png',
  'data/countries.json',
  'static/chart.js',
  'static/ptRMTiqXYfZMCOiVj9kQ1On4KCFtpe4.woff2',
  'static/ptRPTiqXYfZMCOiVj9kQ3FLdPQxPqMQ0bX8.woff2',
]

self.addEventListener('message', evt => {
  if (evt.data.command === 'prefetch-external') {
    const countries = evt.data.countries
    const urls = countries.map(country => `data/${country}.json`)
    const progress = { min: 0, max: urls.length, value: 0 }
    evt.waitUntil(
      caches.open(PRECACHE)
        .then(cache => {
          for (const url of urls)
          cache.add(url)
            .then(_ => {
              ++progress.value
              evt.ports[0].postMessage({ message: 'progress', progress })
            })
            .catch(err => console.error(err))
        })
        .then(self.skipWaiting())
        .catch(err => console.error(err))
    )
  }
})

self.addEventListener('install', evt => {
  evt.waitUntil(
    caches.open(PRECACHE)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(self.skipWaiting())
      .catch(err => console.error(err))
  )
})

self.addEventListener('activate', evt => {
  const currentCaches = [PRECACHE, RUNTIME]
  evt.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return cacheNames.filter(cacheName => !currentCaches.includes(cacheName))
      })
      .then(cachesToDelete => {
        return Promise.all(cachesToDelete.map(cacheToDelete => {
          return caches.delete(cacheToDelete);
        }))
      })
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', evt => {
  if (evt.request.url.startsWith(self.location.origin)) {
    evt.respondWith(
      caches.match(evt.request)
        .then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse
          }
          return caches.open(RUNTIME)
            .then(cache => {
              return fetch(evt.request)
                .then(response => {
                  return cache.put(evt.request, response.clone())
                    .then(() => {
                      return response
                    })
                })
            })
        })
    )
  }
})
