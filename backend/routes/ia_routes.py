import logging
import os

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse
from google import genai
from starlette.concurrency import run_in_threadpool

from backend.routes.common import json_data
from backend.services.historico_service import buscar_contexto, registrar_mensagem
from backend.services.ia_service import (
    IAInputError,
    IAServiceError,
    descrever_imagem,
    explicar_simples,
    responder_ia,
)

ia_bp = APIRouter()
logger = logging.getLogger(__name__)

client = None
api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
if api_key:
    client = genai.Client(api_key=api_key)


def _nao_autorizado():
    return JSONResponse(
        {"status": "erro", "mensagem": "Não autorizado"},
        status_code=401,
    )


def _erro_interno():
    logger.exception("Erro não tratado na rota de IA")
    return JSONResponse(
        {"status": "erro", "mensagem": "Erro interno do servidor"},
        status_code=500,
    )


def _erro_ia(erro):
    return JSONResponse(
        {"status": "erro", "mensagem": str(erro)},
        status_code=503,
    )


@ia_bp.post("/chat-stream")
async def chat_stream(request: Request):
    if client is None:
        raise HTTPException(status_code=503, detail="Serviço de IA não configurado.")

    dados = await json_data(request)
    prompt = (dados.get("prompt") or dados.get("pergunta") or "").strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt inválido.")

    try:
        stream = client.models.generate_content_stream(
            model=os.getenv("GEMINI_MODEL", "gemini-1.5-flash"),
            contents=prompt,
        )

        def generate():
            for chunk in stream:
                text = getattr(chunk, "text", None)
                if text:
                    yield f"data: {text}\n\n"

        return StreamingResponse(generate(), media_type="text/event-stream")
    except Exception as erro:
        raise HTTPException(status_code=503, detail=str(erro)) from erro


@ia_bp.post("/ia")
async def ia(request: Request):
    usuario_id = request.session.get("usuario_id")
    if not usuario_id:
        return _nao_autorizado()

    try:
        dados = await json_data(request)
        pergunta = (dados.get("pergunta") or "").strip()
        if not pergunta:
            return JSONResponse(
                {"status": "erro", "mensagem": "Pergunta inválida"},
                status_code=400,
            )

        historico = await run_in_threadpool(buscar_contexto, usuario_id)
        resposta = await run_in_threadpool(responder_ia, pergunta, historico=historico)
        await run_in_threadpool(registrar_mensagem, usuario_id, pergunta, resposta)

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
        dados = await json_data(request)
        texto = (dados.get("texto") or "").strip()
        if not texto:
            return JSONResponse(
                {"status": "erro", "mensagem": "Texto inválido"},
                status_code=400,
            )
        resposta = await run_in_threadpool(explicar_simples, texto)
        return {"status": "ok", "resposta": resposta}
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
        dados = await json_data(request)
        imagem = dados.get("imagem", "")
        if not imagem:
            return JSONResponse(
                {"status": "erro", "mensagem": "Imagem inválida"},
                status_code=400,
            )
        resposta = await run_in_threadpool(descrever_imagem, imagem)
        return {"status": "ok", "resposta": resposta}
    except IAInputError as erro:
        return JSONResponse(
            {"status": "erro", "mensagem": str(erro)},
            status_code=400,
        )
    except IAServiceError as erro:
        return _erro_ia(erro)
    except Exception:
        return _erro_interno()
