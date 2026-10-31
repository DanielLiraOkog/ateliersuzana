const assert = require('assert');
const C = require('../src/calc.js');
const S = {
  config: { salario: 1500, dias: 22, horas: 8, custoFixo: 100 },
  materiais: [
    { id: 1, custo: 15 }, { id: 2, custo: 7 }, { id: 3, custo: 1.5 },
  ],
};
assert.strictEqual(C.r2(C.valorHora(S.config)), 8.52);
const p = { tecidoId: 1, consumoTecido: 1.5, tempoMin: 8, aviamentos: [{ materialId: 2, qtd: 1 }, { materialId: 3, qtd: 2 }] };
const c = C.custoProduto(S, p);
assert.strictEqual(c.tecido, 22.5);
assert.strictEqual(c.aviamentos, 10);
assert.strictEqual(c.maoDeObra, 1.14); // 8,52/h * 8 min
assert.strictEqual(c.fixos, 0.08);
assert.strictEqual(c.total, 33.71);
assert.strictEqual(C.preco(70, 30), 100);          // 30% do preço é lucro
assert.strictEqual(C.preco(50, 0), 50);
const ped = { itens: [{ qtd: 2, preco: 50, custo: 30 }], desconto: 10, frete: 15, pagamentos: [{ valor: 50 }] };
assert.strictEqual(C.totalPedido(ped), 105);
assert.strictEqual(C.pagoPedido(ped), 50);
assert.strictEqual(C.lucroPedido(ped), 30);
console.log('calc ok');
