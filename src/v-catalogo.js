// ================= CATÁLOGO =================
// Vitrine só para ela: navegar pelas fotos, ver preço e o que dá para fazer com o estoque atual.
const catProdutos = () => S.produtos.filter((p) => p.catalogo !== false);

// Quantas peças dá para fazer com o estoque (limitada pelo material mais escasso).
function disponibilidade(p, tecidoId) {
  const need = [];
  const tec = tecidoId || p.tecidoId;
  if (tec && p.consumoTecido > 0) need.push([Number(tec), p.consumoTecido]);
  (p.aviamentos || []).forEach((a) => { if (a.qtd > 0) need.push([Number(a.materialId), a.qtd]); });
  if (!need.length) return { qtd: null, falta: null };
  let min = Infinity, falta = null;
  need.forEach(([id, q]) => {
    const m = byId(S.materiais, id);
    const n = m ? Math.floor(Math.max(0, m.estoque) / q + 1e-9) : 0;
    if (n < min) { min = n; falta = m; }
  });
  return { qtd: min, falta };
}
const tagDisp = (d) => (d.qtd === null ? '' : d.qtd === 0 ? '<span class="disp bad">Sem material</span>'
  : `<span class="disp ${d.qtd <= 3 ? 'warn' : 'good'}">Dá para fazer ${d.qtd}</span>`);
const precosProduto = (p, tecidoId) => {
  const custo = Calc.custoProduto(S, p, tecidoId).total;
  return { custo, atacado: Calc.preco(custo, p.margemAtacado), varejo: Calc.preco(custo, p.margemVarejo) };
};

views.catalogo = function () {
  const tab = ui.catTab || 'produtos', tipoPreco = ui.catPreco || 'varejo', cat = ui.catCat || 'todas', so = !!ui.catSo, q = norm(ui.busca);
  const tabs = `<div class="chips"><button class="chip ${tab === 'produtos' ? 'on' : ''}" data-act="catTab" data-t="produtos">Produtos</button><button class="chip ${tab === 'estampas' ? 'on' : ''}" data-act="catTab" data-t="estampas">Estampas e tecidos</button></div>`;
  let corpo = '';
  const controles = [`<input class="search" id="busca" placeholder="Buscar…" value="${esc(ui.busca)}">`];
  if (tab === 'produtos') {
    const cats = [...new Set(catProdutos().map((p) => p.categoria).filter(Boolean))].sort();
    let lista = catProdutos().filter((p) => (cat === 'todas' || p.categoria === cat) && (!q || norm(p.nome + p.categoria + p.codigo).includes(q)));
    if (so) lista = lista.filter((p) => disponibilidade(p).qtd !== 0);
    lista.sort((a, b) => (a.categoria || '').localeCompare(b.categoria || '') || a.nome.localeCompare(b.nome));
    ui.catLista = lista.map((p) => p.id);
    controles.push(`<div class="chips">${[['todas', 'Todas'], ...cats.map((c) => [c, c])].map(([k, t]) => `<button class="chip ${cat === k ? 'on' : ''}" data-act="catCat" data-c="${esc(k)}">${esc(t)}</button>`).join('')}</div>`);
    corpo = lista.length ? `<div class="cat-grid">${lista.map((p) => {
      const d = disponibilidade(p), pr = precosProduto(p);
      return `<article class="cat-card" tabindex="0" data-act="catAbrir" data-id="${p.id}"><div class="cat-foto">${thumb(p.foto, p.nome, 'xl')}${tagDisp(d)}</div>
        <div class="cat-info"><b>${esc(p.nome)}</b><span class="muted small">${esc([p.codigo, p.categoria].filter(Boolean).join(' · '))}</span>
        <span class="cat-preco">${money(pr[tipoPreco])}<small>${tipoPreco}</small></span></div></article>`;
    }).join('')}</div>` : `<p class="empty big">${S.produtos.length ? 'Nenhum produto com esses filtros.' : 'Cadastre produtos com foto para montar o catálogo.'}</p>`;
  } else {
    const lista = S.materiais.filter((m) => m.tipo === 'tecido' && (!q || norm(m.nome).includes(q))).sort((a, b) => a.nome.localeCompare(b.nome));
    ui.catLista = lista.map((m) => m.id);
    corpo = lista.length ? `<div class="cat-grid">${lista.map((m) => {
      const sem = m.estoque <= 0, baixo = m.minimo > 0 && m.estoque <= m.minimo;
      return `<article class="cat-card" tabindex="0" data-act="catAbrirEst" data-id="${m.id}"><div class="cat-foto">${thumb(m.foto, m.nome, 'xl')}${sem ? '<span class="disp bad">Sem estoque</span>' : baixo ? '<span class="disp warn">Pouco</span>' : ''}</div>
        <div class="cat-info"><b>${esc(m.nome)}</b><span class="muted small">${num(m.estoque)} ${esc(m.unidade)} em estoque</span><span class="cat-preco">${money(m.custo)}<small>/ ${esc(m.unidade)}</small></span></div></article>`;
    }).join('')}</div>` : '<p class="empty big">Cadastre tecidos (com foto da estampa) em Materiais.</p>';
  }
  controles.push(`<div class="chips"><button class="chip ${tipoPreco === 'varejo' ? 'on' : ''}" data-act="catPreco" data-p="varejo">Varejo</button><button class="chip ${tipoPreco === 'atacado' ? 'on' : ''}" data-act="catPreco" data-p="atacado">Atacado</button></div>`);
  if (tab === 'produtos') controles.push(`<button class="chip ${so ? 'on' : ''}" data-act="catSo">Só o que dá para fazer</button>`);
  return `<div class="page-head"><h1>Catálogo</h1>${tabs}</div><div class="cat-bar">${controles.join('')}</div>${corpo}`;
};
views.catalogoAfter = views.pedidosAfter;
actions.catTab = (d) => { ui.catTab = d.t; ui.busca = ''; render(); };
actions.catCat = (d) => { ui.catCat = d.c; render(); };
actions.catPreco = (d) => { ui.catPreco = d.p; render(); };
actions.catSo = () => { ui.catSo = !ui.catSo; render(); };

