#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
รับไฟล์คำศัพท์ดิบ 1 หมวด ตรวจความถูกต้อง แล้วรวมเข้าคลังของระดับนั้น

  python tools/make-batch.py tools/raw/starter-อาหารและเครื่องดื่ม.txt

รูปแบบไฟล์ดิบ (บรรทัดแรกคือชื่อระดับกับชื่อหมวด คั่นด้วย >)
  starter > อาหารและเครื่องดื่ม
  Rice|n.|ข้าว|ไรซ์
  Bread|n.|ขนมปัง|เบรด
  ...

ถ้าหมวดนี้มีอยู่แล้วในคลัง จะถูกแทนที่ทั้งหมวด
ตรวจให้ครบทั้ง: จำนวนคำ, คำอังกฤษซ้ำทั้งระดับ, ความหมายซ้ำในหมวด,
ความยาวความหมาย, รูปแบบคำอ่าน, ชนิดคำ
"""

import io, json, os, sys, re

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
POS_OK = {"n.", "v.", "adj.", "adv.", "prep.", "phr."}
THAI_READ = re.compile(u"^[฀-๿\\-]+$")


def load_raw(path):
    lines = [l.strip() for l in io.open(path, encoding="utf-8").read().split("\n")]
    lines = [l for l in lines if l and not l.startswith("#")]
    level, cat = [x.strip() for x in lines[0].split(">")]
    rows = []
    for i, l in enumerate(lines[1:], start=2):
        parts = l.split("|")
        if len(parts) != 4:
            raise SystemExit(u"บรรทัด %d ต้องมี 4 ช่องคั่นด้วย | : %s" % (i, l))
        en, pos, th, read = [p.strip() for p in parts]
        rows.append({"en": en, "pos": pos, "th": th, "read": read, "cat": cat})
    return level, cat, rows


def check_batch(cat, rows, expect=100):
    bad = []
    if len(rows) != expect:
        bad.append(u"หมวดนี้มี %d คำ ต้องการ %d" % (len(rows), expect))
    seen_en, seen_th = {}, {}
    for i, w in enumerate(rows, start=1):
        if w["pos"] not in POS_OK:
            bad.append(u"%s: ชนิดคำ '%s' ไม่ถูกต้อง" % (w["en"], w["pos"]))
        if len(w["th"]) > 25:
            bad.append(u"%s: ความหมายยาว %d ตัวอักษร" % (w["en"], len(w["th"])))
        if not THAI_READ.match(w["read"]):
            bad.append(u"%s: คำอ่าน '%s' ต้องมีแต่อักษรไทยกับยัติภังค์" % (w["en"], w["read"]))
        k = w["en"].lower()
        if k in seen_en:
            bad.append(u"คำอังกฤษ '%s' ซ้ำในหมวดเดียวกัน" % w["en"])
        seen_en[k] = i
        if w["th"] in seen_th:
            bad.append(u"!! ความหมาย '%s' ซ้ำในหมวด (%s กับ %s)" % (w["th"], w["en"], rows[seen_th[w["th"]] - 1]["en"]))
        seen_th[w["th"]] = i
    return bad


def merge(level, cat, rows):
    path = os.path.join(ROOT, "data", level + ".json")
    db = json.load(io.open(path, encoding="utf-8"))
    others = [w for w in db["words"] if w["cat"] != cat]

    # คำอังกฤษห้ามซ้ำกับหมวดอื่นในระดับเดียวกัน
    taken = {w["en"].lower(): w["cat"] for w in others}
    clash = [(w["en"], taken[w["en"].lower()]) for w in rows if w["en"].lower() in taken]
    if clash:
        return None, [u"'%s' มีอยู่แล้วในหมวด '%s'" % (en, c) for en, c in clash]

    db["words"] = others + rows
    db["source"] = "curated-v1"
    io.open(path, "w", encoding="utf-8").write(json.dumps(db, ensure_ascii=False, indent=1))
    return db, []


def main():
    if len(sys.argv) < 2:
        raise SystemExit(u"ใช้: python tools/make-batch.py <ไฟล์ดิบ>")
    level, cat, rows = load_raw(sys.argv[1])

    problems = check_batch(cat, rows)
    if problems:
        print(u"ไม่ผ่าน %d จุด:" % len(problems))
        for p in problems[:20]:
            print(u"   " + p)
        sys.exit(1)

    db, problems = merge(level, cat, rows)
    if problems:
        print(u"ชนกับหมวดอื่น %d จุด:" % len(problems))
        for p in problems[:20]:
            print(u"   " + p)
        sys.exit(1)

    cats = {}
    for w in db["words"]:
        cats[w["cat"]] = cats.get(w["cat"], 0) + 1
    print(u"เพิ่ม '%s' %d คำ เข้าระดับ %s เรียบร้อย" % (cat, len(rows), level))
    print(u"ตอนนี้ %s มี %d คำ / %d หมวด" % (level, len(db["words"]), len(cats)))
    for c in sorted(cats, key=lambda x: (-cats[x], x)):
        print(u"   %-36s %3d %s" % (c, cats[c], u"" if cats[c] == 100 else u"<- ยังไม่ครบ"))


if __name__ == "__main__":
    main()
