// Moim Workers API 검증 — 로그인(이메일 코드) → 주요 CRUD → 권한 → 탈퇴 cascade (57 항목)
// 사용: node scripts/verify-api.mjs <base-url> <로그파일>
//   npx wrangler dev  실행 후 로그를 파일로 남기고 그 경로를 넘긴다
// 로그인 코드는 RESEND_API_KEY 미설정 시 워커 콘솔에 출력되므로 로그에서 회수한다.
// ⚠ 운영은 키가 등록돼 있어 코드가 로그에 안 찍힌다(실메일 발송) — 로컬(키 없는 환경) 전용.
// ⚠ 검증용 계정·데이터는 마지막에 스스로 삭제한다(탈퇴 cascade).
import fs from 'node:fs';

const BASE = process.argv[2] || 'http://127.0.0.1:8790';

let pass = 0;
let fail = 0;
const log = (ok, name, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  ok ? pass++ : fail++;
};

/** 네트워크가 불안정한 환경(여러 A 레코드 중 일부 차단 등) 대비 — 연결 실패만 재시도 */
async function fetchRetry(url, init, tries = 4) {
  for (let i = 1; ; i++) {
    try {
      return await fetch(url, init);
    } catch (err) {
      if (i >= tries) throw err;
      await new Promise((r) => setTimeout(r, 500 * i));
    }
  }
}

