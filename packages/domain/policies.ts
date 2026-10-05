import { compare, exact, rate, q, sum } from './money.js';
import type { ManagementPoolPolicy, ManagementSnapshot, BonusPolicy, ProductPriceVersion } from './entities.js';
export function dateOnly(value:string):void {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)throw new Error('INVALID_DATE');
}
export interface PolicyContext {productId:string;groupId:string|null;orderDate:string}
export function resolveManagementPolicy(policies:readonly ManagementPoolPolicy[],context:PolicyContext):ManagementPoolPolicy {
  dateOnly(context.orderDate);
  for(const p of policies){
    if(!p.id||!Number.isSafeInteger(p.version)||p.version<1)throw new Error('INVALID_POLICY_ID_VERSION');
    dateOnly(p.effectiveFrom);rate(p.rate);
    if(p.effectiveTo!==null){dateOnly(p.effectiveTo);if(p.effectiveTo<=p.effectiveFrom)throw new Error('INVALID_EFFECTIVE_RANGE');}
    if((p.scope==='ALL')!==(p.scopeId===null))throw new Error('INVALID_SCOPE_REFERENCE');
  }
  const candidates=policies.filter(p=>p.status==='APPROVED'&&p.effectiveFrom<=context.orderDate&&(p.effectiveTo===null||context.orderDate<p.effectiveTo)&&
    (p.scope==='ALL'||(p.scope==='PRODUCT'&&p.scopeId===context.productId)||(p.scope==='PRODUCT_GROUP'&&p.scopeId===context.groupId)));
  const precedence={ALL:0,PRODUCT_GROUP:1,PRODUCT:2};
  for(const scope of ['ALL','PRODUCT_GROUP','PRODUCT'] as const)if(candidates.filter(p=>p.scope===scope).length>1)throw new Error('AMBIGUOUS_MANAGEMENT_POLICY');
  const policy=candidates.sort((a,b)=>precedence[b.scope]-precedence[a.scope])[0];
  if(!policy)throw new Error('MANAGEMENT_POLICY_REQUIRED');return structuredClone(policy);
}
export function snapshotManagementPolicy(policies:readonly ManagementPoolPolicy[],context:PolicyContext):ManagementSnapshot {
  const p=resolveManagementPolicy(policies,context);
  return Object.freeze({policyId:p.id,policyVersion:p.version,rate:exact(rate(p.rate)),...context});
}
export function validateBonusPolicy(policy:BonusPolicy):void {
  if(!policy.id||!Number.isSafeInteger(policy.version)||policy.version<1)throw new Error('INVALID_BONUS_POLICY');
  if(compare(sum([rate(policy.pmShare),rate(policy.supportShare),rate(policy.companyShare)]),q(1n))!==0)throw new Error('BONUS_SHARES_MUST_SUM_TO_ONE');
}
export type SupportShares={MKT:string;ACCOUNTING:string;LOGISTICS:string};
export function validateSupportShares(shares:SupportShares):void {
  if(compare(sum([rate(shares.MKT),rate(shares.ACCOUNTING),rate(shares.LOGISTICS)]),q(1n))!==0)throw new Error('SUPPORT_SHARES_MUST_SUM_TO_ONE');
}
export function snapshotPrice(price:ProductPriceVersion,productId:string,orderDate:string):Readonly<ProductPriceVersion> {
  dateOnly(orderDate);dateOnly(price.effectiveFrom);if(price.effectiveTo!==null)dateOnly(price.effectiveTo);
  if(price.productId!==productId||price.status!=='APPROVED'||orderDate<price.effectiveFrom||(price.effectiveTo!==null&&orderDate>=price.effectiveTo))throw new Error('APPROVED_EFFECTIVE_PRICE_REQUIRED');
  if(compare(q(price.unitValue),q(0n))<0)throw new Error('INVALID_PRICE');rate(price.vatRate);
  return Object.freeze(structuredClone(price));
}
