#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
รวมทุกไฟล์ให้เหลือไฟล์เดียว สำหรับส่งให้คนอื่นหรือเปิดจากเครื่องตรงๆ

  python tools/build-single.py

จะได้ไฟล์
  vocab-arena-single.html   เปิดด้วยเบราว์เซอร์ได้เลย ไม่ต้องมีเซิร์ฟเวอร์
  vocab-arena-artifact.html เวอร์ชันสำหรับเผยแพร่เป็น Artifact (ไม่มีแท็ก html/head/body)
"""

import io, os, json, re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
rd = lambda *p: io.open(os.path.join(ROOT, *p), encoding="utf-8").read()

html = rd("index.html")
css = rd("style.css")
cfg = rd("config.js")
app = rd("app.js")

levels = json.loads(re.search(r'LEVELS:\s*(\[[^\]]*\])', cfg).group(1).replace("'", '"'))
data = {lv: json.loads(rd("data", lv + ".json")) for lv in levels}

blob = ("<script>window.VA_DATA = "
        + json.dumps(data, ensure_ascii=False, separators=(",", ":"))
        + ";</script>")

body = html
body = body.replace('<link rel="stylesheet" href="style.css">', "<style>\n" + css + "\n</style>")
body = body.replace('<script src="config.js"></script>',
                    "<script>\n" + cfg + "\n</script>\n" + blob)
body = body.replace('<script src="app.js"></script>', "<script>\n" + app + "\n</script>")

with io.open(os.path.join(ROOT, "vocab-arena-single.html"), "w", encoding="utf-8") as f:
    f.write(body)

# เวอร์ชัน Artifact: ตัดโครง doctype/html/head/body ออก เหลือเนื้อหาล้วน
inner = body.split("<head>", 1)[1]
head, rest = inner.split("</head>", 1)
rest = rest.split("<body>", 1)[1].rsplit("</body>", 1)[0]
keep = [ln for ln in head.split("\n")
        if ln.strip().startswith(("<title", "<link", "<style", "</style"))
        or (ln and not ln.strip().startswith("<meta"))]
artifact = "\n".join(keep).strip() + "\n" + rest

with io.open(os.path.join(ROOT, "vocab-arena-artifact.html"), "w", encoding="utf-8") as f:
    f.write(artifact)

kb = lambda n: "%.0f KB" % (n / 1024.0)
print("vocab-arena-single.html   %s" % kb(len(body.encode("utf-8"))))
print("vocab-arena-artifact.html %s" % kb(len(artifact.encode("utf-8"))))
print("words embedded: %d" % sum(len(d["words"]) for d in data.values()))
