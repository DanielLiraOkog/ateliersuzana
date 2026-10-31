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

## Cópias de segurança
- Configurações → Cópia de segurança automática: frequência (ao abrir/fechar, 1 h, 6 h, diária, semanal), quantidade de cópias e pasta de destino (pen drive, Drive, OneDrive).
- As preferências ficam em `Documentos\Atelier Suzana Lira\config-app.json` (por computador). Os dados ficam em `dados.json`.
- Trocar de computador: salvar cópia em arquivo no antigo e restaurar no novo (ou escolher uma cópia automática). Os dados atuais são guardados antes como `antes-de-restaurar-*.json`.
