// 밥장부 직원용 서비스워커 — 앱 셸 캐시(오프라인 실행) + 홈 화면 설치 지원.
// 데이터는 localStorage에만 있으므로 여기서는 정적 파일만 다룬다.
// 중계 서버 API(다른 출처)는 절대 캐시하지 않고 항상 네트워크로 보낸다.
// 캐시에는 "정상 응답(2xx) + 같은 출처(basic)"만 쓴다 — 배포 중 404가 한 번 나면
// 오프라인 앱이 오류 페이지로 바뀌어 버리는 캐시 오염 사고를 막는다.
const CACHE = 'bapjangbu-staff-v3';
const ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];

// 캐시에 담아도 되는 응답인가 — 정상 상태 + 같은 출처만 허용
function cacheable(res) {
  return !!res && res.ok && res.type === 'basic';
}
function putSafe(request, res) {
  if (!cacheable(res)) return;                      // 404·5xx·불투명(교차출처) 응답은 저장하지 않음
  const copy = res.clone();
  caches.open(CACHE).then(c => c.put(request, copy)).catch(() => { /* 저장 실패는 무시 */ });
}

self.addEventListener('install', e => {
  // addAll은 하나라도 정상 응답이 아니면 실패한다 → 오류 응답이 캐시에 들어가지 않는다
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
        if (cacheable(res)) { putSafe('./index.html', res); return res; }
        // 배포 중 404 등 비정상 응답 — 캐시를 덮어쓰지 말고 마지막 정상 앱을 보여준다
        return caches.match('./index.html').then(hit => hit || res);
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // 아이콘·매니페스트 등 정적 파일은 캐시 우선
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      putSafe(e.request, res);
      return res;
    }))
  );
});
