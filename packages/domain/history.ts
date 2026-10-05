import type { Actor, Adjustment, PeriodState } from './entities.js';
import { q } from './money.js';
function deepFreeze<T>(value:T):T {if(value!==null&&typeof value==='object'){Object.freeze(value);for(const child of Object.values(value))deepFreeze(child);}return value;}
/** Snapshot construction only: application service must check DB reconciliations/eligibility before lock. */
export function freezeSettlement<T>(input:T):T{return deepFreeze(structuredClone(input));}
export function transitionPeriod(from:PeriodState,to:PeriodState):PeriodState {
  const next:Partial<Record<PeriodState,PeriodState>>={OPEN:'REVIEW',REVIEW:'LOCKED',LOCKED:'PAID'};
  if(next[from]!==to)throw new Error('INVALID_PERIOD_TRANSITION');return to;
}
export function approveAdjustment(draft:Adjustment,actor:Actor,approvedAt:string):Readonly<Adjustment> {
  if(actor.role!=='ADMIN'&&actor.role!=='EXECUTIVE')throw new Error('ADJUSTMENT_APPROVAL_FORBIDDEN');
  if(!actor.id||!draft.id||!draft.relatedEntityId||!draft.sourcePeriodId||!draft.applicationPeriodId||draft.sourcePeriodId===draft.applicationPeriodId||!draft.reason.trim()||draft.status!=='DRAFT'&&draft.status!=='PENDING')throw new Error('INVALID_ADJUSTMENT_APPROVAL');
  q(draft.amount);if(!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(approvedAt)||!Number.isFinite(Date.parse(approvedAt)))throw new Error('EXPLICIT_APPROVAL_TIMESTAMP_REQUIRED');
  return deepFreeze({...structuredClone(draft),status:'APPROVED',approvedBy:actor.id,approvedAt});
}
