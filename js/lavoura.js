import { api, auth, mostrarMensagem, limparMensagem, exigirLogin } from './api.js';

if (!exigirLogin()) { /* redirecionou */ }

const usuario = auth.usuario();
if (usuario) document.getElementById('nome-usuario').textContent = `Olá, ${usuario.nome}`;
document.getElementById('btn-sair').addEventListener('click', () => auth.sair());

const params = new URLSearchParams(window.location.search);
const lavouraId = parseInt(params.get('id'), 10);
if (!lavouraId) window.location.replace('lavouras.html');

let lavouraAtual = null;
let colheitas = [];
let resumo = null;
const graficos = {};

// =========================
// Helpers
// =========================
const moeda = (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const numero = (v) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const dataBr = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};
const hoje = () => new Date().toISOString().slice(0, 10);

function receitaBrutaColheita(c) {
  return c.qtd_caixas * c.preco_caixa + c.qtd_premium * c.preco_premium + c.doce_kg * c.preco_doce_kg;
}
function custoEmbalagemColheita(c) {
  return c.qtd_caixas * c.custo_embalagem_caixa + c.qtd_premium * c.custo_embalagem_premium;
}

// =========================
// Tabs
// =========================
const botoesAba = document.querySelectorAll('.tabs button');
const conteudos = document.querySelectorAll('.aba-conteudo');
botoesAba.forEach(b => b.addEventListener('click', () => {
  botoesAba.forEach(x => x.classList.toggle('ativa', x === b));
  const alvo = b.dataset.aba;
  conteudos.forEach(c => c.classList.toggle('escondido', c.dataset.aba !== alvo));
  if (alvo === 'dashboard') renderDashboard();
}));

// =========================
// Carregar lavoura + colheitas
// =========================
async function carregarTudo() {
  try {
    const [lav, cols] = await Promise.all([
      api.get(`/lavouras/${lavouraId}`),
      api.get(`/lavouras/${lavouraId}/colheitas`),
    ]);
    lavouraAtual = lav;
    colheitas = cols;

    document.getElementById('titulo-lavoura').textContent = lav.nome;
    const tipoLabel = { estufa: 'Estufa', campo: 'Campo', outro: 'Outro' }[lav.tipo] || lav.tipo;
    document.getElementById('meta-lavoura').textContent =
      `${tipoLabel} • Safra ${lav.ano_safra}${lav.ativa ? '' : ' • Encerrada'}`;

    preencherFormRegistrar();
    preencherFormConfig();
    renderTabela();
  } catch (err) {
    if (err.status === 404) mostrarMensagem('#msg', 'erro', 'Lavoura não encontrada.');
    else mostrarMensagem('#msg', 'erro', err.message || 'Erro ao carregar.');
  }
}

// =========================
// Aba REGISTRAR
// =========================
function preencherFormRegistrar() {
  document.getElementById('r-data').value = hoje();
  if (colheitas.length) {
    const ultima = colheitas[colheitas.length - 1];
    document.getElementById('r-emb-caixa').value = ultima.custo_embalagem_caixa || 0;
    document.getElementById('r-emb-premium').value = ultima.custo_embalagem_premium || 0;
    document.getElementById('r-preco-caixa').value = ultima.preco_caixa || 0;
    document.getElementById('r-preco-premium').value = ultima.preco_premium || 0;
    document.getElementById('r-preco-doce').value = ultima.preco_doce_kg || 0;
  }
}

