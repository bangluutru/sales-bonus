export type Role='ADMIN'|'ACCOUNTING'|'PM'|'SALES_MANAGER'|'SUPPORT_MANAGER'|'EXECUTIVE'|'AUDITOR';
export type Currency='VND';
export type PeriodState='OPEN'|'REVIEW'|'LOCKED'|'PAID';
export type ApprovalState='DRAFT'|'PENDING'|'APPROVED'|'REJECTED';
export type ExpenseCategory='CUSTOMER_DISCOUNT'|'MARKETING_SUPPORT'|'DEALER_INCENTIVE'|'SALES_INCENTIVE'|'OTHER'|'RESERVE';
export interface Actor {id:string;role:Role}
export interface Employee {id:string;code:string;name:string;active:boolean}
export interface Customer {id:string;name:string;externalId:string|null}
export interface Product {id:string;sku:string;name:string;groupId:string|null;externalId:string|null;active:boolean}
export interface ProductPriceVersion {id:string;productId:string;version:number;unitValue:string;currency:Currency;taxBasis:'INCLUDING_VAT'|'EXCLUDING_VAT';vatRate:string;effectiveFrom:string;effectiveTo:string|null;status:'PROVISIONAL'|'APPROVED'|'RETIRED';sourceReference:string}
export interface Order {id:string;customerId:string;pmId:string;orderDate:string;currency:Currency;sourceRevision:string}
export interface OrderItem {id:string;orderId:string;productId:string;quantity:string;priceSnapshot:Readonly<ProductPriceVersion>;poolSnapshot:ManagementSnapshot}
export interface Payment {id:string;orderId:string;amount:string;date:string;method:string;reference:string;status:'DRAFT'|'CONFIRMED'|'REVERSED';createdBy:string;confirmedBy:string|null;confirmedAt:string|null}
export interface PaymentAllocation {paymentId:string;orderItemId:string;amount:string;method:'PRO_RATA_BY_NET_VALUE'|'MANUAL';reason:string|null}
export interface ManagementPoolPolicy {id:string;version:number;scope:'ALL'|'PRODUCT_GROUP'|'PRODUCT';scopeId:string|null;rate:string;effectiveFrom:string;effectiveTo:string|null;status:'DRAFT'|'APPROVED'|'RETIRED'}
export interface ManagementSnapshot {readonly policyId:string;readonly policyVersion:number;readonly rate:string;readonly orderDate:string;readonly productId:string;readonly groupId:string|null}
export interface BonusPolicy {id:string;version:number;pmShare:string;supportShare:string;companyShare:string}
export interface PoolExpense {id:string;category:ExpenseCategory;amount:string;status:ApprovalState}
export interface EmployeeTarget {employeeId:string;periodId:string;type:'COLLECTED_REVENUE';amount:string;currency:Currency}
export interface CalculationPeriod {id:string;start:string;end:string;timezone:string;state:PeriodState}
export interface BonusCalculationLine {id:string;itemId:string;trace:unknown}
export interface BonusCalculation {id:string;periodId:string;employeeId:string;engineVersion:string;lines:BonusCalculationLine[]}
export interface Settlement {id:string;periodId:string;snapshot:unknown;state:'LOCKED'|'PAID'}
export interface Adjustment {id:string;sourcePeriodId:string;applicationPeriodId:string;amount:string;reason:string;relatedEntityId:string;status:ApprovalState;approvedBy?:string;approvedAt?:string}
export interface AuditLog {id:string;actorId:string;at:string;action:string;entityType:string;entityId:string;before:unknown;after:unknown;reason:string|null}
export interface ExternalEntityMapping {tenantId:string;sourceSystem:string;entityType:string;externalId:string;internalId:string;mappingVersion:number}
