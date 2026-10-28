def iniciar_terminal():

    while True:

        print("\n=== UniSense CLI ===")

        print("1 - Login")
        print("2 - Cadastro")
        print("3 - Sair")

        opcao = input("\nEscolha: ")

        if opcao == "1":
            input("Email: ")
            input("Senha: ")
            print("\nLogin enviado.")

        elif opcao == "2":
            input("Novo email: ")
            input("Nova senha: ")
            print("\nCadastro enviado.")

        elif opcao == "3":

            print("\nSaindo...")

            break

        else:

            print("\nOpção inválida.")