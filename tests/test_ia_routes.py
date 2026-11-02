import unittest
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import select

from backend.app import app
from backend.database import SessionLocal
from backend.models import Historico, Usuario
from backend.services import ia_service
from backend.services.ia_service import IAInputError, IAServiceError


class TestIAService(unittest.TestCase):
    def test_responder_ia_tenta_novamente_apos_503(self):
        resposta = SimpleNamespace(text="Resposta simulada")
        with patch("backend.services.ia_service.client") as client, \
             patch("backend.services.ia_service.time.sleep") as dormir:
            client.models.generate_content.side_effect = [
                Exception("503 Service Unavailable"),
                resposta,
            ]

            resultado = ia_service.responder_ia("Pergunta de teste")

        self.assertEqual(resultado, "Resposta simulada")
        self.assertEqual(client.models.generate_content.call_count, 2)
        dormir.assert_called_once_with(0.5)

    def test_responder_ia_falha_apos_duas_tentativas_503(self):
        with patch("backend.services.ia_service.client") as client, \
             patch("backend.services.ia_service.time.sleep") as dormir:
            client.models.generate_content.side_effect = Exception(
                "503 Service Unavailable"
            )

            with self.assertRaisesRegex(
                IAServiceError,
                "A IA está temporariamente indisponível.",
            ):
                ia_service.responder_ia("Pergunta de teste")

        self.assertEqual(client.models.generate_content.call_count, 2)
        dormir.assert_called_once_with(0.5)

    def test_responder_ia_falha_apos_duas_respostas_vazias(self):
        resposta = SimpleNamespace(text="  ")
        with patch("backend.services.ia_service.client") as client:
            client.models.generate_content.return_value = resposta

            with self.assertRaisesRegex(
                IAServiceError,
                "Não foi possível obter uma resposta da IA.",
            ):
                ia_service.responder_ia("Pergunta de teste")

        self.assertEqual(client.models.generate_content.call_count, 2)

    def test_responder_ia_nao_repete_erro_nao_temporario(self):
        with patch("backend.services.ia_service.client") as client, \
             patch("backend.services.ia_service.time.sleep") as dormir:
            client.models.generate_content.side_effect = Exception("404 NOT_FOUND")

            with self.assertRaisesRegex(
                IAServiceError,
                "A IA está temporariamente indisponível.",
            ):
                ia_service.responder_ia("Pergunta de teste")

        client.models.generate_content.assert_called_once()
        dormir.assert_not_called()

    def test_responder_ia_inclui_contexto_recente(self):
        with patch("backend.services.ia_service.client") as client:
            client.models.generate_content.return_value = SimpleNamespace(
                text="Resposta contextual"
            )

            resultado = ia_service.responder_ia(
                "E o segundo passo?",
                historico=[{
                    "pergunta": "Como começo?",
                    "resposta": "Comece pelo planejamento.",
                }],
            )

        self.assertEqual(resultado, "Resposta contextual")
        conteudos = client.models.generate_content.call_args.kwargs["contents"]
        self.assertEqual(
            [conteudo.parts[0].text for conteudo in conteudos],
            ["Como começo?", "Comece pelo planejamento.", "E o segundo passo?"],
        )


