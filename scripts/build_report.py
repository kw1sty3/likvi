"""Build the individual report from docs/report-ruslan-full.md.

Documentation-only dependencies: python-docx and Pillow. Run from any directory.
"""
from pathlib import Path
import re
from PIL import Image, ImageDraw, ImageFont
from docx import Document
from docx.shared import Mm, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / 'docs'
ASSETS = DOCS / 'report-assets'
OUTPUT = DOCS / 'Отчет_Жердин_Руслан_Likvi.docx'
ASSETS.mkdir(exist_ok=True)


def font(size, bold=False):
    choices = [Path('C:/Windows/Fonts') / ('arialbd.ttf' if bold else 'arial.ttf'),
               Path('/usr/share/fonts/truetype/dejavu') / ('DejaVuSans-Bold.ttf' if bold else 'DejaVuSans.ttf')]
    return ImageFont.truetype(str(next(p for p in choices if p.exists())), size)


def diagram(name, rows):
    width, height = 1800, 530
    img = Image.new('RGB', (width, height), 'white')
    draw = ImageDraw.Draw(img)
    for row, (label, blocks) in enumerate(rows):
        top = 65 + row * 260
        draw.text((24, top - 45), label, font=font(29, True), fill='black')
        for col, text in enumerate(blocks):
            left = 25 + col * 600
            draw.rounded_rectangle((left, top, left + 545, top + 155), 12, fill='#f0f4f8', outline='#6e7e8e', width=3)
            box = draw.multiline_textbbox((0, 0), text, font=font(30), spacing=10, align='center')
            draw.multiline_text((left + (545 - box[2]) / 2, top + (155 - box[3]) / 2 - box[1]), text,
                                font=font(30), fill='#172635', align='center', spacing=10)
            if col < 2:
                x = left + 552
                draw.line((x, top + 77, x + 39, top + 77), fill='#263e54', width=4)
                draw.polygon([(x + 39, top + 77), (x + 27, top + 69), (x + 27, top + 85)], fill='#263e54')
    img.save(ASSETS / name)


diagram('architecture.png', [
    ('Локальный полёт', ['Клавиатура\nКоманды пилота', 'Rapier 60 Гц\nСилы и контакты', 'Three.js\nПоложение модели']),
    ('Общие данные', ['Арена и BVH\nГеометрия препятствий', 'Правила заезда\nКольца и авария', 'Zustand\nТелеметрия и интерфейс'])])
diagram('server-flow.png', [
    ('Управление попыткой', ['Браузер\nТолько seq и keys', 'Сервер Rapier\nДвижение и зачёт', 'Снимок состояния\nОтображение на клиенте']),
    ('Подтверждение результата', ['Серверный финиш\nМаршрут и время', 'Атомарная запись\nresults.json', 'Подтверждённый рейтинг\nДо 100 результатов'])])

doc = Document()
sec = doc.sections[0]
sec.page_width = Mm(210); sec.page_height = Mm(297)
sec.top_margin = Mm(20); sec.bottom_margin = Mm(20)
sec.left_margin = Mm(25); sec.right_margin = Mm(20)
sec.header_distance = Mm(10); sec.footer_distance = Mm(10)
sec.different_first_page_header_footer = True

for name in ['Normal', 'Title', 'Subtitle', 'Heading 1', 'Heading 2', 'Heading 3', 'Caption', 'List Number', 'List Bullet']:
    style = doc.styles[name]
    style.font.name = 'Times New Roman'
    style.font.color.rgb = RGBColor(0, 0, 0)
    fonts = style._element.get_or_add_rPr().rFonts
    for attr in ['asciiTheme', 'hAnsiTheme', 'eastAsiaTheme', 'cstheme']:
        fonts.attrib.pop(qn('w:' + attr), None)
    for attr in ['ascii', 'hAnsi', 'eastAsia', 'cs']:
        fonts.set(qn('w:' + attr), 'Times New Roman')
    style.paragraph_format.widow_control = True
for style in doc.styles:
    for border in list(style._element.iter(qn('w:pBdr'))):
        border.getparent().remove(border)
normal = doc.styles['Normal']
normal.font.size = Pt(12)
normal.paragraph_format.line_spacing = 1.15
normal.paragraph_format.space_after = Pt(6)
normal.paragraph_format.first_line_indent = Mm(7.5)
normal.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
for name, size in [('Heading 1', 16), ('Heading 2', 13), ('Heading 3', 12)]:
    style = doc.styles[name]
    style.font.size = Pt(size); style.font.bold = True
    style.paragraph_format.space_before = Pt(15)
    style.paragraph_format.space_after = Pt(8)
    style.paragraph_format.first_line_indent = Mm(0)
    style.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.LEFT
    style.paragraph_format.keep_with_next = True
