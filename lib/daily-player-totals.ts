export type DailySourceRow = {row:number;values:unknown[]};
export type DailyPlayer = {
 key:string;name:string;card:string;agencies:string[];games:number[];sourceRows:number[];
 buyins:number|null;rake:number|null;back:number|null;
};
export function sheetDate(value:unknown):string|null {
 if(typeof value==='number'&&Number.isFinite(value)&&value>25000&&value<100000)return new Date((Math.floor(value)-25569)*86400000).toISOString().slice(0,10);
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
 const date=new Date(value+'T00:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value?value:null;
}
const nameKey=(v:unknown)=>String(v??'').trim().replace(/\s+/g,' ').toUpperCase();
const add=(sum:number|null,value:unknown):number|null=>sum!==null&&typeof value==='number'&&Number.isSafeInteger(value)&&value>=0&&Number.isSafeInteger(sum+value)?sum+value:null;

// Sum current cumulative Sheet rows once, never OCR attempts or removed rows.
export function dailyPlayerTotals(source:DailySourceRow[],day:string,blockedRows:ReadonlySet<number>=new Set()):DailyPlayer[]{
 const cards=new Map<string,Set<string>>();
 for(const {values:r} of source){if(sheetDate(r[1])!==day||!nameKey(r[4]))continue;const name=nameKey(r[4]),card=String(r[5]??'').trim();if(!cards.has(name))cards.set(name,new Set());if(card)cards.get(name)!.add(card);}
 const players=new Map<string,DailyPlayer>();let currentDate:string|null=null,game:number|undefined;
 for(const {row,values:r} of source){
  const date=sheetDate(r[1]);if(date!==currentDate){game=undefined;currentDate=date;}
  if(r[0]!==''&&r[0]!=null){const number=Number(r[0]);game=Number.isInteger(number)&&number>0?number:undefined;}
  const name=nameKey(r[4]);if(date!==day||!name)continue;
  const knownCards=cards.get(name)!,card=String(r[5]??'').trim()||(knownCards.size===1?Array.from(knownCards)[0]:'');
  // Conflicting card numbers remain separate identities; do not guess a merge.
  const key=knownCards.size>1?JSON.stringify([name,card]):name;
  const p=players.get(key)||{key,name:String(r[4]).trim().replace(/\s+/g,' '),card,agencies:[],games:[],sourceRows:[],buyins:0,rake:0,back:0};
  const agency=String(r[6]??'').trim();if(agency&&!p.agencies.includes(agency))p.agencies.push(agency);
  if(game!==undefined&&!p.games.includes(game))p.games.push(game);p.sourceRows.push(row);
  p.buyins=add(p.buyins,r[7]);p.rake=add(p.rake,r[8]);p.back=add(p.back,r[9]);
  if(blockedRows.has(row))p.buyins=p.rake=p.back=null;
  players.set(key,p);
 }
 return Array.from(players.values()).map(p=>({...p,games:p.games.sort((a,b)=>a-b)}));
}
