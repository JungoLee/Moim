import nodemailer from 'nodemailer';

// SMTP 발송기 — env(SMTP_HOST·SMTP_PORT·SMTP_USER·SMTP_PASS·SMTP_FROM)로 구성.
// SMTP 미설정(로컬 개발)이면 발송 대신 서버 콘솔에 코드를 출력한다.
let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) return null;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465, // 465=SSL, 587=STARTTLS
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transporter;
}

/** 로그인 인증 코드 메일 발송. SMTP 미설정이면 콘솔 출력(개발용). */
export async function sendLoginCode(email, code) {
  const t = getTransporter();
  if (!t) {
    console.log(`[mail] (SMTP 미설정 — 개발용 출력) ${email} 로그인 코드: ${code}`);
    return;
  }
  const brand = process.env.BRAND_NAME || 'Moim';
  await t.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: `[${brand}] 로그인 인증 코드: ${code}`,
    text: `${brand} 로그인 인증 코드입니다.\n\n${code}\n\n10분 안에 입력해주세요. 본인이 요청하지 않았다면 이 메일을 무시하세요.`,
    html: `
      <div style="font-family:sans-serif;max-width:420px;margin:0 auto;padding:24px">
        <h2 style="margin:0 0 12px">${brand} 로그인 인증 코드</h2>
        <p style="color:#555;margin:0 0 20px">아래 코드를 로그인 화면에 입력해주세요. <strong>10분</strong> 동안 유효합니다.</p>
        <div style="font-size:24px;font-weight:700;letter-spacing:4px;text-align:center;padding:16px;background:#f4f5f9;border-radius:10px">${code}</div>
        <p style="color:#999;font-size:12px;margin:20px 0 0">본인이 요청하지 않았다면 이 메일을 무시하세요.</p>
      </div>`,
  });
}
