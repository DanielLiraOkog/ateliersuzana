// Regras de cálculo de preço. Funciona no navegador (global Calc) e no Node (testes).
(function (root) {
  const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

  // Valor de uma hora de trabalho: salário / dias / horas por dia
  function valorHora(cfg) {
    const horasMes = cfg.dias * cfg.horas;
    return horasMes > 0 ? cfg.salario / horasMes : 0;
  }

  // Custo fixo mensal rateado por minuto trabalhado
  function fixoPorMinuto(cfg) {
    const minMes = cfg.dias * cfg.horas * 60;
    return minMes > 0 ? cfg.custoFixo / minMes : 0;
  }

  // Custo de uma peça. `tecidoId` troca o tecido padrão (outra estampa/cor).
  function custoProduto(S, p, tecidoId) {
    const mat = (id) => S.materiais.find((m) => m.id === Number(id));
    const tecido = mat(tecidoId || p.tecidoId);
    const tecidoCusto = tecido ? tecido.custo * (p.consumoTecido || 0) : 0;
    const aviam = (p.aviamentos || []).reduce((s, a) => {
      const m = mat(a.materialId);
      return s + (m ? m.custo * (a.qtd || 0) : 0);
    }, 0);
    const maoDeObra = (valorHora(S.config) * (p.tempoMin || 0)) / 60;
    const fixos = fixoPorMinuto(S.config) * (p.tempoMin || 0);
    const total = tecidoCusto + aviam + maoDeObra + fixos;
    return {
      tecido: r2(tecidoCusto), aviamentos: r2(aviam), maoDeObra: r2(maoDeObra),
      fixos: r2(fixos), total: r2(total),
    };
  }

  // Margem sobre o preço de venda: 30% => lucro é 30% do preço.
  function preco(custo, margem) {
    const m = Math.min(Number(margem) || 0, 95) / 100;
    return r2(custo / (1 - m));
  }

  function totalPedido(p) {
    const itens = (p.itens || []).reduce((s, i) => s + i.qtd * i.preco, 0);
    return r2(itens - (p.desconto || 0) + (p.frete || 0));
  }
  const pagoPedido = (p) => r2((p.pagamentos || []).reduce((s, x) => s + x.valor, 0));
  const lucroPedido = (p) =>
    r2((p.itens || []).reduce((s, i) => s + i.qtd * (i.preco - i.custo), 0) - (p.desconto || 0));

  const api = { r2, valorHora, fixoPorMinuto, custoProduto, preco, totalPedido, pagoPedido, lucroPedido };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Calc = api;
})(typeof window !== 'undefined' ? window : globalThis);
