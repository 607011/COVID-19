const PRECACHE = 'prefetch-cache-1'
const RUNTIME = 'runtime'

const PRECACHE_URLS = [
  'img/favicon-bright-red.png',
  'data/countries.json',
  'static/chart.js',
  'static/ptRMTiqXYfZMCOiVj9kQ1On4KCFtpe4.woff2',
  'static/ptRPTiqXYfZMCOiVj9kQ3FLdPQxPqMQ0bX8.woff2',
]

let urlsToKeepCurrent = []

self.addEventListener('message', evt => {
  switch (evt.data.command) {
    case 'prefetch-external':
      if (evt.data.countries instanceof Array) {
        const countries = evt.data.countries
        urlsToKeepCurrent = countries.map(country => `data/${country}.json`)
        const progress = { min: 0, max: urlsToKeepCurrent.length, value: 0 }
        evt.waitUntil(
          caches.open(PRECACHE)
            .then(cache => {
              for (const url of urlsToKeepCurrent) {
                cache.add(url)
                  .then(() => {
                    ++progress.value
                    evt.source.postMessage({ message: 'progress', progress })
                  })
                  .catch(err => console.error(err))
              }
            })
            .then(self.skipWaiting())
            .catch(err => console.error(err))
        )  
      }
      break
    case 'refresh':
      if (urlsToKeepCurrent.length > 0) {
        const progress = { min: 0, max: urlsToKeepCurrent.length, value: 0 }
        evt.waitUntil(
          caches.open(PRECACHE)
            .then(cache => {
              for (const url of urlsToKeepCurrent) {
                fetch(url, { cache: 'reload' })
                  .then(response => {
                    cache.put(url, response.clone())
                  })
                  .then(() => {
                    ++progress.value
                    if (progress.value < progress.max) {
                      evt.source.postMessage({ message: 'progress', progress })
                    }
                    else {
                      evt.source.postMessage({ message: 'refreshed' })
                    }
                  })
                  .catch(err => console.error(err))
              }
            })
            .then(self.skipWaiting())
            .catch(err => console.error(err))
        )
      }
      break
    default:
      break
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
