"""Build public course PDFs and private submission cover copies.

Use the task's bundled document runtime. No secrets or private course scans are read.
"""
from pathlib import Path
from xml.sax.saxutils import escape
import re
import json
import textwrap
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, PageBreak, Preformatted, KeepTogether
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from PIL import Image as PILImage

ROOT = Path.cwd()
OUT = ROOT / 'docs' / 'submission'
PRIVATE = ROOT / '.private' / 'submission'
OUT.mkdir(parents=True, exist_ok=True)
PRIVATE.mkdir(parents=True, exist_ok=True)
styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name='ReportBody', fontName='Helvetica', fontSize=10, leading=15, spaceAfter=9, textColor=colors.HexColor('#202a38')))
styles.add(ParagraphStyle(name='ReportTitle', fontName='Helvetica-Bold', fontSize=25, leading=31, spaceAfter=20, textColor=colors.black))
styles.add(ParagraphStyle(name='ReportH1', fontName='Helvetica-Bold', fontSize=16, leading=21, spaceBefore=16, spaceAfter=9, keepWithNext=True, textColor=colors.black))
styles.add(ParagraphStyle(name='ReportH2', fontName='Helvetica-Bold', fontSize=12, leading=17, spaceBefore=12, spaceAfter=7, keepWithNext=True, textColor=colors.black))
styles.add(ParagraphStyle(name='ReportCell', fontName='Helvetica', fontSize=7.5, leading=10, wordWrap='CJK', textColor=colors.HexColor('#202a38')))
styles.add(ParagraphStyle(name='Caption', fontName='Helvetica', fontSize=8, leading=11, spaceAfter=12, textColor=colors.HexColor('#49576b')))
WIDTH = A4[0] - 92

def clean(s):
    s = re.sub(r'\[([^\]]+)\]\([^)]*\)', r'\1', s)
    s = s.replace('**', '').replace('`', '')
    return s.replace('\u2014', ', ')

def para(s, style='ReportBody'):
    return Paragraph(escape(clean(s)), styles[style])

def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor('#ccd4e0'))
    canvas.line(46, 38, A4[0] - 46, 38)
    canvas.setFont('Helvetica', 8)
    canvas.setFillColor(colors.HexColor('#49576b'))
    canvas.drawString(46, 25, 'PracticeChart EHR | CIT4001 | Fictional data only')
    canvas.drawRightString(A4[0] - 46, 25, str(doc.page))
    canvas.restoreState()

def cover(title, private=False):
    content = [Spacer(1, 45), para('CIT4001 SOFTWARE IMPLEMENTATION AND TESTING', 'Caption'),
               para(title, 'ReportTitle'), para('PracticeChart EHR'),
               para('University of Technology, Jamaica'), para('Group 2'), Spacer(1, 24),
               para('This document describes the implemented course application and the evidence recorded for it. It uses fictional patient data. Human training and user acceptance remain pending.')]
    if private:
        content += [Spacer(1, 20), para('Private submission cover details', 'ReportH2')]
        for name, number in json.loads((ROOT / '.private' / 'group-cover.json').read_text()) if (ROOT / '.private' / 'group-cover.json').exists() else []:
            content.append(para(name + ' / ' + number))
        content.append(para('Confirm these cover details before submission. A listed name is not evidence of a completed code contribution.', 'Caption'))
    else:
        content.append(para('Public course copy. Student identification numbers and private course instruments are excluded.', 'Caption'))
    content += [Spacer(1, 30), para('Prepared for group review. This is not a record of clinical approval, a live pilot, completed training, or completed acceptance testing.', 'Caption'), PageBreak()]
    return content

def table(lines):
    data = [[para(cell.strip(), 'ReportCell') for cell in line.strip().strip('|').split('|')] for line in lines if not re.match(r'^\s*\|\s*:?-+', line)]
    n = max(len(row) for row in data)
    for row in data:
        row += [para('', 'ReportCell')] * (n - len(row))
    weights = [1] * n
    if n == 2:
        weights = [.35, .65]
    elif n == 3:
        weights = [.2, .4, .4]
    total = sum(weights)
    t = Table(data, colWidths=[WIDTH * w / total for w in weights], repeatRows=1, hAlign='LEFT')
    t.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e9eef7')), ('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LINEBELOW', (0, 0), (-1, 0), .7, colors.HexColor('#8e9fbb')), ('LINEBELOW', (0, 1), (-1, -1), .25, colors.HexColor('#d7dfea')), ('TOPPADDING', (0, 0), (-1, -1), 7), ('BOTTOMPADDING', (0, 0), (-1, -1), 7), ('LEFTPADDING', (0, 0), (-1, -1), 6), ('RIGHTPADDING', (0, 0), (-1, -1), 6)]))
    return [t, Spacer(1, 12)]

def image(path, label):
    p = ROOT / 'docs' / path
    if not p.exists():
        return [para('See the source diagram or screenshot: ' + path, 'Caption')]
    with PILImage.open(p) as im:
        w, h = im.size
    ratio = min(WIDTH / w, 525 / h)
    return [Image(str(p), width=w * ratio, height=h * ratio, hAlign='LEFT'), para(label, 'Caption')]

