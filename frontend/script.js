/* =====================================================
   UniSense — script.js
   SPA ligada ao backend Flask real (mesma origem).
   Login/cadastro/IA/histórico usam sessão (cookie).
   ===================================================== */

// Mesma origem: o Flask serve o frontend e a API juntos.
const API = ""

// Dados do usuário logado (preenchidos após /me ou login)
let EMAIL = null
let NOME = null
let FOTO = null  // emoji, data URL (imagem) ou null (usa a inicial)


/* ── Helpers de UI ──────────────────────────────────── */
function mostrarErro(el, msg) { el.textContent = msg; el.style.display = "block" }

function validarSenha(senha) {
  if (senha.length < 8) return "A senha deve ter ao menos 8 caracteres."
  if (!/[A-Z]/.test(senha)) return "A senha deve conter ao menos 1 letra maiúscula."
  if (!/[^A-Za-z0-9]/.test(senha)) return "A senha deve conter ao menos 1 caractere especial."
  return ""
}

function validarSenhaAoDigitar() {
  const senha = document.getElementById("login-senha")?.value || ""
  const requisitos = document.getElementById("password-requirements")
  if (!requisitos) return
  const regras = {
    "req-length": senha.length >= 8,
    "req-upper": /[A-Z]/.test(senha),
    "req-special": /[^A-Za-z0-9]/.test(senha)
  }
  Object.entries(regras).forEach(([id, valido]) => {
    const item = document.getElementById(id)
    if (!item) return
    item.classList.toggle("valid", valido)
    item.textContent = (valido ? "✔" : "✖") + " " + item.dataset.texto
  })
}

function mostrarScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"))
  document.getElementById(id).classList.add("active")
}

function getNome() {
  if (NOME) return NOME
  if (EMAIL) return EMAIL.split("@")[0]
  return "Usuário"
}


/* ── Modais ─────────────────────────────────────────── */
let _ultimoFoco = null

function abrirModal(id) {
  _ultimoFoco = document.activeElement
  const m = document.getElementById(id)
  m.classList.add("open")

  // ARIA: marca como diálogo e rotula pelo título (para leitores de tela)
  const box = m.querySelector(".modal-box")
  if (box) {
    box.setAttribute("role", "dialog")
    box.setAttribute("aria-modal", "true")
    const h = box.querySelector("h2")
    if (h) box.setAttribute("aria-label", h.textContent.trim())
  }

  // Move o foco para dentro do modal (teclado/leitor de tela)
  const alvo = m.querySelector("button, [href], input, select, textarea")
  if (alvo) setTimeout(() => alvo.focus(), 50)
}

const SINAIS_LIBRAS = [
  { palavra: "Olá", descricao: "Saudação usada para cumprimentar alguém." },
  { palavra: "Obrigado", descricao: "Forma de agradecer a outra pessoa." },
  { palavra: "Por favor", descricao: "Expressão usada ao fazer um pedido com educação." },
  { palavra: "Família", descricao: "Sinal relacionado a pessoas da mesma família." },
  { palavra: "Amigo", descricao: "Pessoa com quem você tem amizade." },
  { palavra: "Escola", descricao: "Lugar onde as pessoas estudam e aprendem." },
  { palavra: "Água", descricao: "Substância essencial para a vida e para beber." },
  { palavra: "Amor", descricao: "Sentimento de carinho e afeto por alguém." }
]

function abrirDicionarioLibras() {
  abrirModal("modal-dicionario-libras")
  filtrarSinaisLibras()
  setTimeout(() => document.getElementById("busca-libras")?.focus(), 60)
}

function filtrarSinaisLibras() {
  const busca = (document.getElementById("busca-libras")?.value || "")
    .toLocaleLowerCase("pt-BR")
  const encontrados = SINAIS_LIBRAS.filter(sinal =>
    sinal.palavra.toLocaleLowerCase("pt-BR").includes(busca)
  )
  const lista = document.getElementById("sinais-libras")
  const vazio = document.getElementById("sinais-libras-vazio")
  if (!lista || !vazio) return

  lista.innerHTML = encontrados.map(sinal => `
    <article class="sinal-card">
      <div class="sinal-icone" aria-hidden="true">🤟</div>
      <div>
        <h3>${escHtml(sinal.palavra)}</h3>
        <p>${escHtml(sinal.descricao)}</p>
        <a href="https://www.ines.gov.br/dicionario-de-libras/" target="_blank" rel="noopener">
          Ver referência visual →
        </a>
      </div>
    </article>`).join("")
  vazio.style.display = encontrados.length ? "none" : "block"
}

function fecharModal(id) {
  document.getElementById(id).classList.remove("open")
  document.querySelectorAll("#" + id + " .error-msg, #" + id + " .success-msg")
    .forEach(el => el.style.display = "none")
  // Devolve o foco para o elemento que abriu o modal
  if (_ultimoFoco && _ultimoFoco.focus) _ultimoFoco.focus()
}

function iniciarMaterial(materialId) {
  if (progressoDe(materialId)) return
  registrarProgressoMaterial(materialId, "iniciado")
}

async function registrarProgressoMaterial(materialId, status) {
  try {
    const resp = await fetch(API + "/curso/progresso", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ curso_id: materialId, status })
    })
    if (!resp.ok) return
    const atual = progressoDe(materialId)
    if (atual) atual.status = status
    else CURSOS_PROGRESSO.push({ curso_id: materialId, status, pontuacao: 0 })
  } catch {}
}

// Esc fecha o modal aberto
document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    const aberto = document.querySelector(".modal-overlay.open")
    if (aberto) fecharModal(aberto.id)
  }
})
function abrirCadastro()      { abrirModal("modal-cadastro") }
function abrirRecuperacao()   { abrirModal("modal-recuperacao") }
function abrirAlterarSenha()  { abrirModal("modal-senha") }

// Fecha o modal ao clicar fora dele
document.addEventListener("click", e => {
  if (e.target.classList.contains("modal-overlay")) fecharModal(e.target.id)
})


/* ── Autenticação (backend real) ────────────────────── */
async function fazerLogin() {
  const email = document.getElementById("login-email").value.trim()
  const senha = document.getElementById("login-senha").value.trim()
  const erro  = document.getElementById("login-erro")

  if (!email || !senha) { mostrarErro(erro, "Preencha e-mail e senha."); return }

  try {
    const resp = await fetch(API + "/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, senha })
    })
    const dados = await resp.json()

    if (resp.ok && dados.status === "ok") {
      erro.style.display = "none"
      if (!localStorage.getItem("us_desde")) {
        localStorage.setItem("us_desde", new Date().toLocaleDateString("pt-BR"))
      }
      entrarApp(email, dados.nome, dados.foto, dados.prefs)
    } else {
      mostrarErro(erro, dados.mensagem || "E-mail ou senha inválidos.")
    }
  } catch {
    mostrarErro(erro, "Erro ao conectar com o servidor.")
  }
}

async function fazerCadastro() {
  const nome  = document.getElementById("cad-nome").value.trim()
  const email = document.getElementById("cad-email").value.trim()
  const senha = document.getElementById("cad-senha").value.trim()
  const aceitouTermos = document.getElementById("cad-aceite-termos").checked
  const erro  = document.getElementById("cad-erro")
  const ok    = document.getElementById("cad-ok")

  ok.style.display = "none"
  if (!nome || !email || !senha) { mostrarErro(erro, "Preencha todos os campos."); return }
  if (!aceitouTermos) {
    mostrarErro(erro, "Leia e aceite os Termos de Uso e a Política de Privacidade.")
    return
  }
  const erroSenha = validarSenha(senha)
  if (erroSenha) { mostrarErro(erro, erroSenha); return }

  try {
    const resp = await fetch(API + "/cadastro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome,
        email,
        senha,
        aceite_termos: true,
        aceite_privacidade: true
      })
    })
    const dados = await resp.json()

    if (resp.status === 201) {
      erro.style.display = "none"
      ok.style.display = "block"
      // Já adianta o e-mail no login
      document.getElementById("login-email").value = email
      setTimeout(() => fecharModal("modal-cadastro"), 1500)
    } else {
      mostrarErro(erro, dados.mensagem || dados.erro || "Não foi possível criar a conta.")
    }
  } catch {
    mostrarErro(erro, "Erro ao conectar com o servidor.")
  }
}

