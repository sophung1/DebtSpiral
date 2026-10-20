import { Scoreboard } from './components/Scoreboard';
import { Buckets } from './components/Buckets';
import { Outlook } from './components/Outlook';
import { MoneyFlow } from './components/MoneyFlow';
import { HouseholdPanel } from './components/HouseholdPanel';
import { SourcesDrawer } from './components/SourcesDrawer';
import { policyMeta } from './model/data';

export default function App() {
  return (
    <>
      <Scoreboard />
      <main>
        <Outlook />
        <MoneyFlow />
        <Buckets />
        <p className="hint center">Policy switch scores are rough first-year estimates, mostly CBO's <a href={policyMeta.cboUrl} target="_blank" rel="noreferrer">Options for Reducing the Deficit</a> ÷ 10. Hover a switch for its source.</p>
        <HouseholdPanel />
        <SourcesDrawer />
      </main>
      <footer className="site-foot">deficitdial.io · a simplified, static, one-year model. It's an educational game, not an official score.</footer>
    </>
  );
}
