import logging

from fastapi import Request
from fastapi.responses import JSONResponse


logger = logging.getLogger(__name__)


async def json_data(request: Request):
    try:
        data = await request.json()
    except ValueError:
        return {}
    return data if isinstance(data, dict) else {}


def usuario_id(request: Request):
    return request.session.get("usuario_id")


def nao_autorizado():
    return JSONResponse(
        {"status": "erro", "mensagem": "Não autorizado"},
        status_code=401
    )


def erro_interno(logger_name):
    logging.getLogger(logger_name).exception("Erro não tratado na rota")
    return JSONResponse(
        {"status": "erro", "mensagem": "Erro interno do servidor"},
        status_code=500
    )