// Passo 1: solicita o código por e-mail
async function solicitarCodigo() {
  const email = document.getElementById("rec-email").value.trim()
  const erro = document.getElementById("rec-erro")
  const info = document.getElementById("rec-info")
  erro.style.display = "none"; info.textContent = ""
  if (!email) { mostrarErro(erro, "Informe o e-mail."); return }
  try {
    const resp = await fetch(API + "/recuperar/solicitar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    })
    const dados = await resp.json()
    if (dados.codigo_dev) {  // ambiente de teste (sem e-mail configurado)
      document.getElementById("rec-codigo").value = dados.codigo_dev
      info.textContent = "Modo teste: código preenchido (" + dados.codigo_dev + ")."
    } else {
      info.textContent = "Se o e-mail existir, enviamos um código. Verifique sua caixa de entrada."
    }
  } catch {
    mostrarErro(erro, "Erro ao enviar o código.")
  }
}

// Passo 2: confirma o código e redefine a senha
async function fazerRecuperacao() {
  const email = document.getElementById("rec-email").value.trim()
  const codigo = document.getElementById("rec-codigo").value.trim()
  const senha = document.getElementById("rec-senha").value.trim()
  const erro = document.getElementById("rec-erro")
  const ok = document.getElementById("rec-ok")

  ok.style.display = "none"
  if (!email || !codigo || !senha) { mostrarErro(erro, "Preencha e-mail, código e nova senha."); return }
  const erroSenha = validarSenha(senha)
  if (erroSenha) { mostrarErro(erro, erroSenha); return }

  try {
    const resp = await fetch(API + "/recuperar/confirmar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, codigo, senha_nova: senha })
    })
    const dados = await resp.json()

    if (resp.ok && dados.status === "ok") {
      erro.style.display = "none"
      ok.style.display = "block"
      document.getElementById("login-email").value = email
      setTimeout(() => { ok.style.display = "none"; fecharModal("modal-recuperacao") }, 1800)
    } else {
      mostrarErro(erro, dados.mensagem || "Não foi possível redefinir a senha.")
    }
  } catch {
    mostrarErro(erro, "Erro ao conectar com o servidor.")
  }
}

async function alterarSenha() {
  const atual = document.getElementById("senha-atual").value
  const nova  = document.getElementById("senha-nova").value
  const erro  = document.getElementById("senha-erro")
  const ok    = document.getElementById("senha-ok")

  ok.style.display = "none"
  if (!atual || !nova) { mostrarErro(erro, "Preencha as duas senhas."); return }
  const erroSenha = validarSenha(nova)
  if (erroSenha) { mostrarErro(erro, erroSenha); return }

  try {
    const resp = await fetch(API + "/alterar-senha", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ senha_atual: atual, senha_nova: nova })
    })
    const dados = await resp.json()

    if (resp.ok && dados.status === "ok") {
      erro.style.display = "none"
      ok.style.display = "block"
      document.getElementById("senha-atual").value = ""
      document.getElementById("senha-nova").value = ""
      setTimeout(() => fecharModal("modal-senha"), 1500)
    } else {
      mostrarErro(erro, dados.mensagem || "Não foi possível alterar a senha.")
    }
  } catch {
    mostrarErro(erro, "Erro ao conectar com o servidor.")
  }
}

async function sair() {
  try { await fetch(API + "/logout", { method: "POST", credentials: "include" }) } catch {}
  EMAIL = null
  NOME = null
  FOTO = null
  resetarA11yVisual()   // volta a acessibilidade ao padrão na tela de login (conta intacta)
  localStorage.removeItem("us_usuario")
  document.getElementById("login-email").value = ""
  document.getElementById("login-senha").value = ""
  mostrarScreen("screen-login")
}


/* ── Entrada no app (após login / sessão ativa) ─────── */
function entrarApp(email, nome, foto, prefs) {
  EMAIL = email
  NOME = nome || null
  FOTO = foto || null
  localStorage.setItem("us_usuario", email)
  mostrarScreen("screen-app")
  renderCursosCards()
  navegar("dashboard")
  document.getElementById("dash-usuario").textContent = "Olá, " + getNome() + "! 👋"
  carregarHistorico()
  carregarProgressoCursos()

  // Perfil de acessibilidade: aplica o que está salvo, ou abre o onboarding na 1ª vez
  if (prefs === null || prefs === undefined) {
    abrirModal("modal-onboarding")
  } else {
    aplicarPrefs(prefs)
  }
}


/* ── Navegação SPA ──────────────────────────────────── */
function navegar(pagina) {
  ["dashboard", "estudos", "cursos", "perfil"].forEach(p => {
    const el = document.getElementById("page-" + p)
    if (el) el.style.display = (p === pagina) ? "" : "none"
    const nav = document.getElementById("nav-" + p)
    if (nav) nav.classList.toggle("active", p === pagina)
    const mnav = document.getElementById("mnav-" + p)
    if (mnav) mnav.classList.toggle("active", p === pagina)
  })
  if (pagina === "perfil") preencherPerfil()
  if (pagina === "cursos") voltarCursos()
}

function preencherPerfil() {
  const nome = getNome()
  aplicarAvatar(FOTO)
  document.getElementById("perfil-nome").textContent = nome
  document.getElementById("perfil-email").textContent = EMAIL || ""
  document.getElementById("cursos-count").textContent =
    CURSOS_PROGRESSO.filter(p => p.status === "concluido").length
  document.getElementById("membro-desde").textContent =
    localStorage.getItem("us_desde") || "—"
  renderConquistas()
}


/* ── Gamificação: conquistas + certificado ──────────── */
const BADGES = [
  { min: 1, emoji: "🌱", nome: "Primeiros passos" },
  { min: 2, emoji: "⭐", nome: "No caminho" },
  { min: 3, emoji: "🚀", nome: "Quase lá" },
  { min: 4, emoji: "🏆", nome: "Mestre da acessibilidade" }
]

function renderConquistas() {
  const total = Object.keys(CURSOS).length
  const concluidos = CURSOS_PROGRESSO.filter(p => p.status === "concluido").length

  const cont = document.getElementById("conq-contagem")
  if (cont) cont.textContent = concluidos + " de " + total
  const fill = document.getElementById("conq-fill")
  if (fill) fill.style.width = Math.round((concluidos / total) * 100) + "%"

  const grid = document.getElementById("badges")
  if (grid) {
    grid.innerHTML = BADGES.map(b => {
      const earned = concluidos >= b.min
      const titulo = earned ? "Conquistado!" : ("Conclua " + b.min + " curso(s)")
      return `<div class="badge ${earned ? "" : "locked"}" title="${titulo}">
        <span class="badge-emoji">${b.emoji}</span><span>${b.nome}</span></div>`
    }).join("")
  }

  const btn = document.getElementById("btn-cert")
  const hint = document.getElementById("cert-hint")
  if (btn && hint) {
    if (concluidos >= total) {
      btn.disabled = false
      hint.textContent = ""
    } else {
      btn.disabled = true
      hint.textContent = "Conclua todos os " + total + " cursos para emitir o certificado."
    }
  }
}

