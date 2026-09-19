from sqlalchemy import select

from backend.database import SessionLocal
from backend.models import Curso


CURSOS_VALIDOS = frozenset({
    "acessibilidade",
    "assistente-ia",
    "teclado",
    "cores-contraste",
})
STATUS_VALIDOS = frozenset({"iniciado", "concluido"})
TOTAL_PERGUNTAS = {
    "acessibilidade": 3,
    "assistente-ia": 3,
    "teclado": 3,
    "cores-contraste": 3,
}


def validar_progresso(curso_id, status, pontuacao, pergunta_atual):
    if not isinstance(curso_id, str) or curso_id not in CURSOS_VALIDOS:
        raise ValueError("curso_id inválido")
    if not isinstance(status, str) or status not in STATUS_VALIDOS:
        raise ValueError("status inválido")
    if isinstance(pontuacao, bool) or not isinstance(pontuacao, int):
        raise ValueError("pontuação deve ser um número inteiro")
    if pontuacao < 0 or pontuacao > 100:
        raise ValueError("pontuação deve estar entre 0 e 100")
    if status == "iniciado" and pontuacao != 0:
        raise ValueError("curso iniciado não pode ter pontuação")
    if isinstance(pergunta_atual, bool) or not isinstance(pergunta_atual, int):
        raise ValueError("pergunta_atual deve ser um número inteiro")
    if pergunta_atual < 0 or pergunta_atual > TOTAL_PERGUNTAS[curso_id]:
        raise ValueError("pergunta_atual está fora do limite do curso")
    if status == "concluido" and pergunta_atual != TOTAL_PERGUNTAS[curso_id]:
        raise ValueError("curso concluído deve ter todas as perguntas respondidas")


def listar_progresso(usuario_id):
    with SessionLocal() as banco:
        cursos = banco.scalars(
            select(Curso).where(Curso.usuario_id == usuario_id)
        ).all()
        return [
            {
                "curso_id": curso.curso_id,
                "status": curso.status,
                "pontuacao": curso.pontuacao,
                "pergunta_atual": curso.pergunta_atual or 0,
            }
            for curso in cursos
        ]


def salvar_progresso(usuario_id, curso_id, status, pontuacao, pergunta_atual=0):
    validar_progresso(curso_id, status, pontuacao, pergunta_atual)

    with SessionLocal() as banco:
        curso = banco.scalar(
            select(Curso).where(
                Curso.usuario_id == usuario_id,
                Curso.curso_id == curso_id,
            )
        )
        if curso:
            if status == "concluido":
                curso.status = status
                curso.pontuacao = pontuacao
                curso.pergunta_atual = pergunta_atual
            elif curso.status != "concluido":
                curso.pergunta_atual = pergunta_atual
        else:
            banco.add(Curso(
                usuario_id=usuario_id,
                curso_id=curso_id,
                status=status,
                pontuacao=pontuacao,
                pergunta_atual=pergunta_atual,
            ))
        banco.commit()
