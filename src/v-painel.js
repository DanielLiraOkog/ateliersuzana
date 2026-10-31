const pedidosValidos = () => S.pedidos.filter((p) => !['orcamento', 'cancelado'].includes(p.status));
const saldoPedido = (p) => Calc.r2(Calc.totalPedido(p) - Calc.pagoPedido(p));

views.painel = function () {
  const m = ym(new Date());
  const doMes = pedidosValidos().filter((p) => p.data.startsWith(m));
  const fat = doMes.reduce((s, p) => s + Calc.totalPedido(p), 0);
  const lucro = doMes.reduce((s, p) => s + Calc.lucroPedido(p), 0);
  const recebido = S.pedidos.filter((p) => p.status !== 'cancelado').flatMap((p) => p.pagamentos).filter((x) => x.data.startsWith(m)).reduce((s, x) => s + x.valor, 0);
  const desp = S.despesas.filter((d) => d.data.startsWith(m)).reduce((s, d) => s + d.valor, 0);
  const aReceber = pedidosValidos().reduce((s, p) => s + Math.max(0, saldoPedido(p)), 0);

  const entregas = S.pedidos.filter((p) => ['aprovado', 'producao', 'pronto'].includes(p.status))
    .sort((a, b) => (a.entrega || '9999').localeCompare(b.entrega || '9999')).slice(0, 8);
  const orcamentos = S.pedidos.filter((p) => p.status === 'orcamento');
  const baixo = S.materiais.filter((x) => x.minimo > 0 && x.estoque <= x.minimo);

  const meses = [5, 4, 3, 2, 1, 0].map((i) => somaMes(m, -i));
  const serie = meses.map((mm) => pedidosValidos().filter((p) => p.data.startsWith(mm)).reduce((s, p) => s + Calc.totalPedido(p), 0));
  const max = Math.max(...serie, 1);

  const vazio = !S.materiais.length || !S.produtos.length;
  const passos = vazio ? `<section class="card hint"><h3>Por onde começar</h3><ol>
      <li class="${S.materiais.length ? 'ok' : ''}"><a data-act="go" data-view="materiais">Cadastre seus materiais</a> (tecidos, elástico, botões…) com o preço que você paga.</li>
      <li class="${S.produtos.length ? 'ok' : ''}"><a data-act="go" data-view="produtos">Cadastre seus produtos</a>: o programa calcula o custo e o preço sozinho.</li>
      <li class="${S.clientes.length ? 'ok' : ''}"><a data-act="go" data-view="clientes">Cadastre clientes</a> (ou importe da planilha antiga).</li>
      <li class="${S.pedidos.length ? 'ok' : ''}"><a data-act="go" data-view="pedidos">Lance seu primeiro pedido</a>.</li>
    </ol></section>` : '';

  return `<div class="page-head"><h1>Painel</h1><span class="muted">${esc(mesNome(m))}</span></div>
  ${passos}
  <div class="stats">
    <div class="stat"><span>Vendas do mês</span><b>${money(fat)}</b></div>
    <div class="stat"><span>Recebido no mês</span><b class="good">${money(recebido)}</b></div>
    <div class="stat"><span>Gastos do mês</span><b class="bad">${money(desp)}</b></div>
    <div class="stat"><span>Lucro estimado das vendas</span><b>${money(lucro)}</b><small>já descontado custo de material, mão de obra e custos fixos</small></div>
    <div class="stat"><span>A receber dos clientes</span><b class="warn">${money(aReceber)}</b></div>
  </div>
  <div class="grid2">
    <section class="card"><h3>Próximas entregas</h3>
      ${entregas.length ? `<table class="t"><tbody>${entregas.map((p) => {
        const atraso = p.entrega && p.entrega < hoje();
        return `<tr class="click" data-act="abrirPedido" data-id="${p.id}"><td>#${p.numero}</td><td>${esc(nomeCliente(p.clienteId))}</td>
          <td class="${atraso ? 'bad' : ''}">${p.entrega ? dataBR(p.entrega) + (atraso ? ' · atrasado' : '') : 'sem data'}</td><td><span class="tag s-${p.status}">${STATUS_NOME[p.status]}</span></td></tr>`;
      }).join('')}</tbody></table>` : '<p class="empty">Nenhuma entrega pendente.</p>'}
    </section>
    <section class="card"><h3>Vendas dos últimos 6 meses</h3>
      <div class="bars">${serie.map((v, i) => `<div class="bar"><i style="height:${Math.round((v / max) * 100)}%" title="${money(v)}"></i><em>${money(v).replace(',00', '')}</em><span>${new Date(meses[i] + '-15').toLocaleDateString('pt-BR', { month: 'short' })}</span></div>`).join('')}</div>
    </section>
    <section class="card"><h3>Atenção</h3>
      <ul class="alerts">
        ${orcamentos.length ? `<li><a data-act="filtrarPedidos" data-f="orcamento">${orcamentos.length} orçamento(s) aguardando resposta</a></li>` : ''}
        ${baixo.map((x) => `<li class="bad"><a data-act="go" data-view="materiais">Estoque baixo: ${esc(x.nome)} (${num(x.estoque)} ${x.unidade})</a></li>`).join('')}
        ${!orcamentos.length && !baixo.length ? '<li class="muted">Tudo em ordem por aqui.</li>' : ''}
      </ul>
    </section>
    <section class="card"><h3>Atalhos</h3>
      <div class="shortcuts">
        <button class="btn primary" data-act="novoPedido">+ Novo pedido</button>
        <button class="btn" data-act="novaCompra">+ Registrar compra de material</button>
        <button class="btn" data-act="novaDespesa">+ Lançar gasto</button>
      </div>
    </section>
  </div>`;
};