function emitirCertificado() {
  const concluidos = CURSOS_PROGRESSO.filter(p => p.status === "concluido")
  if (concluidos.length < Object.keys(CURSOS).length) return

  document.getElementById("cert-nome").textContent = getNome()
  const titulos = concluidos.map(p => (CURSOS[p.curso_id] && CURSOS[p.curso_id].titulo) || p.curso_id)
  document.getElementById("cert-cursos").innerHTML =
    titulos.map(t => `<li>${escHtml(t)}</li>`).join("")
  document.getElementById("cert-data").textContent =
    "Emitido em " + new Date().toLocaleDateString("pt-BR")

  abrirModal("modal-certificado")
}


/* ── Foto de perfil (emoji / imagem) ────────────────── */

// Lista de emojis disponíveis (rostos, pessoas, animais e alguns símbolos)
const EMOJIS = [
  "😀","😃","😄","😁","😆","😊","🙂","😉","😍","😎","🤓","🧐",
  "🤩","🥳","😇","🤗","🙃","😺","😅","🤔","😴","🤠","🥰","😜",
  "🐶","🐱","🦊","🐼","🐨","🦁","🐯","🐸","🐵","🦉","🦄","🐲",
  "🌟","🚀","🎧","👓","♿","🦮","💡","🎓","❤️","🔥","🌈","⚡"
]

function renderEmojis() {
  const grid = document.getElementById("emoji-grid")
  if (!grid) return
  grid.innerHTML = EMOJIS
    .map(e => `<button type="button" onclick="selecionarEmoji('${e}')">${e}</button>`)
    .join("")
}

// Aplica a foto no avatar do perfil: imagem (data URL), emoji ou inicial do nome
function aplicarAvatar(foto) {
  const av = document.getElementById("avatar-letra")
  if (!av) return

  if (foto && foto.startsWith("data:")) {
    av.textContent = ""
    av.style.backgroundImage = `url('${foto}')`
    av.style.backgroundSize = "cover"
    av.style.backgroundPosition = "center"
  } else if (foto) {
    av.style.backgroundImage = ""
    av.textContent = foto  // emoji
  } else {
    av.style.backgroundImage = ""
    av.textContent = (getNome()[0] || "?").toUpperCase()
  }
}

async function salvarFoto(foto) {
  FOTO = foto || null
  aplicarAvatar(FOTO)
  try {
    await fetch(API + "/perfil/foto", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ foto: foto || "" })
    })
  } catch {}
}

function selecionarEmoji(emoji) {
  salvarFoto(emoji)
  fecharModal("modal-foto")
}

function usarInicial() {
  salvarFoto("")   // string vazia -> volta para a inicial do nome
  fecharModal("modal-foto")
}

function carregarImagem(event) {
  const erro = document.getElementById("foto-erro")
  erro.style.display = "none"

  const file = event.target.files[0]
  if (!file) return
  if (!file.type.startsWith("image/")) {
    mostrarErro(erro, "Selecione um arquivo de imagem.")
    return
  }

  const reader = new FileReader()
  reader.onload = e => {
    const img = new Image()
    img.onload = () => abrirCrop(img)   // abre a tela de ajuste (zoom/recorte)
    img.onerror = () => mostrarErro(erro, "Não foi possível ler a imagem.")
    img.src = e.target.result
  }
  reader.readAsDataURL(file)

  // permite reenviar o mesmo arquivo depois
  event.target.value = ""
}


/* ── Ajuste de foto (zoom + recorte) ────────────────── */
const CROP = {
  img: null, base: 1, scale: 1, zoom: 1, ox: 0, oy: 0,
  V: 260, O: 128,               // tamanho do preview e da saída
  drag: false, sx: 0, sy: 0, sox: 0, soy: 0
}

function abrirCrop(img) {
  CROP.img = img
  // escala "cover": a imagem preenche todo o círculo no zoom 1
  CROP.base = Math.max(CROP.V / img.width, CROP.V / img.height)
  CROP.zoom = 1
  CROP.scale = CROP.base
  CROP.ox = (CROP.V - img.width * CROP.scale) / 2
  CROP.oy = (CROP.V - img.height * CROP.scale) / 2

  document.getElementById("crop-zoom").value = 1
  fecharModal("modal-foto")
  abrirModal("modal-crop")
  desenharCrop()
}

function clampCrop() {
  const w = CROP.img.width * CROP.scale
  const h = CROP.img.height * CROP.scale
  CROP.ox = Math.min(0, Math.max(CROP.V - w, CROP.ox))
  CROP.oy = Math.min(0, Math.max(CROP.V - h, CROP.oy))
}

function desenharCrop() {
  if (!CROP.img) return
  clampCrop()
  const c = document.getElementById("crop-canvas")
  const ctx = c.getContext("2d")
  ctx.clearRect(0, 0, CROP.V, CROP.V)
  ctx.drawImage(
    CROP.img,
    CROP.ox, CROP.oy,
    CROP.img.width * CROP.scale, CROP.img.height * CROP.scale
  )
}

// Liga os controles do cropper uma única vez
function setupCrop() {
  const c = document.getElementById("crop-canvas")
  if (!c) return
  const zoom = document.getElementById("crop-zoom")

  zoom.addEventListener("input", () => {
    const cx = CROP.V / 2, cy = CROP.V / 2
    // mantém o ponto central fixo ao dar zoom
    const imgX = (cx - CROP.ox) / CROP.scale
    const imgY = (cy - CROP.oy) / CROP.scale
    CROP.zoom = parseFloat(zoom.value)
    CROP.scale = CROP.base * CROP.zoom
    CROP.ox = cx - imgX * CROP.scale
    CROP.oy = cy - imgY * CROP.scale
    desenharCrop()
  })

  c.addEventListener("pointerdown", e => {
    CROP.drag = true
    CROP.sx = e.clientX; CROP.sy = e.clientY
    CROP.sox = CROP.ox; CROP.soy = CROP.oy
    c.setPointerCapture(e.pointerId)
  })
  c.addEventListener("pointermove", e => {
    if (!CROP.drag) return
    CROP.ox = CROP.sox + (e.clientX - CROP.sx)
    CROP.oy = CROP.soy + (e.clientY - CROP.sy)
    desenharCrop()
  })
  const fim = () => { CROP.drag = false }
  c.addEventListener("pointerup", fim)
  c.addEventListener("pointercancel", fim)
  c.addEventListener("pointerleave", fim)
}

function cancelarCrop() {
  fecharModal("modal-crop")
  CROP.img = null
  abrirModal("modal-foto")   // volta para a escolha de emoji/imagem
}

function aplicarCrop() {
  if (!CROP.img) return
  const k = CROP.O / CROP.V   // converte a visão (260) para a saída (128)
  const out = document.createElement("canvas")
  out.width = CROP.O
  out.height = CROP.O
  const octx = out.getContext("2d")
  octx.drawImage(
    CROP.img,
    CROP.ox * k, CROP.oy * k,
    CROP.img.width * CROP.scale * k, CROP.img.height * CROP.scale * k
  )
  const dataUrl = out.toDataURL("image/jpeg", 0.85)
  fecharModal("modal-crop")
  CROP.img = null
  salvarFoto(dataUrl)
}


/* ── Foco Diário (tarefas) ──────────────────────────── */
let TAREFAS = []
let EDIT_TAREFA_ID = null

function escHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

async function abrirTarefas() {
  cancelarFormTarefa()
  abrirModal("modal-tarefas")
  await carregarTarefas()
}

async function carregarTarefas() {
  const cont = document.getElementById("tarefas-lista")
  cont.innerHTML = '<div class="tarefas-vazio">Carregando…</div>'
  try {
    const resp = await fetch(API + "/task", { credentials: "include" })
    const dados = await resp.json()
    TAREFAS = (dados.status === "ok" && dados.tarefas) ? dados.tarefas : []
  } catch {
    TAREFAS = []
  }
  renderTarefas()
}

