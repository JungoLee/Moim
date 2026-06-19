import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
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
          let user = await User.findOne({ googleId: profile.id });
          if (!user) {
            user = await User.create({
              googleId: profile.id,
              email,
              name: profile.displayName || '',
              picture,
            });
          } else {
            // 프로필 최신화
            user.email = email || user.email;
            user.name = profile.displayName || user.name;
            user.picture = picture || user.picture;
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
