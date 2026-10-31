// ================= CLIENTES =================
function formCliente(c, depois) {
  const novo = !c;
  c = c || { nome: '', telefone: '', endereco: '', cpf: '', obs: '' };
  const hist = novo ? '' : S.pedidos.filter((p) => p.clienteId === c.id).sort((a, b) => b.numero - a.numero);
  openModal({
    title: novo ? 'Novo cliente' : 'Cliente', wide: true,
    body: `<div class="form-grid">${F.text('nome', 'Nome', c.nome, 'required')}${F.text('telefone', 'Telefone / WhatsApp', c.telefone)}
      ${F.text('endereco', 'Endereço / CEP', c.endereco)}${F.text('cpf', 'CPF / CNPJ', c.cpf)}${F.area('obs', 'Observações (medidas, preferências…)', c.obs)}</div>
      ${hist && hist.length ? `<h3>Histórico</h3><table class="t">${hist.map((p) => `<tr><td>#${p.numero}</td><td>${dataBR(p.data)}</td><td>${STATUS_NOME[p.status]}</td><td class="r">${money(Calc.totalPedido(p))}</td></tr>`).join('')}</table>` : ''}
      ${novo ? '' : '<p><button type="button" class="btn danger-o sm" data-act="excluirCliente" data-id="' + c.id + '">Excluir cliente</button></p>'}`,
    onSubmit: (v) => {
      const dados = { nome: v.nome.trim(), telefone: v.telefone, endereco: v.endereco, cpf: v.cpf, obs: v.obs };
      if (novo) { c = { id: nextId('cliente'), ...dados }; S.clientes.push(c); } else Object.assign(c, dados);
      save(); toast('Cliente salvo.'); if (depois) depois(c); else render();
    },
  });
}
views.clientes = function () {
  const q = norm(ui.busca);
  const lista = S.clientes.filter((c) => !q || norm(c.nome + c.telefone).includes(q)).sort((a, b) => a.nome.localeCompare(b.nome));
  return `<div class="page-head"><h1>Clientes</h1><div class="row-btn"><button class="btn" data-act="importarClientes">Importar da planilha (CSV)</button><button class="btn primary" data-act="novoCliente">+ Novo cliente</button></div></div>
  <div class="toolbar"><input class="search" id="busca" placeholder="Buscar cliente…" value="${esc(ui.busca)}"></div>
  ${lista.length ? `<table class="t"><thead><tr><th>Nome</th><th>Telefone</th><th>Endereço</th><th class="r">Pedidos</th><th class="r">Total comprado</th></tr></thead><tbody>
  ${lista.map((c) => { const ps = pedidosValidos().filter((p) => p.clienteId === c.id); return `<tr class="click" data-act="editarCliente" data-id="${c.id}"><td>${esc(c.nome)}</td><td>${esc(c.telefone)}</td><td class="trunc">${esc(c.endereco)}</td><td class="r">${ps.length}</td><td class="r">${money(ps.reduce((s, p) => s + Calc.totalPedido(p), 0))}</td></tr>`; }).join('')}
  </tbody></table>` : '<p class="empty big">Nenhum cliente cadastrado.</p>'}`;
};
views.clientesAfter = views.pedidosAfter;
actions.novoCliente = () => formCliente(null);
actions.editarCliente = (d) => formCliente(byId(S.clientes, d.id));
actions.excluirCliente = (d) => {
  if (S.pedidos.some((p) => p.clienteId === Number(d.id))) return toast('Este cliente tem pedidos e não pode ser excluído.');
  confirmar('Excluir este cliente?', () => { S.clientes = S.clientes.filter((c) => c.id !== Number(d.id)); save(); $$('.overlay').forEach((o) => o.remove()); render(); });
};
// CSV simples (aspas e vírgula/ponto-e-vírgula)
function parseCSV(t) {
  const sep = (t.split('\n')[0].match(/;/g) || []).length > (t.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) { if (ch === '"') { if (t[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === sep) { row.push(cur); cur = ''; }
    else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (ch !== '\r') cur += ch;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
}
actions.importarClientes = async () => {
  const t = await api.openText('csv');
  if (!t) return;
  const rows = parseCSV(t.replace(/^﻿/, ''));
  const head = rows[0].map(norm);
  const col = (...names) => head.findIndex((h) => names.some((n) => h.includes(n)));
  const iN = col('cliente', 'nome'), iT = col('telefone', 'fone'), iE = col('endereco'), iC = col('cpf');
  if (iN < 0) return toast('Não achei a coluna "Cliente" ou "Nome" no arquivo.');
  let novos = 0;
  rows.slice(1).forEach((r) => {
    const nome = (r[iN] || '').trim(); if (!nome) return;
    if (S.clientes.some((c) => norm(c.nome) === norm(nome))) return;
    S.clientes.push({ id: nextId('cliente'), nome, telefone: (r[iT] || '').trim(), endereco: (r[iE] || '').trim(), cpf: (r[iC] || '').trim(), obs: '' }); novos++;
  });
  save(); toast(`${novos} cliente(s) importado(s).`); render();
};

// ================= MATERIAIS =================
views.materiais = function () {
  const aba = ui.matTab || 'estoque';
  const q = norm(ui.busca);
  const lista = S.materiais.filter((m) => !q || norm(m.nome).includes(q)).sort((a, b) => a.nome.localeCompare(b.nome));
  const tabs = `<div class="chips"><button class="chip ${aba === 'estoque' ? 'on' : ''}" data-act="matTab" data-t="estoque">Materiais e estoque</button><button class="chip ${aba === 'compras' ? 'on' : ''}" data-act="matTab" data-t="compras">Compras feitas</button></div>`;
  const corpo = aba === 'estoque'
    ? (lista.length ? `<table class="t"><thead><tr><th></th><th>Material</th><th>Tipo</th><th class="r">Custo</th><th class="r">Em estoque</th><th class="r">Mínimo</th><th>Fornecedor</th></tr></thead><tbody>
      ${lista.map((m) => `<tr class="click" data-act="editarMaterial" data-id="${m.id}"><td class="th">${thumb(m.foto, m.nome)}</td><td>${esc(m.nome)}</td><td>${m.tipo === 'tecido' ? 'Tecido' : 'Aviamento'}</td><td class="r">${money(m.custo)} / ${esc(m.unidade)}</td>
      <td class="r ${m.minimo > 0 && m.estoque <= m.minimo ? 'bad' : ''}">${num(m.estoque)} ${esc(m.unidade)}${m.minimo > 0 && m.estoque <= m.minimo ? ' ⚠' : ''}</td><td class="r muted">${m.minimo ? num(m.minimo) : '—'}</td><td>${esc(m.fornecedor)}</td></tr>`).join('')}</tbody></table>`
      : '<p class="empty big">Cadastre seus tecidos (cada estampa pode ser um item) e aviamentos.</p>')
    : (S.compras.length ? `<table class="t"><thead><tr><th>Data</th><th>Material</th><th>Loja</th><th class="r">Qtd</th><th class="r">Valor pago</th><th></th></tr></thead><tbody>
      ${S.compras.slice().sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id).map((c) => { const m = byId(S.materiais, c.materialId) || { nome: '(excluído)', unidade: '' };
      return `<tr><td>${dataBR(c.data)}</td><td>${esc(m.nome)}</td><td>${esc(c.loja)}</td><td class="r">${num(c.qtd)} ${esc(m.unidade)}</td><td class="r">${money(c.valor)}</td><td><button class="icon" data-act="excluirCompra" data-id="${c.id}" title="Excluir compra">🗑</button></td></tr>`; }).join('')}</tbody></table>`
      : '<p class="empty big">Nenhuma compra registrada.</p>');
  return `<div class="page-head"><h1>Materiais</h1><div class="row-btn"><button class="btn" data-act="novaCompra">+ Registrar compra</button><button class="btn primary" data-act="novoMaterial">+ Novo material</button></div></div>
  <div class="toolbar">${tabs}${aba === 'estoque' ? `<input class="search" id="busca" placeholder="Buscar material…" value="${esc(ui.busca)}">` : ''}</div>${corpo}`;
};
views.materiaisAfter = views.pedidosAfter;
actions.matTab = (d) => { ui.matTab = d.t; render(); };
function formMaterial(m) {
  const novo = !m;
  m = m || { nome: '', tipo: 'tecido', unidade: 'm', custo: '', estoque: 0, minimo: 0, fornecedor: '', foto: '' };
  openModal({
    title: novo ? 'Novo material' : 'Material',
    body: `<div class="form-grid">${campoFoto(m.foto, m.nome, 'Foto da estampa / tecido')}${F.text('nome', 'Nome (ex.: Cetim floral rosa)', m.nome, 'required')}
      ${F.select('tipo', 'Tipo', [['tecido', 'Tecido (comprado por metro)'], ['aviamento', 'Aviamento (elástico, botão, linha…)']], m.tipo)}
      ${F.select('unidade', 'Vendido por', [['m', 'metro'], ['un', 'unidade'], ['cm', 'centímetro'], ['rolo', 'rolo'], ['pct', 'pacote']], m.unidade)}
      ${F.num('custo', 'Custo por unidade (R$)', m.custo, 'required min="0"')}${F.num('estoque', 'Quantidade em estoque', m.estoque)}${F.num('minimo', 'Avisar quando chegar em…', m.minimo, 'min="0"')}
      ${F.text('fornecedor', 'Onde compra', m.fornecedor)}</div>
      ${novo ? '' : '<p><button type="button" class="btn danger-o sm" data-act="excluirMaterial" data-id="' + m.id + '">Excluir material</button></p>'}`,
    onSubmit: (v) => {
      const dados = { nome: v.nome.trim(), tipo: v.tipo, unidade: v.unidade, custo: parseFloat(v.custo) || 0, estoque: parseFloat(v.estoque) || 0, minimo: parseFloat(v.minimo) || 0, fornecedor: v.fornecedor, foto: v.foto || '' };
      if (novo) S.materiais.push({ id: nextId('material'), ...dados }); else Object.assign(m, dados);
      save(); toast('Material salvo.'); render();
    },
    onOpen: (form) => ligarFoto(form),
  });
}
actions.novoMaterial = () => formMaterial(null);
actions.editarMaterial = (d) => formMaterial(byId(S.materiais, d.id));
actions.excluirMaterial = (d) => {
  const id = Number(d.id);
  const usado = S.produtos.some((p) => p.tecidoId === id || p.aviamentos.some((a) => a.materialId === id));
  if (usado) return toast('Este material é usado em algum produto. Remova do produto antes.');
  confirmar('Excluir este material?', () => { S.materiais = S.materiais.filter((m) => m.id !== id); save(); $$('.overlay').forEach((o) => o.remove()); render(); });
};
actions.novaCompra = () => {
  if (!S.materiais.length) return toast('Cadastre o material primeiro.');
  openModal({
    title: 'Registrar compra de material',
    body: `<div class="form-grid">${F.date('data', 'Data', hoje(), 'required')}${F.text('loja', 'Loja / fornecedor', '')}
      ${F.select('materialId', 'Material', S.materiais.slice().sort((a, b) => a.nome.localeCompare(b.nome)).map((m) => [m.id, `${m.nome} (${m.unidade})`]))}
      ${F.num('qtd', 'Quantidade comprada', '', 'required min="0.01"')}${F.num('valor', 'Valor total pago (R$)', '', 'required min="0"')}
      <p class="full muted" id="unitInfo">O custo do material é atualizado para o preço desta compra.</p></div>`,
    onOpen: (form) => form.addEventListener('input', () => {
      const q = parseFloat(form.qtd.value), v = parseFloat(form.valor.value);
      $('#unitInfo', form).textContent = q > 0 && v >= 0 ? `Custo por unidade: ${money(v / q)}` : '';
    }),
    onSubmit: (v) => {
      const m = byId(S.materiais, v.materialId), qtd = parseFloat(v.qtd), valor = Calc.r2(parseFloat(v.valor));
      const c = { id: nextId('compra'), data: v.data, loja: v.loja, materialId: m.id, qtd, valor };
      S.compras.push(c);
      m.estoque = Calc.r2((m.estoque || 0) + qtd); m.custo = Calc.r2(valor / qtd);
      S.despesas.push({ id: nextId('despesa'), data: v.data, descricao: `Compra: ${m.nome}${v.loja ? ' (' + v.loja + ')' : ''}`, categoria: 'Material', valor, compraId: c.id });
      save(); toast('Compra registrada, estoque e custo atualizados.'); render();
    },
  });
};
actions.excluirCompra = (d) => confirmar('Excluir esta compra? O estoque será reduzido e o gasto removido.', () => {
  const c = byId(S.compras, d.id), m = byId(S.materiais, c.materialId);
  if (m) m.estoque = Calc.r2(m.estoque - c.qtd);
  S.compras = S.compras.filter((x) => x.id !== c.id); S.despesas = S.despesas.filter((x) => x.compraId !== c.id); save(); render();
});

// ================= PRODUTOS =================
const custoLista = (p) => Calc.custoProduto(S, p).total;
views.produtos = function () {
  const vista = ui.prodVista || 'galeria';
  const q = norm(ui.busca);
  const lista = S.produtos.filter((p) => !q || norm(p.nome + p.categoria + p.codigo).includes(q)).sort((a, b) => (a.categoria || '').localeCompare(b.categoria || '') || a.nome.localeCompare(b.nome));
  return `<div class="page-head"><h1>Produtos</h1><button class="btn primary" data-act="novoProduto">+ Novo produto</button></div>
  <div class="toolbar"><div class="row-btn"><input class="search" id="busca" placeholder="Buscar produto ou categoria…" value="${esc(ui.busca)}">
    <div class="chips"><button class="chip ${vista === 'galeria' ? 'on' : ''}" data-act="prodVista" data-v="galeria">Galeria</button><button class="chip ${vista === 'lista' ? 'on' : ''}" data-act="prodVista" data-v="lista">Lista</button></div></div>
    <span class="muted small">Os preços usam o tecido padrão e mudam sozinhos quando o preço de um material muda.</span></div>
  ${lista.length && vista === 'galeria' ? `<div class="galeria">${lista.map((p) => { const c = custoLista(p); return `<div class="gcard" tabindex="0" data-act="editarProduto" data-id="${p.id}">${thumb(p.foto, p.nome, 'xl')}
    <b>${esc(p.nome)}</b><span class="muted small">${esc([p.codigo, p.categoria].filter(Boolean).join(' · '))}</span>
    <div class="gp"><span>Atacado<b>${money(Calc.preco(c, p.margemAtacado))}</b></span><span>Varejo<b>${money(Calc.preco(c, p.margemVarejo))}</b></span></div></div>`; }).join('')}</div>` : ''}
  ${lista.length && vista === 'lista' ? `<table class="t"><thead><tr><th></th><th>Cód.</th><th>Produto</th><th>Categoria</th><th class="r">Custo</th><th class="r">Atacado</th><th class="r">Varejo</th><th class="r">Margem (at./var.)</th><th></th></tr></thead><tbody>
  ${lista.map((p) => { const c = custoLista(p); return `<tr class="click" data-act="editarProduto" data-id="${p.id}"><td class="th">${thumb(p.foto, p.nome)}</td><td>${esc(p.codigo)}</td><td>${esc(p.nome)}</td><td>${esc(p.categoria)}</td><td class="r">${money(c)}</td>
    <td class="r"><b>${money(Calc.preco(c, p.margemAtacado))}</b></td><td class="r"><b>${money(Calc.preco(c, p.margemVarejo))}</b></td><td class="r muted">${num(p.margemAtacado, 1)}% / ${num(p.margemVarejo, 1)}%</td>
    <td><button class="icon" data-act="duplicarProduto" data-id="${p.id}" title="Duplicar">⧉</button></td></tr>`; }).join('')}</tbody></table>`
  : ''}${lista.length ? '' : '<p class="empty big">Cadastre seus produtos para o programa calcular custo e preço.</p>'}`;
};
actions.prodVista = (d) => { ui.prodVista = d.v; render(); };
views.produtosAfter = views.pedidosAfter;
const linhaAviam = (a = { materialId: '', qtd: 1 }) => `<div class="aviam"><select name="av_mat">${[['', '— material —'], ...S.materiais.filter((m) => m.tipo === 'aviamento').map((m) => [m.id, `${m.nome} (${money(m.custo)}/${m.unidade})`])].map(([v, t]) => `<option value="${v}" ${String(v) === String(a.materialId) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>
  <input name="av_qtd" type="number" step="any" min="0" value="${a.qtd}" title="Quantidade"><button type="button" class="icon" data-act="rmAviam">🗑</button></div>`;
actions.rmAviam = (d, el) => { const f = el.closest('form'); el.closest('.aviam').remove(); f.dispatchEvent(new Event('input')); };
actions.addAviam = (d, el) => { el.closest('form').querySelector('#aviams').insertAdjacentHTML('beforeend', linhaAviam()); };

function lerProdutoForm(form) {
  const f = new FormData(form);
  const mats = f.getAll('av_mat'), qtds = f.getAll('av_qtd');
  return {
    catalogo: f.get('catalogo') === 'on', foto: f.get('foto') || '', nome: (f.get('nome') || '').trim(), codigo: f.get('codigo'), categoria: (f.get('categoria') || '').trim(),
    tecidoId: f.get('tecidoId') ? Number(f.get('tecidoId')) : '', consumoTecido: parseFloat(f.get('consumoTecido')) || 0,
    aviamentos: mats.map((m, i) => ({ materialId: Number(m), qtd: parseFloat(qtds[i]) || 0 })).filter((a) => a.materialId),
    tempoMin: parseFloat(f.get('tempoMin')) || 0, margemAtacado: parseFloat(f.get('margemAtacado')) || 0, margemVarejo: parseFloat(f.get('margemVarejo')) || 0, obs: f.get('obs'),
  };
}
function formProduto(p, copia) {
  const novo = !p || copia;
  const base = p ? JSON.parse(JSON.stringify(p)) : { foto: '', nome: '', codigo: '', categoria: '', tecidoId: '', consumoTecido: '', aviamentos: [], tempoMin: '', margemAtacado: S.config.margemAtacado, margemVarejo: S.config.margemVarejo, obs: '' };
  if (copia) { base.nome += ' (cópia)'; base.codigo = ''; }
  const cats = [...new Set(S.produtos.map((x) => x.categoria).filter(Boolean))];
  const hora = Calc.valorHora(S.config);
  openModal({
    title: novo ? (copia ? 'Duplicar produto' : 'Novo produto') : 'Produto', wide: true,
    body: `<div class="cols"><div>
      <div class="form-grid">${campoFoto(base.foto, base.nome)}${F.text('nome', 'Nome do produto', base.nome, 'required')}${F.text('codigo', 'Código', base.codigo)}
      <label>Categoria<input name="categoria" list="cats" value="${esc(base.categoria)}"><datalist id="cats">${cats.map((c) => `<option value="${esc(c)}">`).join('')}</datalist></label>
      ${F.select('tecidoId', 'Tecido padrão', [['', '— nenhum —'], ...S.materiais.filter((m) => m.tipo === 'tecido').map((m) => [m.id, `${m.nome} (${money(m.custo)}/${m.unidade})`])], base.tecidoId)}
      ${F.num('consumoTecido', 'Quanto de tecido gasta (metros)', base.consumoTecido, 'min="0"')}${F.num('tempoMin', 'Tempo de produção (minutos)', base.tempoMin, 'min="0"')}</div>
      <h3>Aviamentos</h3><div id="aviams">${base.aviamentos.map(linhaAviam).join('')}</div><button type="button" class="btn sm" data-act="addAviam">+ Aviamento</button>
      <div class="form-grid" style="margin-top:14px">${F.num('margemAtacado', 'Margem de lucro ATACADO (%)', base.margemAtacado, 'min="0" max="95"')}${F.num('margemVarejo', 'Margem de lucro VAREJO (%)', base.margemVarejo, 'min="0" max="95"')}${F.area('obs', 'Observações', base.obs)}<label class="check full"><input type="checkbox" name="catalogo" ${base.catalogo !== false ? 'checked' : ''}> Mostrar este produto no Catálogo</label></div>
      ${novo ? '' : '<p><button type="button" class="btn danger-o sm" data-act="excluirProduto" data-id="' + p.id + '">Excluir produto</button></p>'}
    </div><aside class="calc card" id="calcBox"></aside></div>`,
    onOpen: (form) => {
      const upd = () => {
        const d = lerProdutoForm(form), c = Calc.custoProduto(S, d);
        $('#calcBox', form).innerHTML = `<h3>Como o preço é calculado</h3>
          <div class="ln"><span>Tecido</span><b>${money(c.tecido)}</b></div><div class="ln"><span>Aviamentos</span><b>${money(c.aviamentos)}</b></div>
          <div class="ln"><span>Mão de obra (${money(hora)}/h)</span><b>${money(c.maoDeObra)}</b></div><div class="ln"><span>Custos fixos rateados</span><b>${money(c.fixos)}</b></div>
          <div class="ln tot"><span>Custo da peça</span><b>${money(c.total)}</b></div>
          <div class="price"><span>Atacado</span><b>${money(Calc.preco(c.total, d.margemAtacado))}</b><small>lucro ${money(Calc.preco(c.total, d.margemAtacado) - c.total)}</small></div>
          <div class="price"><span>Varejo</span><b>${money(Calc.preco(c.total, d.margemVarejo))}</b><small>lucro ${money(Calc.preco(c.total, d.margemVarejo) - c.total)}</small></div>`;
      };
      form.addEventListener('input', upd); upd(); ligarFoto(form);
    },
    onSubmit: (v, form) => {
      const dados = lerProdutoForm(form);
      if (novo) S.produtos.push({ id: nextId('produto'), ...dados }); else Object.assign(p, dados);
      save(); toast('Produto salvo.'); render();
    },
  });
}
actions.novoProduto = () => formProduto(null);
actions.editarProduto = (d) => formProduto(byId(S.produtos, d.id));
actions.duplicarProduto = (d) => formProduto(byId(S.produtos, d.id), true);
actions.excluirProduto = (d) => {
  if (S.pedidos.some((o) => o.itens.some((i) => i.produtoId === Number(d.id)))) return toast('Este produto já foi usado em pedidos e não pode ser excluído.');
  confirmar('Excluir este produto?', () => { S.produtos = S.produtos.filter((p) => p.id !== Number(d.id)); save(); $$('.overlay').forEach((o) => o.remove()); render(); });
};
