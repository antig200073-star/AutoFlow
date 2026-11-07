"""Relatório das linhas visíveis do painel; não acessa nem altera o banco."""

from collections import Counter
from datetime import datetime, timedelta, timezone
from io import BytesIO
from pathlib import Path
from xml.sax.saxutils import escape
import os
import tempfile


HEADERS = ["Nº O.S.", "Placa", "Veículo", "Cliente", "Serviço / Defeito", "Status", "Entrada"]
REPORT_TZ = timezone(timedelta(hours=-3))
STATUS_ORDER = ["Em Diagnóstico", "Aguardando peças", "Em Manutenção", "Pronto para retirada", "Entregue"]


def visible_order_records(grid):
    """Os metadados acompanham a linha mesmo após ordenar ou filtrar a tabela."""
    from PyQt5.QtCore import Qt
    return [grid.item(row, 0).data(Qt.UserRole)
            for row in range(grid.rowCount()) if not grid.isRowHidden(row)]


def status_counts(rows):
    counts = Counter(str(row[5] or "").strip().casefold() for row in rows)
    values = [counts.pop(label.casefold(), 0) for label in STATUS_ORDER]
    return STATUS_ORDER + ["Outros / não informado"], values + [sum(counts.values())]


def movement_counts(records, end_date):
    """Eventos por O.S.; não deduz datas de saída a partir do status."""
    days = [end_date - timedelta(days=offset) for offset in range(6, -1, -1)]
    entries, exits = Counter(), Counter()
    missing_entries = missing_exits = invalid_dates = 0
    for order in records:
        for field, counts in (("data_entrada", entries), ("data_saida", exits)):
            value = order.get(field)
            if not value:
                missing_entries += field == "data_entrada"
                missing_exits += field == "data_saida" and order.get("status") == "entregue"
                continue
            try:
                moment = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
                if moment.tzinfo is not None:
                    moment = moment.astimezone(REPORT_TZ)
                counts[moment.date()] += 1
            except (ValueError, TypeError):
                invalid_dates += 1
    return {"days": days, "entries": [entries[d] for d in days],
            "exits": [exits[d] for d in days], "missing_entries": missing_entries,
            "missing_exits": missing_exits, "invalid_dates": invalid_dates}


def report_charts(rows, movement, width):
    """Desenha barras vetoriais com escala inteira iniciada em zero."""
    from reportlab.graphics.shapes import Drawing, String, Rect, Line
    from reportlab.lib.colors import HexColor
    import math

    red, green, ink, gray = map(HexColor, ["#C62828", "#17836B", "#16181D", "#D7DBE0"])
    drawing = Drawing(width, 230)
    half = width / 2

    def text(x, y, value, size=8, color=ink, anchor="start", bold=False):
        drawing.add(String(x, y, str(value), fontName="AutoFlowSansBold" if bold else "AutoFlowSans",
                           fontSize=size, fillColor=color, textAnchor=anchor))

    text(0, 214, "Entradas e saídas por dia", 12, bold=True)
    text(half + 18, 214, "Atendimentos por status", 12, bold=True)
    labels, counts = status_counts(rows)
    left, right, bottom, height = 28, half - 16, 42, 130
    if movement is None:
        text(5, 136, "Datas de movimentação não fornecidas.", 9)
    else:
        maximum = max(movement["entries"] + movement["exits"] + [1])
        step = max(1, math.ceil(maximum / 4))
        ceiling = math.ceil(maximum / step) * step
        for tick in range(0, ceiling + 1, step):
            y = bottom + height * tick / ceiling
            drawing.add(Line(left, y, right, y, strokeColor=gray, strokeWidth=0.5))
            text(left - 7, y - 3, tick, anchor="end")
        slot = (right - left) / 7
        for i, day in enumerate(movement["days"]):
            center = left + slot * (i + .5)
            for shift, value, color in [(-10, movement["entries"][i], red), (2, movement["exits"][i], green)]:
                h = height * value / ceiling
                drawing.add(Rect(center + shift, bottom, 9, h, fillColor=color, strokeColor=None))
                if value:
                    text(center + shift + 4.5, bottom + h + 5, value, 8, anchor="middle")
            text(center, bottom - 15, day.strftime("%d/%m"), 8, anchor="middle")
        for x, color, label in [(left, red, "Entradas"), (left + 100, green, "Saídas")]:
            drawing.add(Rect(x, 190, 8, 8, fillColor=color, strokeColor=None))
            text(x + 13, 190, label)
        text(left, 6, "Quantidade de movimentações (por O.S.)", 8)

    start, bar_start, bar_width = half + 18, half + 163, half - 205
    maximum = max(counts + [1])
    step = max(1, math.ceil(maximum / 4))
    ceiling = math.ceil(maximum / step) * step
    for tick in range(0, ceiling + 1, step):
        x = bar_start + bar_width * tick / ceiling
        drawing.add(Line(x, 35, x, 185, strokeColor=gray, strokeWidth=.5))
        text(x, 22, tick, anchor="middle")
    for i, (label, value) in enumerate(zip(labels, counts)):
        y = 165 - i * 25
        text(start, y + 5, label, 8)
        length = bar_width * value / ceiling
        drawing.add(Rect(bar_start, y, length, 16, fillColor=green if label == "Entregue" else red,
                         strokeColor=None))
        text(bar_start + length + 5, y + 4, value, 9, bold=True)
    text(bar_start, 6, "Quantidade de O.S.", 8)
    return drawing


