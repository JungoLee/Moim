// 로그인 코드 메일 발송 — Resend HTTP API 만 사용한다.
// (Workers 는 raw TCP 를 못 열어 SMTP/nodemailer 불가. 키가 없으면 콘솔 출력 = wrangler tail 로 확인)
// 발신 도메인 opnae.com 은 Resend 에 인증돼 있고, 키는 opnae 프로젝트들이 공용으로 쓴다.

function buildLoginMail(code, env) {
  const brand = env.BRAND_NAME || 'Moim';
  return {
    brand,
    subject: `[${brand}] 로그인 인증 코드: ${code}`,
    text: `${brand} 로그인 인증 코드입니다.\n\n${code}\n\n10분 안에 입력해주세요. 본인이 요청하지 않았다면 이 메일을 무시하세요.`,
    // 메일 클라이언트 호환을 위해 인라인 스타일만 쓴다 — 코드가 한눈에 들어오는 카드형
    html: `
      <div style="margin:0;padding:32px 16px;background:#f4f5f7;font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif">
        <div style="max-width:420px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden">
          <div style="padding:22px 28px 0">
            <p style="margin:0;font-size:13px;font-weight:700;letter-spacing:0.4px;color:#4f46e5">● ${brand}</p>
          </div>
          <div style="padding:18px 28px 28px">
            <h1 style="margin:0 0 6px;font-size:19px;color:#111827">로그인 인증 코드</h1>
            <p style="margin:0 0 18px;font-size:14px;line-height:1.7;color:#6b7280">
              아래 코드를 로그인 화면에 입력해주세요.<br/>코드는 <strong style="color:#111827">10분</strong> 동안 유효합니다.
            </p>
            <div style="padding:18px 8px;text-align:center;background:#f6f7fb;border:1px dashed #c7cbe8;border-radius:10px">
              <span style="font-size:24px;font-weight:800;letter-spacing:5px;color:#1f2937;font-family:Consolas,monospace">${code}</span>
            </div>
            <p style="margin:18px 0 0;font-size:12px;line-height:1.7;color:#9ca3af">
              본인이 요청하지 않았다면 이 메일은 무시하세요 — 코드를 모르는 사람은 로그인할 수 없습니다.
            </p>
          </div>
          <div style="padding:14px 28px;background:#fafafa;border-top:1px solid #f0f0f2">
            <p style="margin:0;font-size:11px;color:#b3b8c2">이 메일은 ${brand}(moim.opnae.com) 로그인 시도로 발송됐습니다.</p>
          </div>
        </div>
      </div>`,
  };
}

/** 발송 수단(Resend API 키)이 설정돼 있는가 */
export const hasMailTransport = (env) => !!env.RESEND_API_KEY;

/** 로그인 인증 코드 발송. 발송 수단이 없으면 로그 출력(개발·폴백). */
export async function sendLoginCode(email, code, env) {
  if (!env.RESEND_API_KEY) {
    console.log(`[mail] (발송 수단 미설정 — 개발용 출력) ${email} 로그인 코드: ${code}`);
    return;
  }
  const { brand, subject, text, html } = buildLoginMail(code, env);
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: `${brand} <${env.SMTP_FROM}>`,
      to: [email],
      subject,
      text,
      html,
    }),
  });
  if (!res.ok) throw new Error(`Resend 발송 실패 (${res.status}): ${await res.text()}`);
}
