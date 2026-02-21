from __future__ import annotations

import typer

from .expression import app as expression_app
from .file import app as file_app
from .kill import app as kill_app
from .serve import app as serve_app
from .spot import app as spot_app
from .tissue import app as tissue_app

app = typer.Typer(add_completion=False, help="Unified micropattern backend CLI")
app.add_typer(file_app, name="file")
app.add_typer(kill_app, name="kill")
app.add_typer(expression_app, name="expression")
app.add_typer(spot_app, name="spot")
app.add_typer(tissue_app, name="tissue")
app.add_typer(serve_app, name="serve")


if __name__ == "__main__":
    app()