function renderTarefas() {
  const cont = document.getElementById("tarefas-lista")
  if (!TAREFAS.length) {
    cont.innerHTML = '<div class="tarefas-vazio">Nenhuma tarefa ainda. Clique em “➕ Criar tarefa”.</div>'
    return
  }
  cont.innerHTML = TAREFAS.map(t => {
    const concl = t.status === "concluida"
    return `
      <div class="tarefa-item ${concl ? "concluida" : ""}" data-id="${t.id}">
        <div class="tarefa-top">
          <span class="tarefa-titulo">${escHtml(t.titulo)}</span>
          <div class="tarefa-top-dir">
            <button class="tarefa-status ${concl ? "on" : ""}" onclick="concluirTarefa(${t.id})"
              title="${concl ? "Concluída — clique para reabrir" : "Pendente — clique para concluir"}">
              ${concl ? "✅ Concluída" : "⏳ Pendente"}
            </button>
            ${t.descricao ? `<button class="tarefa-expandir" onclick="toggleDetalhe(${t.id})">expandir</button>` : ""}
          </div>
        </div>
        ${t.descricao ? `<div class="tarefa-detalhe" id="det-${t.id}" style="display:none">${escHtml(t.descricao)}</div>` : ""}
        <div class="tarefa-acoes">
          <button onclick="editarTarefa(${t.id})">✏️ Editar</button>
          <button onclick="deletarTarefa(${t.id})">🗑️ Excluir</button>
          <button onclick="togglePassos(${t.id})">🤖 Passos da IA</button>
        </div>
        <div class="tarefa-passos" id="passos-${t.id}" style="display:none">${escHtml(t.passos_ia || "Sem passos gerados.")}</div>
      </div>`
  }).join("")
}

function toggleDetalhe(id) {
  const d = document.getElementById("det-" + id)
  if (!d) return
  const aberto = d.style.display === "none"
  d.style.display = aberto ? "" : "none"
  const btn = document.querySelector(`.tarefa-item[data-id="${id}"] .tarefa-expandir`)
  if (btn) btn.textContent = aberto ? "recolher" : "expandir"
}

function togglePassos(id) {
  const p = document.getElementById("passos-" + id)
  if (p) p.style.display = p.style.display === "none" ? "" : "none"
}

function novaTarefa()      { mostrarFormTarefa(null) }
function editarTarefa(id)  { mostrarFormTarefa(TAREFAS.find(t => t.id === id) || null) }

function mostrarFormTarefa(tarefa) {
  EDIT_TAREFA_ID = tarefa ? tarefa.id : null
  const titulo = tarefa ? tarefa.titulo : ""
  const desc = tarefa ? (tarefa.descricao || "") : ""
  document.getElementById("tarefa-form").innerHTML = `
    <div class="tarefa-form-box">
      <input id="f-titulo" maxlength="120" placeholder="Título da tarefa" value="${escHtml(titulo)}">
      <textarea id="f-desc" placeholder="Detalhes (opcional)">${escHtml(desc)}</textarea>
      <div style="display:flex;gap:.6rem">
        <button class="btn btn-primary btn-sm" id="f-salvar" style="width:auto" onclick="salvarTarefa()">${tarefa ? "Salvar alterações" : "Criar tarefa"}</button>
        <button class="btn btn-ghost btn-sm" style="width:auto" onclick="cancelarFormTarefa()">Cancelar</button>
      </div>
      <div id="f-msg" class="error-msg"></div>
    </div>`
  document.getElementById("f-titulo").focus()
}

function cancelarFormTarefa() {
  EDIT_TAREFA_ID = null
  const f = document.getElementById("tarefa-form")
  if (f) f.innerHTML = ""
}

async function salvarTarefa() {
  const titulo = document.getElementById("f-titulo").value.trim()
  const desc = document.getElementById("f-desc").value.trim()
  const msg = document.getElementById("f-msg")
  if (!titulo) { mostrarErro(msg, "Digite um título para a tarefa."); return }

  const btn = document.getElementById("f-salvar")
  const txtOriginal = btn.textContent
  btn.disabled = true
  btn.textContent = "🤖 Gerando passos com a IA…"

  const editando = EDIT_TAREFA_ID !== null
  const url = editando ? (API + "/task/" + EDIT_TAREFA_ID) : (API + "/task")
  const metodo = editando ? "PUT" : "POST"

  try {
    const resp = await fetch(url, {
      method: metodo,
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ titulo, descricao: desc })
    })
    const dados = await resp.json()
    if (resp.ok && dados.status === "ok") {
      cancelarFormTarefa()
      await carregarTarefas()
    } else {
      btn.disabled = false; btn.textContent = txtOriginal
      mostrarErro(msg, dados.mensagem || "Não foi possível salvar.")
    }
  } catch {
    btn.disabled = false; btn.textContent = txtOriginal
    mostrarErro(msg, "Erro ao conectar com o servidor.")
  }
}

async function concluirTarefa(id) {
  const t = TAREFAS.find(x => x.id === id)
  const novo = (t && t.status === "concluida") ? "pendente" : "concluida"
  try {
    await fetch(API + "/task/" + id + "/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ status: novo })
    })
    await carregarTarefas()
  } catch {}
}

async function deletarTarefa(id) {
  if (!confirm("Deletar esta tarefa?")) return
  try {
    await fetch(API + "/task/" + id, { method: "DELETE", credentials: "include" })
    await carregarTarefas()
  } catch {}
}


/* ── Chat IA (backend /ia + histórico) ──────────────── */
function adicionarMsg(texto, tipo) {
  const msgs = document.getElementById("chat-msgs")
  const div = document.createElement("div")
  div.className = "msg " + tipo

  const ehAssistente =
    (tipo.includes("assistant") || tipo.includes("bot")) && !tipo.includes("typing")

  if (ehAssistente) {
    const span = document.createElement("span")
    span.textContent = texto
    div.appendChild(span)

    const btn = document.createElement("button")
    btn.type = "button"
    btn.className = "btn-falar"
    btn.title = "Ouvir esta resposta"
    btn.setAttribute("aria-label", "Ouvir esta resposta em voz alta")
    btn.textContent = "🔊"
    btn.addEventListener("click", () => falar(texto))
    div.appendChild(btn)

    // Botão "explicar de forma simples" (não aparece nas próprias versões simples)
    if (!tipo.includes("simples")) {
      const bSimples = document.createElement("button")
      bSimples.type = "button"
      bSimples.className = "btn-simples"
      bSimples.textContent = "💬 Explicar de forma simples"
      bSimples.addEventListener("click", () => explicarSimples(texto, bSimples))
      div.appendChild(bSimples)
    }
  } else {
    div.textContent = texto
  }

  msgs.appendChild(div)
  msgs.scrollTop = msgs.scrollHeight
  return div
}

// Ditado por voz (Speech-to-Text) — fala vira texto no campo de pergunta
let RECON = null
function ditar() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SR) {
    alert("Seu navegador não suporta ditado por voz. Tente o Google Chrome.")
    return
  }
  const mic = document.getElementById("chat-mic")

  // Se já está ouvindo, para
  if (RECON) { RECON.stop(); return }

  RECON = new SR()
  RECON.lang = "pt-BR"
  RECON.interimResults = false
  RECON.maxAlternatives = 1

  mic.textContent = "🔴"
  mic.classList.add("gravando")

  RECON.onresult = e => {
    const texto = e.results[0][0].transcript
    const input = document.getElementById("chat-input")
    input.value = input.value ? (input.value + " " + texto) : texto
    input.focus()
  }
  RECON.onerror = () => {}
  RECON.onend = () => {
    mic.textContent = "🎤"
    mic.classList.remove("gravando")
    RECON = null
  }

  RECON.start()
}

// Explicar de forma simples — IA reescreve em linguagem simples (acess. cognitiva)
async function explicarSimples(texto, btn) {
  const original = btn.textContent
  btn.disabled = true
  btn.textContent = "Simplificando…"
  try {
    const resp = await fetch(API + "/ia/simplificar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ texto })
    })
    const dados = await resp.json()
    if (resp.status === 401) {
      adicionarMsg("Sua sessão expirou. Faça login novamente.", "assistant")
      mostrarScreen("screen-login")
      return
    }
    adicionarMsg("📝 Em palavras simples:\n" + (dados.resposta || dados.mensagem || "Não consegui simplificar."), "assistant simples")
    btn.textContent = "✓ Simplificado"
  } catch {
    btn.disabled = false
    btn.textContent = original
  }
}

