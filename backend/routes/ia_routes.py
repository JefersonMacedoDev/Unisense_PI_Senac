import logging

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from backend.services.ia_service import (
    IAInputError,
    IAServiceError,
    descrever_imagem,
    explicar_simples,
    responder_ia,
)
from backend.services.historico_service import registrar_mensagem


ia_bp = APIRouter()
logger = logging.getLogger(__name__)


def _nao_autorizado():
    return JSONResponse(
        {"status": "erro", "mensagem": "Não autorizado"},
        status_code=401
    )


def _erro_interno():
    logger.exception("Erro não tratado na rota de IA")
    return JSONResponse(
        {"status": "erro", "mensagem": "Erro interno do servidor"},
        status_code=500
    )


def _erro_ia(erro):
    return JSONResponse(
        {"status": "erro", "mensagem": str(erro)},
        status_code=503
    )


async def _json(request):
    try:
        return await request.json()
    except ValueError:
        return {}


@ia_bp.post("/ia")
async def ia(request: Request):
    usuario_id = request.session.get("usuario_id")
    if not usuario_id:
        return _nao_autorizado()

    try:
        dados = await _json(request)
        if not isinstance(dados, dict) or not dados.get("pergunta"):
            return JSONResponse(
                {"status": "erro", "mensagem": "Pergunta inválida"},
                status_code=400
            )

        pergunta = dados["pergunta"]
        resposta = responder_ia(pergunta)

        registrar_mensagem(usuario_id, pergunta, resposta)

        return {"status": "ok", "resposta": resposta}
    except IAServiceError as erro:
        return _erro_ia(erro)
    except Exception:
        return _erro_interno()


@ia_bp.post("/ia/simplificar")
async def simplificar(request: Request):
    """Reescreve um texto em linguagem simples (não grava no histórico)."""
    if not request.session.get("usuario_id"):
        return _nao_autorizado()

    try:
        dados = await _json(request)
        texto = (dados.get("texto") or "").strip() if isinstance(dados, dict) else ""
        if not texto:
            return JSONResponse(
                {"status": "erro", "mensagem": "Texto inválido"},
                status_code=400
            )
        return {"status": "ok", "resposta": explicar_simples(texto)}
    except IAServiceError as erro:
        return _erro_ia(erro)
    except Exception:
        return _erro_interno()


@ia_bp.post("/ia/descrever-imagem")
async def descrever(request: Request):
    """Descreve uma imagem enviada (data URL)."""
    if not request.session.get("usuario_id"):
        return _nao_autorizado()

    try:
        dados = await _json(request)
        imagem = dados.get("imagem", "") if isinstance(dados, dict) else ""
        if not imagem:
            return JSONResponse(
                {"status": "erro", "mensagem": "Imagem inválida"},
                status_code=400
            )
        return {"status": "ok", "resposta": descrever_imagem(imagem)}
    except IAInputError as erro:
        return JSONResponse(
            {"status": "erro", "mensagem": str(erro)},
            status_code=400
        )
    except IAServiceError as erro:
        return _erro_ia(erro)
    except Exception:
        return _erro_interno()
