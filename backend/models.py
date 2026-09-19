from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class Usuario(Base):
    __tablename__ = "usuarios"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nome: Mapped[str | None] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    senha: Mapped[str] = mapped_column(String(255))
    foto: Mapped[str | None] = mapped_column(Text)
    prefs_a11y: Mapped[str | None] = mapped_column(Text)
    reset_codigo: Mapped[str | None] = mapped_column(String(6))
    reset_expira: Mapped[datetime | None] = mapped_column(DateTime)


class Historico(Base):
    __tablename__ = "historico"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    usuario_id: Mapped[int] = mapped_column(Integer, index=True)
    pergunta: Mapped[str] = mapped_column(Text)
    resposta: Mapped[str] = mapped_column(Text)
    conversa: Mapped[str | None] = mapped_column(String(255))
    data: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Tarefa(Base):
    __tablename__ = "tarefas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    usuario_id: Mapped[int] = mapped_column(Integer, index=True)
    titulo: Mapped[str] = mapped_column(String(255))
    descricao: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(30), default="pendente")
    passos_ia: Mapped[str | None] = mapped_column(Text)
    data: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Curso(Base):
    __tablename__ = "cursos"
    __table_args__ = (UniqueConstraint("usuario_id", "curso_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    usuario_id: Mapped[int] = mapped_column(Integer, index=True)
    curso_id: Mapped[str] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(30), default="iniciado")
    pontuacao: Mapped[int] = mapped_column(Integer, default=0)
    pergunta_atual: Mapped[int] = mapped_column(Integer, default=0)
    data: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
