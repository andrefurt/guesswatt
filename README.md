# GuessWatts

> Compare electricity tariffs in Portugal. See whether you are paying too much.

GuessWatts compares every electricity offer published by ERSE, the Portuguese energy regulator, with
what you pay now, and tells you which one is cheapest for you and how to switch. It is free, open
source and runs at [guesswatts.com](https://guesswatts.com).

## What it does

- **Estimado:** type your monthly bill in euros and see how it compares with the market.
- **Preciso:** upload your PDF invoice or type its numbers, and see what the cheapest offer saves you.
- **The best offer for you:** domestic offers only; offers with a lock-in or reserved for a group are
  left out, and indexed offers are labelled with the price date.
- **How to switch:** the supplier's contacts from ERSE's data and the steps to change.
- **Private:** everything runs in your browser, and the invoice never leaves your device. The result
  lives in the URL, so it can be shared as a link.
- **Works offline** after the first visit, and installs as an app.

## Run it locally

```bash
git clone https://github.com/andrefurt/guesswatt.git
cd guesswatt
git config core.hooksPath .githooks   # once per clone: the commit checks and the gate
python3 -m http.server 8000           # then open http://localhost:8000
```

There is no build step: the browser loads the files as they are in the repo. It needs an HTTP server,
not `file://`. Setup, tests, the data refresh and troubleshooting are in
[`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md).

## How it works

- **Data:** a weekly GitHub Action (`.github/workflows/update-erse.yml`) downloads ERSE's tariff
  export, builds `data/offers.json`, checks it against bounds and pushes it when prices change. The
  page shows the date of the prices.
- **Calculation:** `js/calculator.js` owns the formulas and the ranking;
  [`docs/DATA_MODEL.mdc`](docs/DATA_MODEL.mdc) explains them.
- **Stack:** plain JavaScript modules and CSS, no framework and no backend. PDF.js and the Inter font
  are self-hosted in `vendor/`. [`docs/TECH_STACK.mdc`](docs/TECH_STACK.mdc) has the architecture and
  the file map.
- **Accessibility:** aims for WCAG 2.2 AA.

## Documentation

[`docs/README.md`](docs/README.md) says which doc owns what. Why something is the way it is:
[`docs/DECISIONS.mdc`](docs/DECISIONS.mdc).

## Contributing

Read [`CLAUDE.md`](CLAUDE.md) for the rules and [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) for the
workflow. Issues: [GitHub Issues](https://github.com/andrefurt/guesswatt/issues).

## License

MIT, see [LICENSE](LICENSE). The tariff data is ERSE's ([erse.pt](https://www.erse.pt/)).
