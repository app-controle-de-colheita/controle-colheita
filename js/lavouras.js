import { api, auth, mostrarMensagem, limparMensagem, exigirLogin } from './api.js';

if (!exigirLogin()) { /* redirecionou */ }

const usuario = auth.usuario();
if (usuario) document.getElementById('nome-usuario').textContent = `Olá, ${usuario.nome}`;
document.getElementById('btn-sair').addEventListener('click', () => auth.sair());

const moeda = (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const numero = (v) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });

const grade = document.getElementById('grade-ativas');
const gradeEnc = document.getElementById('grade-encerradas');
const tituloEnc = document.getElementById('titulo-encerradas');
const vazio = document.getElementById('estado-vazio');
const overview = document.getElementById('overview');

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

function cardLavoura(lav, resumoPorId) {
  const a = document.createElement('a');
  a.className = 'card-lavoura' + (lav.ativa ? '' : ' inativa');
  a.href = `lavoura.html?id=${lav.id}`;
  const tipoLabel = { estufa: 'Estufa', campo: 'Campo', outro: 'Outro' }[lav.tipo] || lav.tipo;
  const r = resumoPorId.get(lav.id);
  const resumoHtml = r ? `
    <div class="meta" style="margin-top:.6rem; border-top:1px dashed var(--cor-borda); padding-top:.5rem;">
      <div>📦 ${r.total_colheitas} colheita${r.total_colheitas === 1 ? '' : 's'}</div>
      <div>💰 Líquido: <strong>${moeda(r.receita_liquida)}</strong></div>
    </div>` : '';
  a.innerHTML = `
    <div class="nome">${escaparHtml(lav.nome)}</div>
    <div class="meta" style="margin-top:.5rem;">
      <span class="badge">${tipoLabel}</span>
      <span class="badge">Safra ${lav.ano_safra}</span>
      ${lav.ativa ? '' : '<span class="badge">Encerrada</span>'}
    </div>
    ${lav.observacao ? `<div class="meta" style="margin-top:.5rem;">${escaparHtml(lav.observacao)}</div>` : ''}
    ${resumoHtml}
  `;
  return a;
}

function escaparHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function renderOverview(rg) {
  if (!rg.total_lavouras) {
    overview.classList.add('escondido');
    return;
  }
  overview.classList.remove('escondido');
  document.getElementById('ov-receita-liquida').textContent = moeda(rg.receita_liquida);
  document.getElementById('ov-receita-bruta').textContent = moeda(rg.receita_bruta);
  document.getElementById('ov-custo-emb').textContent = moeda(rg.custo_embalagem_total);
  document.getElementById('ov-ativas').textContent = `${rg.lavouras_ativas} de ${rg.total_lavouras}`;
  document.getElementById('ov-caixas').textContent = numero(rg.total_caixas);
  document.getElementById('ov-premium').textContent = numero(rg.total_premium);
  document.getElementById('ov-doce').textContent = numero(rg.total_doce_kg);
  document.getElementById('ov-colheitas').textContent = numero(rg.total_colheitas);
}

async function carregar() {
  grade.innerHTML = '';
  gradeEnc.innerHTML = '';
  tituloEnc.classList.add('escondido');
  vazio.classList.add('escondido');
  overview.classList.add('escondido');

  try {
    const rg = await api.get('/resumo-geral');
    renderOverview(rg);
    const resumoPorId = new Map(rg.por_lavoura.map(r => [r.id, r]));

    if (!rg.total_lavouras) {
      vazio.classList.remove('escondido');
      return;
    }

    // ordena pelas mais recentes (id desc)
    const ordenadas = [...rg.por_lavoura].sort((a, b) => b.id - a.id);
    const lavouras = await api.get('/lavouras');
    const lavById = new Map(lavouras.map(l => [l.id, l]));

    const ativas = ordenadas.filter(r => r.ativa);
    const encerradas = ordenadas.filter(r => !r.ativa);
    ativas.forEach(r => grade.appendChild(cardLavoura(lavById.get(r.id), resumoPorId)));
    if (encerradas.length) {
      tituloEnc.classList.remove('escondido');
      encerradas.forEach(r => gradeEnc.appendChild(cardLavoura(lavById.get(r.id), resumoPorId)));
    }
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
