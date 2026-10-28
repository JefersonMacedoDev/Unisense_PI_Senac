import os
import subprocess


def limpar_tela():
    comando = ["cmd", "/c", "cls"] if os.name == "nt" else ["clear"]
    subprocess.run(comando, check=True)


def exibir_cabecalho(titulo):

    limpar_tela()

    print("\n" + "=" * 60)

    print(titulo.center(60))

    print("=" * 60 + "\n")


def pausar():

    input("\nPressione ENTER para continuar...")