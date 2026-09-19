from sqlalchemy import select

from backend.database import SessionLocal
from backend.models import Historico


def registrar_mensagem(usuario_id, pergunta, resposta):
    with SessionLocal() as banco:
        banco.add(Historico(
            usuario_id=usuario_id,
            pergunta=pergunta,
            resposta=resposta,
        ))
        banco.commit()


def listar_atual(usuario_id):
    with SessionLocal() as banco:
        linhas = banco.scalars(
            select(Historico)
            .where(
                Historico.usuario_id == usuario_id,
                Historico.conversa.is_(None),
            )
            .order_by(Historico.id.desc())
        ).all()
        return [
            {"pergunta": item.pergunta, "resposta": item.resposta, "data": item.data}
            for item in linhas
        ]


def arquivar_atual(usuario_id, nome):
    with SessionLocal() as banco:
        linhas = banco.scalars(
            select(Historico).where(
                Historico.usuario_id == usuario_id,
                Historico.conversa.is_(None),
            )
        ).all()
        for linha in linhas:
            linha.conversa = nome
        banco.commit()
    return len(linhas)


def listar_conversas(usuario_id):
    with SessionLocal() as banco:
        linhas = banco.scalars(
            select(Historico)
            .where(
                Historico.usuario_id == usuario_id,
                Historico.conversa.is_not(None),
            )
            .order_by(Historico.id.asc())
        ).all()

    grupos = {}
    ordem = []
    for linha in linhas:
        nome = linha.conversa
        if nome not in grupos:
            grupos[nome] = []
            ordem.append(nome)
        grupos[nome].append({
            "pergunta": linha.pergunta,
            "resposta": linha.resposta,
        })
    return [
        {"nome": nome, "mensagens": grupos[nome]}
        for nome in reversed(ordem)
    ]
