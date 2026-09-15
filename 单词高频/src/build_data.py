# -*- coding: utf-8 -*-
"""构建脚本：校验数据 → 生成网站 data.js → 生成 PDF 手册"""
import io, json, os, sys
from collections import OrderedDict

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(BASE)
sys.path.insert(0, BASE)

from content_words1 import WORDS_PART1
from content_words2 import WORDS_PART2
from content_phrases import PHRASES

WORDS = WORDS_PART1 + WORDS_PART2

def validate(name, items, expect):
    print(f"[校验] {name}: 期望 {expect} 条, 实际 {len(items)} 条")
    assert len(items) == expect, f"{name} 数量不符: {len(items)} != {expect}"
    keys = [w[0].strip().lower() for w in items]
    dup = set()
    for k in keys:
        if keys.count(k) > 1:
            dup.add(k)
    if dup:
        print(f"  [警告] 重复项: {sorted(dup)}")
    else:
        print("  [OK] 无重复项")
    cats = OrderedDict()
    for w in items:
        cats.setdefault(w[2], 0)
        cats[w[2]] += 1
    for c, n in cats.items():
        print(f"  - {c}: {n}")
    return cats

print("=" * 50)
word_cats = validate("1000 高频词", WORDS, 1000)
print("-" * 50)
phrase_cats = validate("360 高频词组", PHRASES, 360)
print("=" * 50)

# ---------- 生成网站 data.js ----------
def js_str(s):
    return json.dumps(s, ensure_ascii=False)

word_items = [{"e": w[0], "c": w[1], "g": w[2]} for w in WORDS]
phrase_items = [{"e": p[0], "c": p[1], "g": p[2]} for p in PHRASES]

data_js = (
    "/* 自动生成：1000 高频生活词 + 360 高频词组 */\n"
    "window.WORD_DATA = " + json.dumps(word_items, ensure_ascii=False) + ";\n"
    "window.PHRASE_DATA = " + json.dumps(phrase_items, ensure_ascii=False) + ";\n"
)
site_js_dir = os.path.join(ROOT, "1000高频词网站", "js")
os.makedirs(site_js_dir, exist_ok=True)
data_js_path = os.path.join(site_js_dir, "data.js")
with io.open(data_js_path, "w", encoding="utf-8") as f:
    f.write(data_js)
print("已生成:", data_js_path, os.path.getsize(data_js_path), "bytes")

# 同时输出 JSON 备用
with io.open(os.path.join(ROOT, "src", "words.json"), "w", encoding="utf-8") as f:
    json.dump({"words": word_items, "phrases": phrase_items}, f, ensure_ascii=False, indent=1)
print("已生成: src/words.json")
