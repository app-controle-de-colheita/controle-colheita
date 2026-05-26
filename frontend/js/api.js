// Cliente HTTP do backend. Centraliza base URL, token JWT e tratamento de erros.

// Em dev (servido pelo proprio FastAPI), a base eh a mesma origem (caminho vazio).
// Em prod (frontend no GitHub Pages), trocar pra URL HTTPS do Tailscale Funnel.
const API_BASE = window.location.origin.startsWith('http://10.0.1.14')
  || window.location.hostname === 'localhost'
  || window.location.hostname === '127.0.0.1'
    ? ''  // mesma origem do servidor FastAPI
    : 'https://TROCAR-PELO-FUNNEL';  // ajustar na Fase 3

const TOKEN_KEY = 'morango_token';
const USUARIO_KEY = 'morango_usuario';

export const auth = {
  salvar(token, usuario) {
    localStorage.setItem(TOKEN_KEY, token);
    if (usuario) localStorage.setItem(USUARIO_KEY, JSON.stringify(usuario));
  },
  token() { return localStorage.getItem(TOKEN_KEY); },
  usuario() {
    const u = localStorage.getItem(USUARIO_KEY);
    return u ? JSON.parse(u) : null;
  },
  logado() { return !!localStorage.getItem(TOKEN_KEY); },
  sair() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USUARIO_KEY);
    window.location.href = 'index.html';
  },
};

class ApiErro extends Error {
  constructor(status, detalhe) {
    super(typeof detalhe === 'string' ? detalhe : 'Erro na requisicao');
    this.status = status;
    this.detalhe = detalhe;
  }
}

async function requisicao(metodo, caminho, corpo, opcoes = {}) {
  const headers = { 'Accept': 'application/json' };
  const token = auth.token();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let body;
  if (corpo instanceof FormData || corpo instanceof URLSearchParams) {
    body = corpo;
  } else if (corpo !== undefined && corpo !== null) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(corpo);
  }

  const resp = await fetch(`${API_BASE}${caminho}`, { method: metodo, headers, body });

  if (resp.status === 401 && !opcoes.naoRedirecionar) {
    auth.sair();
    throw new ApiErro(401, 'Sessao expirada');
  }

  if (resp.status === 204) return null;

  let dados = null;
  const tipo = resp.headers.get('content-type') || '';
  if (tipo.includes('application/json')) {
    dados = await resp.json();
  } else {
    dados = await resp.text();
  }

  if (!resp.ok) {
    const detalhe = (dados && dados.detail) || dados || `HTTP ${resp.status}`;
    throw new ApiErro(resp.status, detalhe);
  }

  return dados;
}

export const api = {
  get: (caminho, opcoes) => requisicao('GET', caminho, null, opcoes),
  post: (caminho, corpo, opcoes) => requisicao('POST', caminho, corpo, opcoes),
  patch: (caminho, corpo, opcoes) => requisicao('PATCH', caminho, corpo, opcoes),
  delete: (caminho, opcoes) => requisicao('DELETE', caminho, null, opcoes),
};

export { ApiErro };

/** Mostra mensagem no elemento (cria se nao existir). tipo: 'erro' | 'sucesso' | 'aviso' */
export function mostrarMensagem(seletor, tipo, texto) {
  const el = document.querySelector(seletor);
  if (!el) return;
  el.className = `mensagem ${tipo}`;
  el.textContent = texto;
  el.classList.remove('escondido');
}

export function limparMensagem(seletor) {
  const el = document.querySelector(seletor);
  if (el) el.classList.add('escondido');
}

/** Exige login. Se nao tiver token, manda pra index. */
export function exigirLogin() {
  if (!auth.logado()) {
    window.location.href = 'index.html';
    return false;
  }
  return true;
}
