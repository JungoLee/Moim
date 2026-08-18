-- Moim D1 스키마 (Mongo 7 컬렉션 → 12 테이블)
-- 멱등: CREATE TABLE IF NOT EXISTS — 재실행 안전
-- 규칙: id 는 TEXT(기존 Mongo ObjectId 24-hex 를 그대로 승계, 신규는 crypto.randomUUID())
--       시각은 TEXT ISO8601 UTC / 불리언은 INTEGER 0·1 / 배열은 별도 테이블

-- 사용자 — leave 중첩 객체는 leave_* 로 평탄화
-- google_id: 이메일 로그인 계정은 'email:<소문자 이메일>' 자리표시자 (구글 로그인 시 실 ID 로 교체 = 계정 통합)
CREATE TABLE IF NOT EXISTS users (
  id               TEXT PRIMARY KEY,
  google_id        TEXT NOT NULL UNIQUE,
  email            TEXT NOT NULL,
  name             TEXT NOT NULL DEFAULT '',
  nickname         TEXT NOT NULL DEFAULT '',
  picture          TEXT NOT NULL DEFAULT '',
  is_admin         INTEGER NOT NULL DEFAULT 0,
  leave_remaining  INTEGER NOT NULL DEFAULT 15,
  leave_start      TEXT NOT NULL DEFAULT '',
  leave_renewal    TEXT NOT NULL DEFAULT '',
  leave_max_consec INTEGER NOT NULL DEFAULT 5,
  leave_style      TEXT NOT NULL DEFAULT 'balanced',
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- 그룹(Tier) — UI 표기는 '그룹'
CREATE TABLE IF NOT EXISTS tiers (
  id         TEXT PRIMARY KEY,
  owner      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  code       TEXT NOT NULL UNIQUE,
  color      TEXT NOT NULL DEFAULT '#7c8cff',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tiers_owner ON tiers (owner, created_at);

CREATE TABLE IF NOT EXISTS tier_members (
  tier_id TEXT NOT NULL REFERENCES tiers(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (tier_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_tier_members_user ON tier_members (user_id);

-- 일정 — visibility: public(공유) | private(그룹만 상세) | default(구버전 = public 취급)
-- origin_*: 시간 요청 수락으로 생성된 일정의 출처 스냅샷
CREATE TABLE IF NOT EXISTS events (
  id                 TEXT PRIMARY KEY,
  owner              TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title              TEXT NOT NULL,
  start              TEXT NOT NULL,
  end                TEXT NOT NULL,
  all_day            INTEGER NOT NULL DEFAULT 0,
  location           TEXT NOT NULL DEFAULT '',
  memo               TEXT NOT NULL DEFAULT '',
  visibility         TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','private','default')),
  origin_kind        TEXT NOT NULL DEFAULT '',
  origin_request_id  TEXT,
  origin_from_name   TEXT NOT NULL DEFAULT '',
  origin_to_name     TEXT NOT NULL DEFAULT '',
  origin_requested_at TEXT,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_owner_start ON events (owner, start);
-- 시간요청 사본 짝 조회용 (상대가 자기 사본을 지웠는지 판정)
CREATE INDEX IF NOT EXISTS idx_events_origin_request ON events (origin_request_id);

-- 비공개 일정의 상세 열람 그룹 (Event.audienceTiers[] 분해)
CREATE TABLE IF NOT EXISTS event_audience_tiers (
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tier_id  TEXT NOT NULL REFERENCES tiers(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, tier_id)
);
CREATE INDEX IF NOT EXISTS idx_event_audience_tier ON event_audience_tiers (tier_id);

-- 친구 관계 (쌍당 1행). status: pending | accepted (거절은 행 삭제)
CREATE TABLE IF NOT EXISTS friendships (
  id         TEXT PRIMARY KEY,
  requester  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (requester, recipient)
);
CREATE INDEX IF NOT EXISTS idx_friendships_recipient ON friendships (recipient, status);
CREATE INDEX IF NOT EXISTS idx_friendships_requester ON friendships (requester, status);

-- 모임 방
CREATE TABLE IF NOT EXISTS rooms (
  id          TEXT PRIMARY KEY,
  owner       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  code        TEXT NOT NULL UNIQUE,
  join_by_url INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rooms_owner ON rooms (owner, created_at);

CREATE TABLE IF NOT EXISTS room_members (
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (room_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_room_members_user ON room_members (user_id);

-- 멤버별 날짜 표시 (Room.availabilities[].marks[] 2단 중첩 → 평탄화)
-- status: yes(종일 가능) | no(불가) | after(time 이후 가능). 날짜당 1행을 DB 제약으로 승격
CREATE TABLE IF NOT EXISTS room_availability_marks (
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date    TEXT NOT NULL,
  status  TEXT NOT NULL DEFAULT 'yes' CHECK (status IN ('yes','no','after')),
  time    TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (room_id, user_id, date)
);

-- 방 댓글(채팅). author_name = 작성 시점 표시명 스냅샷
CREATE TABLE IF NOT EXISTS room_comments (
  id          TEXT PRIMARY KEY,
  room_id     TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL DEFAULT '',
  text        TEXT NOT NULL,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_room_comments_room ON room_comments (room_id, created_at);

-- 시간 요청 (from·to 는 SQL 예약어라 from_user·to_user)
CREATE TABLE IF NOT EXISTS time_requests (
  id         TEXT PRIMARY KEY,
  from_user  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL DEFAULT '시간 요청',
  start      TEXT NOT NULL,
  end        TEXT NOT NULL,
  all_day    INTEGER NOT NULL DEFAULT 0,
  message    TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_time_requests_to ON time_requests (to_user, created_at);
CREATE INDEX IF NOT EXISTS idx_time_requests_from ON time_requests (from_user, created_at);

-- 이메일 로그인 코드 — 이메일당 1행(재요청 시 교체). 코드는 sha256 해시로만 저장.
-- Mongo TTL 인덱스가 없으므로 만료행은 조회·발급 시점에 DELETE 로 정리한다.
CREATE TABLE IF NOT EXISTS login_codes (
  email      TEXT PRIMARY KEY,
  code_hash  TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts   INTEGER NOT NULL DEFAULT 0,
  sent_at    TEXT NOT NULL
);

-- 메일 발송 IP 제한 — key 는 "ip:YYYY-MM-DD", 하루 지나면 지운다
CREATE TABLE IF NOT EXISTS mail_rate (
  key   TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0
);
