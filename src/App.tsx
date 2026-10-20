import { Scoreboard } from './components/Scoreboard';
import { TaxPanel } from './components/TaxPanel';
import { SpendingPanel } from './components/SpendingPanel';
import { PolicyPanel } from './components/PolicyPanel';
import { HouseholdPanel } from './components/HouseholdPanel';
import { SourcesDrawer } from './components/SourcesDrawer';

export default function App() {
  return (
    <>
      <Scoreboard />
      <main>
        <div className="grid">
          <TaxPanel />
          <SpendingPanel />
          <PolicyPanel />
        </div>
        <HouseholdPanel />
        <SourcesDrawer />
      </main>
      <footer className="site-foot">deficitdial.io · a simplified, static, one-year model. It's an educational game, not an official score.</footer>
    </>
  );
}
