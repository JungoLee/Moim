import nodemailer from 'nodemailer';

// 로그인 코드 메일 발송 — 우선순위:
// 1) BREVO_API_KEY 설정 시 Brevo HTTP API (⚠ Render 무료 플랜은 외부 SMTP 포트(25·465·587)를
//    차단하므로 운영은 HTTPS(443) 기반 발송이 필요하다)
// 2) SMTP env(SMTP_HOST·SMTP_USER 등) 설정 시 nodemailer SMTP (로컬·유료 플랜)
// 3) 둘 다 없으면 발송 대신 서버 콘솔에 코드 출력 (개발 폴백)
let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) return null;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465, // 465=SSL, 587=STARTTLS
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    // 포트가 막힌 환경에서 기본값(2분)씩 매달리지 않게 짧은 타임아웃
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  return transporter;
}

function buildLoginMail(code) {
  const brand = process.env.BRAND_NAME || 'Moim';
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

// Brevo(구 Sendinblue) HTTP API — 발신 주소(SMTP_FROM 또는 SMTP_USER)는 Brevo 에서 사전 인증 필요
async function sendViaBrevo(email, code) {
  const { brand, subject, text, html } = buildLoginMail(code);
  const sender = process.env.SMTP_FROM || process.env.SMTP_USER;
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': process.env.BREVO_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({
      sender: { email: sender, name: brand },
      to: [{ email }],
      subject,
      textContent: text,
      htmlContent: html,
    }),
  });
  if (!res.ok) throw new Error(`Brevo 발송 실패 (${res.status}): ${await res.text()}`);
}

/** 발송 수단(Brevo API 키 또는 SMTP)이 하나라도 설정돼 있는가 */
export function hasMailTransport() {
  return !!process.env.BREVO_API_KEY || !!(process.env.SMTP_HOST && process.env.SMTP_USER);
}

/** 로그인 인증 코드 메일 발송. 발송 수단이 없으면 콘솔 출력(개발용). */
export async function sendLoginCode(email, code) {
  if (process.env.BREVO_API_KEY) return sendViaBrevo(email, code);
  const t = getTransporter();
  if (!t) {
    console.log(`[mail] (발송 수단 미설정 — 개발용 출력) ${email} 로그인 코드: ${code}`);
    return;
  }
  const { subject, text, html } = buildLoginMail(code);
  await t.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject,
    text,
    html,
  });
}
