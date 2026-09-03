/* ═══════════════════════════════════════════════════════════
   ไฟล์ตั้งค่า — นี่คือไฟล์เดียวที่คุณต้องแก้
   ═══════════════════════════════════════════════════════════

   ขั้นตอน (ดูละเอียดใน SETUP.md):
   1. สมัคร supabase.com (ฟรี) แล้วสร้างโปรเจกต์
   2. เข้าเมนู Project Settings → Data API
   3. ก๊อบ "Project URL" มาวางที่ URL ข้างล่าง
   4. ก๊อบ "anon public" key มาวางที่ KEY ข้างล่าง
   5. เซฟไฟล์นี้

   ตราบใดที่ยังไม่ใส่ เกมยังเล่นได้ปกติ
   แค่คะแนนจะเก็บในเครื่องตัวเองไม่ใช่กระดานกลาง
   ─────────────────────────────────────────────────────────── */

window.VA_CONFIG = {

  SUPABASE_URL: "https://jisptboixukvtzevcktt.supabase.co",
  SUPABASE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imppc3B0Ym9peHVrdnR6ZXZja3R0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzOTYyOTIsImV4cCI6MjEwMzk3MjI5Mn0.pSnyS-h-OlQQy7g0F1KGLm1b4OYHMN53ExuP97C-kGU",

  /* ── กติกาเกม ปรับได้ตามใจ ───────────────────────────── */
  RULES: {
    rushSeconds:      60,   // โหมดตะลุยเวลา: เวลาทั้งเกม (วินาที)
    rushPenalty:      3,    // โหมดตะลุยเวลา: ตอบผิดหักกี่วินาที
    surviveSeconds:   8,    // โหมดอึดไม่ตาย: เวลาต่อข้อ
    duelSeconds:      10,   // โหมดท้าดวล: เวลาต่อข้อ
    duelQuestions:    20,   // โหมดท้าดวล: จำนวนข้อ

    basePoints:       100,  // คะแนนพื้นฐานต่อข้อที่ตอบถูก
    speedWindow:      5,    // ตอบภายในกี่วินาทีถึงได้โบนัสความเร็ว
    speedBonus:       20,   // โบนัสความเร็วต่อวินาทีที่เหลือ
    comboStep:        0.1,  // ตัวคูณเพิ่มขึ้นเท่าไรต่อ 1 คอมโบ
    comboMax:         2.0,  // ตัวคูณสูงสุด
    reverseChance:    0.4   // ถ้าเปิดโหมดสลับ จะถามเป็นไทย→อังกฤษ กี่ %
  },

  /* ── ระดับที่จะแสดง เรียงตามนี้ ──────────────────────── */
  LEVELS: ["starter", "middle", "toeic", "advanced"]
};