// Navegação por voz — comandos faladas viram ações
function toast(msg) {
  let el = document.getElementById("toast")
  if (!el) {
    el = document.createElement("div")
    el.id = "toast"
    el.className = "toast"
    document.body.appendChild(el)
  }
  el.textContent = msg
  el.classList.add("show")
  clearTimeout(window._toastT)
  window._toastT = setTimeout(() => el.classList.remove("show"), 2600)
}

function comandoVoz() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SR) { alert("Seu navegador não suporta comando de voz. Tente o Google Chrome."); return }
  const btn = document.getElementById("btn-voz")
  const rec = new SR()
  rec.lang = "pt-BR"; rec.interimResults = false; rec.maxAlternatives = 1
  if (btn) { btn.textContent = "🎙️ Ouvindo…"; btn.classList.add("on") }
  rec.onresult = e => executarComando((e.results[0][0].transcript || "").toLowerCase())
  rec.onerror = () => {}
  rec.onend = () => { if (btn) { btn.textContent = "🎙️ Comando de voz"; btn.classList.remove("on") } }
  rec.start()
}

function executarComando(txt) {
  const t = txt.normalize("NFD").replace(/[̀-ͯ]/g, "")  // sem acentos
  const tem = (...ks) => ks.some(k => t.includes(k))
  let acao = ""

  if (tem("dashboard", "inicio", "painel"))            { navegar("dashboard"); acao = "Dashboard" }
  else if (tem("estudo"))                              { navegar("estudos"); acao = "Área de Estudos" }
  else if (tem("curso"))                               { navegar("cursos"); acao = "Cursos Rápidos" }
  else if (tem("perfil"))                              { navegar("perfil"); acao = "Perfil" }
  else if (tem("tarefa", "foco"))                      { abrirTarefas(); acao = "Foco Diário" }
  else if (tem("nova conversa", "limpar conversa"))    { novaConversa(); acao = "Nova conversa" }
  else if (tem("historico"))                           { abrirHistoricoConversas(); acao = "Histórico" }
  else if (tem("aumentar", "maior"))                   { mudarFonte(1); acao = "Aumentar fonte" }
  else if (tem("diminuir", "menor"))                   { mudarFonte(-1); acao = "Diminuir fonte" }
  else if (tem("contraste"))                           { toggleContraste(); acao = "Alto contraste" }
  else if (tem("fechar"))                              { const m = document.querySelector(".modal-overlay.open"); if (m) fecharModal(m.id); acao = "Fechar" }
  else if (tem("sair", "logout", "deslogar"))          { sair(); acao = "Sair" }

  toast(acao ? ("✓ " + acao) : ('Não entendi: "' + txt + '"'))
}

// Leitura em voz alta (Text-to-Speech) — pilar Visual
function falar(texto) {
  if (!("speechSynthesis" in window)) {
    alert("Seu navegador não suporta leitura em voz alta.")
    return
  }
  window.speechSynthesis.cancel()  // interrompe qualquer fala anterior
  const fala = new SpeechSynthesisUtterance(texto)
  fala.lang = "pt-BR"
  fala.rate = 1
  window.speechSynthesis.speak(fala)
}

let IA_MENSAGEM_ENVIANDO = false

async function enviarMensagem() {
  if (IA_MENSAGEM_ENVIANDO) return

  const input = document.getElementById("chat-input")
  const texto = input.value.trim()
  if (!texto) return

  IA_MENSAGEM_ENVIANDO = true
  const botaoEnviar = document.getElementById("chat-enviar")
  if (botaoEnviar) {
    botaoEnviar.disabled = true
    botaoEnviar.textContent = "Enviando…"
  }

  adicionarMsg(texto, "user")
  input.value = ""
  const typing = adicionarMsg("Digitando…", "assistant typing")

  try {
    const resp = await fetch(API + "/ia", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ pergunta: texto })
    })
    const dados = await resp.json()
    typing.remove()

    if (resp.status === 401) {
      adicionarMsg("Sua sessão expirou. Faça login novamente.", "assistant")
      mostrarScreen("screen-login")
      return
    }
    adicionarMsg(dados.resposta || dados.mensagem || "Não consegui responder agora.", "assistant")
  } catch {
    typing.remove()
    adicionarMsg("Não foi possível conectar ao assistente. Tente novamente.", "assistant")
  } finally {
    IA_MENSAGEM_ENVIANDO = false
    if (botaoEnviar) {
      botaoEnviar.disabled = false
      botaoEnviar.textContent = "Enviar"
    }
  }
}

// Descrição de imagem por IA (acessibilidade visual)
function _redimensionar(file, maxDim, cb) {
  const reader = new FileReader()
  reader.onload = e => {
    const img = new Image()
    img.onload = () => {
      let w = img.width, h = img.height
      if (w > h && w > maxDim) { h = Math.round(h * maxDim / w); w = maxDim }
      else if (h >= w && h > maxDim) { w = Math.round(w * maxDim / h); h = maxDim }
      const c = document.createElement("canvas"); c.width = w; c.height = h
      c.getContext("2d").drawImage(img, 0, 0, w, h)
      cb(c.toDataURL("image/jpeg", 0.7))
    }
    img.onerror = () => cb(null)
    img.src = e.target.result
  }
  reader.readAsDataURL(file)
}

function enviarImagem(event) {
  const file = event.target.files[0]
  event.target.value = ""
  if (!file) return
  if (!file.type.startsWith("image/")) { adicionarMsg("Selecione uma imagem.", "assistant"); return }

  _redimensionar(file, 512, async (dataUrl) => {
    if (!dataUrl) { adicionarMsg("Não consegui ler a imagem.", "assistant"); return }
    adicionarMsg("🖼️ Imagem enviada", "user")
    const typing = adicionarMsg("Descrevendo a imagem…", "assistant typing")
    try {
      const resp = await fetch(API + "/ia/descrever-imagem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ imagem: dataUrl })
      })
      const dados = await resp.json()
      typing.remove()
      if (resp.status === 401) {
        adicionarMsg("Sua sessão expirou. Faça login novamente.", "assistant")
        mostrarScreen("screen-login"); return
      }
      adicionarMsg(dados.resposta || dados.mensagem || "Não consegui descrever a imagem.", "assistant")
    } catch {
      typing.remove()
      adicionarMsg("Erro de conexão ao descrever a imagem.", "assistant")
    }
  })
}

async function carregarHistorico() {
  const msgs = document.getElementById("chat-msgs")
  // Reseta para a mensagem de boas-vindas
  msgs.innerHTML = '<div class="msg assistant">Olá! Sou o assistente UniSense. Como posso ajudar com acessibilidade hoje? 👋</div>'

  try {
    const resp = await fetch(API + "/historico", { credentials: "include" })
    const dados = await resp.json()
    if (dados.status === "ok" && Array.isArray(dados.historico)) {
      // Backend retorna do mais novo p/ o mais antigo — invertemos p/ ordem cronológica
      dados.historico.slice().reverse().forEach(item => {
        adicionarMsg(item.pergunta, "user")
        adicionarMsg(item.resposta, "assistant")
      })
    }
  } catch { /* silencioso: mantém só a boas-vindas */ }
}

