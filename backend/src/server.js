import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import passport from 'passport';

import { connectDB } from './config/db.js';
import { configurePassport } from './config/passport.js';
import authRoutes from './routes/auth.js';
import eventRoutes from './routes/events.js';
import friendRoutes from './routes/friends.js';
import calendarRoutes from './routes/calendar.js';

// 필수 환경변수 점검 — 없으면 cryptic crash(passport throw 등) 대신 친절히 안내하고 종료
const REQUIRED_ENV = ['MONGODB_URI', 'JWT_SECRET', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_CALLBACK_URL'];
const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missingEnv.length) {
  console.error(`[server] 필수 환경변수가 비어 있어 시작할 수 없습니다: ${missingEnv.join(', ')}`);
  console.error('[server] backend/.env 를 만들고 값을 채우세요. (양식: backend/.env.example)');
  process.exit(1);
}

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json());

configurePassport();
app.use(passport.initialize());

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'moim-backend' }));
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/calendar', calendarRoutes);

// 공통 에러 핸들러
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[error]', err);
  res.status(500).json({ ok: false, message: '서버 오류가 발생했습니다.' });
});

const PORT = process.env.PORT || 4000;

connectDB(process.env.MONGODB_URI)
  .then(() => {
    app.listen(PORT, () => console.log(`[server] http://localhost:${PORT} 에서 실행 중`));
  })
  .catch((err) => {
    console.error('[server] DB 연결 실패로 시작할 수 없습니다:', err.message);
    process.exit(1);
  });
