import json
import re
import secrets
from contextlib import contextmanager
from datetime import datetime, timedelta

from sqlalchemy import select
from werkzeug.security import check_password_hash, generate_password_hash

from backend.database import SessionLocal
from backend.models import Usuario


@contextmanager
def _banco():
    banco = SessionLocal()
    try:
        yield banco
    except Exception:
        banco.rollback()
        raise
    finally:
        banco.close()


def _parse_prefs(valor):
    if not valor:
        return None
    try:
        return json.loads(valor)
    except (TypeError, ValueError):
        return None


def senha_confere(senha_banco, senha_informada):
    """Aceita hashes e senhas legadas em texto puro durante a migração."""
    try:
        senha_valida = check_password_hash(senha_banco, senha_informada)
    except (TypeError, ValueError):
        senha_valida = False
    return senha_valida or senha_banco == senha_informada


def validar_senha(senha):
    if len(senha) < 8:
        return "A senha deve ter ao menos 8 caracteres"
    if not re.search(r"[A-Z]", senha):
        return "A senha deve conter ao menos 1 letra maiúscula"
    if not re.search(r"[^A-Za-z0-9]", senha):
        return "A senha deve conter ao menos 1 caractere especial"
    return None


def _usuario_publico(usuario):
    return {
        "id": usuario.id,
        "nome": usuario.nome,
        "email": usuario.email,
        "foto": usuario.foto,
        "prefs": _parse_prefs(usuario.prefs_a11y)
    }


def autenticar(email, senha):
    with _banco() as banco:
        usuario = banco.scalar(select(Usuario).where(Usuario.email == email))
    if not usuario or not senha_confere(usuario.senha, senha):
        return None
    return _usuario_publico(usuario)


def dados_do_usuario(usuario_id):
    with _banco() as banco:
        usuario = banco.get(Usuario, usuario_id)
    if not usuario:
        return None
    return {"foto": usuario.foto, "prefs": _parse_prefs(usuario.prefs_a11y)}


def criar_usuario(nome, email, senha):
    with _banco() as banco:
        if banco.scalar(select(Usuario).where(Usuario.email == email)):
            return False
        banco.add(Usuario(
            nome=nome,
            email=email,
            senha=generate_password_hash(senha)
        ))
        banco.commit()
    return True


def alterar_senha(usuario_id, senha_atual, senha_nova):
    with _banco() as banco:
        usuario = banco.get(Usuario, usuario_id)
        if not usuario or not senha_confere(usuario.senha, senha_atual):
            return False
        usuario.senha = generate_password_hash(senha_nova)
        banco.commit()
    return True


def atualizar_foto(usuario_id, foto):
    with _banco() as banco:
        usuario = banco.get(Usuario, usuario_id)
        if usuario:
            usuario.foto = foto or None
            banco.commit()


def salvar_preferencias(usuario_id, preferencias):
    with _banco() as banco:
        usuario = banco.get(Usuario, usuario_id)
        if usuario:
            usuario.prefs_a11y = json.dumps(preferencias)
            banco.commit()


def criar_codigo_recuperacao(email):
    with _banco() as banco:
        usuario = banco.scalar(select(Usuario).where(Usuario.email == email))
        if not usuario:
            return None
        codigo = "%06d" % secrets.randbelow(1000000)
        usuario.reset_codigo = codigo
        usuario.reset_expira = datetime.utcnow() + timedelta(minutes=15)
        banco.commit()
    return codigo


def confirmar_recuperacao(email, codigo, senha_nova):
    with _banco() as banco:
        usuario = banco.scalar(select(Usuario).where(Usuario.email == email))
        if not usuario or not usuario.reset_codigo:
            return "Solicite um novo código."
        if usuario.reset_codigo != codigo:
            return "Código incorreto."
        if not usuario.reset_expira or datetime.utcnow() > usuario.reset_expira:
            return "Código expirado. Solicite um novo."

        usuario.senha = generate_password_hash(senha_nova)
        usuario.reset_codigo = None
        usuario.reset_expira = None
        banco.commit()
    return None
