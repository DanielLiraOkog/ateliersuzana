// ---------- lista de pedidos ----------
views.pedidos = function () {
  const f = ui.filtroPedido;
  const filtros = [['abertos', 'Em aberto'], ['orcamento', 'Orçamentos'], ['producao', 'Em produção'], ['entregue', 'Entregues'], ['cancelado', 'Cancelados'], ['todos', 'Todos']];
  let lista = S.pedidos.filter((p) => (f === 'todos' ? true : f === 'abertos' ? ['aprovado', 'producao', 'pronto'].includes(p.status) : p.status === f));
  const q = norm(ui.busca);
  if (q) lista = lista.filter((p) => norm(nomeCliente(p.clienteId) + ' ' + p.numero).includes(q));
  lista.sort((a, b) => b.numero - a.numero);
  return `<div class="page-head"><h1>Pedidos</h1><button class="btn primary" data-act="novoPedido">+ Novo pedido</button></div>
    <div class="toolbar"><div class="chips">${filtros.map(([k, t]) => `<button class="chip ${f === k ? 'on' : ''}" data-act="filtrarPedidos" data-f="${k}">${t}</button>`).join('')}</div>
      <input class="search" id="busca" placeholder="Buscar cliente ou nº…" value="${esc(ui.busca)}"></div>
    ${lista.length ? `<table class="t"><thead><tr><th>Nº</th><th>Cliente</th><th>Pedido em</th><th>Entrega</th><th>Status</th><th class="r">Total</th><th class="r">Falta receber</th></tr></thead><tbody>
      ${lista.map((p) => { const s = saldoPedido(p); return `<tr class="click" data-act="abrirPedido" data-id="${p.id}"><td>#${p.numero}</td><td>${esc(nomeCliente(p.clienteId))}</td><td>${dataBR(p.data)}</td>
        <td>${dataBR(p.entrega)}</td><td><span class="tag s-${p.status}">${STATUS_NOME[p.status]}</span></td><td class="r">${money(Calc.totalPedido(p))}</td>
        <td class="r ${s > 0 && p.status !== 'cancelado' ? 'warn' : 'muted'}">${p.status === 'cancelado' ? '—' : s > 0 ? money(s) : 'pago ✓'}</td></tr>`; }).join('')}
    </tbody></table>` : '<p class="empty big">Nenhum pedido aqui ainda.</p>'}`;
};
views.pedidosAfter = function () {
  const b = $('#busca'); if (!b) return;
  b.addEventListener('input', () => {
    ui.busca = b.value; const pos = b.selectionStart; render(); const nb = $('#busca'); nb.focus(); nb.setSelectionRange(pos, pos);
  });
};
actions.filtrarPedidos = (d) => go('pedidos', { filtroPedido: d.f });
actions.novoPedido = () => {
  ui.draft = { id: null, numero: null, clienteId: '', data: hoje(), entrega: '', status: 'orcamento', itens: [], frete: 0, desconto: 0, pagamentos: [], obs: '', baixa: null };
  go('pedido');
};
actions.abrirPedido = (d) => { ui.draft = JSON.parse(JSON.stringify(byId(S.pedidos, d.id))); go('pedido'); };

// ---------- editor de pedido ----------
const opcoesProdutos = () => [['', '— escolha o produto —'], ...S.produtos.map((p) => [p.id, p.nome])];
const opcoesTecidos = () => [['', 'tecido padrão do produto'], ...S.materiais.filter((m) => m.tipo === 'tecido').map((m) => [m.id, m.nome])];

