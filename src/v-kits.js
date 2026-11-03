// ================= KITS =================
// Kit = vários produtos vendidos juntos (Natal, Dia das Mães, sorteio, promoção…).
const OCASIOES = ['Natal', 'Dia das Mães', 'Dia dos Pais', 'Dia dos Namorados', 'Páscoa', 'Sorteio', 'Promoção', 'Outro'];

const kitProdutoFotos = (k) => [...new Set((k.itens || []).map((i) => byId(S.produtos, i.produtoId)).filter((p) => p && p.foto).map((p) => p.foto))];
const kitFoto = (k) => k.foto || kitProdutoFotos(k)[0] || '';
// Foto do kit; sem foto, um mosaico com as fotos dos produtos que ele leva.
function kitThumb(k, tam = '') {
  if (k.foto) return thumb(k.foto, k.nome, tam);
  const f = kitProdutoFotos(k).slice(0, 4);
  return f.length ? `<span class="thumb mosaico n${f.length} ${tam}">${f.map((x) => `<img src="${esc(x)}" alt="">`).join('')}</span>` : thumb('', k.nome, tam);
}
// Quantos kits dá para montar com o estoque atual.
function disponibilidadeKit(k) {
  const tot = {};
  (k.itens || []).forEach((c) => consumoItem({ produtoId: Number(c.produtoId), tecidoId: c.tecidoId, qtd: c.qtd }).forEach((x) => { tot[x.materialId] = (tot[x.materialId] || 0) + x.qtd; }));
  const ids = Object.keys(tot);
  if (!ids.length) return { qtd: null, falta: null };
  let min = Infinity, falta = null;
  ids.forEach((id) => {
    const m = byId(S.materiais, id), n = m ? Math.floor(Math.max(0, m.estoque) / tot[id] + 1e-9) : 0;
    if (n < min) { min = n; falta = m; }
  });
  return { qtd: min, falta };
}
const resumoItensKit = (k) => (k.itens || []).map((c) => { const p = byId(S.produtos, c.produtoId); return p ? `${c.qtd}× ${p.nome}` : ''; }).filter(Boolean).join(', ');

function cardKit(k, acao, tipoPreco = 'varejo') {
  const c = Calc.custoKit(S, k), d = disponibilidadeKit(k), n = (k.itens || []).reduce((s, i) => s + i.qtd, 0);
  return `<article class="cat-card" tabindex="0" data-act="${acao}" data-id="${k.id}"><div class="cat-foto">${kitThumb(k, 'xl')}${tagDisp(d)}</div>
    <div class="cat-info"><b>${esc(k.nome)}</b><span class="muted small">${esc([k.ocasiao, n + ' peça(s)'].filter(Boolean).join(' · '))}</span>
    <span class="cat-preco">${money(c[tipoPreco])}<small>${tipoPreco}</small></span>
    ${c.economiaPct > 0 ? `<span class="small good">Cliente economiza ${num(c.economiaPct, 1)}% frente ao avulso</span>` : ''}</div></article>`;
}

views.kits = function () {
  const oc = ui.kitOc || 'todas', q = norm(ui.busca);
  const ocs = [...new Set(S.kits.map((k) => k.ocasiao).filter(Boolean))].sort();
  const lista = S.kits.filter((k) => (oc === 'todas' || k.ocasiao === oc) && (!q || norm(k.nome + ' ' + k.ocasiao).includes(q)))
    .sort((a, b) => (a.ocasiao || '').localeCompare(b.ocasiao || '') || a.nome.localeCompare(b.nome));
  return `<div class="page-head"><h1>Kits</h1><button class="btn primary" data-act="novoKit">+ Montar kit</button></div>
  <p class="muted" style="margin-top:-8px">Junte vários produtos num kit para promoção, sorteio ou datas como Natal e Dia das Mães. O preço sai da soma dos produtos, mais a embalagem e o tempo de montagem.</p>
  <div class="cat-bar"><input class="search" id="busca" placeholder="Buscar kit…" value="${esc(ui.busca)}" aria-label="Buscar kit">
    <div class="chips">${[['todas', 'Todos'], ...ocs.map((o) => [o, o])].map(([k, t]) => `<button class="chip ${oc === k ? 'on' : ''}" data-act="kitOc" data-o="${esc(k)}">${esc(t)}</button>`).join('')}</div></div>
  ${lista.length ? `<div class="cat-grid">${lista.map((k) => cardKit(k, 'editarKit')).join('')}</div>`
    : `${S.kits.length ? vazio('Nenhum kit com esses filtros', 'Troque a ocasião ou limpe a busca.') : vazio('Nenhum kit ainda', 'Junte produtos num kit para o Natal, o Dia das Mães ou um sorteio.', 'novoKit', '+ Montar o primeiro kit')}`}`;
};
views.kitsAfter = views.pedidosAfter;
actions.kitOc = (d) => { ui.kitOc = d.o; render(); };
actions.novoKit = () => formKit(null);
actions.editarKit = (d) => formKit(byId(S.kits, d.id));

