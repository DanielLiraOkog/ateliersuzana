const NAV = [['painel', '🏠', 'Painel'], ['catalogo', '🖼', 'Catálogo'], ['pedidos', '🧾', 'Pedidos'], ['clientes', '👥', 'Clientes'], ['produtos', '👗', 'Produtos'], ['materiais', '🧵', 'Materiais'], ['financeiro', '💰', 'Financeiro'], ['config', '⚙', 'Configurações']];
function boasVindas() {
  const vazio = !S.produtos.length && !S.materiais.length && !S.pedidos.length && !S.clientes.length;
  if (!vazio || S.config.bemVinda) return;
  S.config.bemVinda = true; save();
  openModal({ title: 'Bem-vinda ao seu ateliê!', body: `<p class="confirm">É a primeira vez neste computador?</p>
    <p class="muted">Se você já usava o programa em outro computador, traga seus dados de volta agora. Se é a primeira vez de verdade, feche esta janela e comece a cadastrar.</p>
    <div class="row-btn" style="margin-top:14px"><button type="button" class="btn primary" data-act="bvArquivo">Restaurar de um arquivo de cópia</button><button type="button" class="btn" data-act="bvPasta">Ver cópias automáticas</button></div>` });
}
(async function boot() {
  S = migrate((await api.load()) || defaults());
  $('#nav').innerHTML = NAV.map(([v, i, t]) => `<button data-view="${v}" data-act="navTo"><span>${i}</span>${t}</button>`).join('');
  actions.navTo = (d) => { ui.busca = ''; ui.draft = null; go(d.view); };
  $('#main').addEventListener('input', (e) => { if (ui.view === 'pedido' && ui.draft) pedidoInput(e); });
  document.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.cat-card,.gcard')) { e.preventDefault(); e.target.click(); } });
  render();
  aplicarLogo();
  api.getSettings().then((c) => { ui.bk = c; if (ui.view === 'painel') render(); });
  boasVindas();
  window.__ready = true;
})();
