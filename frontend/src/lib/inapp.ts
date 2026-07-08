// 인앱 브라우저(카카오톡·라인·인스타그램 등 WebView) 감지 + 외부 기본 브라우저 탈출.
// 구글 OAuth 는 embedded WebView 를 정책적으로 차단한다(Error 403: disallowed_useragent)
// → 로그인 전에 기본 브라우저로 내보내야 한다.

export function isInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /KAKAOTALK|Line\/|Instagram|FBAN|FBAV|FB_IAB|NAVER\(inapp|DaumApps|; wv\)/i.test(navigator.userAgent);
}

/** 외부 기본 브라우저로 url 을 연다. 열 방법이 있으면 이동을 시작하고 true, 없으면(iOS 일부 인앱) false. */
export function escapeInAppBrowser(url: string): boolean {
  const ua = navigator.userAgent;
  if (/KAKAOTALK/i.test(ua)) {
    window.location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(url);
    return true;
  }
  if (/Line\//i.test(ua)) {
    // 라인 인앱: 쿼리 파라미터로 외부 브라우저 열기 지원
    window.location.href = url + (url.includes('?') ? '&' : '?') + 'openExternalBrowser=1';
    return true;
  }
  if (/Android/i.test(ua)) {
    // 안드로이드 일반 인앱(인스타그램·페이스북 등): 크롬 intent 로 탈출
    window.location.href = `intent://${url.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`;
    return true;
  }
  return false;
}