// ---------- janela de detalhe (foto grande) ----------
function abrirDetalhe(tipo, id, tec) {
  ui.catSel = { tipo, id: Number(id), tec: tec ? Number(tec) : '' };
  if ($('#detalhe')) return renderDetalhe();
  openModal({ title: 'Catálogo', wide: true, body: '<div id="detalhe"></div>', onOpen: renderDetalhe });
}
actions.catAbrir = (d) => abrirDetalhe('p', d.id);
actions.catAbrirEst = (d) => abrirDetalhe('e', d.id);
actions.catEstampa = (d) => { ui.catSel.tec = d.id ? Number(d.id) : ''; renderDetalhe(); };
actions.catNav = (d) => {
  const l = ui.catLista || [], i = l.indexOf(ui.catSel.id);
  if (i < 0 || l.length < 2) return;
  abrirDetalhe(ui.catSel.tipo, l[(i + Number(d.d) + l.length) % l.length]);
};
document.addEventListener('keydown', (e) => {
  if (!$('#detalhe') || e.target.matches('input,textarea,select')) return;
  if (e.key === 'ArrowLeft') actions.catNav({ d: -1 });
  if (e.key === 'ArrowRight') actions.catNav({ d: 1 });
});
const fecharModais = () => $$('.overlay').forEach((o) => o.remove());

