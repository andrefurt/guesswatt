# GuessWatt

Ferramenta de comparação de tarifas de electricidade em Portugal.

## Como funciona

### Modo Estimativa

Introduz o valor mensal da tua factura (€/mês). O sistema assume:

- Potência: 4.6 kVA (mais comum em Portugal)
- Tarifa: Simples (preço único)
- Consumo: estimado a partir do valor

### Modo Preciso

Podes:

- Carregar a factura em PDF (extracção automática)
- Introduzir manualmente: potência, consumo, tipo de tarifa

## Glossário

- **kWh**: Quilowatt-hora. Unidade de energia. 1 kWh = aparelho de 1000W ligado 1 hora.
- **kVA**: Potência contratada. Define quanta energia podes usar em simultâneo.
- **Tarifa simples**: Preço único a qualquer hora.
- **Tarifa bi-horária**: Dois preços: vazio (22h-8h) e fora de vazio.
- **Tarifa tri-horária**: Três preços: vazio, cheias, ponta.
- **CPE**: Código de Ponto de Entrega. Identifica o contador.
- **Termo fixo**: Valor diário independente do consumo (€/dia).
- **Termo variável**: Preço por energia consumida (€/kWh).

## Fórmula de cálculo

```
Custo = (Termo fixo × 30) + (Termo variável × consumo) + Taxas + IVA 23%
```

## Fonte dos dados

Dados oficiais da ERSE (Entidade Reguladora dos Serviços Energéticos), actualizados mensalmente.

