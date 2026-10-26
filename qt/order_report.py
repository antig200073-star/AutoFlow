"""Relatório das linhas visíveis do painel; não acessa nem altera o banco."""

from collections import Counter
from datetime import datetime
from io import BytesIO
from pathlib import Path
from xml.sax.saxutils import escape
import os
import tempfile


HEADERS = ["Nº O.S.", "Placa", "Veículo", "Cliente", "Serviço / Defeito", "Status", "Entrada"]


def visible_order_rows(grid):
    """Preserva a busca e a ordem exibida, sem incluir linhas ocultas."""
    return [
        [grid.item(row, col).text() if grid.item(row, col) else "-"
         for col in range(7)]
        for row in range(grid.rowCount()) if not grid.isRowHidden(row)
    ]


def generate_order_report(path, rows, workshop, search="", demo=False, generated_at=None):
    """Gera PDF paginado; substitui o destino somente após geração completa."""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.styles import ParagraphStyle
    from reportlab import __file__ as reportlab_file
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, LongTable, TableStyle

    # Fontes incluídas no ReportLab: o PDF independe das fontes do computador.
    fonts = Path(reportlab_file).parent / "fonts"
    if "AutoFlowSans" not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(TTFont("AutoFlowSans", str(fonts / "Vera.ttf")))
        pdfmetrics.registerFont(TTFont("AutoFlowSansBold", str(fonts / "VeraBd.ttf")))

    rows = [list(row) for row in rows]
    if any(len(row) != len(HEADERS) for row in rows):
        raise ValueError("Cada ordem deve conter as sete colunas do painel.")
    moment = generated_at or datetime.now().astimezone()
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

    story = [p("AUTOFLOW", title), p("Relatório de ordens de serviço", title),
             p("Oficina: " + str(workshop or "Não informada")),
             p("Emitido em: " + moment.strftime("%d/%m/%Y às %H:%M %z")),
             p("Busca aplicada: " + (search.strip() or "Nenhuma")),
             p("Escopo: linhas visíveis da lista das 200 O.S. mais recentes (por número)."),
             p(f"Total de ordens neste relatório: {len(rows)}")]
    if demo:
        story.append(p("DEMONSTRAÇÃO ACADÊMICA - DADOS FICTÍCIOS. Atividade de 26/10/2026."))
    if rows:
        counts = Counter(str(row[5] or "Não informado") for row in rows)
        story += [p("Resumo por status: " + " | ".join(f"{k}: {v}" for k, v in counts.items())), Spacer(1, 10)]
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
