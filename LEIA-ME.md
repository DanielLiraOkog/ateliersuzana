# Atelier Suzana Lira — gestão do ateliê

Programa para Windows (funciona sem internet). Dados em `Documentos\Atelier Suzana Lira\dados.json`,
com cópia automática diária em `backups\` (últimos 30 dias).

## Desenvolver
- `npm install` · `npm start` (abre o programa) · `npm run dev` (versão no navegador, porta 5173) · `npm test`
- `npm run dist` gera o instalador em `dist/` (rode no Windows, ou use o GitHub Actions em `.github/workflows/build.yml`).

## Cálculo de preço (src/calc.js)
- Hora = salário ÷ dias ÷ horas por dia. Mão de obra = hora × minutos da peça ÷ 60.
- Custos fixos rateados por minuto trabalhado. Custo = tecido + aviamentos + mão de obra + fixos.
- Preço = custo ÷ (1 − margem). Margem de 30% significa que 30% do preço é lucro. Margem é por produto.
