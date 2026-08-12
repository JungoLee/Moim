// 로그인 코드 메일 발송 — Brevo HTTP API 만 사용한다.
// (Workers 는 raw TCP 를 못 열어 SMTP/nodemailer 불가. 키가 없으면 콘솔 출력 = wrangler tail 로 확인)

function buildLoginMail(code, env) {
  const brand = env.BRAND_NAME || 'Moim';
  return {
    brand,
    subject: `[${brand}] 로그인 인증 코드: ${code}`,
    text: `${brand} 로그인 인증 코드입니다.\n\n${code}\n\n10분 안에 입력해주세요. 본인이 요청하지 않았다면 이 메일을 무시하세요.`,
    html: `
      <div style="font-family:sans-serif;max-width:420px;margin:0 auto;padding:24px">
        <h2 style="margin:0 0 12px">${brand} 로그인 인증 코드</h2>
        <p style="color:#555;margin:0 0 20px">아래 코드를 로그인 화면에 입력해주세요. <strong>10분</strong> 동안 유효합니다.</p>
        <div style="font-size:24px;font-weight:700;letter-spacing:4px;text-align:center;padding:16px;background:#f4f5f9;border-radius:10px">${code}</div>
        <p style="color:#999;font-size:12px;margin:20px 0 0">본인이 요청하지 않았다면 이 메일을 무시하세요.</p>
      </div>`,
  };
}

/** 발송 수단(Brevo API 키)이 설정돼 있는가 */
export const hasMailTransport = (env) => !!env.BREVO_API_KEY;

/** 로그인 인증 코드 발송. 발송 수단이 없으면 로그 출력(개발·폴백). */
export async function sendLoginCode(email, code, env) {
  if (!env.BREVO_API_KEY) {
    console.log(`[mail] (발송 수단 미설정 — 개발용 출력) ${email} 로그인 코드: ${code}`);
    return;
  }
  const { brand, subject, text, html } = buildLoginMail(code, env);
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': env.BREVO_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({
      sender: { email: env.SMTP_FROM, name: brand },
      to: [{ email }],
      subject,
      textContent: text,
      htmlContent: html,
    }),
  });
  if (!res.ok) throw new Error(`Brevo 발송 실패 (${res.status}): ${await res.text()}`);
}