document.getElementById('form-registrar').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  limparMensagem('#msg-registrar');
  const val = (id) => parseFloat(document.getElementById(id).value || '0');
  const dados = {
    data: document.getElementById('r-data').value,
    qtd_caixas: val('r-qtd-caixas'),
    preco_caixa: val('r-preco-caixa'),
    qtd_premium: val('r-qtd-premium'),
    preco_premium: val('r-preco-premium'),
    doce_kg: val('r-doce-kg'),
    preco_doce_kg: val('r-preco-doce'),
    custo_embalagem_caixa: val('r-emb-caixa'),
    custo_embalagem_premium: val('r-emb-premium'),
  };
  const obs = document.getElementById('r-obs').value.trim();
  if (obs) dados.observacao = obs;

  if (dados.qtd_caixas === 0 && dados.qtd_premium === 0 && dados.doce_kg === 0) {
    mostrarMensagem('#msg-registrar', 'erro', 'Pelo menos um dos tipos (caixa, premium ou doce) precisa ter quantidade > 0.');
    return;
  }

  const botao = ev.target.querySelector('button[type=submit]');
  botao.disabled = true;
  botao.textContent = 'Salvando...';
  try {
    await api.post(`/lavouras/${lavouraId}/colheitas`, dados);
    mostrarMensagem('#msg-registrar', 'sucesso', `Colheita de ${dataBr(dados.data)} registrada!`);
    document.getElementById('r-obs').value = '';
    document.getElementById('r-qtd-caixas').value = 0;
    document.getElementById('r-qtd-premium').value = 0;
    document.getElementById('r-doce-kg').value = 0;
    colheitas = await api.get(`/lavouras/${lavouraId}/colheitas`);
    renderTabela();
    resumo = null;
  } catch (err) {
    let msg = err.message || 'Erro ao salvar.';
    if (err.status === 409) msg = 'Já existe uma colheita registrada nessa data. Vá na Tabela pra editar.';
    mostrarMensagem('#msg-registrar', 'erro', msg);
  } finally {
    botao.disabled = false;
    botao.textContent = 'Salvar colheita';
  }
});

// =========================
// Aba TABELA
// =========================
function renderTabela() {
  const tbody = document.querySelector('#tabela-colheitas tbody');
  const vazio = document.getElementById('tabela-vazia');
  const tabela = document.getElementById('tabela-colheitas');
  const btnExp = document.getElementById('btn-exportar-csv');
  tbody.innerHTML = '';

  if (!colheitas.length) {
    vazio.classList.remove('escondido');
    tabela.classList.add('escondido');
    btnExp.disabled = true;
    return;
  }
  vazio.classList.add('escondido');
  tabela.classList.remove('escondido');
  btnExp.disabled = false;

  const ordenadas = [...colheitas].sort((a, b) => b.data.localeCompare(a.data));
  for (const c of ordenadas) {
    const bruta = receitaBrutaColheita(c);
    const liquida = bruta - custoEmbalagemColheita(c);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${dataBr(c.data)}</td>
      <td>${c.qtd_caixas ? `${numero(c.qtd_caixas)} × ${moeda(c.preco_caixa)}` : '—'}</td>
      <td>${c.qtd_premium ? `${numero(c.qtd_premium)} × ${moeda(c.preco_premium)}` : '—'}</td>
      <td>${c.doce_kg ? `${numero(c.doce_kg)}kg × ${moeda(c.preco_doce_kg)}` : '—'}</td>
      <td>${moeda(bruta)}</td>
      <td><strong>${moeda(liquida)}</strong></td>
      <td class="acoes">
        <button class="btn-icone" data-acao="editar" data-id="${c.id}" title="Editar">✏️</button>
        <button class="btn-icone excluir" data-acao="excluir" data-id="${c.id}" title="Excluir">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  }
}

document.querySelector('#tabela-colheitas tbody').addEventListener('click', async (ev) => {
  const btn = ev.target.closest('button[data-acao]');
  if (!btn) return;
  const id = parseInt(btn.dataset.id, 10);
  const colheita = colheitas.find(c => c.id === id);
  if (!colheita) return;

  if (btn.dataset.acao === 'excluir') {
    if (!confirm(`Excluir a colheita de ${dataBr(colheita.data)}? Esta ação não pode ser desfeita.`)) return;
    try {
      await api.delete(`/colheitas/${id}`);
      colheitas = colheitas.filter(c => c.id !== id);
      renderTabela();
      resumo = null;
    } catch (err) {
      mostrarMensagem('#msg-tabela', 'erro', err.message || 'Erro ao excluir.');
    }
  } else if (btn.dataset.acao === 'editar') {
    abrirModalEdicao(colheita);
  }
});

// =========================
// Modal de edição
// =========================
const modalEditar = document.getElementById('modal-editar');
let colheitaEditando = null;