function linhaItem(i, idx) {
  const p = byId(S.produtos, i.produtoId);
  return `<tr data-idx="${idx}">
    <td>${F.select('produtoId', '', opcoesProdutos(), i.produtoId, 'class="it-prod"').replace('<label>', '<label class="bare">')}</td>
    <td>${F.select('tecidoId', '', opcoesTecidos(), i.tecidoId || '', 'class="it-tec"').replace('<label>', '<label class="bare">')}</td>
    <td><input class="it-desc" placeholder="cor, tamanho, detalhes" value="${esc(i.descricao || '')}"></td>
    <td><input class="it-qtd w60" type="number" min="1" step="1" value="${i.qtd}"></td>
    <td><select class="it-tipo w90"><option value="atacado" ${i.tipoPreco === 'atacado' ? 'selected' : ''}>Atacado</option><option value="varejo" ${i.tipoPreco !== 'atacado' ? 'selected' : ''}>Varejo</option></select></td>
    <td><input class="it-preco w90" type="number" step="0.01" min="0" value="${i.preco}"></td>
    <td class="r it-sub">${money(i.qtd * i.preco)}</td>
    <td><button type="button" class="icon" data-act="rmItem" data-idx="${idx}" title="Remover">🗑</button></td></tr>`;
}

function precoSugerido(item) {
  const p = byId(S.produtos, item.produtoId);
  if (!p) return { custo: 0, preco: 0 };
  const custo = Calc.custoProduto(S, p, item.tecidoId).total;
  const margem = item.tipoPreco === 'atacado' ? p.margemAtacado : p.margemVarejo;
  return { custo, preco: Calc.preco(custo, margem) };
}