doc.styles['Title'].font.size = Pt(24)
doc.styles['Title'].font.bold = True
doc.styles['Title'].paragraph_format.first_line_indent = Mm(0)
doc.styles['Caption'].font.size = Pt(10)
doc.styles['Caption'].font.italic = False
doc.styles['Caption'].paragraph_format.first_line_indent = Mm(0)
doc.styles['Caption'].paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
for level in range(1, 3):
    name = f'TOC {level}'
    if name not in doc.styles:
        doc.styles.add_style(name, 1)
    s = doc.styles[name]
    s.font.name = 'Times New Roman'; s.font.size = Pt(11); s.font.color.rgb = RGBColor(0, 0, 0)
    s.paragraph_format.space_after = Pt(3)
    s.paragraph_format.first_line_indent = Mm(0)


def ptext(text, style=None):
    p = doc.add_paragraph(style=style)
    for i, token in enumerate(re.split(r'(`[^`]+`|\*\*[^*]+\*\*)', text)):
        if token.startswith('`'):
            run = p.add_run(token[1:-1]); run.font.name = 'Consolas'; run.font.size = Pt(10)
        elif token.startswith('**'):
            p.add_run(token[2:-2]).bold = True
        else:
            p.add_run(token)
    return p


for line in ['Московский политехнический университет', 'Центр проектной деятельности']:
    p = ptext(line); p.alignment = WD_ALIGN_PARAGRAPH.CENTER; p.paragraph_format.first_line_indent = Mm(0)
doc.add_paragraph().paragraph_format.space_after = Pt(65)
p = ptext('Отчёт о реализации физической подсистемы проекта Likvi', 'Title')
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
p = ptext('Индивидуальный технический отчёт\nпо проектной деятельности')
p.alignment = WD_ALIGN_PARAGRAPH.CENTER; p.paragraph_format.first_line_indent = Mm(0)
p.paragraph_format.space_after = Pt(55)
for line in ['Автор  Жердин Руслан Сергеевич', 'Учебная группа  241-325', 'Направление подготовки  09.03.01',
             'Руководитель проекта  Идиатуллов Тимур Тофикович', 'Состояние реализации на 13 октября 2026 года']:
    p = ptext(line); p.alignment = WD_ALIGN_PARAGRAPH.LEFT; p.paragraph_format.first_line_indent = Mm(0)
p = ptext('Москва 2026'); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
p.paragraph_format.first_line_indent = Mm(0); p.paragraph_format.space_before = Pt(65)
doc.add_page_break()

p = ptext('Содержание')
p.runs[0].bold = True; p.runs[0].font.size = Pt(16)
p.paragraph_format.first_line_indent = Mm(0)
p = doc.add_paragraph()
field = OxmlElement('w:fldSimple'); field.set(qn('w:instr'), 'TOC \\o "1-1" \\h \\z')
r = OxmlElement('w:r'); t = OxmlElement('w:t'); t.text = 'Содержание обновляется при подготовке окончательной версии'
r.append(t); field.append(r); p._p.append(field)
doc.add_page_break()

footer = sec.footer.paragraphs[0]
footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
footer.paragraph_format.first_line_indent = Mm(0)
page = OxmlElement('w:fldSimple'); page.set(qn('w:instr'), 'PAGE')
footer._p.append(page)


def table_widths(header):
    if len(header) == 5: return [45, 28, 28, 32, 32]
    if len(header) == 4:
        if header[0] == 'Часть': return [34, 22, 82, 27]
        return [45, 24, 55, 41]
    if len(header) == 3:
        if header[0] == 'Этап': return [15, 51, 99]
        if header[0] == 'Файл': return [49, 25, 91]
        if header[0] == 'Участник': return [43, 56, 66]
        if header[0] == 'Область': return [31, 72, 62]
        return [58, 33, 74]
    return [81, 84] if header[0] == 'Файл или группа' else [81, 84]


