from backend.database import init_db


# O app já cria as tabelas sozinho ao subir (init_db em create_app).
# Este script existe para criar o banco manualmente, se precisar.
init_db()

print("Banco criado com sucesso.")