function renderDetalhe() {
  const box = $('#detalhe'); if (!box) return;
  const sel = ui.catSel, l = ui.catLista || [], i = l.indexOf(sel.id);
  const nav = l.length > 1 && i >= 0 ? `<div class="det-nav"><button type="button" class="btn sm" data-act="catNav" data-d="-1">‹ Anterior</button><span class="muted small">${i + 1} de ${l.length} · use as setas ← →</span><button type="button" class="btn sm" data-act="catNav" data-d="1">Próximo ›</button></div>` : '';
  if (sel.tipo === 'p') {
    const p = byId(S.produtos, sel.id); if (!p) return;
    const tecId = sel.tec || p.tecidoId || '';
    const tec = byId(S.materiais, tecId), pr = precosProduto(p, tecId), d = disponibilidade(p, tecId);
    const estampas = p.consumoTecido > 0 ? S.materiais.filter((m) => m.tipo === 'tecido').sort((a, b) => a.nome.localeCompare(b.nome)) : [];
    $('.modal h2').textContent = p.nome;
    box.innerHTML = `<div class="detalhe"><div class="det-foto">${thumb(p.foto, p.nome, 'xl')}</div>
      <div class="det-info"><div><h3>${esc(p.nome)}</h3><span class="muted">${esc([p.codigo, p.categoria].filter(Boolean).join(' · '))}</span></div>
      <div class="precos"><div><span>Atacado</span><b>${money(pr.atacado)}</b></div><div><span>Varejo</span><b>${money(pr.varejo)}</b></div></div>
      <div>${tagDisp(d).replace('class="disp', 'class="disp inline')} ${d.qtd === 0 && d.falta ? `<span class="muted small">Falta: ${esc(d.falta.nome)}</span>` : ''}${tec ? `<div class="muted small" style="margin-top:6px">Estampa: ${esc(tec.nome)}</div>` : ''}</div>
      ${estampas.length ? `<div><b class="small">Estampas (o preço muda conforme o tecido)</b><div class="estampas">${estampas.map((m) => {
        const ok = m.estoque >= p.consumoTecido;
        return `<button type="button" class="est ${m.id === Number(tecId) ? 'on' : ''} ${ok ? '' : 'off'}" data-act="catEstampa" data-id="${m.id}" title="${esc(m.nome)}${ok ? '' : ' (sem estoque)'}">${thumb(m.foto, m.nome)}<span>${esc(m.nome)}</span><b>${money(precosProduto(p, m.id)[ui.catPreco || 'varejo'])}</b></button>`;
      }).join('')}</div></div>` : ''}
      ${p.obs ? `<p class="muted">${esc(p.obs)}</p>` : ''}
      <div class="row-btn"><button type="button" class="btn primary" data-act="catPedido">+ Criar pedido com este produto</button><button type="button" class="btn" data-act="catEditar">Editar produto</button></div>
      ${nav}</div></div>`;
  } else {
    const m = byId(S.materiais, sel.id); if (!m) return;
    $('.modal h2').textContent = m.nome;
    const uso = catProdutos().filter((p) => p.consumoTecido > 0).map((p) => ({ p, d: disponibilidade(p, m.id) })).filter((x) => x.d.qtd > 0).sort((a, b) => b.d.qtd - a.d.qtd);
    box.innerHTML = `<div class="detalhe"><div class="det-foto">${thumb(m.foto, m.nome, 'xl')}</div>
      <div class="det-info"><div><h3>${esc(m.nome)}</h3><span class="muted">${esc(m.fornecedor || 'Fornecedor não informado')}</span></div>
      <div class="precos"><div><span>Em estoque</span><b>${num(m.estoque)} ${esc(m.unidade)}</b></div><div><span>Custo</span><b>${money(m.custo)}/${esc(m.unidade)}</b></div></div>
      <div><b class="small">O que dá para fazer com esta estampa</b>
      ${uso.length ? `<div class="uso">${uso.map(({ p, d }) => `<button type="button" class="uso-i" data-act="catProdEst" data-id="${p.id}" data-tec="${m.id}">${thumb(p.foto, p.nome)}<span><b>${esc(p.nome)}</b><small class="muted">até ${d.qtd} peça(s) · ${money(precosProduto(p, m.id)[ui.catPreco || 'varejo'])}</small></span></button>`).join('')}</div>` : '<p class="empty">Estoque insuficiente para os produtos cadastrados.</p>'}</div>
      <div class="row-btn"><button type="button" class="btn" data-act="catEditarMat">Editar material</button></div>${nav}</div></div>`;
  }
}
actions.catProdEst = (d) => { ui.catLista = []; abrirDetalhe('p', d.id, d.tec); };
actions.catEditar = () => { const p = byId(S.produtos, ui.catSel.id); fecharModais(); formProduto(p); };
actions.catEditarMat = () => { const m = byId(S.materiais, ui.catSel.id); fecharModais(); formMaterial(m); };
actions.catPedido = () => {
  const p = byId(S.produtos, ui.catSel.id);
  const item = { produtoId: p.id, tecidoId: ui.catSel.tec || '', descricao: '', qtd: 1, tipoPreco: ui.catPreco || 'varejo', preco: 0, custo: 0, auto: true };
  Object.assign(item, precoSugerido(item));
  fecharModais();
  ui.draft = { id: null, numero: null, clienteId: '', data: hoje(), entrega: '', status: 'orcamento', itens: [item], frete: 0, desconto: 0, pagamentos: [], obs: '', baixa: null };
  go('pedido');
};
