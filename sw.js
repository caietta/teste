// Service Worker para otimização de cache CDN Cloudflare
const CACHE_NAME = "quiz-cache-v2";
const CDN_BASE = "https://pub-ab258eec9fbd44ec967aa5cc0195d16b.r2.dev/";

// Recursos críticos para cache
const CRITICAL_RESOURCES = [
  "/",
  "/index.html",
  "blonde.webp",
  "brunette.webp",
  "milf.webp",
  "young.webp",
  "maria.webp",
  "lisa.webp",
  "eva.webp",
  "logomilf.jpeg",
  "logonormal.jpeg",
];

// Install event - cache recursos críticos
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("Service Worker: Caching critical resources");
        return cache.addAll(
          CRITICAL_RESOURCES.map((resource) => {
            // Adiciona cache busting para evitar cache antigo
            return resource + "?v=" + Date.now();
          })
        );
      })
      .catch((err) => {
        console.log("Service Worker: Error caching resources", err);
      })
  );
  self.skipWaiting();
});

// Activate event - limpa caches antigos
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log("Service Worker: Deleting old cache", cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - estratégia de cache inteligente
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Para vídeos do CDN Cloudflare - sempre buscar da rede primeiro
  if (
    url.href.includes(CDN_BASE) &&
    (url.href.includes(".mp4") || url.href.includes(".webm"))
  ) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Clone a resposta para o cache
          const responseClone = response.clone();

          // Cache apenas se a resposta for válida
          if (response.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }

          return response;
        })
        .catch(() => {
          // Fallback para cache em caso de erro de rede
          return caches.match(event.request);
        })
    );
    return;
  }

  // Para recursos estáticos - cache first
  if (
    event.request.destination === "image" ||
    event.request.url.includes(".webp") ||
    event.request.url.includes(".jpeg") ||
    event.request.url.includes(".jpg") ||
    event.request.url.includes(".png")
  ) {
    event.respondWith(
      caches.match(event.request).then((response) => {
        if (response) {
          return response;
        }

        return fetch(event.request).then((response) => {
          // Cache apenas imagens válidas
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }

          return response;
        });
      })
    );
    return;
  }

  // Para outros recursos - network first com fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

// Background sync para pré-carregar vídeo quando a rede estiver disponível
self.addEventListener("sync", (event) => {
  if (event.tag === "background-video-preload") {
    event.waitUntil(preloadBackgroundVideo());
  }
});

// Função para pré-carregar vídeos em background
function preloadBackgroundVideo() {
  const videoUrls = [
    CDN_BASE + "VID1-FUNIL.webm",
    CDN_BASE + "VID2-FUNIL.webm",
    CDN_BASE + "VID3-FUNIL.webm",
    CDN_BASE + "VID4-FUNIL%20(1).webm",
  ];

  const preloadPromises = videoUrls.map((videoUrl) => {
    return fetch(videoUrl, { mode: "no-cors" })
      .then((response) => {
        if (response.ok || response.type === "opaque") {
          return caches.open(CACHE_NAME).then((cache) => {
            return cache.put(videoUrl, response);
          });
        }
      })
      .catch((err) => {
        console.log(`Background video preload failed for ${videoUrl}:`, err);
      });
  });

  return Promise.all(preloadPromises);
}
