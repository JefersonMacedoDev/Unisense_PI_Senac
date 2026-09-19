import os

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker


BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "database.db")
DATABASE_URL = os.getenv("DATABASE_URL")
USE_POSTGRES = bool(DATABASE_URL)

if USE_POSTGRES:
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)
else:
    engine = create_engine(
        f"sqlite:///{DB_PATH}",
        connect_args={"check_same_thread": False}
    )

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


class Base(DeclarativeBase):
    pass


def init_db():
    from backend.models import Curso, Historico, Tarefa, Usuario

    # As importações registram todos os modelos antes da criação das tabelas.
    _ = (Curso, Historico, Tarefa, Usuario)
    Base.metadata.create_all(bind=engine)

    # Migração simples para bancos existentes antes do controle por pergunta.
    colunas_cursos = {
        coluna["name"] for coluna in inspect(engine).get_columns("cursos")
    }
    if "pergunta_atual" not in colunas_cursos:
        with engine.begin() as conexao:
            conexao.execute(
                text("ALTER TABLE cursos ADD COLUMN pergunta_atual INTEGER DEFAULT 0")
            )
