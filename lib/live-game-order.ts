// Internal game numbers are independent of the external casino No.
export function gameStateFor(states:any[],group:any){
 return states.find(s=>Number(s.game_no)===Number(group.game)&&s.table_label===group.table&&s.blind===group.blind);
}
export function gameStatusFor(states:any[],group:any){
 const status=gameStateFor(states,group)?.status;
 return ['active','prepared','closed','unconfirmed'].includes(status)?status:'unknown';
}
export function orderGames(groups:any[],states:any[]){
 const ranks:Record<string,number>={active:0,prepared:1,unknown:2,unconfirmed:2,closed:3};
 const rank=(g:any)=>ranks[gameStatusFor(states,g)]??2;
 return [...groups].sort((a,b)=>rank(a)-rank(b)||Number(b.game)-Number(a.game)||a.id.localeCompare(b.id));
}
export function validLedgerDay(value:unknown){return typeof value==='string'&&/^20\d{2}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;}