// ---------- editor ----------
const linhaKit = (c = { produtoId: '', tecidoId: '', qtd: 1 }) => `<div class="kit-item">
  <select name="ki_prod" aria-label="Produto">${[['', '— produto —'], ...S.produtos.slice().sort((a, b) => a.nome.localeCompare(b.nome)).map((p) => [p.id, p.nome])].map(([v, t]) => `<option value="${v}" ${String(v) === String(c.produtoId) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>
  <select name="ki_tec" title="Estampa / tecido deste item" aria-label="Estampa ou tecido deste item">${[['', 'tecido padrão'], ...S.materiais.filter((m) => m.tipo === 'tecido').map((m) => [m.id, m.nome])].map(([v, t]) => `<option value="${v}" ${String(v) === String(c.tecidoId) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>
  <input name="ki_qtd" type="number" min="1" step="1" value="${c.qtd}" title="Quantidade" aria-label="Quantidade"><button type="button" class="icon" data-act="rmKitItem" title="Tirar do kit" aria-label="Tirar do kit">${icon('trash')}</button></div>`;
actions.addKitItem = (d, el) => { el.closest('form').querySelector('#kitItens').insertAdjacentHTML('beforeend', linhaKit()); };
actions.rmKitItem = (d, el) => { const f = el.closest('form'); el.closest('.kit-item').remove(); f.dispatchEvent(new Event('input')); };

function lerKitForm(form) {
  const f = new FormData(form), pr = f.getAll('ki_prod'), te = f.getAll('ki_tec'), qt = f.getAll('ki_qtd'), n = (k) => parseFloat(f.get(k)) || 0;
  return {
    foto: f.get('foto') || '', nome: (f.get('nome') || '').trim(), ocasiao: (f.get('ocasiao') || '').trim(),
    itens: pr.map((p, i) => ({ produtoId: p ? Number(p) : '', tecidoId: te[i] ? Number(te[i]) : '', qtd: Math.max(1, parseInt(qt[i], 10) || 1) })).filter((i) => i.produtoId),
    embalagem: n('embalagem'), tempoMin: n('tempoMin'), margemAtacado: n('margemAtacado'), margemVarejo: n('margemVarejo'), precoFixo: n('precoFixo'),
    catalogo: f.get('catalogo') === 'on', obs: f.get('obs') || '',
  };
}
function formKit(k, copia) {
  if (!S.produtos.length) return toast('Cadastre os produtos primeiro, depois monte o kit.');
  const novo = !k || copia;
  const base = k ? JSON.parse(JSON.stringify(k)) : { foto: '', nome: '', ocasiao: '', itens: [{ produtoId: '', tecidoId: '', qtd: 1 }], embalagem: 0, tempoMin: 10, margemAtacado: S.config.margemAtacado, margemVarejo: S.config.margemVarejo, precoFixo: '', obs: '' };
  if (copia) { base.nome += ' (cópia)'; }
  openModal({
    title: novo ? (copia ? 'Duplicar kit' : 'Montar kit') : 'Kit', wide: true,
    body: `<div class="cols"><div>
      <div class="form-grid">${campoFoto(base.foto, base.nome, 'Foto do kit (opcional)')}
      <p class="full muted small" style="margin:-4px 0 0">Sem foto, o programa mostra um mosaico com as fotos dos produtos do kit.</p>
      ${F.text('nome', 'Nome do kit', base.nome, 'required')}
      <label>Ocasião<input name="ocasiao" list="ocasioes" value="${esc(base.ocasiao)}"><datalist id="ocasioes">${[...new Set([...OCASIOES, ...S.kits.map((x) => x.ocasiao).filter(Boolean)])].map((o) => `<option value="${esc(o)}">`).join('')}</datalist></label></div>
      <h3 style="margin-top:14px">O que vai no kit</h3>
      <div id="kitItens">${base.itens.map(linhaKit).join('')}</div><button type="button" class="btn sm" data-act="addKitItem">+ Produto no kit</button>
      <div class="form-grid" style="margin-top:14px">${F.num('embalagem', 'Embalagem: caixa, fita, cartão… (R$)', base.embalagem, 'min="0"')}${F.num('tempoMin', 'Tempo para montar o kit (minutos)', base.tempoMin, 'min="0"')}
      ${F.num('margemAtacado', 'Margem de lucro ATACADO (%)', base.margemAtacado, 'min="0" max="95"')}${F.num('margemVarejo', 'Margem de lucro VAREJO (%)', base.margemVarejo, 'min="0" max="95"')}
      ${F.num('precoFixo', 'Preço fixo de varejo (R$), opcional', base.precoFixo, 'min="0"')}
      ${F.area('obs', 'Observações', base.obs)}<label class="check full"><input type="checkbox" name="catalogo" ${base.catalogo !== false ? 'checked' : ''}> Mostrar este kit no Catálogo</label></div>
      ${novo ? '' : `<p class="row-btn"><button type="button" class="btn primary sm" data-act="kitPedido" data-id="${k.id}">+ Criar pedido com este kit</button><button type="button" class="btn sm" data-act="kitDuplicar" data-id="${k.id}">Duplicar</button><button type="button" class="btn danger-o sm" data-act="excluirKit" data-id="${k.id}">Excluir kit</button></p>`}
    </div><aside class="calc card" id="calcBox"></aside></div>`,
    onOpen: (form) => {
      const upd = () => {
        const d = lerKitForm(form), c = Calc.custoKit(S, d), disp = disponibilidadeKit(d);
        $('#calcBox', form).innerHTML = `<h3>Como o preço do kit é calculado</h3>
          <div class="ln"><span>Produtos do kit</span><b>${money(c.itens)}</b></div><div class="ln"><span>Embalagem</span><b>${money(c.embalagem)}</b></div>
          <div class="ln"><span>Montagem (mão de obra e fixos)</span><b>${money(c.montagem)}</b></div><div class="ln tot"><span>Custo do kit</span><b>${money(c.total)}</b></div>
          <div class="price"><span>Atacado</span><b>${money(c.atacado)}</b><small>lucro ${money(c.atacado - c.total)}</small></div>
          <div class="price"><span>Varejo${d.precoFixo > 0 ? ' (fixo)' : ''}</span><b>${money(c.varejo)}</b><small class="${c.lucroVarejo < 0 ? 'bad' : ''}">lucro ${money(c.lucroVarejo)}</small></div>
          <p class="small" style="margin:12px 0 0">Vendidos separados (varejo): <b>${money(c.avulsoVarejo)}</b>${c.avulsoVarejo > 0 ? `<br>${c.economiaPct >= 0 ? 'Cliente economiza' : 'Kit sai mais caro em'} <b>${num(Math.abs(c.economiaPct), 1)}%</b>` : ''}</p>
          <p class="small muted" style="margin:6px 0 0">${disp.qtd === null ? '' : disp.qtd === 0 ? 'Sem material em estoque para montar.' : `Com o estoque atual dá para montar ${disp.qtd} kit(s).`}</p>`;
      };
      form.addEventListener('input', upd); upd(); ligarFoto(form);
    },
    onSubmit: (v, form) => {
      const dados = lerKitForm(form);
      if (!dados.itens.length) { toast('Um kit precisa de pelo menos um produto. Escolha o que vai dentro.'); return false; }
      if (novo) S.kits.push({ id: nextId('kit'), ...dados }); else Object.assign(k, dados);
      save(); toast('Pronto! Kit salvo.'); render();
    },
  });
}
actions.kitDuplicar = (d) => { const k = byId(S.kits, d.id); fecharModais(); formKit(k, true); };
actions.excluirKit = (d) => {
  const id = Number(d.id);
  if (S.pedidos.some((o) => o.itens.some((i) => i.kitId === id))) return toast('Este kit já foi usado em pedidos e não pode ser excluído. Desmarque "Mostrar no Catálogo" para tirá-lo de circulação.');
  confirmar('Excluir este kit? Os produtos dele continuam cadastrados, mas isso não pode ser desfeito.', () => { S.kits = S.kits.filter((k) => k.id !== id); save(); fecharModais(); render(); });
};
// Cria um pedido novo já com este kit.
function pedidoComItem(item) {
  Object.assign(item, precoSugerido(item));
  fecharModais();
  ui.draft = { id: null, numero: null, clienteId: '', data: hoje(), entrega: '', status: 'orcamento', itens: [item], frete: 0, desconto: 0, pagamentos: [], obs: '', baixa: null };
  go('pedido');
}
actions.kitPedido = (d) => pedidoComItem({ kitId: Number(d.id), produtoId: '', tecidoId: '', descricao: '', qtd: 1, tipoPreco: 'varejo', preco: 0, custo: 0, auto: true });
