import os
import requests

BREVO_API_KEY = os.getenv("BREVO_API_KEY")
# E-mail remetente verificado no Brevo (ex.: seu e-mail). Pode vir do .env.
BREVO_REMETENTE = os.getenv("BREVO_REMETENTE", "nao-responda@unisense.com")


def email_configurado():
    return bool(BREVO_API_KEY)


def enviar_email(destino, assunto, html):
    """Envia um e-mail transacional pela API do Brevo. Retorna True/False."""
    if not BREVO_API_KEY:
        return False
    try:
        r = requests.post(
            "https://api.brevo.com/v3/smtp/email",
            headers={"api-key": BREVO_API_KEY, "Content-Type": "application/json"},
            json={
                "sender": {"name": "UniSense", "email": BREVO_REMETENTE},
                "to": [{"email": destino}],
                "subject": assunto,
                "htmlContent": html,
            },
            timeout=20,
        )
        return r.status_code in (200, 201)
    except Exception:
        return False