function abrirModalEdicao(c) {
  colheitaEditando = c;
  limparMensagem('#msg-editar');
  document.getElementById('modal-data').textContent = `Data: ${dataBr(c.data)}`;
  document.getElementById('e-qtd-caixas').value = c.qtd_caixas;
  document.getElementById('e-preco-caixa').value = c.preco_caixa;
  document.getElementById('e-qtd-premium').value = c.qtd_premium;
  document.getElementById('e-preco-premium').value = c.preco_premium;
  document.getElementById('e-doce-kg').value = c.doce_kg;
  document.getElementById('e-preco-doce').value = c.preco_doce_kg;
  document.getElementById('e-emb-caixa').value = c.custo_embalagem_caixa;
  document.getElementById('e-emb-premium').value = c.custo_embalagem_premium;
  document.getElementById('e-obs').value = c.observacao || '';
  modalEditar.classList.remove('escondido');
}

function fecharModalEdicao() {
  modalEditar.classList.add('escondido');
  colheitaEditando = null;
}

document.getElementById('btn-editar-cancelar').addEventListener('click', fecharModalEdicao);
modalEditar.addEventListener('click', (e) => { if (e.target === modalEditar) fecharModalEdicao(); });

document.getElementById('form-editar').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  if (!colheitaEditando) return;
  limparMensagem('#msg-editar');
  const val = (id) => parseFloat(document.getElementById(id).value || '0');
  const dados = {
    qtd_caixas: val('e-qtd-caixas'),
    preco_caixa: val('e-preco-caixa'),
    qtd_premium: val('e-qtd-premium'),
    preco_premium: val('e-preco-premium'),
    doce_kg: val('e-doce-kg'),
    preco_doce_kg: val('e-preco-doce'),
    custo_embalagem_caixa: val('e-emb-caixa'),
    custo_embalagem_premium: val('e-emb-premium'),
    observacao: document.getElementById('e-obs').value.trim() || null,
  };
  const botao = ev.target.querySelector('button[type=submit]');
  botao.disabled = true;
  botao.textContent = 'Salvando...';
  try {
    await api.patch(`/colheitas/${colheitaEditando.id}`, dados);
    colheitas = await api.get(`/lavouras/${lavouraId}/colheitas`);
    renderTabela();
    resumo = null;
    fecharModalEdicao();
  } catch (err) {
    mostrarMensagem('#msg-editar', 'erro', err.message || 'Erro ao salvar.');
  } finally {
    botao.disabled = false;
    botao.textContent = 'Salvar';
  }
});

