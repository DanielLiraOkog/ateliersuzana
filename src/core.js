// Base: estado, salvamento, formatação, janelas (modal) e formulários.
const api = window.electronAPI || {
  load: () => fetch('/api/db').then((r) => r.json()),
  save: (d) => fetch('/api/db', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }),
  exportBackup: async () => { download('backup.json', JSON.stringify(S), 'application/json'); return true; },
  importBackup: () => pickFile('.json').then((t) => (t ? JSON.parse(t) : null)),
  openText: (ext) => pickFile('.' + ext),
  savePdf: async () => { window.print(); return true; },
  dataDir: async () => '(modo navegador)',
  appVersion: async () => 'navegador',
  getSettings: async () => ({ backupDir: '(modo navegador)', frequencia: 'diario', manter: 30, ultimo: 0, ultimoErro: null, dataDir: '(modo navegador)' }),
  setSettings: async (p) => ({ backupDir: '(modo navegador)', frequencia: p.frequencia || 'diario', manter: p.manter || 30, ultimo: 0, ultimoErro: null }),
  chooseBackupDir: async () => null, backupNow: async () => ({ ok: false, erro: 'Disponível só no programa instalado.' }),
  listBackups: async () => [], readBackup: async () => null, safetyCopy: async () => false, openBackupFolder: async () => false, setIcon: async () => true,
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
    seq: { material: 0, produto: 0, kit: 0, cliente: 0, pedido: 0, numeroPedido: 0, despesa: 0, compra: 0 },
    config: { loja: 'Atelier Suzana Lira', salario: 1500, dias: 22, horas: 8, custoFixo: 100, margemAtacado: 30, margemVarejo: 50, telefone: '', rodapePedido: 'Obrigada pela preferência!' },
    materiais: [], produtos: [], kits: [], clientes: [], pedidos: [], despesas: [], compras: [],
  };
}
function migrate(d) {
  const base = defaults();
  d.seq = { ...base.seq, ...(d.seq || {}) };
  d.config = { ...base.config, ...(d.config || {}) };
  for (const k of ['materiais', 'produtos', 'kits', 'clientes', 'pedidos', 'despesas', 'compras']) d[k] = d[k] || [];
  return d;
}
const nextId = (k) => ++S.seq[k];

