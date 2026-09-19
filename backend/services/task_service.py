from sqlalchemy import select

from backend.database import SessionLocal
from backend.models import Tarefa
from backend.services.ia_service import gerar_passos_ia


def listar_tarefas(usuario_id):
    with SessionLocal() as banco:
        tarefas = banco.scalars(
            select(Tarefa)
            .where(Tarefa.usuario_id == usuario_id)
            .order_by(Tarefa.id.desc())
        ).all()
        return [
            {
                "id": tarefa.id,
                "titulo": tarefa.titulo,
                "descricao": tarefa.descricao,
                "status": tarefa.status,
                "passos_ia": tarefa.passos_ia,
                "data": tarefa.data,
            }
            for tarefa in tarefas
        ]


def criar_tarefa(usuario_id, titulo, descricao=""):
    tarefa = Tarefa(
        usuario_id=usuario_id,
        titulo=titulo,
        descricao=descricao,
        status="pendente",
        passos_ia=gerar_passos_ia(titulo, descricao),
    )
    with SessionLocal() as banco:
        banco.add(tarefa)
        banco.commit()


def atualizar_tarefa(usuario_id, tarefa_id, titulo, descricao=""):
    with SessionLocal() as banco:
        tarefa = banco.scalar(
            select(Tarefa).where(
                Tarefa.id == tarefa_id,
                Tarefa.usuario_id == usuario_id,
            )
        )
        if tarefa:
            tarefa.titulo = titulo
            tarefa.descricao = descricao
            tarefa.passos_ia = gerar_passos_ia(titulo, descricao)
            banco.commit()


def definir_status(usuario_id, tarefa_id, status):
    with SessionLocal() as banco:
        tarefa = banco.scalar(
            select(Tarefa).where(
                Tarefa.id == tarefa_id,
                Tarefa.usuario_id == usuario_id,
            )
        )
        if tarefa:
            tarefa.status = status
            banco.commit()


def deletar_tarefa(usuario_id, tarefa_id):
    with SessionLocal() as banco:
        tarefa = banco.scalar(
            select(Tarefa).where(
                Tarefa.id == tarefa_id,
                Tarefa.usuario_id == usuario_id,
            )
        )
        if tarefa:
            banco.delete(tarefa)
            banco.commit()