// =========================
// Exportar CSV
// =========================
document.getElementById('btn-exportar-csv').addEventListener('click', () => {
  if (!colheitas.length) return;
  const cabecalho = [
    'Data', 'Qtd caixas', 'Preço caixa (R$)',
    'Qtd premium', 'Preço premium (R$)',
    'Doce (kg)', 'Preço doce/kg (R$)',
    'Custo embalagem caixa (R$)', 'Custo embalagem premium (R$)',
    'Receita bruta (R$)', 'Custo embalagem (R$)', 'Receita líquida (R$)',
    'Observação',
  ];
  const ordenadas = [...colheitas].sort((a, b) => a.data.localeCompare(b.data));
  const linhas = ordenadas.map(c => {
    const bruta = receitaBrutaColheita(c);
    const custo = custoEmbalagemColheita(c);
    return [
      c.data,
      c.qtd_caixas, c.preco_caixa,
      c.qtd_premium, c.preco_premium,
      c.doce_kg, c.preco_doce_kg,
      c.custo_embalagem_caixa, c.custo_embalagem_premium,
      bruta.toFixed(2), custo.toFixed(2), (bruta - custo).toFixed(2),
      (c.observacao || '').replace(/[\r\n]+/g, ' '),
    ];
  });
  const escapar = (v) => {
    const s = String(v ?? '');
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [cabecalho, ...linhas].map(l => l.map(escapar).join(';')).join('\r\n');
  // BOM pra Excel detectar UTF-8 com acentos
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const nome = `${lavouraAtual.nome.replace(/[^\w-]+/g, '_')}_${lavouraAtual.ano_safra}.csv`;
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

// =========================
// Aba DASHBOARD
// =========================
async function renderDashboard() {
  const vazio = document.getElementById('dashboard-vazio');
  const conteudo = document.getElementById('dashboard-conteudo');
  if (!colheitas.length) {
    vazio.classList.remove('escondido');
    conteudo.classList.add('escondido');
    return;
  }
  vazio.classList.add('escondido');
  conteudo.classList.remove('escondido');

  try {
    if (!resumo) resumo = await api.get(`/lavouras/${lavouraId}/resumo`);
  } catch (err) {
    mostrarMensagem('#msg', 'erro', 'Erro ao carregar resumo: ' + (err.message || ''));
    return;
  }

  document.getElementById('d-receita-bruta').textContent = moeda(resumo.receita_bruta);
  document.getElementById('d-custo-emb').textContent = moeda(resumo.custo_embalagem_total);
  document.getElementById('d-receita-liquida').textContent = moeda(resumo.receita_liquida);
  document.getElementById('d-total-caixas').textContent = numero(resumo.total_caixas);
  document.getElementById('d-total-premium').textContent = numero(resumo.total_premium);
  document.getElementById('d-total-doce').textContent = numero(resumo.total_doce_kg);
  document.getElementById('d-preco-med-cx').textContent = resumo.media_preco_caixa != null ? moeda(resumo.media_preco_caixa) : '—';
  document.getElementById('d-preco-med-pr').textContent = resumo.media_preco_premium != null ? moeda(resumo.media_preco_premium) : '—';

  renderGraficos();
}

function renderGraficos() {
  const ordenadas = [...colheitas].sort((a, b) => a.data.localeCompare(b.data));
  const labels = ordenadas.map(c => dataBr(c.data));
  const qtdCaixas = ordenadas.map(c => c.qtd_caixas);
  const qtdPremium = ordenadas.map(c => c.qtd_premium);
  const doceKg = ordenadas.map(c => c.doce_kg);
  const receitaDia = ordenadas.map(c => receitaBrutaColheita(c));
  const liquidaDia = ordenadas.map(c => receitaBrutaColheita(c) - custoEmbalagemColheita(c));

  let acumulada = 0;
  const acumuladaArr = liquidaDia.map(v => (acumulada += v, acumulada));

  const precoCaixa = ordenadas.map(c => c.qtd_caixas > 0 ? c.preco_caixa : null);
  const precoPremium = ordenadas.map(c => c.qtd_premium > 0 ? c.preco_premium : null);
  const precoDoce = ordenadas.map(c => c.doce_kg > 0 ? c.preco_doce_kg : null);

  const corCaixa = '#d62828';   // vermelho morango — fruta
  const corPremium = '#2e7d32'; // verde folha — premium
  const corDoce = '#b08543';    // caramelo — doce

  const baseOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' } },
    interaction: { mode: 'index', intersect: false },
  };

  destruirGrafico('qtd');
  graficos.qtd = new Chart(document.getElementById('grafico-qtd'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Caixas', data: qtdCaixas, backgroundColor: corCaixa },
        { label: 'Premium', data: qtdPremium, backgroundColor: corPremium },
        { label: 'Doce (kg)', data: doceKg, backgroundColor: corDoce },
      ],
    },
    options: { ...baseOpts, scales: { x: { stacked: false }, y: { beginAtZero: true } } },
  });

  destruirGrafico('receita');
  graficos.receita = new Chart(document.getElementById('grafico-receita'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Bruta (R$)', data: receitaDia, backgroundColor: corCaixa },
        { label: 'Líquida (R$)', data: liquidaDia, backgroundColor: corPremium },
      ],
    },
    options: { ...baseOpts, scales: { y: { beginAtZero: true } } },
  });

  destruirGrafico('acumulado');
  graficos.acumulado = new Chart(document.getElementById('grafico-acumulado'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Receita líquida acumulada (R$)',
        data: acumuladaArr,
        borderColor: corCaixa,
        backgroundColor: 'rgba(201, 53, 83, 0.15)',
        fill: true,
        tension: 0.25,
      }],
    },
    options: { ...baseOpts, scales: { y: { beginAtZero: true } } },
  });

  destruirGrafico('preco');
  graficos.preco = new Chart(document.getElementById('grafico-preco'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Preço caixa (R$)', data: precoCaixa, borderColor: corCaixa, backgroundColor: corCaixa, spanGaps: true, tension: 0.2 },
        { label: 'Preço premium (R$)', data: precoPremium, borderColor: corPremium, backgroundColor: corPremium, spanGaps: true, tension: 0.2 },
        { label: 'Preço doce/kg (R$)', data: precoDoce, borderColor: corDoce, backgroundColor: corDoce, spanGaps: true, tension: 0.2 },
      ],
    },
    options: { ...baseOpts, scales: { y: { beginAtZero: false } } },
  });
}

