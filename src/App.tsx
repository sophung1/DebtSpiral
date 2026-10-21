import { Scoreboard } from './components/Scoreboard';
import { BUCKET_CARDS } from './components/Buckets';
import { Outlook } from './components/Outlook';
import { MoneyFlow } from './components/MoneyFlow';
import { HouseholdPanel } from './components/HouseholdPanel';
import { SourcesDrawer } from './components/SourcesDrawer';
import { policyMeta } from './model/data';
import { useLayout } from './state/layout';

const CARDS: Record<string, () => JSX.Element> = { households: HouseholdPanel, outlook: Outlook, moneyflow: MoneyFlow, ...BUCKET_CARDS };
const FULL = new Set(['households', 'debt', 'outlook', 'moneyflow', 'wild']);
const WIDE = new Set(['income_tax']);

export default function App() {
  const { order, dragging, over } = useLayout();

  return (
    <>
      <a className="skip" href="#main">Skip to the budget cards</a>
      <Scoreboard />
      <main id="main" tabIndex={-1}>
        <div className={`cards ${dragging ? 'is-dragging' : ''}`}>
          {order.map((id) => {
            const Card = CARDS[id];
            const cls = FULL.has(id) ? 'full' : WIDE.has(id) ? 'wide' : '';
            const drop = over?.id === id ? (over.after ? 'drop-after' : 'drop-before') : '';
            return (
              <div key={id} data-id={id} className={`card-slot ${cls} ${drop} ${dragging === id ? 'dragging' : ''}`}>
                <Card />
              </div>
            );
          })}
        </div>
        <p className="hint center">
          Policy switch scores are rough first-year estimates, mostly CBO's <a href={policyMeta.cboUrl} target="_blank" rel="noreferrer">Options for Reducing the Deficit</a> ÷ 10. Hover a switch for its source.
        </p>
        <SourcesDrawer />
      </main>
      <footer className="site-foot">
        <p>debtspiral.app · A simplified educational simulator: one-year scores with a 10-year outlook, not an official estimate.</p>
        <p>Not affiliated with or endorsed by any government agency, party, candidate or organization named here; presets are our approximations of their published plans. Not financial, tax or legal advice; household figures are illustrative.</p>
        <p>Data from Treasury, CBO and public polls (dated in Sources); estimates are rough and can be out of date. No cookies or tracking: your layout stays in your browser, and shared scenarios live in the link.</p>
      </footer>
    </>
  );
}
