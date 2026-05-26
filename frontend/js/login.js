import { api, auth, mostrarMensagem, limparMensagem } from './api.js';

// Se ja esta logado, vai direto pra lista de lavouras.
if (auth.logado()) {
  window.location.replace('lavouras.html');
}

const tabLogin = document.getElementById('tab-login');
const tabCadastro = document.getElementById('tab-cadastro');
const formLogin = document.getElementById('form-login');
const formCadastro = document.getElementById('form-cadastro');

function mostrarLogin() {
  tabLogin.classList.add('ativa');
  tabCadastro.classList.remove('ativa');
  formLogin.classList.remove('escondido');
  formCadastro.classList.add('escondido');
  limparMensagem('#msg');
}

function mostrarCadastro() {
  tabCadastro.classList.add('ativa');
  tabLogin.classList.remove('ativa');
  formCadastro.classList.remove('escondido');
  formLogin.classList.add('escondido');
  limparMensagem('#msg');
}

tabLogin.addEventListener('click', mostrarLogin);
tabCadastro.addEventListener('click', mostrarCadastro);

formLogin.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  limparMensagem('#msg');
  const email = document.getElementById('login-email').value.trim();
  const senha = document.getElementById('login-senha').value;

  const form = new URLSearchParams();
  form.append('username', email);
  form.append('password', senha);

  const botao = formLogin.querySelector('button[type=submit]');
  botao.disabled = true;
  botao.textContent = 'Entrando...';
  try {
    const r = await api.post('/auth/login', form, { naoRedirecionar: true });
    auth.salvar(r.access_token);
    // pega dados do usuario logado e salva
    try {
      const usuario = await api.get('/me');
      auth.salvar(r.access_token, usuario);
    } catch (_) { /* ignora — token ja salvo */ }
    window.location.href = 'lavouras.html';
  } catch (err) {
    const msg = err.status === 401
      ? 'Email ou senha inválidos.'
      : (err.message || 'Erro ao entrar. Tente novamente.');
    mostrarMensagem('#msg', 'erro', msg);
    botao.disabled = false;
    botao.textContent = 'Entrar';
  }
});

formCadastro.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  limparMensagem('#msg');
  const nome = document.getElementById('cad-nome').value.trim();
  const email = document.getElementById('cad-email').value.trim();
  const senha = document.getElementById('cad-senha').value;

  const botao = formCadastro.querySelector('button[type=submit]');
  botao.disabled = true;
  botao.textContent = 'Criando...';
  try {
    await api.post('/auth/registrar', { nome, email, senha }, { naoRedirecionar: true });
    // Apos cadastro, faz login automatico
    const form = new URLSearchParams();
    form.append('username', email);
    form.append('password', senha);
    const r = await api.post('/auth/login', form, { naoRedirecionar: true });
    auth.salvar(r.access_token, { id: 0, nome, email });
    window.location.href = 'lavouras.html';
  } catch (err) {
    let msg = err.message || 'Erro ao cadastrar.';
    if (err.status === 409) msg = 'Esse email já está cadastrado. Faça login.';
    if (Array.isArray(err.detalhe)) {
      // validacao Pydantic
      msg = err.detalhe.map(e => e.msg).join(' | ');
    }
    mostrarMensagem('#msg', 'erro', msg);
    botao.disabled = false;
    botao.textContent = 'Criar conta';
  }
});
