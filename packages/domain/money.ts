/** Exact reduced rationals. Money/rates must enter as strings or bigint, never Number. */
export interface Rational { readonly n: bigint; readonly d: bigint }
function gcd(a: bigint,b: bigint): bigint { a=a<0n?-a:a; while(b!==0n){const t=a%b;a=b;b=t;}return a; }
function rational(n:bigint,d:bigint):Rational {
  if(d===0n)throw new Error('ZERO_DENOMINATOR');
  if(d<0n){n=-n;d=-d;}
  const g=gcd(n,d);return Object.freeze({n:n/g,d:d/g});
}
export function q(value:string|bigint):Rational {
  if(typeof value==='bigint')return rational(value,1n);
  if(typeof value!=='string')throw new Error('EXACT_STRING_REQUIRED');
  if(value.length>500)throw new Error('DECIMAL_TOO_LONG');
  if(/^-?\d+\/\d+$/.test(value)){const [n,d]=value.split('/');return rational(BigInt(n!),BigInt(d!));}
  if(!/^-?\d+(\.\d+)?$/.test(value))throw new Error('INVALID_EXACT_DECIMAL');
  const negative=value.startsWith('-');const raw=negative?value.slice(1):value;
  const [whole,fraction='']=raw.split('.');const d=10n**BigInt(fraction.length);
  return rational((BigInt(whole!)*d+BigInt(fraction||'0'))*(negative?-1n:1n),d);
}
export function exact(v:Rational):string {return v.d===1n?v.n.toString():`${v.n}/${v.d}`;}
export function add(a:Rational,b:Rational):Rational{return rational(a.n*b.d+b.n*a.d,a.d*b.d);}
export function sub(a:Rational,b:Rational):Rational{return rational(a.n*b.d-b.n*a.d,a.d*b.d);}
export function mul(a:Rational,b:Rational):Rational{return rational(a.n*b.n,a.d*b.d);}
export function div(a:Rational,b:Rational):Rational{return rational(a.n*b.d,a.d*b.n);}
export function compare(a:Rational,b:Rational):number {const v=a.n*b.d-b.n*a.d;return v<0n?-1:v>0n?1:0;}
export function sum(values:readonly Rational[]):Rational{return values.reduce(add,q(0n));}
export function nonnegative(value:string):Rational {const v=q(value);if(v.n<0n)throw new Error('NEGATIVE_INPUT');return v;}
export function rate(value:string):Rational {const v=nonnegative(value);if(compare(v,q(1n))>0)throw new Error('RATE_OUT_OF_RANGE');return v;}
export function ceilQuantum(value:Rational,quantum:bigint):bigint {
  if(value.n<0n||quantum<=0n)throw new Error('INVALID_CEILING_INPUT');
  const denominator=value.d*quantum;
  return ((value.n+denominator-1n)/denominator)*quantum;
}
