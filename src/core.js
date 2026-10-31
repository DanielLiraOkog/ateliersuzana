// Base: estado, salvamento, formatação, janelas (modal) e formulários.
const api = window.electronAPI || {
  load: () => fetch('/api/db').then((r) => r.json()),
  save: (d) => fetch('/api/db', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }),
  exportBackup: async () => { download('backup.json', JSON.stringify(S), 'application/json'); return true; },
  importBackup: () => pickFile('.json').then((t) => (t ? JSON.parse(t) : null)),
  openText: (ext) => pickFile('.' + ext),
  savePdf: async () => { window.print(); return true; },
  dataDir: async () => '(modo navegador)',
};
function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; a.click();
}
function pickFile(accept) {
  return new Promise((resolve) => {
    const i = document.createElement('input'); i.type = 'file'; i.accept = accept;
    i.onchange = () => (i.files[0] ? i.files[0].text().then(resolve) : resolve(null));
    i.click();
  });
}

let S; // todos os dados do programa

const STATUS = [
  ['orcamento', 'Orçamento'], ['aprovado', 'Aprovado'], ['producao', 'Em produção'],
  ['pronto', 'Pronto'], ['entregue', 'Entregue'], ['cancelado', 'Cancelado'],
];
const STATUS_NOME = Object.fromEntries(STATUS);
const FORMAS = ['Pix', 'Dinheiro', 'Cartão', 'Transferência', 'Boleto', 'PagSeguro', 'Outro'];
const CATEGORIAS_DESP = ['Material', 'Aluguel / Luz / Internet', 'Frete / Entrega', 'Embalagem', 'Equipamento', 'Outros'];

function defaults() {
  return {
    versao: 1,
    seq: { material: 0, produto: 0, cliente: 0, pedido: 0, numeroPedido: 0, despesa: 0, compra: 0 },
    config: { loja: 'Atelier Suzana Lira', salario: 1500, dias: 22, horas: 8, custoFixo: 100, margemAtacado: 30, margemVarejo: 50, telefone: '', rodapePedido: 'Obrigada pela preferência!' },
    materiais: [], produtos: [], clientes: [], pedidos: [], despesas: [], compras: [],
  };
}
function migrate(d) {
  const base = defaults();
  d.seq = { ...base.seq, ...(d.seq || {}) };
  d.config = { ...base.config, ...(d.config || {}) };
  for (const k of ['materiais', 'produtos', 'clientes', 'pedidos', 'despesas', 'compras']) d[k] = d[k] || [];
  return d;
}
const nextId = (k) => ++S.seq[k];

let saving = Promise.resolve();
function save() {
  const el = document.getElementById('saveState');
  el.textContent = 'Salvando…';
  const json = JSON.parse(JSON.stringify(S));
  saving = saving.then(() => api.save(json)).then(() => { el.textContent = 'Tudo salvo'; }).catch(() => { el.textContent = '⚠ Erro ao salvar'; });
  return saving;
}

// ---------- utilidades ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const num = (n, d = 2) => Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: d });
const iso = (d) => { const x = new Date(d); return new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const hoje = () => iso(new Date());
function ym(d) { return iso(d).slice(0, 7); }
const dataBR = (s) => (s ? s.split('-').reverse().join('/') : '');
const mesNome = (m) => new Date(m + '-15').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
const somaMes = (m, d) => String(new Date(new Date(m + '-15').setMonth(new Date(m + '-15').getMonth() + d)).toISOString().slice(0, 7));
const ui = { view: 'painel', mes: ym(new Date()), filtroPedido: 'abertos', busca: '', draft: null };
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const byId = (list, id) => list.find((x) => x.id === Number(id));
const nomeCliente = (id) => (byId(S.clientes, id) || {}).nome || '— sem cliente —';
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2600);
}

// ---------- fotos ----------
// Reduz a foto para no máx. 480 px (JPEG) para o arquivo de dados não crescer demais.
function redimensionar(file, max = 480) {
  return new Promise((resolve, reject) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
      const g = c.getContext('2d'); g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); resolve(c.toDataURL('image/jpeg', 0.78));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('imagem')); };
    img.src = url;
  });
}
// Miniatura da foto; sem foto mostra a inicial do nome.
const thumb = (foto, nome = '', tam = '') => foto
  ? `<span class="thumb ${tam}"><img src="${esc(foto)}" alt=""></span>`
  : `<span class="thumb ph ${tam}">${esc((String(nome).trim().charAt(0) || '?').toUpperCase())}</span>`;
const campoFoto = (foto, nome, rotulo = 'Foto do produto') => `<div class="foto-campo"><div class="foto-prev">${thumb(foto, nome, 'lg')}</div>
  <div class="foto-ctl"><b>${rotulo}</b><input type="hidden" name="foto" value="${esc(foto || '')}">
  <label class="btn sm filebtn">📷 Escolher foto<input type="file" accept="image/*" hidden id="fotoArquivo"></label><button type="button" class="btn sm" data-act="rmFoto">Remover</button>
  <small class="muted">Também dá para arrastar a imagem para esta janela ou colar com Ctrl+V.</small></div></div>`;
