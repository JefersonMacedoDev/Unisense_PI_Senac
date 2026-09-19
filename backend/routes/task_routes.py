from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from backend.routes.common import erro_interno, json_data, nao_autorizado, usuario_id
from backend.services.task_service import (
    atualizar_tarefa,
    criar_tarefa,
    definir_status,
    deletar_tarefa,
    listar_tarefas,
)


task_bp = APIRouter()


@task_bp.get("/task")
async def buscar_tarefas(request: Request):
    uid = usuario_id(request)
    if not uid:
        return nao_autorizado()
    try:
        return {"status": "ok", "tarefas": listar_tarefas(uid)}
    except Exception:
        return erro_interno("task")


@task_bp.post("/task", status_code=201)
async def adicionar_tarefa(request: Request):
    uid = usuario_id(request)
    if not uid:
        return nao_autorizado()
    try:
        dados = await json_data(request)
        titulo = (dados.get("titulo") or "").strip()
        descricao = (dados.get("descricao") or "").strip()
        if not titulo:
            return JSONResponse(
                {"status": "erro", "mensagem": "Título inválido"},
                status_code=400
            )
        criar_tarefa(uid, titulo, descricao)
        return {"status": "ok", "mensagem": "Tarefa criada"}
    except Exception:
        return erro_interno("task")


@task_bp.put("/task/{tarefa_id}")
async def editar_tarefa(tarefa_id: int, request: Request):
    uid = usuario_id(request)
    if not uid:
        return nao_autorizado()
    try:
        dados = await json_data(request)
        titulo = (dados.get("titulo") or "").strip()
        descricao = (dados.get("descricao") or "").strip()
        if not titulo:
            return JSONResponse(
                {"status": "erro", "mensagem": "Título inválido"},
                status_code=400
            )
        atualizar_tarefa(uid, tarefa_id, titulo, descricao)
        return {"status": "ok", "mensagem": "Tarefa atualizada"}
    except Exception:
        return erro_interno("task")


@task_bp.post("/task/{tarefa_id}/status")
async def mudar_status(tarefa_id: int, request: Request):
    uid = usuario_id(request)
    if not uid:
        return nao_autorizado()
    try:
        dados = await json_data(request)
        status = dados.get("status", "concluida")
        definir_status(uid, tarefa_id, status)
        return {"status": "ok"}
    except Exception:
        return erro_interno("task")


@task_bp.delete("/task/{tarefa_id}")
async def remover_tarefa(tarefa_id: int, request: Request):
    uid = usuario_id(request)
    if not uid:
        return nao_autorizado()
    try:
        deletar_tarefa(uid, tarefa_id)
        return {"status": "ok"}
    except Exception:
        return erro_interno("task")
