// ================= FINANCEIRO =================
views.financeiro = function () {
  const m = ui.mes;
  const entradas = S.pedidos.filter((p) => p.status !== 'cancelado')
    .flatMap((p) => p.pagamentos.map((x) => ({ ...x, pedido: p }))).filter((x) => x.data.startsWith(m)).sort((a, b) => b.data.localeCompare(a.data));
  const saidas = S.despesas.filter((d) => d.data.startsWith(m)).sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id);
  const tEnt = entradas.reduce((s, x) => s + x.valor, 0), tSai = saidas.reduce((s, x) => s + x.valor, 0);
  const porCat = {}; saidas.forEach((d) => (porCat[d.categoria] = (porCat[d.categoria] || 0) + d.valor));
  const devedores = pedidosValidos().filter((p) => saldoPedido(p) > 0.004).sort((a, b) => (a.entrega || '9999').localeCompare(b.entrega || '9999'));
  return `<div class="page-head"><h1>Financeiro</h1><div class="row-btn"><button class="btn primary" data-act="novaDespesa">+ Lançar gasto</button></div></div>
  <div class="month"><button class="btn sm" data-act="mesAnt">‹</button><b>${esc(mesNome(m))}</b><button class="btn sm" data-act="mesProx">›</button></div>
  <div class="stats">
    <div class="stat"><span>Entrou</span><b class="good">${money(tEnt)}</b></div><div class="stat"><span>Saiu</span><b class="bad">${money(tSai)}</b></div>
    <div class="stat"><span>Saldo do mês</span><b class="${tEnt - tSai < 0 ? 'bad' : 'good'}">${money(tEnt - tSai)}</b></div></div>
  <div class="grid2">
    <section class="card"><h3>Entradas (pagamentos recebidos)</h3>
      ${entradas.length ? `<table class="t"><tbody>${entradas.map((x) => `<tr class="click" data-act="abrirPedido" data-id="${x.pedido.id}"><td>${dataBR(x.data)}</td><td>#${x.pedido.numero} · ${esc(nomeCliente(x.pedido.clienteId))}</td><td>${esc(x.forma)}</td><td class="r good">${money(x.valor)}</td></tr>`).join('')}</tbody></table>` : '<p class="empty">Nada recebido neste mês.</p>'}
    </section>
    <section class="card"><h3>Saídas (gastos)</h3>
      ${saidas.length ? `<table class="t"><tbody>${saidas.map((d) => `<tr><td>${dataBR(d.data)}</td><td>${esc(d.descricao)}</td><td class="muted">${esc(d.categoria)}</td><td class="r bad">${money(d.valor)}</td>
        <td><button class="icon" data-act="excluirDespesa" data-id="${d.id}" title="Excluir">🗑</button></td></tr>`).join('')}</tbody></table>
        <p class="small muted">${Object.entries(porCat).map(([k, v]) => `${esc(k)}: ${money(v)}`).join(' · ')}</p>` : '<p class="empty">Nenhum gasto neste mês.</p>'}
    </section>
  </div>
  <section class="card"><h3>Clientes que ainda devem</h3>
    ${devedores.length ? `<table class="t"><thead><tr><th>Pedido</th><th>Cliente</th><th>Entrega</th><th class="r">Total</th><th class="r">Falta</th></tr></thead><tbody>${devedores.map((p) => `<tr class="click" data-act="abrirPedido" data-id="${p.id}"><td>#${p.numero}</td><td>${esc(nomeCliente(p.clienteId))}</td><td>${dataBR(p.entrega)}</td><td class="r">${money(Calc.totalPedido(p))}</td><td class="r warn">${money(saldoPedido(p))}</td></tr>`).join('')}</tbody></table>` : '<p class="empty">Ninguém devendo. 🎉</p>'}
  </section>`;
};
actions.mesAnt = () => { ui.mes = somaMes(ui.mes, -1); render(); };
actions.mesProx = () => { ui.mes = somaMes(ui.mes, 1); render(); };
actions.novaDespesa = () => openModal({
  title: 'Lançar gasto',
  body: `<div class="form-grid">${F.date('data', 'Data', hoje(), 'required')}${F.text('descricao', 'Descrição', '', 'required')}${F.select('categoria', 'Categoria', CATEGORIAS_DESP.map((c) => [c, c]))}${F.num('valor', 'Valor (R$)', '', 'required min="0.01"')}</div>`,
  onSubmit: (v) => { S.despesas.push({ id: nextId('despesa'), data: v.data, descricao: v.descricao, categoria: v.categoria, valor: Calc.r2(parseFloat(v.valor)) }); save(); toast('Gasto lançado.'); render(); },
});
actions.excluirDespesa = (d) => {
  const x = byId(S.despesas, d.id);
  if (x.compraId) return toast('Este gasto veio de uma compra de material. Exclua a compra na tela Materiais.');
  confirmar('Excluir este gasto?', () => { S.despesas = S.despesas.filter((y) => y.id !== x.id); save(); render(); });
};

