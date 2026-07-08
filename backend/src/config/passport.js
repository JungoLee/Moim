import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { isAdminEmail } from '../utils/admins.js';
import User from '../models/User.js';

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
          const admin = isAdminEmail(email);
          let user = await User.findOne({ googleId: profile.id });
          // 이메일 코드로 먼저 가입한 계정이 있으면 구글 계정과 통합 (자리표시자 googleId 교체)
          if (!user && email) {
            user = await User.findOne({ email: email.toLowerCase(), googleId: `email:${email.toLowerCase()}` });
            if (user) user.googleId = profile.id;
          }
          if (!user) {
            user = await User.create({
              googleId: profile.id,
              email,
              name: profile.displayName || '',
              picture,
              isAdmin: admin,
            });
          } else {
            // 프로필 최신화
            user.email = email || user.email;
            user.name = profile.displayName || user.name;
            user.picture = picture || user.picture;
            if (admin) user.isAdmin = true; // 기본 관리자 보장(강등하지 않음)
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
