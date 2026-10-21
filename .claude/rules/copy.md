---
paths:
  - "*.html"
  - "*.md"
  - "js/**/*.js"
  - "components.js"
---

# Copy

The code owns the UI strings (`index.html`, `sobre.html`, `index.md`, `sobre.md`, `js/*.js`);
`docs/COPY.mdc` owns the voice and the glossary. Read it before writing or changing any text a user
sees.
`scripts/rules-check.js` (in the gate) catches rules 1, 4, 6 and 7 where a grep can; its message
says the fix.

1. PT-PT, with "tu" throughout; never "você".
2. Technical terms get a Portuguese explanation beside the original: "potência contratada (kVA)".
3. Error messages say what happened and what to do next; technical detail goes to the console.
4. Spelling follows AO90: fatura, eletricidade, atualizado, exato, projeto.
5. The brand is "GuessWatts" (lowercase only in the domain, guesswatts.com).
6. Numbers in PT-PT form through `formatEuro` and `formatNumber` (`js/utils.js`): "54,28 €",
   "cerca de 65 €/mês", "4,6 kVA". Never "€54.28".
7. No gerunds where PT-PT uses "a + infinitive" ("a gastar", not "gastando"), and no em dashes.
8. The supplier is "fornecedor" in everything a user reads. "Operador" in PT energy is the network
   operator (E-REDES), so it is never the supplier; "comercializador", ERSE's term, appears only as
   an explanation beside "fornecedor".
9. A verdict shows the number it rests on: "Poupas 0,80 €/mês. É pouco para compensar a mudança",
   not only "Já tens uma boa tarifa". A threshold the person cannot see reads as a hidden rule.
