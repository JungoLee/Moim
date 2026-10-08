-- 2.0 리뉴얼 — 운영 D1 에 한 번만 적용한다 (ALTER 는 재실행하면 "duplicate column" 오류로 멈춘다).
-- 적용 전 백업:  npx wrangler d1 export moim --remote --output backup/d1-YYYYMMDD-before-renewal.sql
-- 적용:          npx wrangler d1 execute moim --remote --file worker/migrations/2026-10-renewal.sql
-- 새로 만드는 DB 는 worker/schema.sql 에 같은 칸이 이미 있어 이 파일이 필요 없다.

-- 화면 테마(보드/표) — 사용자별
ALTER TABLE users ADD COLUMN ui_theme TEXT NOT NULL DEFAULT '';

-- 모임 날짜 확정
ALTER TABLE rooms ADD COLUMN confirmed_start TEXT NOT NULL DEFAULT '';
ALTER TABLE rooms ADD COLUMN confirmed_end TEXT NOT NULL DEFAULT '';
ALTER TABLE rooms ADD COLUMN confirmed_at TEXT NOT NULL DEFAULT '';
