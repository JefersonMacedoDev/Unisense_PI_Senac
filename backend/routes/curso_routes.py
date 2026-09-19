from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from backend.routes.common import erro_interno, json_data, nao_autorizado, usuario_id
from backend.services.curso_service import (
    listar_progresso as buscar_progresso,
    salvar_progresso as registrar_progresso,
)


curso_bp = APIRouter()


@curso_bp.get("/curso/progresso")
async def listar_progresso(request: Request):
    uid = usuario_id(request)
    if not uid:
        return nao_autorizado()
    try:
        progresso = buscar_progresso(uid)
        return {"status": "ok", "progresso": progresso}
    except Exception:
        return erro_interno("curso")


@curso_bp.post("/curso/progresso")
async def salvar_progresso(request: Request):
    uid = usuario_id(request)
    if not uid:
        return nao_autorizado()
    try:
        dados = await json_data(request)
        curso_id = dados.get("curso_id")
        status = dados.get("status", "iniciado")
        pontuacao = dados.get("pontuacao", 0)
        pergunta_atual = dados.get("pergunta_atual", 0)
        if not curso_id:
            return JSONResponse(
                {"status": "erro", "mensagem": "curso_id obrigatório"},
                status_code=400
            )

        registrar_progresso(uid, curso_id, status, pontuacao, pergunta_atual)
        return {"status": "ok"}
    except ValueError as erro:
        return JSONResponse(
            {"status": "erro", "mensagem": str(erro)},
            status_code=400
        )
    except Exception:
        return erro_interno("curso")