async function call(path, { method = 'GET', body, token } = {}) {
  const res = await fetchRetry(`${BASE}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* 리다이렉트 등 */
  }
  return { status: res.status, data, location: res.headers.get('location') };
}

/** D1 에서 해당 이메일의 코드 해시를 못 읽으므로, 코드는 sha256 비교가 불가.
 *  대신 워커가 콘솔에 출력한 코드를 wrangler 로그에서 찾는다. */
function codeFromLog(logPath, email) {
  const text = fs.readFileSync(logPath, 'utf8');
  const marker = `${email} 로그인 코드: `;
  const at = text.lastIndexOf(marker);
  if (at === -1) return null;
  // 코드는 영문 대소문자+숫자 6자 (worker/auth.js 의 CODE_CHARS·CODE_LEN)
  const code = text.slice(at + marker.length, at + marker.length + 6);
  return /^[A-Za-z0-9]{6}$/.test(code) ? code : null;
}

async function login(email, logPath) {
  const req = await call('/api/auth/email/request', { method: 'POST', body: { email } });
  if (req.status !== 200) throw new Error(`코드 요청 실패: ${req.status} ${JSON.stringify(req.data)}`);
  // 워커 로그에서 코드 회수 (조금 기다렸다 재시도)
  let code = null;
  for (let i = 0; i < 20 && !code; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      code = codeFromLog(logPath, email);
    } catch {
      /* 로그 아직 없음 */
    }
  }
  if (!code) throw new Error('로그인 코드를 로그에서 찾지 못함');
  const ver = await call('/api/auth/email/verify', { method: 'POST', body: { email, code } });
  if (ver.status !== 200 || !ver.data?.token) throw new Error(`코드 검증 실패: ${JSON.stringify(ver.data)}`);
  return ver.data.token;
}

const logPath = process.argv[3];
if (!logPath) {
  console.error('사용법: node scripts/verify-api.mjs <base-url> <워커 로그 파일>');
  process.exit(1);
}

const run = async () => {
  const stamp = Date.now();
  const emailA = `verify-a-${stamp}@example.com`;
  const emailB = `verify-b-${stamp}@example.com`;

  // 1. 헬스
  const h = await call('/api/health');
  log(h.status === 200 && h.data?.ok, '헬스체크', JSON.stringify(h.data));

  // 2. 인증 없이 보호 라우트 → 401
  const noAuth = await call('/api/events');
  log(noAuth.status === 401, '비인증 요청 401 차단', `status=${noAuth.status}`);

  // 3. 이메일 코드 로그인 (사용자 A, B)
  const tokenA = await login(emailA, logPath);
  log(!!tokenA, '이메일 코드 로그인 (A)');
  const tokenB = await login(emailB, logPath);
  log(!!tokenB, '이메일 코드 로그인 (B)');

  // 4. 내 정보
  const meA = await call('/api/auth/me', { token: tokenA });
  const meB = await call('/api/auth/me', { token: tokenB });
  log(meA.status === 200 && meA.data.user.email === emailA, '내 정보 조회', meA.data?.user?._id);
  const idA = meA.data.user._id;
  const idB = meB.data.user._id;

  // 5. 닉네임 변경
  const nick = await call('/api/auth/me', { method: 'PATCH', body: { nickname: '검증봇' }, token: tokenA });
  log(nick.status === 200 && nick.data.user.nickname === '검증봇', '닉네임 변경');

  // 6. 연차 설정 저장 → 조회
  await call('/api/auth/leave', { method: 'PUT', body: { remaining: 12, start: '2026-01-01', renewal: '2027-01-01', maxConsec: 4, style: 'long' }, token: tokenA });
  const leave = await call('/api/auth/leave', { token: tokenA });
  log(leave.data?.leave?.remaining === 12 && leave.data.leave.style === 'long', '연차 설정 저장·조회');

  // 7. 그룹 생성 → 목록
  const tier = await call('/api/tiers', { method: 'POST', body: { name: '검증그룹', color: '#ff8800' }, token: tokenA });
  const tierId = tier.data?.tier?._id;
  log(tier.status === 201 && !!tierId && tier.data.tier.code?.length === 8, '그룹 생성', tier.data?.tier?.code);
  const tierList = await call('/api/tiers', { token: tokenA });
  log(tierList.data?.tiers?.some((t) => t._id === tierId), '그룹 목록');

  // 8. 그룹 색 변경
  const recolor = await call(`/api/tiers/${tierId}`, { method: 'PATCH', body: { color: '#123456' }, token: tokenA });
  log(recolor.data?.tier?.color === '#123456', '그룹 색 변경');

  // 9. B 를 그룹에 이메일로 추가
  const addMem = await call(`/api/tiers/${tierId}/members`, { method: 'POST', body: { email: emailB }, token: tokenA });
  log(addMem.status === 200, '그룹 멤버 추가(이메일)');
  const tierList2 = await call('/api/tiers', { token: tokenA });
  log(tierList2.data.tiers.find((t) => t._id === tierId)?.members?.length === 1, '그룹 멤버 반영');

  // 10. 일정 생성 (공개)
  const ev = await call('/api/events', {
    method: 'POST',
    body: { title: '검증 일정', start: '2026-09-01T01:00:00.000Z', end: '2026-09-01T03:00:00.000Z', location: '서울', memo: '메모' },
    token: tokenA,
  });
  const evId = ev.data?.event?._id;
  log(ev.status === 201 && !!evId && ev.data.event.visibility === 'public', '일정 생성(공개)');

  // 11. 일정 생성 (비공개 + 그룹 지정)
  const evP = await call('/api/events', {
    method: 'POST',
    body: { title: '비공개 일정', start: '2026-09-02T01:00:00.000Z', end: '2026-09-02T03:00:00.000Z', visibility: 'private', audienceTiers: [tierId] },
    token: tokenA,
  });
  log(evP.status === 201 && evP.data.event.audienceTiers?.[0] === tierId, '일정 생성(비공개+그룹)');
  const evPId = evP.data?.event?._id;

  // 12. 일정 목록 (기간 필터)
  const evList = await call('/api/events?from=2026-08-01&to=2026-10-01', { token: tokenA });
  log(evList.data?.events?.length === 2, '일정 목록(기간 필터)', `${evList.data?.events?.length}건`);

  // 13. 일정 수정
  const evPatch = await call(`/api/events/${evId}`, { method: 'PATCH', body: { title: '수정된 일정', allDay: true }, token: tokenA });
  log(evPatch.data?.event?.title === '수정된 일정' && evPatch.data.event.allDay === true, '일정 수정');

  // 14. 친구 요청 → 수락
  const fr = await call('/api/friends/requests', { method: 'POST', body: { email: emailB }, token: tokenA });
  const frId = fr.data?.friendship?._id;
  log(fr.status === 201 && !!frId, '친구 요청 보내기');
  const frRecv = await call('/api/friends/requests', { token: tokenB });
  log(frRecv.data?.requests?.length === 1 && frRecv.data.requests[0].requester._id === idA, '받은 친구요청 목록');
  const frAcc = await call(`/api/friends/requests/${frId}/accept`, { method: 'POST', token: tokenB });
  log(frAcc.data?.friendship?.status === 'accepted', '친구 요청 수락');
  const frList = await call('/api/friends', { token: tokenA });
  log(frList.data?.friends?.length === 1 && frList.data.friends[0].user._id === idB, '친구 목록');

  // 15. 친구 캘린더 — B 가 A 를 조회: 공개는 상세, 비공개는 그룹 멤버라 상세
  const cal = await call(`/api/calendar/${idA}`, { token: tokenB });
  const detailed = cal.data?.events?.filter((e) => !e.busy).length;
  log(cal.status === 200 && cal.data.relation === 'friend' && detailed === 2, '친구 캘린더(그룹 멤버 → 비공개도 상세)', `상세 ${detailed}/2`);

  // 16. 그룹에서 B 제거 → 비공개 일정이 "바쁨"으로
  await call(`/api/tiers/${tierId}/members/${idB}`, { method: 'DELETE', token: tokenA });
  const cal2 = await call(`/api/calendar/${idA}`, { token: tokenB });
  const busy = cal2.data?.events?.filter((e) => e.busy);
  log(busy?.length === 1 && busy[0]._id === evPId && busy[0].title === undefined, '비공개 일정 → 바쁨 마스킹(제목 미노출)');

  // 17. 시간 요청 → 수락 → 양쪽 일정 생성
  const tr = await call('/api/requests', {
    method: 'POST',
    body: { to: idB, start: '2026-09-10T05:00:00.000Z', end: '2026-09-10T07:00:00.000Z', title: '커피', message: '봐요' },
    token: tokenA,
  });
  const trId = tr.data?.request?._id;
  log(tr.status === 201 && !!trId, '시간 요청 생성');
  const trRecv = await call('/api/requests/received', { token: tokenB });
  log(trRecv.data?.requests?.[0]?.from?._id === idA, '받은 시간요청 목록(from populate)');
  const trAcc = await call(`/api/requests/${trId}/accept`, { method: 'POST', token: tokenB });
  log(trAcc.status === 200, '시간 요청 수락');
  const evA = await call('/api/events', { token: tokenA });
  const evB = await call('/api/events', { token: tokenB });
  const originA = evA.data.events.find((e) => e.origin?.kind === 'timeRequest');
  const originB = evB.data.events.find((e) => e.origin?.kind === 'timeRequest');
  log(!!originA && !!originB && originA.visibility === 'private', '수락 시 양쪽 캘린더에 비공개 일정 생성');
  log(originA?.originPartnerGone === false, '상대 사본 생존 표시(originPartnerGone=false)');

  // 18. 상대 사본 삭제 → originPartnerGone true
  await call(`/api/events/${originB._id}`, { method: 'DELETE', token: tokenB });
  const evA2 = await call('/api/events', { token: tokenA });
  log(evA2.data.events.find((e) => e._id === originA._id)?.originPartnerGone === true, '상대 삭제 후 originPartnerGone=true');

  // 19. 모임 방 생성 → 코드 입장 → 상세
  const room = await call('/api/rooms', { method: 'POST', body: { name: '검증모임' }, token: tokenA });
  const roomId = room.data?.room?._id;
  const roomCode = room.data?.room?.code;
  log(room.status === 201 && !!roomId && roomCode?.length === 8, '모임 방 생성', roomCode);
  const join = await call('/api/rooms/join', { method: 'POST', body: { code: roomCode }, token: tokenB });
  log(join.data?.roomId === roomId, '코드로 방 입장');
  const roomDetail = await call(`/api/rooms/${roomId}`, { token: tokenB });
  log(roomDetail.data?.room?.members?.length === 2, '방 상세(멤버 2명)');

  // 20. 가용성 저장 → 집계 확인
  await call(`/api/rooms/${roomId}/availability`, { method: 'PUT', body: { marks: [{ date: '2026-09-20', status: 'yes' }, { date: '2026-09-21', status: 'after', time: '19:00' }] }, token: tokenA });
  await call(`/api/rooms/${roomId}/availability`, { method: 'PUT', body: { marks: [{ date: '2026-09-20', status: 'yes' }] }, token: tokenB });
  const roomD2 = await call(`/api/rooms/${roomId}`, { token: tokenA });
  const av = roomD2.data?.availabilities;
  log(av?.[idA]?.length === 2 && av?.[idB]?.length === 1, '가용성 저장·조회');
  log(av[idA].find((m) => m.date === '2026-09-21')?.time === '19:00', '가용성 after 시각 유지');

  // 21. 가용성 전체 교체(덮어쓰기)
  await call(`/api/rooms/${roomId}/availability`, { method: 'PUT', body: { marks: [{ date: '2026-09-25', status: 'no' }] }, token: tokenA });
  const roomD3 = await call(`/api/rooms/${roomId}`, { token: tokenA });
  log(roomD3.data.availabilities[idA]?.length === 1 && roomD3.data.availabilities[idA][0].date === '2026-09-25', '가용성 전체 교체');

  // 22. 방 채팅
  const cmt = await call(`/api/rooms/${roomId}/comments`, { method: 'POST', body: { text: '안녕하세요' }, token: tokenB });
  log(cmt.status === 201, '방 댓글 작성');
  const roomD4 = await call(`/api/rooms/${roomId}`, { token: tokenA });
  const comment = roomD4.data?.comments?.[0];
  log(comment?.text === '안녕하세요' && comment.user === idB, '방 댓글 조회');
  const delCmt = await call(`/api/rooms/${roomId}/comments/${comment._id}`, { method: 'DELETE', token: tokenA });
  log(delCmt.status === 200, '방 댓글 삭제(방장 권한)');

  // 23. 방 설정 · 코드 재발급 · 강퇴
  const patchRoom = await call(`/api/rooms/${roomId}`, { method: 'PATCH', body: { name: '이름변경', joinByUrl: true }, token: tokenA });
  log(patchRoom.status === 200, '방 설정 변경(방장)');
  const patchByB = await call(`/api/rooms/${roomId}`, { method: 'PATCH', body: { name: '탈취' }, token: tokenB });
  log(patchByB.status === 404, '비방장 설정 변경 차단', `status=${patchByB.status}`);
  const newCode = await call(`/api/rooms/${roomId}/code`, { method: 'POST', token: tokenA });
  log(newCode.data?.code && newCode.data.code !== roomCode, '초대 코드 재발급');
  const joinUrl = await call(`/api/rooms/${roomId}/join-url`, { method: 'POST', token: tokenB });
  log(joinUrl.status === 200, 'URL 가입(허용 상태)');
  const kick = await call(`/api/rooms/${roomId}/members/${idB}`, { method: 'DELETE', token: tokenA });
  log(kick.status === 200, '멤버 강퇴');
  const afterKick = await call(`/api/rooms/${roomId}`, { token: tokenB });
  log(afterKick.status === 403, '강퇴된 멤버 접근 차단', `status=${afterKick.status}`);

  // 24. 방 목록
  const roomList = await call('/api/rooms', { token: tokenA });
  log(roomList.data?.rooms?.some((r) => r._id === roomId && r.isOwner), '방 목록(isOwner)');

  // 25. 권한 — 남의 일정 수정 시도
  const steal = await call(`/api/events/${evId}`, { method: 'PATCH', body: { title: '탈취' }, token: tokenB });
  log(steal.status === 404, '타인 일정 수정 차단', `status=${steal.status}`);

  // 26. 관리자 권한 없는 사용자 차단
  const adminDenied = await call('/api/admin/stats', { token: tokenA });
  log(adminDenied.status === 403, '비관리자 admin 접근 차단', `status=${adminDenied.status}`);

  // 27. 구 경로 301 리다이렉트
  const legacyRoom = await call(`/rooms/${roomId}`);
  log(legacyRoom.status === 301 && legacyRoom.location?.includes(`/rooms/detail?id=${roomId}`), '구 /rooms/<id> → 301', legacyRoom.location);
  const legacyUser = await call(`/u/${idA}`);
  log(legacyUser.status === 301 && legacyUser.location?.includes(`/u?id=${idA}`), '구 /u/<id> → 301', legacyUser.location);

  // 28. 정적 자산 서빙
  const idx = await fetchRetry(`${BASE}/`);
  const idxText = await idx.text();
  log(idx.status === 200 && /<!DOCTYPE html>/i.test(idxText), '정적 프론트 서빙(/)');
  const detailPage = await fetchRetry(`${BASE}/rooms/detail?id=${roomId}`);
  log(detailPage.status === 200, '정적 페이지 /rooms/detail');

  // 29. 존재하지 않는 API → JSON 404
  const notFound = await call('/api/nope');
  log(notFound.status === 404 && notFound.data?.ok === false, 'API 404 JSON 응답');

  // 30. 로그인 코드 재요청 쿨다운(60초) — 아직 소비하지 않은 코드가 있어야 적용된다
  //     (검증 성공 시 코드 행은 삭제되므로 emailA/B 는 대상이 아님 — 기존 Express 와 동일)
  const coolEmail = `verify-cool-${stamp}@example.com`;
  const cool1 = await call('/api/auth/email/request', { method: 'POST', body: { email: coolEmail } });
  const cool2 = await call('/api/auth/email/request', { method: 'POST', body: { email: coolEmail } });
  log(cool1.status === 200 && cool2.status === 429, '로그인 코드 재요청 쿨다운 429', `1차=${cool1.status} 2차=${cool2.status}`);

  // 30-b. 잘못된 코드 → 남은 시도 횟수 안내
  const badCode = await call('/api/auth/email/verify', { method: 'POST', body: { email: coolEmail, code: 'AAAAAA' } });
  log(badCode.status === 400 && /4회 남음/.test(badCode.data?.message || ''), '틀린 코드 → 시도 횟수 차감', badCode.data?.message);

  // 31. 탈퇴 → cascade (B 삭제 후 A 의 친구 목록 비고, 방 멤버십 정리)
  const del = await call('/api/auth/me', { method: 'DELETE', token: tokenB });
  log(del.status === 200, '회원 탈퇴');
  const meAfter = await call('/api/auth/me', { token: tokenB });
  log(meAfter.status === 401, '탈퇴 계정 토큰 401 차단', `status=${meAfter.status}`);
  const frAfter = await call('/api/friends', { token: tokenA });
  log(frAfter.data?.friends?.length === 0, '탈퇴 cascade — 친구관계 정리');
  const evAfter = await call('/api/events', { token: tokenA });
  log(Array.isArray(evAfter.data?.events), '탈퇴 후에도 A 일정 목록 정상', `${evAfter.data?.events?.length}건`);

  // 정리 — 검증용 A 계정도 삭제
  await call('/api/auth/me', { method: 'DELETE', token: tokenA });

  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
};

run().catch((e) => {
  console.error('검증 중단:', e.message);
  process.exit(1);
});
