import os

from dotenv import load_dotenv
from google import genai

load_dotenv()


client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))


try:

    modelos = client.models.list()

    print("\n=== MODELOS DISPONÍVEIS ===\n")

    for modelo in modelos:

        print(modelo.name)

except Exception as erro:

    print(f"\nErro ao listar modelos: {erro}\n")