// ================= CONFIGURAÇÕES =================
views.config = function () {
  const c = S.config;
  return `<div class="page-head"><h1>Configurações</h1></div>
  <form id="cfgForm"><section class="card"><h3>Seu ateliê</h3><div class="form-grid">${F.text('loja', 'Nome do ateliê', c.loja)}${F.text('telefone', 'Telefone / contato (aparece no pedido impresso)', c.telefone)}${F.text('rodapePedido', 'Mensagem no rodapé do pedido', c.rodapePedido)}</div></section>
  <section class="card"><h3>Seu trabalho (base do cálculo de preço)</h3>
    <div class="form-grid">${F.num('salario', 'Quanto quer ganhar por mês (R$)', c.salario, 'min="0"')}${F.num('dias', 'Dias trabalhados no mês', c.dias, 'min="1" max="31"')}${F.num('horas', 'Horas trabalhadas por dia', c.horas, 'min="1" max="24"')}
    ${F.num('custoFixo', 'Custos fixos do mês (R$): luz, internet, aluguel, máquina…', c.custoFixo, 'min="0"')}${F.num('margemAtacado', 'Margem padrão ATACADO para novos produtos (%)', c.margemAtacado, 'min="0" max="95"')}${F.num('margemVarejo', 'Margem padrão VAREJO para novos produtos (%)', c.margemVarejo, 'min="0" max="95"')}</div>
    <p class="muted" id="horaInfo"></p>
    <p class="muted small">Ao mudar estes valores, o custo e o preço de todos os produtos são recalculados. Pedidos já lançados mantêm o preço combinado.</p></section>
  <button class="btn primary">Salvar configurações</button></form>
  <section class="card" style="margin-top:18px"><h3>Cópia de segurança</h3>
    <p>Seus dados ficam salvos neste computador em <code id="dataDir"></code>. O programa também guarda uma cópia automática por dia (últimos 30 dias) na pasta <i>backups</i>.</p>
    <div class="row-btn"><button class="btn" data-act="exportar">Salvar cópia (pen drive / nuvem)</button><button class="btn danger-o" data-act="restaurar">Restaurar de uma cópia</button></div></section>`;
};
views.configAfter = function () {
  const f = $('#cfgForm');
  const info = () => { const v = (n) => parseFloat(f[n].value) || 0; $('#horaInfo').textContent = `Valor da sua hora: ${money(Calc.valorHora({ salario: v('salario'), dias: v('dias'), horas: v('horas') }))}`; };
  f.addEventListener('input', info); info();
  api.dataDir().then((p) => { $('#dataDir').textContent = p; });
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    const o = formData(f), n = (k) => parseFloat(o[k]) || 0;
    Object.assign(S.config, { loja: o.loja.trim() || 'Meu Ateliê', telefone: o.telefone, rodapePedido: o.rodapePedido, salario: n('salario'), dias: n('dias') || 22, horas: n('horas') || 8, custoFixo: n('custoFixo'), margemAtacado: n('margemAtacado'), margemVarejo: n('margemVarejo') });
    save(); toast('Configurações salvas.'); render();
  });
};
actions.exportar = async () => { if (await api.exportBackup()) toast('Cópia salva.'); };
actions.restaurar = async () => {
  const d = await api.importBackup(); if (!d) return;
  if (!d.pedidos || !d.config) return toast('Este arquivo não parece ser um backup do programa.');
  confirmar('Substituir TODOS os dados atuais por esta cópia?', () => { S = migrate(d); save(); toast('Dados restaurados.'); render(); }, 'Restaurar');
};