function ligarFoto(form) {
  const hid = $('[name=foto]', form), prev = $('.foto-prev', form);
  const nome = () => (form.nome ? form.nome.value : '');
  const por = (v) => { hid.value = v; prev.innerHTML = thumb(v, nome(), 'lg'); };
  const aceitar = async (file) => {
    if (!file || !file.type.startsWith('image/')) return toast('Escolha um arquivo de imagem (JPG ou PNG).');
    try { por(await redimensionar(file)); } catch (e) { toast('Não consegui abrir essa imagem. Tente JPG ou PNG.'); }
  };
  $('input[type=file]', form).addEventListener('change', (e) => { aceitar(e.target.files[0]); e.target.value = ''; });
  form.addEventListener('paste', (e) => { const f = [...((e.clipboardData && e.clipboardData.files) || [])][0]; if (f) { e.preventDefault(); aceitar(f); } });
  form.addEventListener('dragover', (e) => e.preventDefault());
  form.addEventListener('drop', (e) => { e.preventDefault(); aceitar(e.dataTransfer.files[0]); });
  form.addEventListener('click', (e) => { if (e.target.closest('[data-act=rmFoto]')) por(''); });
  form.addEventListener('input', (e) => { if (e.target.name === 'nome' && !hid.value) prev.innerHTML = thumb('', nome(), 'lg'); });
}

// ---------- formulários ----------
const F = {
  text: (n, l, v = '', a = '') => `<label>${l}<input name="${n}" value="${esc(v)}" ${a}></label>`,
  num: (n, l, v = '', a = '') => `<label>${l}<input name="${n}" type="number" step="any" value="${v}" ${a}></label>`,
  date: (n, l, v = '', a = '') => `<label>${l}<input name="${n}" type="date" value="${v}" ${a}></label>`,
  area: (n, l, v = '') => `<label class="full">${l}<textarea name="${n}" rows="3">${esc(v)}</textarea></label>`,
  select: (n, l, opts, v = '', a = '') =>
    `<label>${l}<select name="${n}" ${a}>${opts.map(([val, t]) => `<option value="${esc(val)}" ${String(val) === String(v) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`,
};
const formData = (form) => {
  const o = {};
  for (const [k, v] of new FormData(form)) o[k] = v;
  return o;
};

// Janela de formulário. onSubmit(dados) devolve false para manter aberta.
function openModal({ title, body, onSubmit, wide = false, submit = 'Salvar', onOpen }) {
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `<form class="modal ${wide ? 'wide' : ''}"><header><h2>${esc(title)}</h2><button type="button" class="x" data-close>×</button></header>
    <div class="modal-body">${body}</div>
    <footer><button type="button" class="btn ghost" data-close>Cancelar</button>${onSubmit ? `<button class="btn primary">${submit}</button>` : ''}</footer></form>`;
  document.body.appendChild(ov);
  const form = $('form', ov);
  const close = () => ov.remove();
  ov.addEventListener('mousedown', (e) => { if (e.target === ov) ov._down = true; });
  ov.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    if ((await onSubmit(formData(form), form)) !== false) close();
  });
  if (onOpen) onOpen(form, close);
  const first = $('input:not([type=hidden]),select,textarea', form); if (first) first.focus();
  return { form, close };
}
function confirmar(msg, onYes, yes = 'Excluir') {
  openModal({ title: 'Confirmar', body: `<p class="confirm">${esc(msg)}</p>`, submit: yes, onSubmit: () => { onYes(); } });
}

// ---------- ações por clique (data-act) ----------
const actions = {};
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (el && actions[el.dataset.act]) { e.preventDefault(); actions[el.dataset.act](el.dataset, el); }
});

const views = {};
function render() {
  $('#brandName').textContent = S.config.loja;
  document.title = S.config.loja;
  $$('#nav button').forEach((b) => b.classList.toggle('on', b.dataset.view === ui.view));
  const v = views[ui.view];
  $('#main').innerHTML = v();
  window.scrollTo(0, 0);
  if (views[ui.view + 'After']) views[ui.view + 'After']();
}
function go(view, extra) { Object.assign(ui, extra || {}, { view }); render(); }
actions.go = (d) => go(d.view);

// ---------- estoque ----------
// Quanto de cada material um item de pedido consome.
function consumoItem(item) {
  const p = byId(S.produtos, item.produtoId);
  if (!p) return [];
  const out = [];
  const tecido = item.tecidoId || p.tecidoId;
  if (tecido && p.consumoTecido) out.push({ materialId: Number(tecido), qtd: p.consumoTecido * item.qtd });
  (p.aviamentos || []).forEach((a) => out.push({ materialId: Number(a.materialId), qtd: a.qtd * item.qtd }));
  return out;
}
function ajustarEstoque(lista, sinal) {
  lista.forEach((c) => { const m = byId(S.materiais, c.materialId); if (m) m.estoque = Calc.r2((m.estoque || 0) + sinal * c.qtd); });
}
const BAIXA_EM = ['producao', 'pronto', 'entregue'];
// Mantém o estoque coerente com o status do pedido (baixa ao entrar em produção, devolve se voltar/cancelar).
function sincronizarEstoque(p) {
  if (p.baixa) { ajustarEstoque(p.baixa, +1); p.baixa = null; }
  if (BAIXA_EM.includes(p.status)) {
    const tot = {};
    p.itens.flatMap(consumoItem).forEach((c) => { tot[c.materialId] = (tot[c.materialId] || 0) + c.qtd; });
    p.baixa = Object.entries(tot).map(([materialId, qtd]) => ({ materialId: Number(materialId), qtd: Calc.r2(qtd) }));
    ajustarEstoque(p.baixa, -1);
  }
}
