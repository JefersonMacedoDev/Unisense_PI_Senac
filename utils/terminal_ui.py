import os


def limpar_tela():

    os.system(
        "cls" if os.name == "nt"
        else "clear"
    )


def exibir_cabecalho(titulo):

    limpar_tela()

    print("\n" + "=" * 60)

    print(titulo.center(60))

    print("=" * 60 + "\n")


def pausar():

    input("\nPressione ENTER para continuar...")