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
const FREQ = [['sessao', 'Sempre que abrir e fechar o programa'], ['1h', 'A cada 1 hora'], ['6h', 'A cada 6 horas'], ['diario', 'Uma vez por dia'], ['semanal', 'Uma vez por semana'], ['desligado', 'Desligado (não recomendado)']];
const dataHora = (ms) => (ms ? new Date(ms).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'ainda não houve');
views.config = function () {
  const c = S.config;
  return `<div class="page-head"><h1>Configurações</h1></div>
  <section class="card"><h3>Logo do ateliê</h3><div class="foto-campo"><div class="logo-prev">${c.logo ? `<img src="${esc(c.logo)}" alt="">` : '<span class="muted small">sem logo</span>'}</div>
    <div class="foto-ctl"><label class="btn sm filebtn">Escolher logo<input type="file" accept="image/*" hidden id="logoArquivo"></label><button type="button" class="btn sm" data-act="rmLogo">Remover logo</button>
    <small class="muted">Aparece no menu, nos pedidos impressos e no ícone da janela. PNG com fundo transparente fica melhor. O atalho da área de trabalho continua com o ícone original.</small></div></div></section>
  <form id="cfgForm"><section class="card"><h3>Seu ateliê</h3><div class="form-grid">${F.text('loja', 'Nome do ateliê', c.loja)}${F.text('telefone', 'Telefone / contato (aparece no pedido impresso)', c.telefone)}${F.text('rodapePedido', 'Mensagem no rodapé do pedido', c.rodapePedido)}</div></section>
  <section class="card"><h3>Seu trabalho (base do cálculo de preço)</h3>
    <div class="form-grid">${F.num('salario', 'Quanto quer ganhar por mês (R$)', c.salario, 'min="0"')}${F.num('dias', 'Dias trabalhados no mês', c.dias, 'min="1" max="31"')}${F.num('horas', 'Horas trabalhadas por dia', c.horas, 'min="1" max="24"')}
    ${F.num('custoFixo', 'Custos fixos do mês (R$): luz, internet, aluguel, máquina…', c.custoFixo, 'min="0"')}${F.num('margemAtacado', 'Margem padrão ATACADO para novos produtos (%)', c.margemAtacado, 'min="0" max="95"')}${F.num('margemVarejo', 'Margem padrão VAREJO para novos produtos (%)', c.margemVarejo, 'min="0" max="95"')}</div>
    <p class="muted" id="horaInfo"></p>
    <p class="muted small">Ao mudar estes valores, o custo e o preço de todos os produtos são recalculados. Pedidos já lançados mantêm o preço combinado.</p></section>
  <button class="btn primary">Salvar configurações</button></form>
  <section class="card" style="margin-top:18px" id="bkCard"><h3>Cópia de segurança automática</h3><p class="muted">Carregando…</p></section>
  <section class="card"><h3>Trocar de computador ou restaurar dados</h3>
    <ol class="passos"><li><b>No computador antigo:</b> clique em <i>Salvar cópia em arquivo</i> e leve o arquivo (pen drive, Drive ou WhatsApp). Se as cópias automáticas já vão para um pen drive ou para a nuvem, esse passo é opcional.</li>
    <li><b>No computador novo:</b> instale o programa, abra e clique em <i>Restaurar de um arquivo</i>, ou escolha uma cópia automática na lista abaixo.</li></ol>
    <div class="row-btn"><button class="btn" data-act="exportar">Salvar cópia em arquivo…</button><button class="btn danger-o" data-act="restaurar">Restaurar de um arquivo…</button></div>
    <h3 style="margin-top:18px">Cópias automáticas encontradas</h3><div id="bkLista"><p class="muted">Carregando…</p></div>
    <p class="muted small">Ao restaurar, os dados atuais são guardados antes numa cópia chamada <i>antes-de-restaurar</i>, na mesma pasta.</p></section>`;
};
function desenharBackup(c) {
  ui.bk = c;
  const box = $('#bkCard'); if (!box) return;
  box.innerHTML = `<h3>Cópia de segurança automática</h3>
    <div class="form-grid"><label>Quando fazer a cópia<select id="bkFreq">${FREQ.map(([v, t]) => `<option value="${v}" ${v === c.frequencia ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
    <label>Quantas cópias guardar<input id="bkManter" type="number" min="1" max="365" value="${c.manter}"></label></div>
    <p><b>Pasta das cópias:</b> <code>${esc(c.backupDir)}</code></p>
    <div class="row-btn"><button class="btn" data-act="bkEscolher">Escolher pasta…</button><button class="btn" data-act="bkAbrir">Abrir pasta</button><button class="btn primary" data-act="bkAgora">Fazer cópia agora</button></div>
    <p class="${c.ultimoErro ? 'bad' : 'muted'}" style="margin-bottom:0">${c.ultimoErro ? '⚠ A última tentativa falhou: ' + esc(c.ultimoErro) + '. Confira se a pasta ou o pen drive está disponível.' : 'Última cópia: ' + dataHora(c.ultimo)}</p>
    <p class="muted small">Só é criada uma cópia nova quando houve alteração nos dados. Num computador emprestado, escolha como pasta um pen drive ou a pasta do Google Drive ou OneDrive, para os dados saírem junto com ela.</p>`;
  $('#bkFreq').onchange = async (e) => desenharBackup(await api.setSettings({ frequencia: e.target.value }));
  $('#bkManter').onchange = async (e) => desenharBackup(await api.setSettings({ manter: e.target.value }));
}
async function carregarCopias() {
  const box = $('#bkLista'); if (!box) return;
  const l = await api.listBackups();
  box.innerHTML = l.length ? `<table class="t"><tbody>${l.map((f) => `<tr><td>${dataHora(f.mtime)}</td><td class="muted small">${esc(f.name)}</td><td class="r muted small">${num(f.size / 1024, 0)} KB</td><td class="r"><button class="btn sm" data-act="bkRestaurar" data-name="${esc(f.name)}">Restaurar esta</button></td></tr>`).join('')}</tbody></table>`
    : '<p class="empty">Nenhuma cópia na pasta escolhida ainda.</p>';
}
views.configAfter = function () {
  const f = $('#cfgForm');
  const info = () => { const v = (n) => parseFloat(f[n].value) || 0; $('#horaInfo').textContent = `Valor da sua hora: ${money(Calc.valorHora({ salario: v('salario'), dias: v('dias'), horas: v('horas') }))}`; };
  f.addEventListener('input', info); info();
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    const o = formData(f), n = (k) => parseFloat(o[k]) || 0;
    Object.assign(S.config, { loja: o.loja.trim() || 'Meu Ateliê', telefone: o.telefone, rodapePedido: o.rodapePedido, salario: n('salario'), dias: n('dias') || 22, horas: n('horas') || 8, custoFixo: n('custoFixo'), margemAtacado: n('margemAtacado'), margemVarejo: n('margemVarejo') });
    save(); toast('Configurações salvas.'); render();
  });
  $('#logoArquivo').addEventListener('change', async (e) => {
    const file = e.target.files[0]; e.target.value = '';
    if (!file || !file.type.startsWith('image/')) return toast('Escolha um arquivo de imagem (PNG ou JPG).');
    try { S.config.logo = await redimensionar(file, 320, true); save(); aplicarLogo(); toast('Logo atualizada.'); render(); } catch (err) { toast('Não consegui abrir essa imagem. Tente PNG ou JPG.'); }
  });
  api.getSettings().then(desenharBackup); carregarCopias();
};
actions.rmLogo = () => { delete S.config.logo; save(); aplicarLogo(); toast('Logo removida.'); render(); };
actions.bkEscolher = async () => { const d = await api.chooseBackupDir(); if (d) { desenharBackup(await api.setSettings({ backupDir: d })); carregarCopias(); toast('Pasta alterada.'); } };
actions.bkAbrir = () => api.openBackupFolder();
actions.bkAgora = async () => { const r = await api.backupNow(); if (r.config) desenharBackup(r.config); toast(r.ok ? 'Cópia feita.' : 'Não foi possível: ' + (r.erro || 'erro')); carregarCopias(); };
actions.exportar = async () => { if (await api.exportBackup()) toast('Cópia salva.'); };

// Troca todos os dados pelos de uma cópia, guardando antes uma cópia dos atuais.
function aplicarRestauracao(d) {
  if (!d || !d.config || !Array.isArray(d.pedidos)) return toast('Este arquivo não parece ser uma cópia do programa.');
  confirmar('Substituir TODOS os dados atuais por esta cópia? Os dados de agora ficam guardados numa cópia "antes-de-restaurar".', async () => {
    await api.safetyCopy();
    S = migrate(d); S.config.bemVinda = true; ui.draft = null; await save(); aplicarLogo();
    toast('Dados restaurados.'); go('painel'); carregarCopias();
  }, 'Restaurar');
}
actions.restaurar = async () => aplicarRestauracao(await api.importBackup());
actions.bkRestaurar = async (d) => aplicarRestauracao(await api.readBackup(d.name));
actions.bvArquivo = () => { fecharModais(); actions.restaurar(); };
actions.bvPasta = () => { fecharModais(); go('config'); };