def markdown(path, omit_title=True):
    lines = path.read_text(encoding='utf-8').splitlines()
    output = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if not line.strip():
            i += 1
            continue
        if line.startswith('```'):
            code = []
            i += 1
            while i < len(lines) and not lines[i].startswith('```'):
                code += textwrap.wrap(lines[i], width=102, replace_whitespace=False, drop_whitespace=False) or ['']
                i += 1
            for start in range(0, len(code), 45):
                output.append(Preformatted('\n'.join(code[start:start + 45]), ParagraphStyle(name='Code', fontName='Courier', fontSize=7, leading=10, spaceAfter=12)))
        elif line.startswith('|'):
            rows = []
            while i < len(lines) and lines[i].startswith('|'):
                rows.append(lines[i])
                i += 1
            output += table(rows)
            continue
        elif line.startswith('!['):
            match = re.match(r'!\[([^]]*)\]\(([^)]+)\)', line)
            if match:
                output += image(match[2], match[1])
        elif line.startswith('# '):
            if not omit_title:
                output.append(para(line[2:], 'ReportH1'))
        elif line.startswith('## '):
            output.append(para(line[3:], 'ReportH1'))
        elif line.startswith('### '):
            output.append(para(line[4:], 'ReportH2'))
        else:
            group = [line]
            if not re.match(r'^(- |\d+\. )', line):
                while i + 1 < len(lines) and lines[i + 1].strip() and not lines[i + 1].startswith(('#', '|', '![', '```', '- ')):
                    i += 1
                    group.append(lines[i])
            output.append(para(' '.join(group)))
        i += 1
    return output

def make(name, title, sections, private=False):
    target = (PRIVATE if private else OUT) / name
    doc = SimpleDocTemplate(str(target), pagesize=A4, rightMargin=46, leftMargin=46, topMargin=46, bottomMargin=52, title=title, author='CIT4001 Group 2')
    story = cover(title, private)
    for section in sections:
        story += markdown(ROOT / 'docs' / section)
        story.append(Spacer(1, 14))
    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    print(target.relative_to(ROOT))

documents = [
    ('development-report.pdf', 'Software development and implementation report', ['DEVELOPMENT_REPORT.md', 'REQUIREMENTS.md']),
    ('programme-manual.pdf', 'Programme manual and database design', ['PROGRAMME_MANUAL.md', 'RECOVERY.md']),
    ('user-manual.pdf', 'PracticeChart user manual', ['USER_MANUAL.md']),
    ('testing-and-control-flow.pdf', 'Testing and control flow appendix', ['TEST_PLAN.md', 'CONTROL_FLOW.md', 'MODULES.md']),
    ('training-and-acceptance-forms.pdf', 'Training plan and blank acceptance forms', ['TRAINING_AND_ACCEPTANCE.md'])
]
for private in [False, True]:
    for name, title, sections in documents:
        make(name, title, sections, private)
    source_files = sorted([p for folder in ['src', 'scripts', 'tests', 'migrations'] for p in (ROOT / folder).rglob('*') if p.is_file() and p.suffix in ['.ts', '.tsx', '.css', '.py', '.mjs', '.sql'] and '.well-known' not in p.parts])
    source_files += [ROOT / f for f in ['package.json', 'tsconfig.json', 'next.config.ts', 'playwright.config.ts', 'vitest.config.ts', 'docker-compose.yml', 'vercel.json']]
    story = cover('Indexed programme source listing', private)
    story += [para('Source index', 'ReportH1'), para('This listing includes authored application code, operator scripts, tests, migrations, and project configuration. Third-party dependencies, generated bundles, credentials, uploads, and private evidence are excluded.')]
    for n, p in enumerate(source_files, 1):
        story.append(para(f'{n}. {p.relative_to(ROOT).as_posix()}', 'Caption'))
    for p in source_files:
        story += [PageBreak(), para(p.relative_to(ROOT).as_posix(), 'ReportH2')]
        wrapped = []
        for n, line in enumerate(p.read_text(encoding='utf-8').splitlines(), 1):
            parts = textwrap.wrap(line.expandtabs(2), width=106, replace_whitespace=False, drop_whitespace=False) or ['']
            wrapped += [f'{n:4d} {parts[0]}'] + ['     ' + v for v in parts[1:]]
        for start in range(0, len(wrapped), 55):
            story.append(Preformatted('\n'.join(wrapped[start:start + 55]), ParagraphStyle(name='Source', fontName='Courier', fontSize=6.8, leading=9.4, spaceAfter=8)))
    target = (PRIVATE if private else OUT) / 'indexed-source-listing.pdf'
    SimpleDocTemplate(str(target), pagesize=A4, rightMargin=46, leftMargin=46, topMargin=46, bottomMargin=52, title='Indexed programme source listing', author='CIT4001 Group 2').build(story, onFirstPage=footer, onLaterPages=footer)
    print(target.relative_to(ROOT))
