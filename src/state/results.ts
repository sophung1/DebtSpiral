import { useMemo } from 'react';
import { useStore, BASE } from './store';
import { computeBudget } from '../model/budget';
import { computeOutcomes, projection } from '../model/outcomes';
import { computeHousehold } from '../model/household';
import { archetypes } from '../model/data';

const baseHouseholds = archetypes.map((a) => computeHousehold(a, BASE));
const baseProjection = projection(computeBudget(BASE, BASE));

export function useResults() {
  const scn = useStore((s) => s.scn);
  return useMemo(() => {
    const budget = computeBudget(scn, BASE);
    const flipped = computeBudget({ ...scn, behavioral: !scn.behavioral }, BASE);
    return {
      scn,
      budget,
      /** how much behavioral responses change the deficit at the current settings ($B; + = raises it) */
      behavioralEffect: scn.behavioral ? budget.deficit - flipped.deficit : flipped.deficit - budget.deficit,
      outcomes: computeOutcomes(budget),
      projection: projection(budget),
      baseProjection,
      households: archetypes.map((a, i) => ({ a, now: computeHousehold(a, scn), base: baseHouseholds[i] })),
    };
  }, [scn]);
}
