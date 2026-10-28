import os
import re
import time
import base64
import binascii

from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")

MODELO_IA = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
MODELO_SIMPLES = os.getenv("GEMINI_SIMPLE_MODEL", MODELO_IA)
MODELO_VISAO = os.getenv("GEMINI_VISION_MODEL", MODELO_IA)

MAX_IMAGEM_BYTES = 5 * 1024 * 1024
MAX_DATA_URL_CHARS = 7 * 1024 * 1024
MIMES_IMAGEM = {"image/jpeg", "image/png", "image/gif", "image/webp"}

client = genai.Client(api_key=API_KEY) if API_KEY else None


class IAServiceError(Exception):
    """Falha esperada ao chamar ou processar o serviço de IA."""


class IAInputError(IAServiceError):
    """Dados enviados pelo cliente não podem ser processados pela IA."""


SISTEMA_PADRAO = (
    "Você é o assistente da UniSense, uma plataforma "
    "de acessibilidade que ajuda pessoas com "
    "dificuldades auditivas, visuais e cognitivas. "
    "Responda SEMPRE em português do Brasil, de forma "
    "clara, simples e acolhedora, independentemente do "
    "idioma em que a pergunta for escrita. "
    "Só use outro idioma se o usuário pedir "
    "explicitamente (por exemplo, para traduzir algo)."
)


def responder_ia(pergunta, sistema=None, modelo=None):

    if not isinstance(pergunta, str) or not pergunta.strip():
        raise IAServiceError("Pergunta inválida.")

    if client is None:
        raise IAServiceError("Serviço de IA não configurado.")

    for tentativa in range(3):
        try:
            resposta = client.models.generate_content(
                model=modelo or MODELO_IA,
                contents=pergunta,
                config=types.GenerateContentConfig(
                    system_instruction=sistema or SISTEMA_PADRAO,
                    temperature=0.5,
                    max_output_tokens=300,
                ),
            )

            texto = resposta.text or ""
        except Exception as erro:
            if "503" not in str(erro):
                raise IAServiceError(
                    "A IA está temporariamente indisponível."
                ) from erro
            if tentativa == 2:
                raise IAServiceError(
                    "Não foi possível obter uma resposta da IA."
                ) from erro
            time.sleep(3)
            continue

        if texto.strip():
            return texto.strip()

    raise IAServiceError("Não foi possível obter uma resposta da IA.")


def _extrair_passos(texto):
    """Mantém apenas as linhas que são itens de lista (-, •, *, 1.),
    normalizando para "- ". Evita que raciocínio/explicação do modelo
    apareça para o usuário. Se não achar itens, devolve o texto limpo.
    """
    if not texto:
        return texto

    passos = []
    for linha in texto.splitlines():
        l = linha.strip()
        m = re.match(r"^(?:[-•*]|\d+[\.\)])\s+(.+)", l)
        if m and m.group(1).strip():
            passos.append("- " + m.group(1).strip())

    if passos:
        return "\n".join(passos[:5])

    return texto.strip()


def gerar_passos_ia(titulo, descricao=""):

    prompt = f"""Quebre a tarefa abaixo em 3 a 5 passos práticos.

Tarefa: {titulo}
Detalhes: {descricao if descricao else "(sem detalhes)"}

Formato OBRIGATÓRIO da resposta:
- um passo por linha, começando com "- "
- no máximo 5 linhas
- em português do Brasil
- frases curtas e fáceis de ler

Responda SOMENTE com a lista de passos. Não escreva introdução,
explicação, comentários nem o seu raciocínio — apenas as linhas com "- "."""

    return _extrair_passos(responder_ia(prompt))


def explicar_simples(texto):
    """Reescreve um texto em linguagem bem simples (acessibilidade cognitiva).

    A instrução vai no papel 'system' (e não no texto do usuário) — isso evita
    que o modelo escreva o 'raciocínio' junto da resposta.
    """
    if not texto:
        return "Nada para explicar."

    sistema = (
        "Você reescreve textos em português do Brasil de forma MUITO simples, "
        "para pessoas com dificuldade de leitura ou compreensão. "
        "Use frases curtas (uma ideia por frase), palavras comuns do dia a dia "
        "e sem termos técnicos, mantendo o mesmo sentido. "
        "Responda APENAS com o texto reescrito: sem introdução, sem comentários "
        "e sem explicar o seu raciocínio."
    )

    return responder_ia(texto, sistema=sistema, modelo=MODELO_SIMPLES)


def _decodificar_imagem(data_url):
    if not isinstance(data_url, str) or not data_url.startswith("data:"):
        raise IAInputError("Imagem inválida.")
    if len(data_url) > MAX_DATA_URL_CHARS:
        raise IAInputError("Imagem muito grande.")

    try:
        cabecalho, imagem_codificada = data_url.split(",", 1)
        partes = cabecalho.split(";")
        mime_type = partes[0][5:]
        if mime_type not in MIMES_IMAGEM or "base64" not in partes[1:]:
            raise IAInputError("Formato de imagem não suportado.")
        imagem = base64.b64decode(imagem_codificada, validate=True)
    except IAInputError:
        raise
    except (ValueError, TypeError, binascii.Error) as erro:
        raise IAInputError("Imagem inválida.") from erro

    if not imagem or len(imagem) > MAX_IMAGEM_BYTES:
        raise IAInputError("Imagem muito grande ou vazia.")

    assinaturas = {
        "image/jpeg": imagem.startswith(b"\xff\xd8\xff"),
        "image/png": imagem.startswith(b"\x89PNG\r\n\x1a\n"),
        "image/gif": imagem.startswith((b"GIF87a", b"GIF89a")),
        "image/webp": imagem.startswith(b"RIFF") and imagem[8:12] == b"WEBP",
    }
    if not assinaturas[mime_type]:
        raise IAInputError("O conteúdo não corresponde ao formato declarado.")

    return mime_type, imagem


def descrever_imagem(data_url):
    """Descreve uma imagem (acessibilidade visual). Prompt curto p/ economizar tokens."""
    if not data_url:
        raise IAInputError("Imagem inválida.")
    if client is None:
        raise IAServiceError("Serviço de IA não configurado.")

    try:
        mime_type, imagem = _decodificar_imagem(data_url)
        resposta = client.models.generate_content(
            model=MODELO_VISAO,
            contents=[
                types.Part.from_text(text="Descreva esta imagem."),
                types.Part.from_bytes(data=imagem, mime_type=mime_type),
            ],
            config=types.GenerateContentConfig(
                system_instruction=(
                    "Você descreve imagens para pessoas com deficiência visual, "
                    "em português do Brasil, em 1 a 3 frases curtas e objetivas. "
                    "Não explique seu raciocínio. "
                    'Escreva a resposta exatamente no formato: "Imagem: <descrição>".'
                ),
                temperature=0.3,
                max_output_tokens=400,
            ),
        )
        texto = resposta.text or ""
        # Pega só o que vem depois do último "Imagem:" (descarta raciocínio)
        idx = texto.rfind("Imagem:")
        if idx != -1:
            texto = texto[idx + len("Imagem:"):]
        if not texto.strip():
            raise IAServiceError("Não foi possível descrever a imagem.")
        return texto.strip()
    except IAServiceError:
        raise
    except Exception as erro:
        raise IAServiceError("Não foi possível descrever a imagem.") from erro