// 밥장부 직원용 서비스워커 — 앱 셸 캐시(오프라인 실행) + 홈 화면 설치 지원.
// 데이터는 localStorage에만 있으므로 여기서는 정적 파일만 다룬다.
// 중계 서버 API(다른 출처)는 절대 캐시하지 않고 항상 네트워크로 보낸다.
const CACHE = 'bapjangbu-staff-v1';
const ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;   // API 등 외부 요청은 그대로 통과

  // 앱 본체(HTML)는 네트워크 우선 — 새 버전이 바로 반영되고, 오프라인이면 캐시로 실행
  if (e.request.mode === 'navigate' || url.pathname.endsWith('/index.html')) {
    e.respondWith(
      fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put('./index.html', copy));
        return res;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // 아이콘·매니페스트 등 정적 파일은 캐시 우선
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }))
  );
});
