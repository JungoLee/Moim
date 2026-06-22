import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../models/User.js';

// 기본 관리자 이메일(콤마로 여러 개, env 로 오버라이드 가능)
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'tough123181@gmail.com')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

// 세션 없이(stateless) Google OAuth 만 사용 — 콜백에서 JWT 를 발급한다.
export function configurePassport() {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value || '';
          const picture = profile.photos?.[0]?.value || '';
          const isAdminEmail = ADMIN_EMAILS.includes(email.toLowerCase());
          let user = await User.findOne({ googleId: profile.id });
          if (!user) {
            user = await User.create({
              googleId: profile.id,
              email,
              name: profile.displayName || '',
              picture,
              isAdmin: isAdminEmail,
            });
          } else {
            // 프로필 최신화
            user.email = email || user.email;
            user.name = profile.displayName || user.name;
            user.picture = picture || user.picture;
            if (isAdminEmail) user.isAdmin = true; // 기본 관리자 보장(강등하지 않음)
            await user.save();
          }
          done(null, user);
        } catch (err) {
          done(err);
        }
      }
    )
  );
}
