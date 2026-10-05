import { q, sub, mul, div, sum, compare, exact, rate, nonnegative, ceilQuantum, type Rational } from './money.js';
import { validateBonusPolicy, validateSupportShares, type SupportShares } from './policies.js';
import type { Currency, ManagementSnapshot, PoolExpense, BonusPolicy } from './entities.js';
export interface ItemInput {
  id:string;currency:Currency;quantity:string;listUnitValue:string;discountAmount:string;netSalesValue:string;
  economicBasis:'EXCLUDING_VAT'|'INCLUDING_VAT';poolSnapshot:ManagementSnapshot;expenses:readonly PoolExpense[];bonusPolicy:BonusPolicy;
  /** Explicit scenario input: not activated as a production recognition default. */
  recognitionStrategy:'PRO_RATA_NET';payments:readonly {id:string;status:'DRAFT'|'CONFIRMED'|'REVERSED';eligibleAmount:string}[];
}
export interface ItemResult {
  engineVersion:string;itemId:string;currency:Currency;economicBasis:ItemInput['economicBasis'];grossListValue:string;discountAmount:string;
  netSalesValue:string;managementPool:string;rawResidual:string;incentiveResidual:string;collectedEligible:string;
  calculated:{pm:string;support:string;company:string};earned:{pm:string;support:string;company:string};
  companyLossUnallocated:string;warnings:string[];settlementEligible:boolean;
  trace:{poolSnapshot:ManagementSnapshot;bonusPolicy:BonusPolicy;expenses:readonly PoolExpense[];payments:ItemInput['payments'];recognitionStrategy:string};
}
function split(base:Rational,policy:BonusPolicy){return {pm:exact(mul(base,rate(policy.pmShare))),support:exact(mul(base,rate(policy.supportShare))),company:exact(mul(base,rate(policy.companyShare)))};}
export function calculateItem(input:ItemInput):ItemResult {
  if(input.currency!=='VND'||!input.id)throw new Error('UNSUPPORTED_CURRENCY_OR_ITEM');
  if(input.economicBasis!=='EXCLUDING_VAT'&&input.economicBasis!=='INCLUDING_VAT')throw new Error('EXPLICIT_ECONOMIC_BASIS_REQUIRED');
  if(input.recognitionStrategy!=='PRO_RATA_NET')throw new Error('EXPLICIT_RECOGNITION_STRATEGY_REQUIRED');
  validateBonusPolicy(input.bonusPolicy);
  const gross=mul(nonnegative(input.quantity),nonnegative(input.listUnitValue));
  const discount=nonnegative(input.discountAmount);const net=nonnegative(input.netSalesValue);
  if(net.n===0n)throw new Error('ZERO_NET_REQUIRES_BUSINESS_RULE');
  if(!input.poolSnapshot.policyId||input.poolSnapshot.policyVersion<1)throw new Error('POOL_SNAPSHOT_REQUIRED');
  const management=mul(gross,rate(input.poolSnapshot.rate));
  const warnings:string[]=[];
  if(new Set(input.expenses.map(e=>e.id)).size!==input.expenses.length||input.expenses.some(e=>!e.id))throw new Error('DUPLICATE_OR_MISSING_EXPENSE_ID');
  for(const e of input.expenses){nonnegative(e.amount);if(e.category==='CUSTOMER_DISCOUNT')throw new Error('DISCOUNT_ALREADY_IN_ITEM_PRICING');}
  const costs=sum(input.expenses.filter(e=>e.status==='APPROVED').map(e=>q(e.amount)));
  if(input.expenses.some(e=>e.status==='DRAFT'||e.status==='PENDING'))warnings.push('PENDING_EXPENSE_APPROVAL');
  const residual=sub(sub(management,discount),costs);
  if(compare(discount,management)>0)warnings.push('CUSTOMER_DISCOUNT_EXCEEDS_MANAGEMENT_POOL');
  if(residual.n<0n)warnings.push('NEGATIVE_RESIDUAL_POOL');
  const positive=residual.n<0n?q(0n):residual;
  if(new Set(input.payments.map(p=>p.id)).size!==input.payments.length||input.payments.some(p=>!p.id))throw new Error('DUPLICATE_OR_MISSING_PAYMENT_ID');
  for(const p of input.payments)nonnegative(p.eligibleAmount);
  const collected=sum(input.payments.filter(p=>p.status==='CONFIRMED').map(p=>q(p.eligibleAmount)));
  if(compare(collected,net)>0)throw new Error('OVER_COLLECTION_REQUIRES_BUSINESS_RULE');
  const earnedBase=mul(positive,div(collected,net));
  return {engineVersion:'domain-foundation-0.1',itemId:input.id,currency:input.currency,economicBasis:input.economicBasis,grossListValue:exact(gross),discountAmount:exact(discount),netSalesValue:exact(net),managementPool:exact(management),rawResidual:exact(residual),incentiveResidual:exact(positive),collectedEligible:exact(collected),calculated:split(positive,input.bonusPolicy),earned:split(earnedBase,input.bonusPolicy),companyLossUnallocated:residual.n<0n?exact(sub(q(0n),residual)):'0',warnings,settlementEligible:!warnings.includes('PENDING_EXPENSE_APPROVAL'),trace:structuredClone({poolSnapshot:input.poolSnapshot,bonusPolicy:input.bonusPolicy,expenses:input.expenses,payments:input.payments,recognitionStrategy:input.recognitionStrategy})};
}
function rounded(value:Rational,quantum:bigint){const result=q(ceilQuantum(value,quantum));return {exact:exact(value),rounded:exact(result),roundingDelta:exact(sub(result,value))};}
export function finalizeBonus(input:{lines:readonly ItemResult[];target:string|null;confirmedPeriodCollection:string;supportShares:SupportShares;roundingQuantumVnd:string}) {
  if(new Set(input.lines.map(l=>l.itemId)).size!==input.lines.length)throw new Error('DUPLICATE_CALCULATION_ITEM');
  if(!/^[1-9]\d*$/.test(input.roundingQuantumVnd))throw new Error('POSITIVE_INTEGER_ROUNDING_QUANTUM_REQUIRED');
  const quantum=BigInt(input.roundingQuantumVnd);
  validateSupportShares(input.supportShares);const collection=nonnegative(input.confirmedPeriodCollection);
  const calculated=sum(input.lines.map(l=>q(l.calculated.pm)));const earned=sum(input.lines.map(l=>q(l.earned.pm)));
  let qualified:boolean|null=null;const warnings=[...new Set(input.lines.flatMap(l=>l.warnings))];
  if(input.target===null)warnings.push('TARGET_REQUIRED');
  else {const target=nonnegative(input.target);if(target.n===0n)throw new Error('ZERO_TARGET_REQUIRES_BUSINESS_RULE');qualified=compare(collection,target)>=0;}
  const payable=qualified===null?null:rounded(qualified?earned:q(0n),quantum);
  const support=sum(input.lines.map(l=>q(l.earned.support)));
  const departments={MKT:rounded(mul(support,rate(input.supportShares.MKT)),quantum),ACCOUNTING:rounded(mul(support,rate(input.supportShares.ACCOUNTING)),quantum),LOGISTICS:rounded(mul(support,rate(input.supportShares.LOGISTICS)),quantum)};
  const roundedSupport=sum(Object.values(departments).map(d=>q(d.rounded)));
  return {pm:{calculated:exact(calculated),earned:exact(earned),qualified,payable:payable?.rounded??null,exactPayable:payable?.exact??null,roundingDelta:payable?.roundingDelta??null},support:{earned:exact(support),departments,roundedTotal:exact(roundedSupport),roundingDelta:exact(sub(roundedSupport,support))},companyEarned:exact(sum(input.lines.map(l=>q(l.earned.company)))),companyLossUnallocated:exact(sum(input.lines.map(l=>q(l.companyLossUnallocated)))),warnings,settlementEligible:qualified!==null&&input.lines.every(l=>l.settlementEligible),rounding:{mode:'CEILING',quantumVnd:input.roundingQuantumVnd,stage:'FINAL_PERSON_OR_DEPARTMENT_TOTAL'},supportShares:structuredClone(input.supportShares)};
}
