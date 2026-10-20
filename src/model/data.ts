import manualJson from '../../data/manual.json';
import liveJson from '../../data/live.json';
import policiesJson from '../../data/policies.json';
import archetypesJson from '../../data/archetypes.json';

export type Filing = 'single' | 'mfj';

export interface Sourced { value: number; asOf?: string; source: string; url?: string }

export interface SoiBin {
  lo: number; hi: number | null; returnsM: number; agiB: number; wagesB: number;
  marriedShare: number; ordinaryShare: number;
}

export interface Program {
  id: string; name: string; category: string; baselineB: number; fullCostB?: number;
  unit: string; source: string;
}

export interface Policy {
  id: string; bucket: string; label: string; deltaB: number; source: string;
  households: Record<string, number>;
  /** switches this one supersedes while on (their scores are part of this one's) */
  replaces?: string[];
}

export interface Archetype {
  id: string; name: string; icon: string; filing: Filing; kids: number; over65: number;
  wages: number; pension: number; socialSecurity: number; capitalGains: number;
  benefits: Record<string, number>;
}

export type Manual = typeof manualJson;
export type Live = typeof liveJson;

export const manual: Manual = manualJson;
export const live: Live = liveJson;
export const programs: Program[] = manualJson.programs;
export const policies: Policy[] = policiesJson.policies as Policy[];
export const policyMeta = { note: policiesJson.note, cboUrl: policiesJson.cboUrl };
export const archetypes: Archetype[] = archetypesJson.archetypes as Archetype[];
export const soiBins: SoiBin[] = manualJson.soi.bins as SoiBin[];
export const tax = manualJson.tax;
