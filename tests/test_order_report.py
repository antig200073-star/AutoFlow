"""Execute: python -m unittest discover -s tests -p 'test_order_report.py'."""
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock
from datetime import date

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "qt"))
from order_report import generate_order_report, visible_order_rows, movement_counts, status_counts
from demo_order_report import demo_rows


class OrderReportTests(unittest.TestCase):
    def test_movement_uses_actual_dates_timezone_and_seven_day_window(self):
        result = movement_counts([
            {"data_entrada": "2026-10-20T02:00:00Z"},  # 19/10 no UTC-03, fora do período.
            {"data_entrada": "2026-10-20", "data_saida": "2026-10-26T02:00:00Z"},
            {"data_entrada": "2026-10-26", "status": "entregue"},  # Não inventa saída.
            {"data_entrada": "inválida", "data_saida": "2026-10-27"},
        ], date(2026, 10, 26))
        self.assertEqual(result["entries"], [1, 0, 0, 0, 0, 0, 1])
        self.assertEqual(result["exits"], [0, 0, 0, 0, 0, 1, 0])
        self.assertEqual(result["missing_exits"], 1)
        self.assertEqual(result["invalid_dates"], 1)

    def test_status_keeps_zero_categories_and_counts_unknown(self):
        rows = demo_rows()
        labels, counts = status_counts(rows)
        self.assertEqual(counts, [2, 1, 1, 1, 1, 0])
        rows[0][5] = "Status novo"
        self.assertEqual(status_counts(rows)[1], [1, 1, 1, 1, 1, 1])
        self.assertEqual(status_counts([])[1], [0] * 6)

    def test_rejects_chart_records_that_do_not_match_filtered_rows(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(ValueError):
                generate_order_report(Path(directory) / "wrong.pdf", demo_rows(), "Teste", records=[])

    def test_visible_rows_preserve_screen_order_and_exclude_hidden(self):
        grid = Mock()
        grid.rowCount.return_value = 3
        grid.isRowHidden.side_effect = lambda row: row == 1
        grid.item.side_effect = lambda row, col: Mock(text=lambda: f"{row}:{col}")
        rows = visible_order_rows(grid)
        self.assertEqual(rows, [[f"{row}:{col}" for col in range(7)] for row in (0, 2)])

    def test_pdf_empty_special_characters_and_long_rows(self):
        with tempfile.TemporaryDirectory() as directory:
            special = demo_rows()[0]
            special[3] = "João & Filhos <teste>"
            special[4] = "Diagnóstico & revisão <motor>\n" * 200
            for name, rows in [("empty", []), ("special", [special]), ("many", demo_rows() * 34)]:
                path = generate_order_report(Path(directory) / name, rows, "Oficina & Filhos", demo=True)
                self.assertEqual(path.suffix, ".pdf")
                self.assertTrue(path.read_bytes().startswith(b"%PDF-"))
                self.assertGreater(path.stat().st_size, 1000)

    def test_invalid_input_preserves_existing_file(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "existing.pdf"
            path.write_bytes(b"existing document")
            with self.assertRaises(ValueError):
                generate_order_report(path, [["incomplete"]], "Oficina")
            self.assertEqual(path.read_bytes(), b"existing document")


if __name__ == "__main__":
    unittest.main()
