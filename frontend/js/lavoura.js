import { api, auth, mostrarMensagem, exigirLogin } from './api.js';

if (!exigirLogin()) { /* redirecionou */ }

const usuario = auth.usuario();
if (usuario) document.getElementById('nome-usuario').textContent = `Olá, ${usuario.nome}`;
document.getElementById('btn-sair').addEventListener('click', () => auth.sair());

const params = new URLSearchParams(window.location.search);
const lavouraId = parseInt(params.get('id'), 10);

if (!lavouraId) {
  window.location.replace('lavouras.html');
}

// Tabs
const botoesAba = document.querySelectorAll('.tabs button');
const conteudos = document.querySelectorAll('.aba-conteudo');
botoesAba.forEach(b => b.addEventListener('click', () => {
  botoesAba.forEach(x => x.classList.toggle('ativa', x === b));
  const alvo = b.dataset.aba;
  conteudos.forEach(c => c.classList.toggle('escondido', c.dataset.aba !== alvo));
}));

async function carregar() {
  try {
    const lav = await api.get(`/lavouras/${lavouraId}`);
    document.getElementById('titulo-lavoura').textContent = lav.nome;
    const tipoLabel = { estufa: 'Estufa', campo: 'Campo', outro: 'Outro' }[lav.tipo] || lav.tipo;
    document.getElementById('meta-lavoura').textContent =
      `${tipoLabel} • Safra ${lav.ano_safra}${lav.ativa ? '' : ' • Encerrada'}`;
  } catch (err) {
    if (err.status === 404) {
      mostrarMensagem('#msg', 'erro', 'Lavoura não encontrada.');
    } else {
      mostrarMensagem('#msg', 'erro', err.message || 'Erro ao carregar.');
    }
  }
}

carregar();
