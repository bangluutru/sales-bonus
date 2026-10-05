import test from 'node:test';
import assert from 'node:assert/strict';
import { q, add, sub, mul, div, exact, ceilQuantum, allocatePayment, resolveManagementPolicy, snapshotManagementPolicy, calculateItem, finalizeBonus, freezeSettlement, approveAdjustment, validateSupportShares, type ItemInput, type ManagementPoolPolicy } from '../packages/domain/index.js';
const policies: ManagementPoolPolicy[] = [
  { id: 'all', version: 1, scope: 'ALL', scopeId: null, rate: '0.42', effectiveFrom: '2026-01-01', effectiveTo: null, status: 'APPROVED' },
  { id: 'group', version: 1, scope: 'PRODUCT_GROUP', scopeId: 'g', rate: '0.43', effectiveFrom: '2026-01-01', effectiveTo: null, status: 'APPROVED' },
  { id: 'a', version: 1, scope: 'PRODUCT', scopeId: 'A', rate: '0.45', effectiveFrom: '2026-01-01', effectiveTo: '2026-11-01', status: 'APPROVED' },
  { id: 'a-new', version: 2, scope: 'PRODUCT', scopeId: 'A', rate: '0.40', effectiveFrom: '2026-11-01', effectiveTo: null, status: 'APPROVED' },
  { id: 'b', version: 1, scope: 'PRODUCT', scopeId: 'B', rate: '0.50', effectiveFrom: '2026-01-01', effectiveTo: null, status: 'APPROVED' },
];
function item(overrides: Partial<ItemInput> = {}): ItemInput {
  return { id: 'line-A', currency: 'VND', quantity: '1', listUnitValue: '100000000', discountAmount: '10000000', netSalesValue: '90000000', poolSnapshot: snapshotManagementPolicy(policies, {productId:'A',groupId:'g',orderDate:'2026-09-15'}), economicBasis: 'EXCLUDING_VAT', expenses: [], bonusPolicy: {id:'bonus',version:1,pmShare:'0.35',supportShare:'0.30',companyShare:'0.35'}, recognitionStrategy: 'PRO_RATA_NET', payments: [], ...overrides };
}
test('exact decimals, fractions and very large money never use floating point', () => {
  assert.equal(exact(add(q('0.1'),q('0.2'))),'3/10');
  assert.equal(exact(mul(q('9007199254740993'),q('0.5'))),'9007199254740993/2');
  assert.equal(exact(div(q('3200000'),q('1.08'))),'80000000/27');
  assert.equal(exact(sub(q('1'),q('0.25'))),'3/4');
  assert.throws(()=>q('1e4')); assert.throws(()=>q('NaN')); assert.throws(()=>div(q('1'),q('0')));
});
test('ceiling to 1000 is exact with zero, ties and fractions',()=>{
  for(const [input,expected] of [['0',0n],['1',1000n],['1000',1000n],['1001',2000n],['80000000/27',2963000n]] as const) assert.equal(ceilQuantum(q(input),1000n),expected);
  assert.throws(()=>ceilQuantum(q('-1'),1000n));
});
test('policy precedence, date boundaries and product differences',()=>{
  assert.equal(resolveManagementPolicy(policies,{productId:'A',groupId:'g',orderDate:'2026-09-15'}).id,'a');
  assert.equal(resolveManagementPolicy(policies,{productId:'A',groupId:'g',orderDate:'2026-11-01'}).id,'a-new');
  assert.equal(resolveManagementPolicy(policies,{productId:'unknown',groupId:'g',orderDate:'2026-09-15'}).id,'group');
  assert.equal(resolveManagementPolicy(policies,{productId:'unknown',groupId:null,orderDate:'2026-09-15'}).id,'all');
  assert.equal(resolveManagementPolicy(policies,{productId:'B',groupId:null,orderDate:'2026-09-15'}).rate,'0.50');
});
test('ambiguous/missing/invalid policies and dates fail rather than guess',()=>{
  assert.throws(()=>resolveManagementPolicy([...policies,{...policies[2]!,id:'duplicate'}],{productId:'A',groupId:'g',orderDate:'2026-09-15'}));
  assert.throws(()=>resolveManagementPolicy([],{productId:'A',groupId:null,orderDate:'2026-09-15'}));
  assert.throws(()=>resolveManagementPolicy(policies,{productId:'A',groupId:'g',orderDate:'2026-02-30'}));
});
test('order snapshot preserves September rate after future changes',()=>{
  const snapshot=snapshotManagementPolicy(policies,{productId:'A',groupId:'g',orderDate:'2026-09-15'});
  const changed=policies.map(p=>p.id==='a'?{...p,rate:'0.1'}:p);
  assert.equal(snapshot.rate,'9/20'); assert.equal(Object.isFrozen(snapshot),true);
  assert.equal(snapshot.policyVersion,1); assert.equal(resolveManagementPolicy(changed,{productId:'A',groupId:'g',orderDate:'2026-12-10'}).rate,'0.40');
});
test('two product pool rates and transactional discount autonomy',()=>{
  const a=calculateItem(item());
  const b=calculateItem(item({poolSnapshot:snapshotManagementPolicy(policies,{productId:'B',groupId:'g',orderDate:'2026-09-15'})}));
  const moreDiscount=calculateItem(item({discountAmount:'20000000',netSalesValue:'80000000'}));
  assert.equal(a.managementPool,'45000000'); assert.equal(b.managementPool,'50000000');
  assert.equal(a.rawResidual,'35000000'); assert.equal(moreDiscount.rawResidual,'25000000');
  assert.equal(a.calculated.pm,'12250000');
});
test('approved expenses reduce residual, pending costs block readiness and discount cannot repeat',()=>{
  const result=calculateItem(item({expenses:[{id:'m',category:'MARKETING_SUPPORT',amount:'1000000',status:'APPROVED'},{id:'pending',category:'OTHER',amount:'2000000',status:'PENDING'}]}));
  assert.equal(result.rawResidual,'34000000'); assert.ok(result.warnings.includes('PENDING_EXPENSE_APPROVAL')); assert.equal(result.settlementEligible,false);
  assert.throws(()=>calculateItem(item({expenses:[{id:'duplicate',category:'CUSTOMER_DISCOUNT',amount:'100',status:'APPROVED'}]})));
});
test('negative residual preserves deficit and reason but PM/Support bonus is zero',()=>{
  const result=calculateItem(item({discountAmount:'50000000',netSalesValue:'50000000'}));
  assert.equal(result.rawResidual,'-5000000'); assert.equal(result.calculated.pm,'0');assert.equal(result.calculated.support,'0');
  assert.ok(result.warnings.includes('CUSTOMER_DISCOUNT_EXCEEDS_MANAGEMENT_POOL'));assert.ok(result.warnings.includes('NEGATIVE_RESIDUAL_POOL'));
  assert.equal(result.companyLossUnallocated,'5000000'); assert.equal(result.settlementEligible,false);
});
test('partial multi-product payment allocates exactly, stable ties and huge amounts',()=>{
  assert.deepEqual(allocatePayment(50000000n,[{id:'A',net:60000000n},{id:'B',net:40000000n}]),[{id:'A',amount:30000000n},{id:'B',amount:20000000n}]);
  assert.deepEqual(allocatePayment(1n,[{id:'B',net:1n},{id:'A',net:1n}]),[{id:'A',amount:1n},{id:'B',amount:0n}]);
  assert.equal(allocatePayment(9007199254740993n,[{id:'A',net:1n},{id:'B',net:2n}]).reduce((s,r)=>s+r.amount,0n),9007199254740993n);
});
test('invalid payment allocations reject duplicate IDs, negative and zero weights',()=>{
  assert.throws(()=>allocatePayment(1n,[{id:'A',net:0n}]));
  assert.throws(()=>allocatePayment(-1n,[{id:'A',net:1n}]));
  assert.throws(()=>allocatePayment(1n,[{id:'A',net:1n},{id:'A',net:1n}]));
});
test('draft does not earn; multiple confirmed payments recognize cumulative exact amounts',()=>{
  const first=calculateItem(item({payments:[{id:'draft',status:'DRAFT',eligibleAmount:'90000000'},{id:'sep',status:'CONFIRMED',eligibleAmount:'63000000'}]}));
  const full=calculateItem(item({payments:[{id:'sep',status:'CONFIRMED',eligibleAmount:'63000000'},{id:'oct',status:'CONFIRMED',eligibleAmount:'27000000'}]}));
  assert.equal(first.collectedEligible,'63000000');assert.equal(first.earned.pm,'8575000');assert.equal(full.earned.pm,'12250000');
  assert.equal(exact(sub(q(full.earned.pm),q(first.earned.pm))),'3675000');
});
test('reversed payment earns zero, duplicate events and overcollection reject',()=>{
  assert.equal(calculateItem(item({payments:[{id:'p',status:'REVERSED',eligibleAmount:'90000000'}]})).earned.pm,'0');
  assert.throws(()=>calculateItem(item({payments:[{id:'p',status:'CONFIRMED',eligibleAmount:'1'},{id:'p',status:'CONFIRMED',eligibleAmount:'1'}]})));
  assert.throws(()=>calculateItem(item({payments:[{id:'p',status:'CONFIRMED',eligibleAmount:'90000001'}]})));
});
test('zero net and inconsistent bonus shares require resolution',()=>{
  assert.throws(()=>calculateItem(item({netSalesValue:'0'})));
  assert.throws(()=>calculateItem(item({bonusPolicy:{id:'bad',version:1,pmShare:'0.35',supportShare:'0.30',companyShare:'0.34'}})));
});
test('target qualification does not erase calculated/earned; no invented zero target rule',()=>{
  const result=calculateItem(item({payments:[{id:'p',status:'CONFIRMED',eligibleAmount:'63000000'}]}));
  const input={roundingQuantumVnd:'1000',lines:[result],target:'90000000',confirmedPeriodCollection:'63000000',supportShares:{MKT:'0.6',ACCOUNTING:'0.2',LOGISTICS:'0.2'}};
  const unmet=finalizeBonus(input);assert.equal(unmet.pm.calculated,'12250000');assert.equal(unmet.pm.earned,'8575000');assert.equal(unmet.pm.payable,'0');
  const met=finalizeBonus({...input,confirmedPeriodCollection:'90000000'});assert.equal(met.pm.payable,'8575000');
  const missing=finalizeBonus({...input,target:null});assert.equal(missing.pm.payable,null);assert.ok(missing.warnings.includes('TARGET_REQUIRED'));
  assert.throws(()=>finalizeBonus({...input,target:'0'}));
});
test('Support department rounding is explicit and reconciles its delta',()=>{
  const line=calculateItem(item({listUnitValue:'10010',discountAmount:'0',netSalesValue:'10010',poolSnapshot:{...item().poolSnapshot,rate:'1'},bonusPolicy:{id:'x',version:1,pmShare:'0.8',supportShare:'0.1',companyShare:'0.1'},payments:[{id:'p',status:'CONFIRMED',eligibleAmount:'10010'}]}));
  const result=finalizeBonus({roundingQuantumVnd:'1000',lines:[line],target:'1',confirmedPeriodCollection:'10010',supportShares:{MKT:'0.6',ACCOUNTING:'0.2',LOGISTICS:'0.2'}});
  assert.equal(result.support.earned,'1001');assert.equal(result.support.roundedTotal,'3000');assert.equal(result.support.roundingDelta,'1999');
  assert.equal(result.support.departments.MKT.exact,'3003/5');assert.equal(result.support.departments.MKT.rounded,'1000');
  assert.throws(()=>validateSupportShares({MKT:'0.5',ACCOUNTING:'0.2',LOGISTICS:'0.2'}));
});
test('deterministic trace totals and settlement snapshot immutability',()=>{
  const input=item({payments:[{id:'p',status:'CONFIRMED',eligibleAmount:'90000000'}]});
  const a=calculateItem(input),b=calculateItem(input);assert.deepEqual(a,b);
  assert.equal(exact(add(add(q(a.calculated.pm),q(a.calculated.support)),q(a.calculated.company))),a.incentiveResidual);
  const frozen=freezeSettlement({id:'s',periodId:'2026-09',lines:[a]});
  input.discountAmount='80000000';assert.equal(frozen.lines[0]!.discountAmount,'10000000');
  assert.throws(()=>{frozen.lines[0]!.rawResidual='0';});
});
test('only Director/Admin approve adjustments; locked history remains referenced',()=>{
  const draft={id:'adj',sourcePeriodId:'2026-09',applicationPeriodId:'2026-10',amount:'-1000',reason:'Refund after lock',relatedEntityId:'refund-1',status:'DRAFT' as const};
  assert.throws(()=>approveAdjustment(draft,{id:'pm',role:'PM'},'2026-10-05T12:00:00Z'));
  const approved=approveAdjustment(draft,{id:'director',role:'EXECUTIVE'},'2026-10-05T12:00:00Z');
  assert.equal(approved.status,'APPROVED');assert.equal(approved.approvedBy,'director');assert.equal(draft.status,'DRAFT');
  assert.throws(()=>approveAdjustment({...draft,reason:''},{id:'admin',role:'ADMIN'},'2026-10-05T12:00:00Z'));
});
test('price snapshots validate effective product/date and preserve prior price',async()=>{
  const {snapshotPrice}=await import('../packages/domain/index.js');
  const price={id:'v1',productId:'A',version:1,unitValue:'3200000',currency:'VND' as const,taxBasis:'INCLUDING_VAT' as const,vatRate:'0.08',effectiveFrom:'2026-01-01',effectiveTo:'2026-11-01',status:'APPROVED' as const,sourceReference:'GENKI-PDF'};
  const saved=snapshotPrice(price,'A','2026-09-15');price.unitValue='4000000';assert.equal(saved.unitValue,'3200000');
  assert.throws(()=>snapshotPrice(price,'A','2026-11-01'));assert.throws(()=>snapshotPrice({...price,status:'PROVISIONAL'},'A','2026-09-15'));assert.throws(()=>snapshotPrice(price,'B','2026-09-15'));
});
test('period transition refuses reopening locked history',async()=>{
  const {transitionPeriod}=await import('../packages/domain/index.js');
  assert.equal(transitionPeriod('OPEN','REVIEW'),'REVIEW');assert.equal(transitionPeriod('REVIEW','LOCKED'),'LOCKED');assert.equal(transitionPeriod('LOCKED','PAID'),'PAID');
  assert.throws(()=>transitionPeriod('LOCKED','OPEN'));assert.throws(()=>transitionPeriod('PAID','REVIEW'));assert.throws(()=>transitionPeriod('OPEN','LOCKED'));
});
