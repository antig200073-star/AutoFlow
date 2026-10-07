"""Atalho: execute `python main.py` na raiz do repositório."""
import runpy
import sys
from pathlib import Path

qt_dir = Path(__file__).resolve().parent / "qt"
sys.path.insert(0, str(qt_dir))
runpy.run_path(str(qt_dir / "main.py"), run_name="__main__")
