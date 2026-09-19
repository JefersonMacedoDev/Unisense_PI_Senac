from fastapi import APIRouter, Request

from backend.routes.common import erro_interno, json_data, nao_autorizado, usuario_id
from backend.services.historico_service import (
    arquivar_atual,
    listar_atual,
    listar_conversas,
)


historico_bp = APIRouter()


@historico_bp.get("/historico")
async def historico(request: Request):
    """Mensagens da conversa atual, ainda não arquivada."""
    uid = usuario_id(request)
    if not uid:
        return nao_autorizado()
    try:
        dados = listar_atual(uid)
        return {"status": "ok", "historico": dados}
    except Exception:
        return erro_interno("historico")


@historico_bp.post("/historico/nova-conversa")
async def nova_conversa(request: Request):
    """Arquiva a conversa atual sob um rótulo e limpa o chat."""
    uid = usuario_id(request)
    if not uid:
        return nao_autorizado()
    try:
        dados = await json_data(request)
        nome = (dados.get("nome") or "").strip() or "Conversa"
        arquivadas = arquivar_atual(uid, nome)
        return {"status": "ok", "salvou": arquivadas > 0, "nome": nome}
    except Exception:
        return erro_interno("historico")


@historico_bp.get("/historico/conversas")
async def conversas(request: Request):
    """Lista conversas arquivadas, agrupadas por rótulo."""
    uid = usuario_id(request)
    if not uid:
        return nao_autorizado()
    try:
        resultado = listar_conversas(uid)
        return {"status": "ok", "conversas": resultado}
    except Exception:
        return erro_interno("historico")
