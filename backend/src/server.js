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