def add_table(lines):
    rows = [[cell.strip() for cell in line.strip().strip('|').split('|')] for line in lines]
    rows = [row for row in rows if not all(re.fullmatch(r'[-: ]+', cell) for cell in row)]
    widths = table_widths(rows[0])
    table = doc.add_table(rows=0, cols=len(widths))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER; table.autofit = False
    for col, width in zip(table.columns, widths): col.width = Mm(width)
    borders = OxmlElement('w:tblBorders')
    for side in ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']:
        border = OxmlElement(f'w:{side}')
        for key, value in [('val', 'single'), ('sz', '4'), ('color', 'D9D9D9')]: border.set(qn(f'w:{key}'), value)
        borders.append(border)
    table._tbl.tblPr.append(borders)
    for n, values in enumerate(rows):
        row = table.add_row()
        trpr = row._tr.get_or_add_trPr()
        trpr.append(OxmlElement('w:cantSplit'))
        if n == 0: trpr.append(OxmlElement('w:tblHeader'))
        for col, (cell, value) in enumerate(zip(row.cells, values)):
            cell.width = Mm(widths[col]); cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            tcpr = cell._tc.get_or_add_tcPr()
            margins = OxmlElement('w:tcMar')
            for side, amount in [('top', '95'), ('bottom', '95'), ('left', '100'), ('right', '100')]:
                elem = OxmlElement('w:' + side); elem.set(qn('w:w'), amount); elem.set(qn('w:type'), 'dxa'); margins.append(elem)
            tcpr.append(margins)
            if n == 0:
                fill = OxmlElement('w:shd'); fill.set(qn('w:fill'), 'E8EFF5'); tcpr.append(fill)
            p = cell.paragraphs[0]
            p.paragraph_format.first_line_indent = Mm(0)
            p.paragraph_format.space_after = Pt(0); p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.line_spacing = 1.05
            p.paragraph_format.keep_with_next = n == 0
            short_numeric = col > 0 and len(value) < 17 and bool(re.search(r'\d', value))
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER if short_numeric or n == 0 else WD_ALIGN_PARAGRAPH.LEFT
            r = p.add_run(value.replace('`', ''))
            r.font.name = 'Calibri'; r.font.size = Pt(10.5); r.bold = n == 0
    gap = doc.add_paragraph(); gap.paragraph_format.space_after = Pt(2); gap.paragraph_format.line_spacing = Pt(3)


lines = (DOCS / 'report-ruslan-full.md').read_text(encoding='utf-8').splitlines()
idx = next(i for i, line in enumerate(lines) if line.startswith('## 1 '))
while idx < len(lines):
    line = lines[idx]
    if not line.strip(): idx += 1; continue
    if line.startswith('## '):
        title = line[3:]
        doc.add_heading(title, 1)
    elif line.startswith('### '): doc.add_heading(line[4:], 2)
    elif line.startswith('|'):
        block = []
        while idx < len(lines) and lines[idx].startswith('|'): block.append(lines[idx]); idx += 1
        add_table(block); continue
    elif line.startswith('```'):
        if doc.paragraphs:
            doc.paragraphs[-1].paragraph_format.keep_with_next = True
        idx += 1; block = []
        while idx < len(lines) and not lines[idx].startswith('```'): block.append(lines[idx]); idx += 1
        p = doc.add_paragraph(); p.paragraph_format.first_line_indent = Mm(5)
        p.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.LEFT
        p.paragraph_format.keep_together = True
        r = p.add_run('\n'.join(block)); r.font.name = 'Consolas'; r.font.size = Pt(10)
    elif line.startswith('!['):
        m = re.match(r'!\[([^]]+)\]\(([^)]+)\)', line)
        p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.first_line_indent = Mm(0); p.paragraph_format.keep_with_next = True
        image = p.add_run().add_picture(str(DOCS / m.group(2)), width=Mm(165))
        image._inline.docPr.set('descr', m.group(1))
    elif line.startswith('Рисунок '): ptext(line, 'Caption')
    elif re.match(r'^\d+\. ', line):
        p = ptext(line)
        p.paragraph_format.first_line_indent = Mm(-6)
        p.paragraph_format.left_indent = Mm(6)
        p.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.LEFT
        p.paragraph_format.space_after = Pt(4)
    else: ptext(line)
    idx += 1

doc.core_properties.title = 'Отчёт о реализации физической подсистемы проекта Likvi'
doc.core_properties.subject = 'Индивидуальные задачи Жердина Руслана по паспорту проекта'
doc.core_properties.author = 'Жердин Руслан Сергеевич'
doc.core_properties.keywords = 'Likvi, Rapier, физика, проектная деятельность'
doc.core_properties.comments = ''
settings = doc.settings.element
lang = doc.styles['Normal']._element.get_or_add_rPr()
language = OxmlElement('w:lang'); language.set(qn('w:val'), 'ru-RU'); lang.append(language)
update = OxmlElement('w:updateFields'); update.set(qn('w:val'), 'true'); settings.append(update)
doc.save(OUTPUT)
print(OUTPUT)
print(f'Paragraphs: {len(doc.paragraphs)}, tables: {len(doc.tables)}')
