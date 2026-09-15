# -*- coding: utf-8 -*-
"""生成 PDF 手册：1000 高频词 + 360 高频词组"""
import os, sys
from collections import OrderedDict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from content_words1 import WORDS_PART1
from content_words2 import WORDS_PART2
from content_phrases import PHRASES

WORDS = WORDS_PART1 + WORDS_PART2

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame,
                                Paragraph, Spacer, Table, TableStyle, PageBreak)

# ---------- 字体 ----------
pdfmetrics.registerFont(UnicodeCIDFont("STSong-Light"))
FONT_CN = "STSong-Light"
FONT_EN = "Helvetica"

TEAL = colors.HexColor("#0d9488")
TEAL_DARK = colors.HexColor("#0f766e")
TEAL_LIGHT = colors.HexColor("#e6f7f4")
INK = colors.HexColor("#1e293b")
SOFT = colors.HexColor("#64748b")
LINE = colors.HexColor("#d7e5e3")

PAGE_W, PAGE_H = A4
MARGIN = 18 * mm

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                   "英语高频词手册.pdf")

# ---------- 样式 ----------
st_title = ParagraphStyle("title", fontName=FONT_CN, fontSize=30, leading=40,
                          textColor=TEAL_DARK, alignment=1, spaceAfter=6)
st_sub = ParagraphStyle("sub", fontName=FONT_CN, fontSize=14, leading=22,
                        textColor=SOFT, alignment=1)
st_h1 = ParagraphStyle("h1", fontName=FONT_CN, fontSize=16, leading=22,
                       textColor=colors.white, alignment=0)
st_cat = ParagraphStyle("cat", fontName=FONT_CN, fontSize=13.5, leading=20,
                        textColor=TEAL_DARK, spaceBefore=10, spaceAfter=4)
st_en = ParagraphStyle("en", fontName=FONT_EN, fontSize=9.5, leading=13,
                       textColor=INK)
st_cn = ParagraphStyle("cn", fontName=FONT_CN, fontSize=10, leading=14,
                       textColor=INK)
st_hdr = ParagraphStyle("hdr", fontName=FONT_CN, fontSize=9.5, leading=12,
                        textColor=colors.white)
st_footer = ParagraphStyle("footer", fontName=FONT_CN, fontSize=8.5, leading=12,
                           textColor=SOFT, alignment=1)
st_cover_sm = ParagraphStyle("coversm", fontName=FONT_CN, fontSize=11, leading=18,
                             textColor=SOFT, alignment=1)


def p_en(t):
    return Paragraph(t, st_en)


def p_cn(t):
    return Paragraph(t, st_cn)


def p_hdr(t):
    return Paragraph(t, st_hdr)


def cat_header(cat_name, count, kind):
    return Paragraph(
        '<font size="10">▍</font> %s <font size="9" color="#64748b">（%d 个%s）</font>' %
        (cat_name, count, kind), st_cat)


def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont(FONT_CN, 8.5)
    canvas.setFillColor(SOFT)
    canvas.drawCentredString(PAGE_W / 2, 12 * mm,
                             "英语高频词手册 · 第 %d 页" % doc.page)
    canvas.restoreState()


def cover_page(story, n_words, n_phrases, n_cats):
    story.append(Spacer(1, 34 * mm))
    # 顶部色块标题
    data = [[Paragraph("英语高频词手册", st_title)],
            [Paragraph("ENGLISH HIGH-FREQUENCY WORDS &amp; PHRASES", st_sub)]]
    t = Table(data, colWidths=[PAGE_W - 2 * MARGIN])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.white),
        ("BOX", (0, 0), (-1, -1), 1.2, TEAL),
        ("TOPPADDING", (0, 0), (-1, -1), 26),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 26),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
    ]))
    story.append(t)
    story.append(Spacer(1, 16 * mm))

    rows = [
        ["1000 个高频生活词", "衣食住行 · 表达感觉和需要 · 沟通状态"],
        ["360 个高频词组", "日常问候 · 饮食购物 · 出行居家 · 沟通对话"],
        ["%d 个分类场景" % n_cats, "按主题分类，循序渐进"],
    ]
    body = []
    for left, right in rows:
        body.append([Paragraph(left, ParagraphStyle(
            "l", fontName=FONT_CN, fontSize=12.5, leading=20, textColor=INK)),
            Paragraph(right, ParagraphStyle(
                "r", fontName=FONT_CN, fontSize=11, leading=20, textColor=SOFT, alignment=2))])
    t2 = Table(body, colWidths=[(PAGE_W - 2 * MARGIN) * 0.42,
                                (PAGE_W - 2 * MARGIN) * 0.58])
    t2.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), TEAL_LIGHT),
        ("BOX", (0, 0), (-1, -1), 0.8, LINE),
        ("INNERGRID", (0, 0), (-1, -1), 0.6, LINE),
        ("TOPPADDING", (0, 0), (-1, -1), 12),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(t2)
    story.append(Spacer(1, 14 * mm))
    story.append(Paragraph("使用方法：先按主题浏览单词，再学习词组；建议每天 2~3 个分类，"
                           "配合口语练习加深记忆。", st_cover_sm))
    story.append(PageBreak())