// Arquiva a conversa atual (nome = data/hora local) e limpa o chat
async function novaConversa() {
  const nome = new Date().toLocaleString("pt-BR")
  try {
    const resp = await fetch(API + "/historico/nova-conversa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ nome })
    })
    const dados = await resp.json()
    await carregarHistorico()  // chat volta só com a boas-vindas
    if (dados.salvou) {
      adicionarMsg(`✓ Conversa anterior salva no histórico (${nome}).`, "assistant")
    } else {
      adicionarMsg("Não havia conversa para salvar.", "assistant")
    }
  } catch {
    adicionarMsg("Erro ao salvar a conversa.", "assistant")
  }
}

async function abrirHistoricoConversas() {
  abrirModal("modal-historico")
  const cont = document.getElementById("conversas-lista")
  cont.innerHTML = '<div class="tarefas-vazio">Carregando…</div>'
  try {
    const resp = await fetch(API + "/historico/conversas", { credentials: "include" })
    const dados = await resp.json()
    renderConversas((dados.status === "ok" && dados.conversas) ? dados.conversas : [])
  } catch {
    cont.innerHTML = '<div class="tarefas-vazio">Não foi possível carregar.</div>'
  }
}

function renderConversas(lista) {
  const cont = document.getElementById("conversas-lista")
  if (!lista.length) {
    cont.innerHTML = '<div class="tarefas-vazio">Nenhuma conversa salva ainda.</div>'
    return
  }
  cont.innerHTML = lista.map((c, i) => `
    <div class="conversa-item">
      <button class="conversa-head" onclick="toggleConversa(${i})">
        <span>🗓️ ${escHtml(c.nome)}</span>
        <span>${c.mensagens.length} msg(s) ›</span>
      </button>
      <div class="conversa-msgs" id="conv-${i}" style="display:none">
        ${c.mensagens.map(m =>
          `<div class="conv-msg"><strong>Você:</strong> ${escHtml(m.pergunta)}<br><strong>IA:</strong> ${escHtml(m.resposta)}</div>`
        ).join("")}
      </div>
    </div>`).join("")
}

function toggleConversa(i) {
  const d = document.getElementById("conv-" + i)
  if (d) d.style.display = d.style.display === "none" ? "" : "none"
}


/* ── Cursos: quiz e progresso (backend) ─────────────── */

// Progresso do usuário, carregado do backend: [{curso_id, status, pontuacao}]
let CURSOS_PROGRESSO = []

// Conteúdo dos quizzes (fácil de editar/expandir). correta = índice da opção certa.
const CURSOS = {
  "acessibilidade": {
    titulo: "🌐 Acessibilidade Básica",
    descricao: "Fundamentos de acessibilidade digital e boas práticas",
    duracao: "20 min",
    videoUrl: "https://www.youtube.com/results?search_query=acessibilidade+digital+portugu%C3%AAs+brasil+legendas",
    perguntas: [
      { q: "Uma página acessível deve permitir que...", opcoes: [
          "Apenas pessoas sem deficiência naveguem rapidamente",
          "Pessoas com diferentes deficiências percebam, usem e compreendam o conteúdo",
          "Todos usem somente o mouse"], correta: 1,
        explicacao: "Acessibilidade envolve percepção, operação e compreensão do conteúdo por diferentes pessoas e tecnologias assistivas." },
      { q: "Ao revisar a acessibilidade de um site, qual referência internacional é mais adequada?", opcoes: [
          "WCAG, que reúne diretrizes para conteúdo web acessível",
          "Wi-Fi, que define a velocidade da rede",
          "USB, que define conectores de dispositivos"], correta: 0,
        explicacao: "As WCAG são diretrizes internacionais para tornar conteúdos e interfaces web mais acessíveis." },
      { q: "Uma imagem informa que uma inscrição foi aprovada. Qual texto alternativo é mais útil?", opcoes: [
          "imagem bonita",
          "Inscrição aprovada",
          "arquivo.png"], correta: 1,
        explicacao: "O texto alternativo deve comunicar a função ou informação relevante da imagem, e não apenas seu nome de arquivo." }
    ]
  },
  "assistente-ia": {
    titulo: "🤖 Uso do Assistente IA",
    descricao: "Como usar a IA para auxiliar no aprendizado de acessibilidade",
    duracao: "15 min",
    videoUrl: "https://www.youtube.com/results?search_query=intelig%C3%AAncia+artificial+educa%C3%A7%C3%A3o+acessibilidade+portugu%C3%AAs+brasil+legendas",
    perguntas: [
      { q: "Qual é um uso adequado do assistente de IA no UniSense?", opcoes: [
          "Apoiar o estudo e explicar conceitos de acessibilidade",
          "Substituir qualquer profissional especializado",
          "Confirmar automaticamente informações sem possibilidade de erro"], correta: 0,
        explicacao: "A IA pode apoiar o aprendizado, mas suas respostas podem conter erros e não substituem orientação profissional." },
      { q: "Qual pedido tende a produzir uma resposta mais útil?", opcoes: [
          "Explique acessibilidade.",
          "Explique, em três frases simples, o que é contraste acessível em uma página web.",
          "Responda qualquer coisa."], correta: 1,
        explicacao: "Perguntas com objetivo, contexto e formato desejado ajudam a IA a produzir respostas mais claras e relevantes." },
      { q: "Ao receber uma resposta importante da IA, o mais seguro é...", opcoes: [
          "Aceitá-la sem conferir",
          "Conferir a informação em fontes confiáveis",
          "Compartilhá-la imediatamente"], correta: 1,
        explicacao: "A IA pode cometer erros; informações importantes devem ser verificadas em fontes confiáveis." }
    ]
  },
  "teclado": {
    titulo: "⌨️ Navegação por Teclado",
    descricao: "Aprenda como tornar seu site navegável apenas pelo teclado",
    duracao: "10 min",
    videoUrl: "https://www.youtube.com/results?search_query=navega%C3%A7%C3%A3o+por+teclado+acessibilidade+portugu%C3%AAs+brasil+legendas",
    perguntas: [
      { q: "Qual tecla normalmente move o foco para o próximo elemento interativo?", opcoes: [
          "Tab", "Caps Lock", "Print Screen"], correta: 0,
        explicacao: "A tecla Tab move o foco entre links, botões, campos e outros elementos interativos." },
      { q: "Uma interface navegável por teclado é importante porque...", opcoes: [
          "Atende pessoas que não conseguem usar o mouse e também agiliza a navegação",
          "Elimina a necessidade de textos claros",
          "Faz todas as imagens carregarem mais rápido"], correta: 0,
        explicacao: "Pessoas com limitações motoras ou visuais podem depender do teclado, e outros usuários também se beneficiam dele." },
      { q: "O indicador de foco deve ser visível para que a pessoa...", opcoes: [
          "Saiba qual elemento receberá sua próxima ação",
          "Veja somente as imagens da página",
          "Aumente automaticamente o tamanho da fonte"], correta: 0,
        explicacao: "O foco visível mostra a posição atual na interface e evita que a pessoa se perca ao navegar pelo teclado." }
    ]
  },
  "cores-contraste": {
    titulo: "🎨 Cores e Contraste",
    descricao: "Entenda como usar cores de forma acessível para todos",
    duracao: "12 min",
    videoUrl: "https://www.youtube.com/results?search_query=cores+contraste+acessibilidade+portugu%C3%AAs+brasil+legendas",
    perguntas: [
      { q: "Por que o contraste entre texto e fundo é importante?", opcoes: [
          "Para melhorar a leitura, especialmente para pessoas com baixa visão",
          "Para fazer a página gastar menos energia",
          "Porque substitui a necessidade de texto"], correta: 0,
        explicacao: "Contraste suficiente ajuda a distinguir as letras do fundo e melhora a leitura em diferentes condições visuais." },
      { q: "Por que não devemos usar somente a cor para indicar um erro?", opcoes: [
          "Porque a cor nunca pode ser usada",
          "Porque algumas pessoas não distinguem determinadas cores; é preciso outro indicador",
          "Porque os erros devem ficar escondidos"], correta: 1,
        explicacao: "Além da cor, use texto, ícone ou outro sinal para que a informação não dependa apenas da percepção de cores." },
      { q: "Qual combinação tende a oferecer melhor contraste para um texto?", opcoes: [
          "Texto cinza-claro em fundo branco",
          "Texto escuro em fundo claro, ou claro em fundo escuro, com contraste suficiente",
          "Texto amarelo em fundo branco"], correta: 1,
        explicacao: "Texto e fundo precisam ter diferença visual suficiente; a combinação exata deve ser verificada com uma ferramenta de contraste." }
    ]
  }
}

