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
        <SourcesDrawer />
      </main>
      <footer className="site-foot">
        <p>DebtSpiral.app · A simplified educational simulator, not an official estimate. Policy scores are rough first-year figures, mostly from CBO's <a href={policyMeta.cboUrl} target="_blank" rel="noreferrer">Options for Reducing the Deficit</a> ÷ 10; hover a switch for its source. These may be out of date by the time you read this.</p>
        <p>Not financial, tax or legal advice; household figures are illustrative.</p>
        <p>Data: Treasury, CBO, public polls (dated in Sources). No cookies or tracking.</p>
        <hr />
        <p>Not affiliated with or endorsed by any government agency, party, candidate or organization named here; presets are approximations of their published plans and are not exhaustive.</p>
        <p>DebtSpiral.app does not endorse any policy, party or candidate.</p>
      </footer>
    </>
  );
}
