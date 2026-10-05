export function allocatePayment(amount:bigint,items:readonly {id:string;net:bigint}[]):{id:string;amount:bigint}[] {
  if(typeof amount!=='bigint'||amount<0n||items.length===0)throw new Error('INVALID_PAYMENT_ALLOCATION');
  if(new Set(items.map(i=>i.id)).size!==items.length||items.some(i=>!i.id||typeof i.net!=='bigint'||i.net<0n))throw new Error('INVALID_ITEM_WEIGHTS');
  const weight=items.reduce((s,i)=>s+i.net,0n);if(weight<=0n)throw new Error('POSITIVE_NET_WEIGHTS_REQUIRED');
  const rows=items.map(i=>({id:i.id,amount:amount*i.net/weight,remainder:amount*i.net%weight}));
  let remaining=amount-rows.reduce((s,i)=>s+i.amount,0n);
  rows.sort((a,b)=>a.remainder>b.remainder?-1:a.remainder<b.remainder?1:a.id<b.id?-1:a.id>b.id?1:0);
  for(const row of rows){if(remaining===0n)break;row.amount+=1n;remaining-=1n;}
  return rows.sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0).map(({id,amount})=>({id,amount}));
}