views.pedido = function () {
  const d = ui.draft;
  if (!d) return views.pedidos();
  const novo = !d.id;
  return `<div class="page-head"><h1>${novo ? 'Novo pedido' : 'Pedido #' + d.numero}</h1>
    <div class="row-btn"><button class="btn ghost" data-act="go" data-view="pedidos">← Voltar</button>
    ${novo ? '' : '<button class="btn" data-act="imprimirPedido">🖨 Imprimir / PDF</button><button class="btn danger-o" data-act="excluirPedido">Excluir</button>'}
    <button class="btn primary" data-act="salvarPedido">Salvar pedido</button></div></div>
  <div class="card form-grid" id="pedForm">
    <label>Cliente<div class="inline"><select name="clienteId" id="pCliente">${[['', '— escolha o cliente —'], ...S.clientes.slice().sort((a, b) => a.nome.localeCompare(b.nome)).map((c) => [c.id, c.nome])].map(([v, t]) => `<option value="${v}" ${String(v) === String(d.clienteId) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>
      <button type="button" class="btn sm" data-act="clienteRapido">+ novo</button></div></label>
    ${F.date('data', 'Data do pedido', d.data)}${F.date('entrega', 'Entrega prevista', d.entrega)}
    ${F.select('status', 'Situação', STATUS, d.status)}
  </div>
  <section class="card"><h3>Itens</h3>
    <table class="t items"><thead><tr><th>Produto</th><th>Tecido / estampa</th><th>Detalhes</th><th>Qtd</th><th>Preço</th><th>Valor un.</th><th class="r">Subtotal</th><th></th></tr></thead>
    <tbody id="itens">${d.itens.map(linhaItem).join('')}</tbody></table>
    <button type="button" class="btn sm" data-act="addItem">+ Adicionar item</button>
    <p class="muted small" id="dica"></p>
  </section>
  <div class="grid2">
    <section class="card form-grid" id="valores">
      ${F.num('frete', 'Frete (R$)', d.frete, 'min="0"')}${F.num('desconto', 'Desconto (R$)', d.desconto, 'min="0"')}
      ${F.area('obs', 'Observações do pedido', d.obs)}
    </section>
    <section class="card"><h3>Pagamento</h3>
      <div class="totais" id="totais"></div>
      <table class="t"><tbody>${d.pagamentos.map((x, i) => `<tr><td>${dataBR(x.data)}</td><td>${esc(x.forma)}</td><td class="r">${money(x.valor)}</td><td><button type="button" class="icon" data-act="rmPag" data-idx="${i}">🗑</button></td></tr>`).join('') || '<tr><td class="muted">Nenhum pagamento registrado.</td></tr>'}</tbody></table>
      <button type="button" class="btn sm" data-act="addPag">+ Registrar pagamento</button>
    </section>
  </div>
  <div class="print-area" id="printArea"></div>`;
};

function lerPedidoDaTela() {
  const d = ui.draft;
  d.clienteId = $('#pCliente').value ? Number($('#pCliente').value) : '';
  ['data', 'entrega', 'status'].forEach((n) => (d[n] = $(`#pedForm [name=${n}]`).value));
  d.frete = parseFloat($('#valores [name=frete]').value) || 0;
  d.desconto = parseFloat($('#valores [name=desconto]').value) || 0;
  d.obs = $('#valores [name=obs]').value;
  $$('#itens tr').forEach((tr) => {
    const it = d.itens[tr.dataset.idx];
    it.produtoId = $('.it-prod', tr).value ? Number($('.it-prod', tr).value) : '';
    it.tecidoId = $('.it-tec', tr).value ? Number($('.it-tec', tr).value) : '';
    it.descricao = $('.it-desc', tr).value;
    it.qtd = Math.max(1, parseInt($('.it-qtd', tr).value) || 1);
    it.tipoPreco = $('.it-tipo', tr).value;
    it.preco = parseFloat($('.it-preco', tr).value) || 0;
  });
}
function atualizarTotais() {
  const d = ui.draft;
  const tot = Calc.totalPedido(d), pago = Calc.pagoPedido(d);
  $$('#itens tr').forEach((tr) => { const it = d.itens[tr.dataset.idx]; $('.it-sub', tr).textContent = money(it.qtd * it.preco); });
  const custoTotal = d.itens.reduce((s, i) => s + i.qtd * i.custo, 0);
  $('#totais').innerHTML = `<div><span>Total do pedido</span><b>${money(tot)}</b></div><div><span>Já pago</span><b class="good">${money(pago)}</b></div>
    <div><span>Falta receber</span><b class="${tot - pago > 0.004 ? 'warn' : ''}">${money(Math.max(0, tot - pago))}</b></div>
    <div class="muted"><span>Lucro estimado</span><b>${money(Calc.lucroPedido(d))}</b></div>`;
  $('#dica').textContent = d.itens.length ? `Custo total dos itens: ${money(custoTotal)} (material + mão de obra + custos fixos).` : '';
}
function recalcularLinha(tr, trocouProduto) {
  const it = ui.draft.itens[tr.dataset.idx];
  const s = precoSugerido(it);
  it.custo = s.custo;
  if (trocouProduto || it.auto !== false) { it.preco = s.preco; $('.it-preco', tr).value = s.preco; }
}
views.pedidoAfter = function () { if (ui.draft) atualizarTotais(); };
// Registrado uma única vez no boot.
function pedidoInput(e) {
  const tr = e.target.closest('#itens tr');
  lerPedidoDaTela();
  if (tr) {
    const it = ui.draft.itens[tr.dataset.idx];
    if (e.target.matches('.it-prod,.it-tec,.it-tipo')) { it.auto = true; recalcularLinha(tr, true); lerPedidoDaTela(); }
    if (e.target.matches('.it-preco')) it.auto = false;
  }
  atualizarTotais();
}
actions.addItem = () => {
  lerPedidoDaTela();
  ui.draft.itens.push({ produtoId: '', tecidoId: '', descricao: '', qtd: 1, tipoPreco: 'varejo', preco: 0, custo: 0, auto: true });
  const sc = window.scrollY; render(); window.scrollTo(0, sc);
};
actions.rmItem = (d) => { lerPedidoDaTela(); ui.draft.itens.splice(Number(d.idx), 1); const sc = window.scrollY; render(); window.scrollTo(0, sc); };
actions.rmPag = (d) => { lerPedidoDaTela(); ui.draft.pagamentos.splice(Number(d.idx), 1); const sc = window.scrollY; render(); window.scrollTo(0, sc); };
actions.addPag = () => {
  lerPedidoDaTela();
  const falta = Math.max(0, Calc.totalPedido(ui.draft) - Calc.pagoPedido(ui.draft));
  openModal({ title: 'Registrar pagamento', body: `<div class="form-grid">${F.date('data', 'Data', hoje(), 'required')}${F.num('valor', 'Valor (R$)', falta || '', 'required min="0.01"')}${F.select('forma', 'Forma de pagamento', FORMAS.map((x) => [x, x]))}</div>`,
    onSubmit: (v) => { ui.draft.pagamentos.push({ data: v.data, valor: Calc.r2(parseFloat(v.valor)), forma: v.forma }); const sc = window.scrollY; render(); window.scrollTo(0, sc); } });
};
actions.clienteRapido = () => {
  lerPedidoDaTela();
  formCliente(null, (c) => { ui.draft.clienteId = c.id; render(); });
};
actions.salvarPedido = () => {
  lerPedidoDaTela();
  const d = ui.draft;
  if (!d.clienteId) return toast('Escolha o cliente.');
  if (!d.itens.length) return toast('Adicione ao menos um item.');
  if (d.itens.some((i) => !i.produtoId)) return toast('Há item sem produto escolhido.');
  d.itens.forEach((i) => delete i.auto);
  if (!d.id) { d.id = nextId('pedido'); d.numero = nextId('numeroPedido'); S.pedidos.push(d); }
  else S.pedidos[S.pedidos.findIndex((p) => p.id === d.id)] = d;
  sincronizarEstoque(d);
  const neg = (d.baixa || []).map((b) => byId(S.materiais, b.materialId)).filter((m) => m && m.estoque < 0);
  save();
  toast(neg.length ? `Salvo. Atenção: estoque negativo de ${neg.map((m) => m.nome).join(', ')}.` : 'Pedido salvo.');
  ui.draft = JSON.parse(JSON.stringify(d));
  render();
};
actions.excluirPedido = () => confirmar(`Excluir o pedido #${ui.draft.numero}? O estoque baixado será devolvido.`, () => {
  const p = byId(S.pedidos, ui.draft.id);
  if (p.baixa) ajustarEstoque(p.baixa, +1);
  S.pedidos = S.pedidos.filter((x) => x.id !== p.id); save(); ui.draft = null; go('pedidos');
});
actions.imprimirPedido = async () => {
  lerPedidoDaTela();
  const d = ui.draft, c = byId(S.clientes, d.clienteId) || {};
  const pa = $('#printArea');
  pa.innerHTML = `<h1>${esc(S.config.loja)}</h1>${S.config.telefone ? `<p>${esc(S.config.telefone)}</p>` : ''}
    <h2>${d.status === 'orcamento' ? 'Orçamento' : 'Pedido'} #${d.numero}</h2>
    <p><b>Cliente:</b> ${esc(c.nome || '')}${c.telefone ? ' · ' + esc(c.telefone) : ''}<br>${c.endereco ? '<b>Endereço:</b> ' + esc(c.endereco) + '<br>' : ''}
    <b>Data:</b> ${dataBR(d.data)}${d.entrega ? ' · <b>Entrega prevista:</b> ' + dataBR(d.entrega) : ''}</p>
    <table><thead><tr><th>Produto</th><th>Detalhes</th><th>Qtd</th><th>Valor un.</th><th>Total</th></tr></thead><tbody>
    ${d.itens.map((i) => { const p = byId(S.produtos, i.produtoId) || {}; const t = byId(S.materiais, i.tecidoId);
      return `<tr><td>${esc(p.nome)}</td><td>${esc([t && t.nome, i.descricao].filter(Boolean).join(' · '))}</td><td>${i.qtd}</td><td>${money(i.preco)}</td><td>${money(i.qtd * i.preco)}</td></tr>`; }).join('')}
    </tbody></table>
    <p class="r">${d.desconto ? 'Desconto: ' + money(d.desconto) + '<br>' : ''}${d.frete ? 'Frete: ' + money(d.frete) + '<br>' : ''}<b>Total: ${money(Calc.totalPedido(d))}</b><br>
    Pago: ${money(Calc.pagoPedido(d))} · Falta: ${money(Math.max(0, Calc.totalPedido(d) - Calc.pagoPedido(d)))}</p>
    ${d.obs ? `<p><b>Obs.:</b> ${esc(d.obs)}</p>` : ''}<p class="foot">${esc(S.config.rodapePedido)}</p>`;
  document.body.classList.add('printing');
  await api.savePdf(`${d.status === 'orcamento' ? 'orcamento' : 'pedido'}-${d.numero}.pdf`);
  document.body.classList.remove('printing');
};
