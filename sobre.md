# Sobre o GuessWatts

## O que é

O GuessWatts compara tarifas de eletricidade em Portugal. Mostras quanto pagas, nós dizemos se estás a pagar demais e qual a melhor alternativa.

Não somos uma empresa de energia. Não vendemos nada. Não ganhamos comissões.

## Porquê

Portugal tem um mercado livre de eletricidade desde 2006. Existem mais de 40 fornecedores (comercializadores, no termo da ERSE) e centenas de tarifas diferentes. A maioria das pessoas fica no mesmo fornecedor durante anos sem comparar, e perde dinheiro.

Mudar de fornecedor é gratuito, demora no máximo 3 semanas e não requer qualquer intervenção técnica. Mas quase ninguém o faz.

O GuessWatts existe para quebrar essa inércia.

## Como calculamos

Usamos os dados oficiais da ERSE (Entidade Reguladora dos Serviços Energéticos).

Para cada tarifa, calculamos:
- Termo fixo (€/dia) × 30 dias
- Termo variável (€/kWh) × consumo mensal
- Taxas: contribuição audiovisual, IEC e taxa da DGEG
- IVA a 6% nos primeiros 200 kWh do mês (300 kWh em casas com 5 ou mais pessoas), até 6,9 kVA
- IVA a 6% na parte do termo fixo que paga o acesso às redes, até 3,45 kVA
- IVA a 23% no resto, exceto na contribuição audiovisual, que paga 6%

## Fonte dos dados

Os dados vêm diretamente da ERSE:
- Preços por tarifa, potência e tipo de contagem
- Condições comerciais (fidelização, contactos, links)

Usamos os dados publicados pela ERSE; a data dos preços aparece no fundo de cada página.

## Limitações

- Estimativas baseadas em consumo médio podem variar ±15% do real
- Tarifas indexadas (preço variável) não são comparáveis diretamente
- Algumas ofertas têm condições especiais não refletidas nos dados

## Quem faz isto

Projeto pessoal de Andrefurt. Código aberto, sem fins lucrativos.

GitHub: https://github.com/andrefurt/guesswatt

