#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
แปลงไฟล์ CSV ที่ดาวน์โหลดจาก Google Sheet ให้เป็นข้อมูลของเกม

วิธีใช้
  1. ใน Google Sheet เปิดแท็บที่ต้องการ → ไฟล์ → ดาวน์โหลด → .csv
  2. เอาไฟล์ .csv มาวางในโฟลเดอร์ tools/csv/  ตั้งชื่อตามระดับ
       tools/csv/starter.csv
       tools/csv/middle.csv
       tools/csv/toeic.csv
       tools/csv/advanced.csv
  3. รันคำสั่งนี้จากโฟลเดอร์ vocab-arena
       python tools/build-data.py
  4. ไฟล์ใน data/ จะถูกอัปเดตให้อัตโนมัติ พร้อมรายงานข้อผิดพลาด

สคริปต์จะตรวจให้ด้วยว่ามีความหมายซ้ำในหมวดเดียวกันหรือไม่
ซึ่งเป็นข้อผิดพลาดที่ทำให้เกมมีข้อที่ตอบถูกได้หลายตัวเลือก
"""

import csv, json, os, sys, io

# Command Prompt ของ Windows ตั้งต้นเป็นรหัสภาษาอังกฤษ พิมพ์ไทยแล้วโปรแกรมจะพัง
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CSV_DIR = os.path.join(HERE, "csv")
OUT_DIR = os.path.join(ROOT, "data")

META = {
    "starter":  (u"เริ่มต้น", u"A1", u"คำที่เจอทุกวัน ร่างกาย ครอบครัว อาหาร สัตว์ บ้าน"),
    "middle":   (u"ระดับกลาง", u"B1", u"คำนามธรรม อารมณ์ กริยาวลี ใช้เล่าเรื่องและแสดงความเห็น"),
    "toeic":    (u"TOEIC", u"800", u"ศัพท์ที่ออกสอบจริง สัญญา บัญชี HR โลจิสติกส์ ประชุม"),
    "advanced": (u"ขั้นสูง", u"C1", u"Academic Word List สำหรับ IELTS / TOEFL"),
}
POS_OK = {"n.", "v.", "adj.", "adv.", "prep.", "phr.", ""}
HEADERS = ["en", "pos", "th", "read", "cat"]


def read_csv(path):
    """อ่าน CSV รองรับทั้งแบบมีหัวตารางและไม่มี"""
    with io.open(path, encoding="utf-8-sig", newline="") as f:
        rows = list(csv.reader(f))
    if not rows:
        return []
    first = [c.strip().lower() for c in rows[0][:5]]
    if first[:3] == ["en", "pos", "th"]:
        rows = rows[1:]
    out = []
    for r in rows:
        r = (r + [""] * 5)[:5]
        en, pos, th, read, cat = [str(c).strip() for c in r]
        if not en and not th:
            continue
        out.append({"en": en, "pos": pos, "th": th, "read": read, "cat": cat})
    return out


def check(level, words):
    """ตรวจข้อผิดพลาด คืนค่ารายการปัญหา"""
    problems = []
    seen_en, seen_th = {}, {}
    cats = {}
    for i, w in enumerate(words):
        line = i + 2
        if not w["en"]:
            problems.append("แถว %d: ไม่มีคำอังกฤษ" % line)
        if not w["th"]:
            problems.append("แถว %d: ไม่มีความหมายไทย" % line)
        if not w["read"]:
            problems.append("แถว %d (%s): ไม่มีคำอ่านไทย" % (line, w["en"]))
        if not w["cat"]:
            problems.append("แถว %d (%s): ไม่มีหมวด" % (line, w["en"]))
        if w["pos"] not in POS_OK:
            problems.append("แถว %d (%s): pos ผิดรูปแบบ '%s'" % (line, w["en"], w["pos"]))
        if len(w["th"]) > 25:
            problems.append("แถว %d (%s): ความหมายยาว %d ตัวอักษร เกิน 25" % (line, w["en"], len(w["th"])))

        k = w["en"].lower()
        if k in seen_en:
            problems.append("แถว %d: คำอังกฤษ '%s' ซ้ำกับแถว %d" % (line, w["en"], seen_en[k]))
        else:
            seen_en[k] = line

        k = (w["cat"], w["th"])
        if k in seen_th:
            problems.append("แถว %d: !! ความหมาย '%s' ซ้ำในหมวด '%s' กับแถว %d "
                            "-- ข้อนี้จะมีตัวเลือกถูก 2 ข้อ" % (line, w["th"], w["cat"], seen_th[k]))
        else:
            seen_th[k] = line

        cats[w["cat"]] = cats.get(w["cat"], 0) + 1
    return problems, cats


def main():
    if not os.path.isdir(CSV_DIR):
        os.makedirs(CSV_DIR)
        print("สร้างโฟลเดอร์ tools/csv/ แล้ว เอาไฟล์ .csv มาวางที่นั่น")
        return

    total_problems = 0
    for level, (label, tier, blurb) in META.items():
        path = os.path.join(CSV_DIR, level + ".csv")
        if not os.path.exists(path):
            print("[ข้าม] ไม่พบไฟล์ %s.csv" % level)
            continue

        words = read_csv(path)
        problems, cats = check(level, words)
        total_problems += len(problems)

        out = {"id": level, "label": label, "tier": tier, "blurb": blurb,
               "target": 1000, "source": "google-sheet", "words": words}
        with io.open(os.path.join(OUT_DIR, level + ".json"), "w", encoding="utf-8") as f:
            f.write(json.dumps(out, ensure_ascii=False, indent=1))

        mark = "ผ่าน  " if not problems else "มีปัญหา  "
        print("%s%-9s %4d คำ / %2d หมวด" % (mark, level, len(words), len(cats)))
        for c, n in sorted(cats.items()):
            if n != 100:
                print("      - หมวด '%s' มี %d คำ (ควรมี 100)" % (c, n))
        for p in problems[:25]:
            print("      " + p)
        if len(problems) > 25:
            print("      ... และอีก %d จุด" % (len(problems) - 25))

    print("")
    if total_problems:
        print("พบปัญหา %d จุด แก้ใน Google Sheet แล้วดาวน์โหลด CSV มารันใหม่" % total_problems)
        sys.exit(1)
    print("เรียบร้อย ข้อมูลใน data/ อัปเดตแล้ว")


if __name__ == "__main__":
    main()
