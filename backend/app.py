import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.sessions import SessionMiddleware

from backend.database import init_db

load_dotenv()


# Pasta do frontend (servida pela própria API -> mesma origem, sem CORS/cookie)
FRONTEND_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "frontend"
)


def create_app():
    app = FastAPI(title="UniSense API")
    app.add_middleware(
        SessionMiddleware,
        secret_key=os.getenv("SECRET_KEY", "dev-secret-trocar"),
        same_site="lax",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Garante que as tabelas existam (local e deploy)
    init_db()

    # ---- Frontend ----
    @app.get("/", include_in_schema=False)
    def home():
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))

    # Health check da API (útil para monitorar o deploy)
    @app.get("/api/health")
    def health():
        return {
            "status": "online",
            "mensagem": "UniSense API funcionando"
        }

    # ---- API (routers) ----
    from backend.routes.auth_routes import auth_bp
    from backend.routes.ia_routes import ia_bp
    from backend.routes.historico_routes import historico_bp
    from backend.routes.task_routes import task_bp
    from backend.routes.curso_routes import curso_bp

    app.include_router(auth_bp)
    app.include_router(ia_bp)
    app.include_router(historico_bp)
    app.include_router(task_bp)
    app.include_router(curso_bp)

    # Arquivos do SPA ficam depois das rotas da API para não capturá-las.
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")

    return app


app = create_app()
