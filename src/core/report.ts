import type { Status } from './rules';

export interface ReportInput { label: string; symbol: string; value: string; unit: string }
export interface ReportStep { label: string; formel: string; indsat: string; resultat: string }
export interface ReportCheck {
  label: string;
  value: string;
  graense: string;
  status: Status;
  kilde?: string;
}
export interface Report {
  modul: string;
  inputs: ReportInput[];
  steps: ReportStep[];
  checks: ReportCheck[];
  noter?: string[];
  /** Reference-id'er der er anvendt */
  refs: string[];
  /** SVG-figur til rapporten */
  figur?: string;
  /** Ekstra sider (fx én pr. konflikt) – hver starter på en ny side */
  sider?: string[];
}

let current: Report | null = null;
export const setReport = (r: Report | null): void => { current = r; };
export const getReport = (): Report | null => current;
