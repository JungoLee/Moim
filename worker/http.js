// 공용 응답 헬퍼 — API 응답은 성공 { ok:true, ...payload } / 실패 { ok:false, message }
export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store, no-cache, must-revalidate',
    },
  });
}

export function fail(message, status = 400, extra = null) {
  return json({ ok: false, ...(extra || {}), message }, status);
}
