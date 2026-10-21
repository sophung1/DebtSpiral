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
  const { order, reset, dragging, over } = useLayout();

  return (
    <>
      <Scoreboard />
      <main>
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
          Drag a card by ⠿ to reorder it, or click its title to collapse it. <button className="link" onClick={reset}>Reset layout</button>
          <br />Policy switch scores are rough first-year estimates, mostly CBO's <a href={policyMeta.cboUrl} target="_blank" rel="noreferrer">Options for Reducing the Deficit</a> ÷ 10. Hover a switch for its source.
        </p>
        <SourcesDrawer />
      </main>
      <footer className="site-foot">debtspiral.app · a simplified, one-year model with a 10-year outlook. It's an educational game, not an official score.</footer>
    </>
  );
}