function destruirGrafico(nome) {
  if (graficos[nome]) { graficos[nome].destroy(); delete graficos[nome]; }
}

// =========================
// Aba CONFIGURAR
// =========================
function preencherFormConfig() {
  document.getElementById('c-nome').value = lavouraAtual.nome;
  document.getElementById('c-tipo').value = lavouraAtual.tipo;
  document.getElementById('c-inicio').value = lavouraAtual.data_inicio || '';
  document.getElementById('c-fim').value = lavouraAtual.data_fim || '';
  document.getElementById('c-obs').value = lavouraAtual.observacao || '';
  document.getElementById('btn-toggle-ativa').textContent = lavouraAtual.ativa ? 'Encerrar safra' : 'Reativar safra';
}

document.getElementById('form-config').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  limparMensagem('#msg-config');
  const dados = {
    nome: document.getElementById('c-nome').value.trim(),
    tipo: document.getElementById('c-tipo').value,
    data_inicio: document.getElementById('c-inicio').value || null,
    data_fim: document.getElementById('c-fim').value || null,
    observacao: document.getElementById('c-obs').value.trim() || null,
  };
  try {
    lavouraAtual = await api.patch(`/lavouras/${lavouraId}`, dados);
    mostrarMensagem('#msg-config', 'sucesso', 'Alterações salvas.');
    document.getElementById('titulo-lavoura').textContent = lavouraAtual.nome;
  } catch (err) {
    mostrarMensagem('#msg-config', 'erro', err.message || 'Erro ao salvar.');
  }
});

document.getElementById('btn-toggle-ativa').addEventListener('click', async () => {
  const acao = lavouraAtual.ativa ? 'encerrar' : 'reativar';
  if (!confirm(`Confirma ${acao} esta lavoura?`)) return;
  try {
    lavouraAtual = await api.patch(`/lavouras/${lavouraId}`, { ativa: !lavouraAtual.ativa });
    preencherFormConfig();
    const tipoLabel = { estufa: 'Estufa', campo: 'Campo', outro: 'Outro' }[lavouraAtual.tipo] || lavouraAtual.tipo;
    document.getElementById('meta-lavoura').textContent =
      `${tipoLabel} • Safra ${lavouraAtual.ano_safra}${lavouraAtual.ativa ? '' : ' • Encerrada'}`;
    mostrarMensagem('#msg-config', 'sucesso', `Lavoura ${lavouraAtual.ativa ? 'reativada' : 'encerrada'}.`);
  } catch (err) {
    mostrarMensagem('#msg-config', 'erro', err.message || 'Erro ao atualizar.');
  }
});

document.getElementById('btn-excluir').addEventListener('click', async () => {
  const conf = prompt(`Pra excluir esta lavoura e TODAS as ${colheitas.length} colheitas, digite o nome dela: ${lavouraAtual.nome}`);
  if (conf !== lavouraAtual.nome) {
    if (conf !== null) alert('Nome não confere. Exclusão cancelada.');
    return;
  }
  try {
    await api.delete(`/lavouras/${lavouraId}`);
    window.location.href = 'lavouras.html';
  } catch (err) {
    mostrarMensagem('#msg-config', 'erro', err.message || 'Erro ao excluir.');
  }
});

carregarTudo();
