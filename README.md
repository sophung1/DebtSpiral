# DebtSpiral

**[debtspiral.app](https://debtspiral.app)**: a budget simulator where you try to balance the U.S. federal budget using real data, and see what happens to the debt when you don't.

- **Areas**: the budget is grouped into cards: income tax, Social Security, health, safety net, defense & other spending, business & trade, and interest. Each card has its own sliders and policy switches, and shows how much it adds to or saves from the deficit. Every line of the budget belongs to exactly one card. A policy's card is set by `bucket` in `data/policies.json`.
- **Income tax**: a draggable 2D bracket editor. Drag a step up or down to change its rate, and drag a knob left or right to move where the bracket starts.
- **Social Security**: its own cash flow (payroll tax in vs. benefits out), plus the payroll rate and wage cap.
- **Programs**: each benefit slider shows the total cost and what each sample household gets.
- **Scoreboard**: the deficit dial (including the deficit without Social Security), plus whether the budget balances, years to pay off the debt, months until the debt ceiling, debt-to-GDP in 10 years and interest as a share of revenue.
- **Households**: six sample households, from a minimum-wage worker to the top 1%, showing taxes, benefits and net change vs current law.
- Scenarios are saved in the URL, so you can share them.

## Develop

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # model + parser unit tests
npm run build
```

## Data

| File | Updated | Contents |
|---|---|---|
| `data/live.json` | automatically (weekly GitHub Action) | debt, debt limit, average interest rate, Treasury yields, fiscal-year-to-date receipts and outlays |
| `data/manual.json` | by hand, yearly | baseline receipts and outlays by category, tax law (brackets, deductions, CTC, EITC, payroll), IRS income distribution |
| `data/policies.json` | by hand | policy switches: first-year $ score, source, effect on each household |
| `data/archetypes.json` | by hand | the sample households |

`npm run fetch-data` refreshes `live.json` from the Treasury Fiscal Data API and the Treasury yield curve CSV. Neither needs an API key. A source that fails keeps its previous value.

**Yearly checklist:**
- New tax-year brackets, deductions and credits (IRS Rev. Proc. each fall).
- New fiscal-year actuals from the September MTS.
- A newer IRS SOI table.
- Re-check the policy scores against the latest CBO *Options for Reducing the Deficit*.

## Model (static, one year)

- **Baseline**: FY2026 actual receipts and outlays from the Monthly Treasury Statement (Tables 4, 5 and 9).
- **10-year outlook**: the plan applies from FY2027; the primary balance holds as a share of GDP, interest accrues on the debt.
- **Big Beautiful Bill rollback**: restores pre-2025 tax law (brackets, deductions, exemptions, $1,000 CTC) in the model; the rest of CBO's FY2026 score (~$487B) is a lump sum.
- **Debt, interest & inflation**: sliders for market rates, persistent extra inflation (interest catches up as the debt reprices over its ~6-year average maturity) real GDP growth for the 10-year outlook, and an economic-feedback (fiscal multiplier) slider, 0.5 by default (0 = static scoring), with a 'scale with severity' toggle (on by default) that raises it for big austerity (+0.1 per point of GDP above a 2%-of-GDP squeeze, max 2×): tightening the primary balance shrinks GDP by multiplier × tightening, revenue falls ~1.2% per 1% of GDP, and the gap fades 30%/yr.
- **Layout**: on phones every card starts collapsed; every card can be collapsed (click its title) and reordered (drag ⠿, or focus it and press ↑/↓). The layout is saved in the browser; 'Reset layout' restores it.
- **Money flow**: a Sankey diagram (taxes + borrowing + policy savings → budget → spending) and two donuts (how it's paid for, what it's spent on) with changes vs current law.
- **Energy & climate**: carbon tax or carbon dividend, EV and clean-energy credits (restore or repeal), fossil-fuel breaks, nuclear, Green New Deal-style investment. Opposite switches use `excludes` in `data/policies.json` and turn each other off.
- **Headline proposals**: a stimulus-check slider (one-time or yearly) and proposals from leaders of both parties. Policies marked `oneTime` count only in year 1 of the 10-year outlook.
- **Presets**: three independent pickers, defined in `src/model/presets.ts` and `src/model/monetary.ts`, each showing what's active or Custom. Policy plan: current law, four eras (Hoover, Eisenhower, Reagan, Clinton) applied to today, and published plans (Trump, Biden FY2025, Sanders, People's Budget, Rand Paul, Heritage, Simpson-Bowles, fiscal hawk), all with behavioral responses on. Economy: today, normal times, historical booms and busts from the Roaring '20s to the 2021–22 inflation surge, Japan-style stagnation, forced austerity and a hypothetical Doomsday. Monetary regime: today's Fed, gold standard, yield-curve control, a 3.5% target, Fed-financed deficits, plus a 'dollar loses reserve status' checkbox that stacks on any regime.
- **Income tax**: your brackets are applied to IRS SOI income bins. Within each bin, income is spread evenly; the open top bin uses a Pareto tail. The result is scaled so current law reproduces actual receipts. An optional switch adds behavioral responses (taxable income elasticity 0.25, capital gains 0.7, corporate 0.2).
- **Payroll cap**: the effect of the cap is estimated from the same income bins.
- **Programs**: outlays scale with the benefit level. The EITC and CTC are scored on their full cost, including the part that reduces income tax.
- **Net interest**: a rate shock reprices about 30% of the debt held by the public in year 1.
- **Outcomes**: the primary balance stays fixed as a share of GDP, interest accrues on the remaining debt, and nominal GDP grows 4%/yr.

All figures are rounded approximations meant for exploring trade-offs. It's not an official score.

## Deploy

`.github/workflows/deploy.yml` builds and deploys to GitHub Pages. It runs on every push to `main`, and weekly to refresh the data. `public/CNAME` sets the custom domain to `debtspiral.app`.

To set up:
1. In repo Settings → Pages, set the source to **GitHub Actions**.
2. Point DNS for `debtspiral.app` at GitHub Pages: A records `185.199.108.153`, `.109.153`, `.110.153`, `.111.153` (and AAAA `2606:50c0:8000::153` through `8003::153`), plus a `www` CNAME to `<user>.github.io`.
3. In Settings → Pages, enter `debtspiral.app` as the custom domain, wait for the DNS check, then tick **Enforce HTTPS** (`.app` domains only work over HTTPS).

Cloudflare Pages also works: build command `npm run build`, output directory `dist`.
