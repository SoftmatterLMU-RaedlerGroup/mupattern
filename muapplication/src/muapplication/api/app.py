from __future__ import annotations

from fastapi import FastAPI

from .routes_health import router as health_router
from .routes_jobs import router as jobs_router
from ..apps.file.route import router as file_router
from ..apps.kill.route import router as kill_router
from ..apps.expression.route import router as expression_router
from ..apps.spot.route import router as spot_router
from ..apps.tissue.route import router as tissue_router


def create_app() -> FastAPI:
    app = FastAPI(title="muapplication api", version="0.1.0")
    app.include_router(health_router)
    app.include_router(jobs_router)
    app.include_router(file_router)
    app.include_router(kill_router)
    app.include_router(expression_router)
    app.include_router(tissue_router)
    app.include_router(spot_router)
    return app


app = create_app()


def main() -> None:
    import uvicorn

    uvicorn.run("muapplication.api.app:app", host="127.0.0.1", port=8787, reload=False)


if __name__ == "__main__":
    main()
