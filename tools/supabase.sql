-- ═══════════════════════════════════════════════════════════
-- กระดานคะแนนกลาง — สคริปต์สร้างตารางใน Supabase
-- วิธีใช้: เข้า supabase.com → โปรเจกต์ของคุณ → SQL Editor
--          → New query → วางทั้งหมดนี้ → กด Run
-- ═══════════════════════════════════════════════════════════

create table if not exists public.scores (
  id          bigint generated always as identity primary key,
  name        text        not null,
  level       text        not null,
  mode        text        not null,
  score       integer     not null,
  correct     integer     not null default 0,
  asked       integer     not null default 0,
  duel_code   text,
  created_at  timestamptz not null default now(),

  -- กันข้อมูลขยะและกันคนยิงคะแนนมั่ว
  constraint name_len   check (char_length(name) between 1 and 14),
  constraint level_ok   check (level in ('starter','middle','toeic','advanced')),
  constraint mode_ok    check (mode  in ('rush','survive','duel')),
  constraint score_ok   check (score between 0 and 200000),
  constraint counts_ok  check (correct >= 0 and asked >= 0 and correct <= asked),
  constraint code_ok    check (duel_code is null or duel_code ~ '^[A-Z0-9]{4}$')
);

-- ดัชนีให้ดึงกระดานเร็ว
create index if not exists scores_board_idx
  on public.scores (level, mode, score desc);
create index if not exists scores_duel_idx
  on public.scores (duel_code) where duel_code is not null;

-- ═══ สิทธิ์การเข้าถึง ═══════════════════════════════════
-- เปิด Row Level Security แล้วอนุญาตแค่ "อ่าน" กับ "เพิ่มแถวใหม่"
-- ไม่มีสิทธิ์แก้ไขหรือลบ แปลว่าไม่มีใครไปยุ่งคะแนนคนอื่นได้
alter table public.scores enable row level security;

drop policy if exists "อ่านได้ทุกคน"  on public.scores;
drop policy if exists "ส่งคะแนนได้"   on public.scores;

create policy "อ่านได้ทุกคน" on public.scores
  for select to anon, authenticated using (true);

create policy "ส่งคะแนนได้" on public.scores
  for insert to anon, authenticated with check (true);

-- ═══════════════════════════════════════════════════════════
-- คำสั่งที่อาจได้ใช้ทีหลัง (ยังไม่ต้องรันตอนนี้)
-- ═══════════════════════════════════════════════════════════

-- ดูคะแนนทั้งหมด เรียงจากสูงสุด
--   select * from public.scores order by score desc limit 50;

-- ลบคะแนนของคนใดคนหนึ่ง (เช่น ตอนทดสอบ)
--   delete from public.scores where name = 'ทดสอบ';

-- ล้างกระดานทั้งหมด เริ่มแข่งรอบใหม่
--   truncate public.scores;
