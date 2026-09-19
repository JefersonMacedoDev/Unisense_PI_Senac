import logging

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from backend.database import USE_POSTGRES
from backend.routes.common import json_data
from backend.services.auth_service import (
    alterar_senha as alterar_senha_usuario,
    atualizar_foto as salvar_foto,
    autenticar,
    confirmar_recuperacao,
    criar_codigo_recuperacao,
    criar_usuario,
    dados_do_usuario,
    salvar_preferencias,
    validar_senha,
)
from backend.services.email_service import email_configurado, enviar_email


auth_bp = APIRouter()
logger = logging.getLogger(__name__)


def _erro_interno(campo="erro"):
    logger.exception("Erro não tratado na rota de autenticação")
    return JSONResponse(
        {campo: "Erro interno do servidor"},
        status_code=500
    )


def _nao_autorizado():
    return JSONResponse(
        {"status": "erro", "mensagem": "Não autorizado"},
        status_code=401
    )


@auth_bp.post("/login")
async def login(request: Request):
    try:
        dados = await json_data(request)
        email = (dados.get("email") or "").strip()
        senha = dados.get("senha") or ""
        if not email or not senha:
            return JSONResponse({"erro": "Dados inválidos"}, status_code=400)

        usuario = autenticar(email, senha)
        if not usuario:
            return JSONResponse(
                {"status": "erro", "mensagem": "Email ou senha incorretos"},
                status_code=401
            )

        nome = usuario["nome"] or email.split("@")[0]
        request.session.clear()
        request.session["usuario_id"] = usuario["id"]
        request.session["usuario_email"] = usuario["email"]
        request.session["usuario_nome"] = nome
        request.session["usuario"] = usuario["email"]

        return {
            "status": "ok",
            "mensagem": "Login realizado",
            "nome": nome,
            "foto": usuario["foto"],
            "prefs": usuario["prefs"]
        }
    except Exception:
        return _erro_interno()


@auth_bp.get("/me")
async def me(request: Request):
    uid = request.session.get("usuario_id")
    if not uid:
        return {"logado": False}

    try:
        perfil = dados_do_usuario(uid)
    except Exception:
        return _erro_interno()

    if perfil is None:
        request.session.clear()
        return {"logado": False}

    return {
        "logado": True,
        "usuario": request.session.get("usuario_email"),
        "nome": request.session.get("usuario_nome"),
        "foto": perfil["foto"],
        "prefs": perfil["prefs"]
    }


@auth_bp.post("/logout")
async def logout(request: Request):
    request.session.clear()
    return {"mensagem": "Logout realizado"}


@auth_bp.post("/cadastro")
async def cadastro(request: Request):
    try:
        dados = await json_data(request)
        nome = (dados.get("nome") or "").strip()
        email = (dados.get("email") or "").strip().lower()
        senha = dados.get("senha") or ""
        aceitou_termos = dados.get("aceite_termos") is True
        aceitou_privacidade = dados.get("aceite_privacidade") is True

        if not email or not senha:
            return JSONResponse({"erro": "Dados inválidos"}, status_code=400)
        if not aceitou_termos or not aceitou_privacidade:
            return JSONResponse(
                {"erro": "É necessário aceitar os Termos de Uso e a Política de Privacidade"},
                status_code=400
            )

        erro_senha = validar_senha(senha)
        if erro_senha:
            return JSONResponse({"erro": erro_senha}, status_code=400)
        if not criar_usuario(nome, email, senha):
            return JSONResponse({"mensagem": "Usuário já existe"}, status_code=409)
        return JSONResponse({"mensagem": "Conta criada com sucesso"}, status_code=201)
    except Exception:
        return _erro_interno()


@auth_bp.post("/alterar-senha")
async def alterar_senha(request: Request):
    uid = request.session.get("usuario_id")
    if not uid:
        return _nao_autorizado()
    try:
        dados = await json_data(request)
        senha_atual = dados.get("senha_atual") or ""
        senha_nova = dados.get("senha_nova") or ""
        if not senha_atual or not senha_nova:
            return JSONResponse(
                {"status": "erro", "mensagem": "Dados inválidos"},
                status_code=400
            )

        erro_senha = validar_senha(senha_nova)
        if erro_senha:
            return JSONResponse(
                {"status": "erro", "mensagem": erro_senha},
                status_code=400
            )
        if not alterar_senha_usuario(uid, senha_atual, senha_nova):
            return JSONResponse(
                {"status": "erro", "mensagem": "Senha atual incorreta"},
                status_code=400
            )
        return {"status": "ok", "mensagem": "Senha alterada com sucesso"}
    except Exception:
        return _erro_interno("mensagem")


@auth_bp.post("/perfil/foto")
async def atualizar_foto(request: Request):
    uid = request.session.get("usuario_id")
    if not uid:
        return _nao_autorizado()
    try:
        dados = await json_data(request)
        foto = dados.get("foto", "")
        if foto and len(foto) > 400000:
            return JSONResponse(
                {"status": "erro", "mensagem": "Imagem muito grande"},
                status_code=400
            )
        salvar_foto(uid, foto)
        return {"status": "ok"}
    except Exception:
        return _erro_interno("mensagem")


@auth_bp.post("/perfil/acessibilidade")
async def salvar_acessibilidade(request: Request):
    uid = request.session.get("usuario_id")
    if not uid:
        return _nao_autorizado()
    try:
        dados = await json_data(request)
        salvar_preferencias(uid, dados.get("prefs", {}))
        return {"status": "ok"}
    except Exception:
        return _erro_interno("mensagem")


@auth_bp.post("/recuperar/solicitar")
async def recuperar_solicitar(request: Request):
    try:
        dados = await json_data(request)
        email = (dados.get("email") or "").strip().lower()
        if not email:
            return JSONResponse(
                {"status": "erro", "mensagem": "Informe o e-mail"},
                status_code=400
            )

        resposta = {
            "status": "ok",
            "mensagem": "Se o e-mail existir, enviaremos um código."
        }
        codigo = criar_codigo_recuperacao(email)
        if codigo:
            enviado = enviar_email(
                email,
                "UniSense — código de recuperação",
                "<p>Seu código para redefinir a senha é:</p>"
                f"<h2 style='letter-spacing:3px'>{codigo}</h2>"
                "<p>Ele expira em 15 minutos. Se não foi você, ignore este e-mail.</p>"
            )
            if not enviado and not email_configurado() and not USE_POSTGRES:
                resposta["codigo_dev"] = codigo
        return resposta
    except Exception:
        return _erro_interno("mensagem")


@auth_bp.post("/recuperar/confirmar")
async def recuperar_confirmar(request: Request):
    try:
        dados = await json_data(request)
        email = (dados.get("email") or "").strip().lower()
        codigo = (dados.get("codigo") or "").strip()
        senha_nova = dados.get("senha_nova") or ""
        if not email or not codigo or not senha_nova:
            return JSONResponse(
                {"status": "erro", "mensagem": "Preencha código e nova senha"},
                status_code=400
            )

        erro_senha = validar_senha(senha_nova)
        if erro_senha:
            return JSONResponse(
                {"status": "erro", "mensagem": erro_senha},
                status_code=400
            )

        erro = confirmar_recuperacao(email, codigo, senha_nova)
        if erro:
            return JSONResponse(
                {"status": "erro", "mensagem": erro},
                status_code=400
            )
        return {"status": "ok", "mensagem": "Senha redefinida. Faça login."}
    except Exception:
        return _erro_interno("mensagem")
