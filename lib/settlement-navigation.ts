export type SettlementTab='games'|'daily'|'sheetWeekly'|'fnb'|'players';
export function settlementHref(tab:SettlementTab,day:string,game?:number){
 const query=new URLSearchParams({tab,day});if(Number.isInteger(game)&&Number(game)>0)query.set('game',String(game));
 return '/?'+query.toString();
}
export function rememberSettlementDay(day:string){
 const url=new URL(window.location.href);url.searchParams.set('day',day);window.history.replaceState(window.history.state,'',url);
}