def visible_order_rows(grid):
    """Preserva a busca e a ordem exibida, sem incluir linhas ocultas."""
    return [
        [grid.item(row, col).text() if grid.item(row, col) else "-"
         for col in range(7)]
        for row in range(grid.rowCount()) if not grid.isRowHidden(row)
    ]


def generate_order_report(path, rows, workshop, search="", demo=False, generated_at=None, records=None):
    """Gera PDF paginado; substitui o destino somente após geração completa."""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.styles import ParagraphStyle
    from reportlab import __file__ as reportlab_file
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, LongTable, TableStyle, PageBreak

    # Fontes incluídas no ReportLab: o PDF independe das fontes do computador.
    fonts = Path(reportlab_file).parent / "fonts"
    if "AutoFlowSans" not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(TTFont("AutoFlowSans", str(fonts / "Vera.ttf")))
        pdfmetrics.registerFont(TTFont("AutoFlowSansBold", str(fonts / "VeraBd.ttf")))

    rows = [list(row) for row in rows]
    if any(len(row) != len(HEADERS) for row in rows):
        raise ValueError("Cada ordem deve conter as sete colunas do painel.")
    if records is not None:
        records = list(records)
        if [str(r.get("id")) for r in records] != [str(row[0]) for row in rows]:
            raise ValueError("Os dados dos gráficos devem corresponder às linhas exportadas.")
    moment = generated_at or datetime.now(REPORT_TZ)
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=REPORT_TZ)
    moment = moment.astimezone(REPORT_TZ)
    movement = movement_counts(records, moment.date()) if records is not None else None
    target = Path(path)
    if target.suffix.lower() != ".pdf":
        target = target.with_name(target.name + ".pdf")
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=landscape(A4), leftMargin=32,
                            rightMargin=32, topMargin=32, bottomMargin=38,
                            title="AutoFlow - Relatório de ordens de serviço", author="AutoFlow")
    body = ParagraphStyle("body", fontName="AutoFlowSans", fontSize=9, leading=13,
                          textColor=colors.HexColor("#16181D"), spaceAfter=6)
    title = ParagraphStyle("title", parent=body, fontName="AutoFlowSansBold", fontSize=23,
                           leading=28, spaceAfter=10)
    cell = ParagraphStyle("cell", parent=body, fontSize=8, leading=11, spaceAfter=0)
    heading = ParagraphStyle("heading", parent=cell, fontName="AutoFlowSansBold", textColor=colors.white)

    def p(value, style=body):
        text = "-" if value is None or value == "" else str(value)
        text = text.replace("\r\n", "\n").replace("\r", "\n").replace("\t", " ")
        text = "".join(c for c in text if c == "\n" or ord(c) >= 32)
        return Paragraph(escape(text).replace("\n", "<br/>"), style)

    story = [p("AUTOFLOW | Relatório de veículos", title),
             p("Oficina: " + str(workshop or "Não informada")),
             p("Emitido em: " + moment.strftime("%d/%m/%Y às %H:%M %z")),
             p("Busca aplicada: " + (search.strip() or "Nenhuma")),
             p("Escopo: linhas visíveis da lista das 200 O.S. mais recentes (por número)."),
             p(f"Total de ordens neste relatório: {len(rows)}")]
    if demo:
        story.append(p("DEMONSTRAÇÃO ACADÊMICA - DADOS FICTÍCIOS. Atividade de 26/10/2026."))
    if rows:
        if movement is not None:
            story.append(p(f"Movimentação de {movement['days'][0]:%d/%m/%Y} a {moment:%d/%m/%Y} (UTC-03:00): "
                           f"Entradas: {sum(movement['entries'])} | Saídas: {sum(movement['exits'])}."))
        story += [Spacer(1, 8), report_charts(rows, movement, doc.width), Spacer(1, 12),
                  p("Cada O.S. representa um atendimento. Um mesmo veículo pode ter mais de uma O.S."),
                  p("Movimentação: datas de entrada e saída dos atendimentos exportados, nos últimos sete dias. "
                    "Status: situação atual de todas as O.S. exportadas, independentemente da data. "
                    "A busca e o limite de 200 O.S. também se aplicam aos gráficos.")]
        if movement and any(movement[k] for k in ("missing_entries", "missing_exits", "invalid_dates")):
            story.append(p(f"Datas não contabilizadas: {movement['missing_entries']} entradas sem data; "
                           f"{movement['missing_exits']} entregas sem data de saída; "
                           f"{movement['invalid_dates']} datas inválidas."))
        story += [PageBreak(), p("Detalhamento das ordens de serviço", title)]
        data = [[p(h, heading) for h in HEADERS]] + [[p(v, cell) for v in row] for row in rows]
        widths = [40, 60, 96, 105, 238, 108, doc.width - 647]
        table = LongTable(data, colWidths=widths, repeatRows=1, splitByRow=1, splitInRow=1,
                          hAlign="LEFT")
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#C62828")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F3F4F6")]),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 7), ("RIGHTPADDING", (0, 0), (-1, -1), 7),
            ("TOPPADDING", (0, 0), (-1, -1), 9), ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
            ("LINEBELOW", (0, 0), (-1, -1), 0.3, colors.HexColor("#D7DBE0")),
        ]))
        story.append(table)
    else:
        story.append(p("Nenhuma ordem de serviço encontrada para a busca aplicada."))

    def footer(canvas, document):
        canvas.saveState()
        canvas.setStrokeColor(colors.HexColor("#C62828"))
        canvas.line(32, 28, document.pagesize[0] - 32, 28)
        canvas.setFont("AutoFlowSans", 8)
        canvas.setFillColor(colors.HexColor("#586171"))
        canvas.drawString(32, 16, "AutoFlow | " + ("Dados fictícios para teste" if demo else "Controle de ordens de serviço"))
        canvas.drawRightString(document.pagesize[0] - 32, 16, f"Página {document.page}")
        canvas.restoreState()

    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(dir=target.parent, suffix=".tmp", delete=False) as stream:
            temporary = Path(stream.name)
            stream.write(buffer.getvalue())
        os.replace(temporary, target)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
    return target
