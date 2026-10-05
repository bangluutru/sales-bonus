import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
const migration=readFileSync('migrations/001_domain_foundation.sql','utf8');
async function database(){const db=new PGlite();await db.exec(migration);await db.exec(`
INSERT INTO tenants VALUES ('t','Company');
INSERT INTO app_users(tenant_id,id,name,role) VALUES ('t','admin','Admin','ADMIN'),('t','pm','PM','PM');
INSERT INTO employees(tenant_id,id,code,name) VALUES ('t','employee','E','Employee');
INSERT INTO customers(tenant_id,id,name) VALUES ('t','customer','Customer');
INSERT INTO products(tenant_id,id,sku,name) VALUES ('t','product','SKU','Product');
INSERT INTO management_pool_policies(tenant_id,id,version,scope,pool_rate,effective_from,status,created_by,approved_by) VALUES ('t','pool',1,'ALL',0.45,'2026-01-01','APPROVED','admin','admin');
INSERT INTO product_price_versions(tenant_id,id,product_id,version,input_amount,currency,pack,tax_basis,vat_rate,effective_from,status,source_reference,change_reason,created_by,approved_by) VALUES ('t','price','product',1,1000,'VND','pack','EXCLUDING_VAT',0.08,'2026-01-01','APPROVED','source','initial','admin','admin');
INSERT INTO orders(tenant_id,id,order_number,customer_id,pm_id,order_date,currency,source_status,source_revision) VALUES ('t','order','O','customer','employee','2026-09-15','VND','source-approved','1');
INSERT INTO order_items(tenant_id,id,order_id,product_id,quantity,gross_list_value,discount_amount,net_sales_value,price_version_id,pool_policy_id,pool_policy_version,pool_rate_snapshot,price_snapshot,effective_context) VALUES ('t','item','order','product',1,1000,100,900,'price','pool',1,0.45,'{}','{}');
INSERT INTO calculation_periods(tenant_id,id,starts_on,ends_on,business_timezone,state) VALUES ('t','sep','2026-09-01','2026-10-01','Asia/Ho_Chi_Minh','OPEN'),('t','oct','2026-10-01','2026-11-01','Asia/Ho_Chi_Minh','OPEN');`);return db;}
test('clean migration creates all required domain entities with exact policy checks',async()=>{
 const db=await database();try{
  const tables=await db.query<{table_name:string}>("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
  for(const table of ['employees','customers','products','orders','order_items','payments','payment_allocations','management_pool_policies','bonus_policies','pool_expenses','employee_targets','calculation_periods','bonus_calculations','bonus_calculation_lines','settlements','adjustments','audit_logs','external_entity_mappings'])assert.ok(tables.rows.some(r=>r.table_name===table),table);
  await assert.rejects(db.exec("INSERT INTO bonus_policies(tenant_id,id,version,pm_share,support_share,company_share,effective_from,status,rounding_mode,rounding_quantum,created_by) VALUES ('t','bad',1,0.35,0.30,0.34,'2026-09-01','DRAFT','CEILING',1000,'admin')"));
  await assert.rejects(db.exec("UPDATE management_pool_policies SET pool_rate=0.4 WHERE id='pool'"),/APPROVED_VERSION_IS_IMMUTABLE/);
  await assert.rejects(db.exec("UPDATE product_price_versions SET input_amount=2000 WHERE id='price'"),/APPROVED_VERSION_IS_IMMUTABLE/);
 }finally{await db.close();}
});
test('confirmed payment allocations conserve cash and reference same-order items',async()=>{
 const db=await database();try{
  await db.exec("INSERT INTO payments(tenant_id,id,order_id,amount,currency,payment_date,method,reference_number,status,created_by) VALUES ('t','payment','order',500,'VND','2026-09-20','TRANSFER','REF','DRAFT','admin')");
  await assert.rejects(db.exec("UPDATE payments SET status='CONFIRMED',confirmed_by='admin',confirmed_at=now() WHERE id='payment'"),/PAYMENT_ALLOCATION_SUM_MISMATCH/);
  await db.exec("INSERT INTO payment_allocations(tenant_id,order_id,payment_id,order_item_id,amount,allocation_method) VALUES ('t','order','payment','item',500,'PRO_RATA_BY_NET_VALUE')");
  await db.exec("UPDATE payments SET status='CONFIRMED',confirmed_by='admin',confirmed_at=now() WHERE id='payment'");
  await assert.rejects(db.exec("UPDATE payment_allocations SET amount=499 WHERE payment_id='payment'"),/CONFIRMED_ALLOCATION_IS_IMMUTABLE/);
  await assert.rejects(db.exec("DELETE FROM payment_allocations WHERE payment_id='payment'"),/CONFIRMED_ALLOCATION_IS_IMMUTABLE/);
  await assert.rejects(db.exec("UPDATE payments SET amount=501 WHERE id='payment'"),/CONFIRMED_PAYMENT_IS_IMMUTABLE/);
  await assert.rejects(db.exec("DELETE FROM payments WHERE id='payment'"),/CONFIRMED_PAYMENT_IS_IMMUTABLE/);
 }finally{await db.close();}
});
test('database protects locked calculations, settlements and audit against direct mutation',async()=>{
 const db=await database();try{
  await db.exec("INSERT INTO bonus_calculations(tenant_id,id,period_id,employee_id,engine_version,input_hash,calculated_exact,earned_exact,trace) VALUES ('t','calc','sep','employee','0.1','hash','1','1','{}')");
  await db.exec("UPDATE calculation_periods SET state='REVIEW' WHERE id='sep'");
  await db.exec("UPDATE calculation_periods SET state='LOCKED',locked_by='admin',locked_at=now() WHERE id='sep'");
  await assert.rejects(db.exec("UPDATE bonus_calculations SET earned_exact='2' WHERE id='calc'"),/LOCKED_PERIOD_HISTORY/);
  await assert.rejects(db.exec("UPDATE bonus_calculations SET period_id='oct' WHERE id='calc'"),/LOCKED_PERIOD_HISTORY/);
  await assert.rejects(db.exec("UPDATE calculation_periods SET state='OPEN' WHERE id='sep'"),/INVALID_PERIOD_TRANSITION/);
  await db.exec("INSERT INTO settlements(tenant_id,id,period_id,recipient_type,recipient_id,immutable_snapshot,snapshot_hash,locked_by,locked_at) VALUES ('t','settle','sep','EMPLOYEE','employee','{}','hash','admin',now())");
  await assert.rejects(db.exec("UPDATE settlements SET immutable_snapshot='{\"changed\":true}' WHERE id='settle'"),/IMMUTABLE_FINANCIAL_RECORD/);
  await db.exec("INSERT INTO audit_logs(tenant_id,id,actor_id,occurred_at,action,entity_type,entity_id,request_id) VALUES ('t','audit','admin',now(),'LOCK','PERIOD','sep','request')");
  await assert.rejects(db.exec("DELETE FROM audit_logs WHERE id='audit'"),/IMMUTABLE_FINANCIAL_RECORD/);
 }finally{await db.close();}
});
test('expense/adjustment approval cannot name PM as approver and discount cannot deduct twice',async()=>{
 const db=await database();try{
  await assert.rejects(db.exec("INSERT INTO pool_expenses(tenant_id,id,order_id,category,amount,source,status,deductible,created_by,approved_by,approved_at) VALUES ('t','expense','order','OTHER',100,'manual','APPROVED',true,'pm','pm',now())"),/DIRECTOR_OR_ADMIN_APPROVAL_REQUIRED/);
  await assert.rejects(db.exec("INSERT INTO pool_expenses(tenant_id,id,order_id,category,amount,source,status,deductible,created_by) VALUES ('t','discount','order','CUSTOMER_DISCOUNT',100,'source','DRAFT',true,'admin')"));
  await db.exec("INSERT INTO adjustments(tenant_id,id,source_period_id,application_period_id,amount,currency,reason,related_entity,status,created_by,approved_by,approved_at) VALUES ('t','adj','sep','oct',-1000,'VND','Refund','refund-1','APPROVED','admin','admin',now())");
  await assert.rejects(db.exec("UPDATE adjustments SET amount=-2000 WHERE id='adj'"),/APPROVED_VERSION_IS_IMMUTABLE/);
 }finally{await db.close();}
});
test('order item snapshots cannot reference a wrong policy version or another product price',async()=>{
 const db=await database();try{
  await assert.rejects(db.exec("UPDATE order_items SET pool_policy_version=2 WHERE id='item'"));
  await db.exec("INSERT INTO products(tenant_id,id,sku,name) VALUES ('t','other-product','OTHER','Other')");
  await assert.rejects(db.exec("UPDATE order_items SET product_id='other-product' WHERE id='item'"));
 }finally{await db.close();}
});
