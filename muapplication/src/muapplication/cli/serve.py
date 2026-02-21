"""muapplication serve – run the HTTP API server."""

from __future__ import annotations

from typing import Annotated

import typer

app = typer.Typer(add_completion=False)


@app.callback(invoke_without_command=True)
def serve(
    dev: Annotated[
        bool,
        typer.Option("--dev", help="Enable uvicorn reload for development."),
    ] = False,
) -> None:
    """Run the muapplication HTTP API server."""
    import uvicorn

    uvicorn.run(
        "muapplication.api.app:app",
        host="127.0.0.1",
        port=8787,
        reload=dev,
    )