function renderCursosCards() {
  const lista = document.getElementById("cursos-lista")
  if (!lista) return

  const cabecalho = `
    <div class="page-title">Cursos Rápidos</div>
    <div class="page-subtitle">Aprenda em minutos com nossos micro-cursos</div>`

  const cards = Object.entries(CURSOS).map(([cursoId, curso]) => `
    <div class="course-card" data-curso="${escHtml(cursoId)}">
      <div class="info">
        <h3>${escHtml(curso.titulo)}</h3>
        <p>${escHtml(curso.descricao)}</p>
        <div class="course-meta">
          <span class="tag">${escHtml(curso.duracao)}</span>
          <span class="tag green">Disponível</span>
        </div>
        <div class="progress-bar"><div class="progress-fill" style="width:0%"></div></div>
        <a class="course-video-link" href="${escHtml(curso.videoUrl)}" target="_blank" rel="noopener">
          ▶ Assistir explicação em português
        </a>
      </div>
      <button class="btn btn-primary btn-sm" onclick="abrirCurso('${escHtml(cursoId)}')">Iniciar</button>
    </div>`).join("")

  lista.innerHTML = cabecalho + cards
}

function progressoDe(cursoId) {
  return CURSOS_PROGRESSO.find(p => p.curso_id === cursoId) || null
}

async function carregarProgressoCursos() {
  try {
    const resp = await fetch(API + "/curso/progresso", { credentials: "include" })
    const dados = await resp.json()
    CURSOS_PROGRESSO = (dados.status === "ok" && dados.progresso) ? dados.progresso : []
  } catch {
    CURSOS_PROGRESSO = []
  }
  aplicarProgressoCards()
}

function aplicarProgressoCards() {
  document.querySelectorAll(".course-card[data-curso]").forEach(card => {
    const prog = progressoDe(card.dataset.curso)
    const btn = card.querySelector("button")
    const fill = card.querySelector(".progress-fill")
    if (prog && prog.status === "concluido") {
      btn.textContent = "✓ Concluído (rever)"
      btn.className = "btn btn-sm btn-success"
      fill.style.width = "100%"
    } else if (prog && prog.status === "iniciado") {
      const total = CURSOS[card.dataset.curso]?.perguntas.length || 0
      const respondidas = Math.min(prog.pergunta_atual || 0, total)
      btn.textContent = respondidas ? `Continuar (${respondidas}/${total})` : "Iniciar"
      btn.className = "btn btn-sm btn-primary"
      fill.style.width = total ? Math.round((respondidas / total) * 100) + "%" : "0%"
    } else {
      btn.textContent = "Iniciar"
      btn.className = "btn btn-sm btn-primary"
      fill.style.width = "0%"
    }
  })
}

// Abre o quiz de um curso e registra o início no backend
function abrirCurso(cursoId) {
  if (!CURSOS[cursoId]) return

  const progresso = progressoDe(cursoId)
  const perguntaAtual = progresso?.pergunta_atual || 0

  fetch(API + "/curso/progresso", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      curso_id: cursoId,
      status: "iniciado",
      pontuacao: 0,
      pergunta_atual: perguntaAtual
    })
  }).catch(() => {})

  renderQuiz(cursoId, perguntaAtual)
  document.getElementById("cursos-lista").style.display = "none"
  document.getElementById("cursos-quiz").style.display = ""
  window.scrollTo(0, 0)
}

function renderQuiz(cursoId, perguntaAtual = 0) {
  const curso = CURSOS[cursoId]
  let html = `
    <button class="btn btn-ghost btn-sm" style="width:auto;margin-bottom:1rem" onclick="voltarCursos()">← Voltar</button>
    <div class="page-title">${curso.titulo}</div>
    <div class="page-subtitle">Responda às perguntas para concluir o curso.</div>
    <div class="quiz-progress" id="quiz-progress" aria-live="polite"></div>
  `
  curso.perguntas.forEach((p, i) => {
    html += `<div class="quiz-q"><h4>${i + 1}. ${escHtml(p.q)}</h4>`
    p.opcoes.forEach((op, j) => {
      html += `<label class="quiz-option"><input type="radio" name="q${i}" value="${j}"><span>${escHtml(op)}</span></label>`
    })
    html += `</div>`
  })
  html += `<div id="quiz-msg" class="quiz-msg">⚠️ Responda todas as perguntas para concluir.</div>`
  html += `<button class="btn btn-primary" id="btn-concluir-quiz" onclick="submeterQuiz('${cursoId}')">Concluir curso</button>`
  document.getElementById("cursos-quiz").innerHTML = html

  document.querySelectorAll("#cursos-quiz input[type=radio]").forEach(input => {
    input.addEventListener("change", () => salvarProgressoPergunta(cursoId))
  })
  atualizarProgressoQuiz(perguntaAtual, curso.perguntas.length)
}

function atualizarProgressoQuiz(respondidas, total) {
  const progresso = document.getElementById("quiz-progress")
  if (!progresso) return
  progresso.textContent = `Progresso: ${respondidas} de ${total} perguntas respondidas`
}

async function salvarProgressoPergunta(cursoId) {
  const curso = CURSOS[cursoId]
  const respondidas = curso.perguntas.filter((_, i) =>
    document.querySelector(`input[name="q${i}"]:checked`)
  ).length
  atualizarProgressoQuiz(respondidas, curso.perguntas.length)

  try {
    await fetch(API + "/curso/progresso", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        curso_id: cursoId,
        status: "iniciado",
        pontuacao: 0,
        pergunta_atual: respondidas
      })
    })
    await carregarProgressoCursos()
  } catch {}
}

async function submeterQuiz(cursoId) {
  const curso = CURSOS[cursoId]
  const total = curso.perguntas.length
  let respondidas = 0
  let acertos = 0

  curso.perguntas.forEach((p, i) => {
    const sel = document.querySelector(`input[name="q${i}"]:checked`)
    if (sel) {
      respondidas++
      if (parseInt(sel.value) === p.correta) acertos++
    }
  })

  // Força responder todas as perguntas
  if (respondidas < total) {
    document.getElementById("quiz-msg").style.display = "block"
    return
  }

  const pontuacao = Math.round((acertos / total) * 100)

  // Feedback visual: marca certas/erradas e trava as opções
  curso.perguntas.forEach((p, i) => {
    document.querySelectorAll(`input[name="q${i}"]`).forEach((inp, j) => {
      inp.disabled = true
      const label = inp.closest(".quiz-option")
      if (j === p.correta) label.classList.add("correct")
      else if (inp.checked) label.classList.add("wrong")
    })

    const selecionada = document.querySelector(`input[name="q${i}"]:checked`)
    const acertou = selecionada && parseInt(selecionada.value) === p.correta
    const explicacao = document.createElement("p")
    explicacao.className = "quiz-explanation " + (acertou ? "correct" : "wrong")
    explicacao.textContent = acertou
      ? "Resposta correta. " + p.explicacao
      : "Resposta incorreta. A alternativa correta é: " + p.opcoes[p.correta] + ". " + p.explicacao
    document.querySelectorAll(".quiz-q")[i]?.appendChild(explicacao)
  })

  // Registra a conclusão no backend
  try {
    await fetch(API + "/curso/progresso", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        curso_id: cursoId,
        status: "concluido",
        pontuacao,
        pergunta_atual: total
      })
    })
  } catch {}

  // Mostra o resultado no topo e esconde o botão de concluir
  const quizDiv = document.getElementById("cursos-quiz")
  const btn = document.getElementById("btn-concluir-quiz")
  if (btn) btn.style.display = "none"

  const fb = document.createElement("div")
  fb.className = "quiz-feedback"
  fb.innerHTML =
    `<div class="score">${acertos}/${total}</div>` +
    `<p style="color:var(--muted);margin:.5rem 0 1rem">Pontuação: ${pontuacao}% — Curso concluído! 🎉</p>` +
    `<button class="btn btn-primary" style="width:auto" onclick="voltarCursos()">Voltar aos cursos</button>`
  quizDiv.prepend(fb)
  window.scrollTo(0, 0)

  await carregarProgressoCursos()
}

