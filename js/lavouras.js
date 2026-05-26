import { api, auth, mostrarMensagem, limparMensagem, exigirLogin } from './api.js';

if (!exigirLogin()) { /* redirecionou */ }

const usuario = auth.usuario();
if (usuario) document.getElementById('nome-usuario').textContent = `Olá, ${usuario.nome}`;

document.getElementById('btn-sair').addEventListener('click', () => auth.sair());

const grade = document.getElementById('grade-ativas');
const gradeEnc = document.getElementById('grade-encerradas');
const tituloEnc = document.getElementById('titulo-encerradas');
const vazio = document.getElementById('estado-vazio');

const modal = document.getElementById('modal-nova');
const formNova = document.getElementById('form-nova');
const inputAno = document.getElementById('nl-ano');
inputAno.value = new Date().getFullYear();

function abrirModal() {
  limparMensagem('#msg-modal');
  formNova.reset();
  inputAno.value = new Date().getFullYear();
  modal.classList.remove('escondido');
  document.getElementById('nl-nome').focus();
}
function fecharModal() { modal.classList.add('escondido'); }

document.getElementById('btn-nova').addEventListener('click', abrirModal);
document.getElementById('btn-cancelar').addEventListener('click', fecharModal);
modal.addEventListener('click', (e) => { if (e.target === modal) fecharModal(); });

function cardLavoura(lav) {
  const a = document.createElement('a');
  a.className = 'card-lavoura' + (lav.ativa ? '' : ' inativa');
  a.href = `lavoura.html?id=${lav.id}`;
  const tipoLabel = { estufa: 'Estufa', campo: 'Campo', outro: 'Outro' }[lav.tipo] || lav.tipo;
  a.innerHTML = `
    <div class="nome">${escaparHtml(lav.nome)}</div>
    <div class="meta" style="margin-top:.5rem;">
      <span class="badge">${tipoLabel}</span>
      <span class="badge">Safra ${lav.ano_safra}</span>
      ${lav.ativa ? '' : '<span class="badge">Encerrada</span>'}
    </div>
    ${lav.observacao ? `<div class="meta" style="margin-top:.5rem;">${escaparHtml(lav.observacao)}</div>` : ''}
  `;
  return a;
}

function escaparHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

async function carregar() {
  grade.innerHTML = '';
  gradeEnc.innerHTML = '';
  tituloEnc.classList.add('escondido');
  vazio.classList.add('escondido');

  try {
    const lavouras = await api.get('/lavouras');
    if (!lavouras.length) { vazio.classList.remove('escondido'); return; }
    const ativas = lavouras.filter(l => l.ativa);
    const encerradas = lavouras.filter(l => !l.ativa);
    ativas.forEach(l => grade.appendChild(cardLavoura(l)));
    if (encerradas.length) {
      tituloEnc.classList.remove('escondido');
      encerradas.forEach(l => gradeEnc.appendChild(cardLavoura(l)));
    }
    if (!ativas.length && !encerradas.length) vazio.classList.remove('escondido');
  } catch (err) {
    mostrarMensagem('#msg', 'erro', err.message || 'Erro ao carregar lavouras.');
  }
}

formNova.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  limparMensagem('#msg-modal');
  const dados = {
    nome: document.getElementById('nl-nome').value.trim(),
    tipo: document.getElementById('nl-tipo').value,
    ano_safra: parseInt(document.getElementById('nl-ano').value, 10),
  };
  const inicio = document.getElementById('nl-inicio').value;
  const obs = document.getElementById('nl-obs').value.trim();
  if (inicio) dados.data_inicio = inicio;
  if (obs) dados.observacao = obs;

  const botao = formNova.querySelector('button[type=submit]');
  botao.disabled = true;
  botao.textContent = 'Criando...';
  try {
    await api.post('/lavouras', dados);
    fecharModal();
    await carregar();
  } catch (err) {
    mostrarMensagem('#msg-modal', 'erro', err.message || 'Erro ao criar lavoura.');
  } finally {
    botao.disabled = false;
    botao.textContent = 'Criar';
  }
});

carregar();