class TestIARoutes(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.email = f"teste-ia-{uuid4().hex}@example.com"
        cls.client = TestClient(app)
        resposta = cls.client.post(
            "/cadastro",
            json={
                "nome": "Teste IA",
                "email": cls.email,
                "senha": "SenhaForte!1",
                "aceite_termos": True,
                "aceite_privacidade": True,
            },
        )
        if resposta.status_code != 201:
            raise AssertionError(f"Não foi possível criar usuário de teste: {resposta.text}")

        resposta = cls.client.post(
            "/login",
            json={"email": cls.email, "senha": "SenhaForte!1"},
        )
        if resposta.status_code != 200:
            raise AssertionError(f"Não foi possível autenticar usuário de teste: {resposta.text}")

    @classmethod
    def tearDownClass(cls):
        banco = SessionLocal()
        usuario = banco.scalar(select(Usuario).where(Usuario.email == cls.email))
        if usuario:
            banco.query(Historico).filter(Historico.usuario_id == usuario.id).delete()
            banco.delete(usuario)
            banco.commit()
        banco.close()

    def test_ia_retorna_resposta_e_registra_historico(self):
        with patch("backend.routes.ia_routes.buscar_contexto", return_value=[]) as contexto, \
             patch("backend.routes.ia_routes.responder_ia", return_value="Resposta simulada") as responder, \
             patch("backend.routes.ia_routes.registrar_mensagem") as registrar:
            resposta = self.client.post("/ia", json={"pergunta": "Como estudar?"})

        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(resposta.json(), {"status": "ok", "resposta": "Resposta simulada"})
        contexto.assert_called_once()
        responder.assert_called_once_with("Como estudar?", historico=[])
        args = registrar.call_args.args
        self.assertEqual(len(args), 3)
        self.assertIsInstance(args[0], int)
        self.assertEqual(args[1:], ("Como estudar?", "Resposta simulada"))

    def test_ia_retorna_503_quando_servico_falha(self):
        with patch(
            "backend.routes.ia_routes.responder_ia",
            side_effect=IAServiceError("IA indisponível"),
        ):
            resposta = self.client.post("/ia", json={"pergunta": "Teste"})

        self.assertEqual(resposta.status_code, 503)
        self.assertEqual(resposta.json()["status"], "erro")
        self.assertEqual(resposta.json()["mensagem"], "IA indisponível")

    def test_simplificacao_retorna_texto(self):
        with patch(
            "backend.routes.ia_routes.explicar_simples",
            return_value="Texto simplificado",
        ) as simplificar:
            resposta = self.client.post(
                "/ia/simplificar",
                json={"texto": "Um texto complexo."},
            )

        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(
            resposta.json(),
            {"status": "ok", "resposta": "Texto simplificado"},
        )
        simplificar.assert_called_once_with("Um texto complexo.")

    def test_simplificacao_rejeita_texto_vazio(self):
        resposta = self.client.post("/ia/simplificar", json={"texto": "  "})

        self.assertEqual(resposta.status_code, 400)
        self.assertEqual(resposta.json()["mensagem"], "Texto inválido")

    def test_descricao_de_imagem_retorna_descricao(self):
        with patch(
            "backend.routes.ia_routes.descrever_imagem",
            return_value="Imagem: uma pessoa estudando.",
        ) as descrever:
            resposta = self.client.post(
                "/ia/descrever-imagem",
                json={"imagem": "data:image/png;base64,imagem-teste"},
            )

        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(
            resposta.json(),
            {"status": "ok", "resposta": "Imagem: uma pessoa estudando."},
        )
        descrever.assert_called_once_with("data:image/png;base64,imagem-teste")

    def test_descricao_rejeita_imagem_invalida(self):
        with patch(
            "backend.routes.ia_routes.descrever_imagem",
            side_effect=IAInputError("Imagem inválida."),
        ):
            resposta = self.client.post(
                "/ia/descrever-imagem",
                json={"imagem": "data:image/png;base64,invalida"},
            )

        self.assertEqual(resposta.status_code, 400)
        self.assertEqual(resposta.json()["mensagem"], "Imagem inválida.")

    def test_rotas_rejeitam_usuario_nao_autenticado(self):
        cliente = TestClient(app)
        for caminho, corpo in (
            ("/ia", {"pergunta": "Teste"}),
            ("/ia/simplificar", {"texto": "Teste"}),
            ("/ia/descrever-imagem", {"imagem": "Teste"}),
        ):
            with self.subTest(caminho=caminho):
                resposta = cliente.post(caminho, json=corpo)
                self.assertEqual(resposta.status_code, 401)


if __name__ == "__main__":
    unittest.main()