let saving = Promise.resolve();
function save() {
  const el = document.getElementById('saveState');
  el.textContent = 'Salvando…';
  const json = JSON.parse(JSON.stringify(S));
  saving = saving.then(() => api.save(json)).then(() => { el.textContent = 'Tudo salvo'; }).catch(() => { el.textContent = 'Não foi possível salvar'; });
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
// Reduz a foto para no máx. 640 px (JPEG) para o arquivo de dados não crescer demais.
function redimensionar(file, max = 640, png = false) {
  return new Promise((resolve, reject) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
      const g = c.getContext('2d'); if (!png) { g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height); } g.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); resolve(png ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.78));
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
  <label class="btn sm filebtn">${icon('camera')} Escolher foto<input type="file" accept="image/*" hidden id="fotoArquivo"></label><button type="button" class="btn sm" data-act="rmFoto">Remover</button>
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
let modalSeq = 0;
function openModal({ title, body, onSubmit, wide = false, submit = 'Salvar', onOpen }) {
  const antes = document.activeElement, tid = 'modalTitulo' + (++modalSeq);
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `<form class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="${tid}"><header><h2 id="${tid}">${esc(title)}</h2><button type="button" class="x" data-close aria-label="Fechar">×</button></header>
    <div class="modal-body">${body}</div>
    <footer><button type="button" class="btn ghost" data-close>${onSubmit ? 'Cancelar' : 'Fechar'}</button>${onSubmit ? `<button class="btn primary">${submit}</button>` : ''}</footer></form>`;
  document.body.appendChild(ov);
  const form = $('form', ov);
  const close = () => { ov.remove(); if (antes && antes.isConnected && antes.focus) antes.focus(); };
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

// ---------- ícones próprios (traço), no lugar de emojis ----------
const ICON = {
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="1.8"/><path d="M21 16l-5-5-8 8"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.6 2.7-6 6-6s6 2.4 6 6"/><circle cx="17" cy="9" r="2.4"/><path d="M16.5 14.2c2.9.3 4.5 2.3 4.5 5.3"/>',
  shirt: '<path d="M8 3L3 6l2 4 3-1v11h8V9l3 1 2-4-5-3c-.5 1.5-2 2.5-4 2.5S8.5 4.5 8 3z"/>',
  gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M5 12v8h14v-8"/><path d="M12 8C9.5 4 6 4.5 6.5 6.8 6.9 8.4 9.5 8 12 8zm0 0c2.5-4 6-3.5 5.5-1.2-.4 1.6-3 1.2-5.5 1.200z"/>',
  spool: '<ellipse cx="12" cy="5.5" rx="7" ry="2.5"/><ellipse cx="12" cy="18.5" rx="7" ry="2.5"/><path d="M5 5.500v13M19 5.500v13M5 10c4 2 10 2 14 0M5 14.500c4 2 10 2 14 0"/>',
  wallet: '<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10h18"/><circle cx="16.5" cy="14.5" r="1.3"/>',
  sliders: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2.2"/><circle cx="8" cy="17" r="2.2"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  camera: '<path d="M4 8h3l1.5-2.500h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.4"/>',
  scissors: '<circle cx="6" cy="6.5" r="2.7"/><circle cx="6" cy="17.5" r="2.7"/><path d="M8.2 8.100L20 19M8.2 15.900L20 5"/>',
  printer: '<path d="M7 9V3h10v6M7 17H4v-7h16v7h-3"/><rect x="7" y="14" width="10" height="7"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17.200v.1"/>',
  check: '<path d="M5 12.500l4.5 4.500L19 7.5"/>',
};
const icon = (n) => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICON[n] || ''}</svg>`;
// Estado vazio: explica e já oferece o próximo passo.
const vazio = (titulo, texto, acao, rotulo, view) => `<div class="vazio"><span class="vazio-ic">${icon('image')}</span><b>${esc(titulo)}</b><p>${esc(texto)}</p>${acao ? `<button type="button" class="btn primary" data-act="${acao}"${view ? ` data-view="${view}"` : ''}>${esc(rotulo)}</button>` : ''}</div>`;

const views = {};
const aplicarLogo = () => api.setIcon(S.config.logo || '');
function render() {
  $('#brandName').textContent = S.config.loja;
  const lg = $('.brand .logo'), logo = S.config.logo;
  lg.classList.toggle('img', !!logo); lg.innerHTML = logo ? `<img src="${esc(logo)}" alt="">` : icon('scissors');
  document.title = S.config.loja;
  $$('#nav button').forEach((b) => { const on = b.dataset.view === (ui.view === 'pedido' ? 'pedidos' : ui.view); b.classList.toggle('on', on); if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
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
  if (item.kitId) { // kit: soma o consumo de cada produto que ele leva
    const k = byId(S.kits, item.kitId);
    return k ? k.itens.flatMap((c) => consumoItem({ produtoId: Number(c.produtoId), tecidoId: c.tecidoId, qtd: c.qtd * item.qtd })) : [];
  }
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

// Teclado nas janelas: Esc fecha; Tab fica dentro da janela aberta.
document.addEventListener('keydown', (e) => {
  const ov = $$('.overlay').pop();
  if (!ov) return;
  if (e.key === 'Escape') { const x = $('[data-close]', ov); if (x) { e.preventDefault(); x.click(); } return; }
  if (e.key !== 'Tab') return;
  const f = $$('button:not([disabled]),input:not([type=hidden]):not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])', ov).filter((el) => el.offsetParent !== null);
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (!ov.contains(document.activeElement) || (e.shiftKey && document.activeElement === first)) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});