function voltarCursos() {
  const quiz = document.getElementById("cursos-quiz")
  quiz.style.display = "none"
  quiz.innerHTML = ""
  document.getElementById("cursos-lista").style.display = ""
}


/* ── Acessibilidade (alto contraste + tamanho de fonte) */
const BASE_FONT = 16
let fontLevel = 0
let highContrast = false

function toggleA11y() {
  const p = document.getElementById("a11y-panel")
  p.style.display = (p.style.display === "none") ? "" : "none"
}

function toggleContraste() {
  highContrast = !highContrast
  document.documentElement.classList.toggle("high-contrast", highContrast)
  document.getElementById("btn-contraste").classList.toggle("on", highContrast)
  localStorage.setItem("us_contraste", highContrast)
  sincronizarPrefs()
}

function mudarFonte(dir) {
  if (dir === 0) fontLevel = 0
  else fontLevel = Math.max(-2, Math.min(4, fontLevel + dir))
  document.documentElement.style.setProperty("--font-size", (BASE_FONT + fontLevel * 2) + "px")
  localStorage.setItem("us_font", fontLevel)
  sincronizarPrefs()
}

// Alterna um "modo" de acessibilidade (classe no html) e salva a preferência
function _toggleModo(classe, btnId, chave) {
  const on = document.documentElement.classList.toggle(classe)
  const b = document.getElementById(btnId)
  if (b) b.classList.toggle("on", on)
  localStorage.setItem(chave, on)
  sincronizarPrefs()
}
function toggleDislexia()  { _toggleModo("fonte-legivel", "btn-dislexia", "us_dislexia") }
function toggleLinks()     { _toggleModo("destacar-links", "btn-links", "us_links") }
function toggleMovimento() { _toggleModo("reduzir-movimento", "btn-movimento", "us_movimento") }

// Reseta só o visual + localStorage (NÃO mexe na conta) — usado no logout
function resetarA11yVisual() {
  document.documentElement.classList.remove(
    "high-contrast", "fonte-legivel", "destacar-links", "reduzir-movimento"
  )
  highContrast = false
  fontLevel = 0
  document.documentElement.style.setProperty("--font-size", BASE_FONT + "px")
  ;["btn-contraste", "btn-dislexia", "btn-links", "btn-movimento"].forEach(id => {
    const b = document.getElementById(id); if (b) b.classList.remove("on")
  })
  ;["us_contraste", "us_font", "us_dislexia", "us_links", "us_movimento"]
    .forEach(k => localStorage.removeItem(k))
}

// Botão "Resetar" do painel: reseta E salva o reset na conta do usuário logado
function resetarA11y() {
  resetarA11yVisual()
  sincronizarPrefs()
}

function restaurarPrefs() {
  if (localStorage.getItem("us_contraste") === "true") {
    highContrast = true
    document.documentElement.classList.add("high-contrast")
    const b = document.getElementById("btn-contraste")
    if (b) b.classList.add("on")
  }
  const fl = parseInt(localStorage.getItem("us_font") || "0")
  if (fl) {
    fontLevel = fl
    document.documentElement.style.setProperty("--font-size", (BASE_FONT + fl * 2) + "px")
  }
  // Restaura os modos extras
  ;[["us_dislexia", "fonte-legivel", "btn-dislexia"],
    ["us_links", "destacar-links", "btn-links"],
    ["us_movimento", "reduzir-movimento", "btn-movimento"]].forEach(([chave, classe, btnId]) => {
    if (localStorage.getItem(chave) === "true") {
      document.documentElement.classList.add(classe)
      const b = document.getElementById(btnId); if (b) b.classList.add("on")
    }
  })
}


/* ── Perfil de acessibilidade (segue a conta) ───────── */
function _setBtn(id, on) { const b = document.getElementById(id); if (b) b.classList.toggle("on", on) }

function prefsAtuais() {
  const h = document.documentElement
  return {
    contraste: h.classList.contains("high-contrast"),
    font: fontLevel,
    dislexia: h.classList.contains("fonte-legivel"),
    links: h.classList.contains("destacar-links"),
    movimento: h.classList.contains("reduzir-movimento")
  }
}

// Aplica um conjunto de preferências (autoritativo: liga/desliga tudo)
function aplicarPrefs(p) {
  if (!p) return
  const h = document.documentElement
  highContrast = !!p.contraste
  h.classList.toggle("high-contrast", highContrast); _setBtn("btn-contraste", highContrast)
  fontLevel = (typeof p.font === "number") ? p.font : 0
  h.style.setProperty("--font-size", (BASE_FONT + fontLevel * 2) + "px")
  h.classList.toggle("fonte-legivel", !!p.dislexia); _setBtn("btn-dislexia", !!p.dislexia)
  h.classList.toggle("destacar-links", !!p.links); _setBtn("btn-links", !!p.links)
  h.classList.toggle("reduzir-movimento", !!p.movimento); _setBtn("btn-movimento", !!p.movimento)
  // espelha no localStorage
  localStorage.setItem("us_contraste", highContrast)
  localStorage.setItem("us_font", fontLevel)
  localStorage.setItem("us_dislexia", !!p.dislexia)
  localStorage.setItem("us_links", !!p.links)
  localStorage.setItem("us_movimento", !!p.movimento)
}

async function salvarPrefs(prefs) {
  try {
    await fetch(API + "/perfil/acessibilidade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ prefs })
    })
  } catch {}
}

// Toggles manuais chamam isto: se logado, salva o estado atual na conta
function sincronizarPrefs() {
  if (EMAIL) salvarPrefs(prefsAtuais())
}

function aplicarOnboarding() {
  const visao = document.getElementById("ob-visao").checked
  const dislexia = document.getElementById("ob-dislexia").checked
  const contraste = document.getElementById("ob-contraste").checked || visao
  const movimento = document.getElementById("ob-movimento").checked
  const prefs = { contraste, font: visao ? 2 : 0, dislexia, links: false, movimento }
  aplicarPrefs(prefs)
  salvarPrefs(prefs)
  fecharModal("modal-onboarding")
}

function pularOnboarding() {
  // Marca o onboarding como feito (não pergunta de novo), sem alterar nada
  salvarPrefs({ contraste: false, font: 0, dislexia: false, links: false, movimento: false })
  fecharModal("modal-onboarding")
}


/* ── Inicialização ──────────────────────────────────── */
async function init() {
  restaurarPrefs()
  renderEmojis()
  setupCrop()
  // Se já existe sessão ativa no backend, entra direto no app
  try {
    const resp = await fetch(API + "/me", { credentials: "include" })
    const dados = await resp.json()
    if (dados.logado) entrarApp(dados.usuario, dados.nome, dados.foto, dados.prefs)
  } catch { /* sem sessão: fica na tela de login */ }
}

document.addEventListener("DOMContentLoaded", init)

async function enviarPromptStream(prompt) {
    const response = await fetch('/api/ia/chat-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let elementoMensagem = criarElementoMensagem(); // Adiciona div no chat

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        // Processa o formato SSE e atualiza o texto na tela em tempo real
        elementoMensagem.innerText += chunk.replace(/^data:\s*/, '');
    }
}