def words_tables(story):
    cats = OrderedDict()
    for w in WORDS:
        cats.setdefault(w[2], []).append(w)

    story.append(Paragraph("第一部分 · 1000 个高频生活词", ParagraphStyle(
        "sec", fontName=FONT_CN, fontSize=17, leading=24, textColor=TEAL_DARK,
        spaceAfter=2)))
    story.append(Paragraph("覆盖衣食住行、感觉与需要、沟通状态等 16 个生活场景",
                           ParagraphStyle("secsub", fontName=FONT_CN, fontSize=10,
                                          leading=15, textColor=SOFT, spaceAfter=6)))

    for cat, items in cats.items():
        story.append(cat_header(cat, len(items), "高频词"))
        # 每行 3 对（6 列）
        rows = []
        for i in range(0, len(items), 3):
            row = []
            for j in range(3):
                if i + j < len(items):
                    e, c, _ = items[i + j]
                    row.append(p_en(e))
                    row.append(p_cn(c))
                else:
                    row.append(Paragraph("", st_en))
                    row.append(Paragraph("", st_cn))
            rows.append(row)
        col_w = (PAGE_W - 2 * MARGIN) / 6.0
        tbl = Table(rows, colWidths=[col_w] * 6)
        tbl.setStyle(TableStyle([
            ("GRID", (0, 0), (-1, -1), 0.5, LINE),
            ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.white, TEAL_LIGHT]),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ]))
        story.append(tbl)
        story.append(Spacer(1, 6))


def phrases_tables(story):
    cats = OrderedDict()
    for p in PHRASES:
        cats.setdefault(p[2], []).append(p)

    story.append(PageBreak())
    story.append(Paragraph("第二部分 · 360 个高频词组", ParagraphStyle(
        "sec", fontName=FONT_CN, fontSize=17, leading=24, textColor=TEAL_DARK,
        spaceAfter=2)))
    story.append(Paragraph("高频句型、日常用语与常用动词短语，按场景分类",
                           ParagraphStyle("secsub", fontName=FONT_CN, fontSize=10,
                                          leading=15, textColor=SOFT, spaceAfter=6)))

    for cat, items in cats.items():
        story.append(cat_header(cat, len(items), "词组"))
        # 每行 2 对（4 列），词组较长
        rows = []
        for i in range(0, len(items), 2):
            row = []
            for j in range(2):
                if i + j < len(items):
                    e, c, _ = items[i + j]
                    row.append(p_en(e))
                    row.append(p_cn(c))
                else:
                    row.append(Paragraph("", st_en))
                    row.append(Paragraph("", st_cn))
            rows.append(row)
        col_w = (PAGE_W - 2 * MARGIN) / 4.0
        tbl = Table(rows, colWidths=[col_w * 1.15, col_w * 0.85] * 2)
        tbl.setStyle(TableStyle([
            ("GRID", (0, 0), (-1, -1), 0.5, LINE),
            ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.white, TEAL_LIGHT]),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 4.5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4.5),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ]))
        story.append(tbl)
        story.append(Spacer(1, 6))


def main():
    doc = BaseDocTemplate(OUT, pagesize=A4,
                          leftMargin=MARGIN, rightMargin=MARGIN,
                          topMargin=16 * mm, bottomMargin=16 * mm,
                          title="英语高频词手册", author="Doubao")

    frame = Frame(MARGIN, 16 * mm, PAGE_W - 2 * MARGIN, PAGE_H - 32 * mm, id="main")
    doc.addPageTemplates([PageTemplate(id="all", frames=[frame], onPage=footer)])

    story = []
    n_cats_words = len(OrderedDict((w[2], 1) for w in WORDS))
    n_cats_phr = len(OrderedDict((p[2], 1) for p in PHRASES))
    cover_page(story, len(WORDS), len(PHRASES), n_cats_words + n_cats_phr)
    words_tables(story)
    phrases_tables(story)

    doc.build(story)
    print("PDF 已生成:", OUT, os.path.getsize(OUT), "bytes")


if __name__ == "__main__":
    main()
