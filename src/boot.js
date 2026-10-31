const NAV = [['painel', '🏠', 'Painel'], ['catalogo', '🖼', 'Catálogo'], ['pedidos', '🧾', 'Pedidos'], ['clientes', '👥', 'Clientes'], ['produtos', '👗', 'Produtos'], ['materiais', '🧵', 'Materiais'], ['financeiro', '💰', 'Financeiro'], ['config', '⚙', 'Configurações']];
(async function boot() {
  S = migrate((await api.load()) || defaults());
  $('#nav').innerHTML = NAV.map(([v, i, t]) => `<button data-view="${v}" data-act="navTo"><span>${i}</span>${t}</button>`).join('');
  actions.navTo = (d) => { ui.busca = ''; ui.draft = null; go(d.view); };
  $('#main').addEventListener('input', (e) => { if (ui.view === 'pedido' && ui.draft) pedidoInput(e); });
  document.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.cat-card,.gcard')) { e.preventDefault(); e.target.click(); } });
  render();
  window.__ready = true;
})();
