export type RoomId='dream'|'mm'|'taiwan'|'philippines';
export const rooms=[
 {id:'dream' as const,name:'Dream Poker',region:'다낭 · 베트남',currency:'VND',zone:'Asia/Ho_Chi_Minh',connected:true,short:'DR'},
 {id:'mm' as const,name:'Million Maker',region:'다낭 · 베트남',currency:'VND',zone:'Asia/Ho_Chi_Minh',connected:false,short:'MM'},
 {id:'taiwan' as const,name:'대만',region:'운영 매장 설정 필요',currency:'TWD',zone:'Asia/Taipei',connected:false,short:'TW'},
 {id:'philippines' as const,name:'필리핀',region:'운영 매장 설정 필요',currency:'PHP',zone:'Asia/Manila',connected:false,short:'PH'},
];
export const workbook='https://docs.google.com/spreadsheets/d/1QJUPswetSgSFAlKkDXdY_WMmM6LCp6nXs9EvmuQF22I/edit';
export function selectedRoom(id:string|null){return rooms.find(r=>r.id===id)||rooms[0];}
// No default-room fallback for financial actions: unconfigured rooms have no links.
export function roomActions(id:string){if(id!=='dream')return [];return [
 {name:'바이인 기록',description:'일일 입력 원본을 바로 확인하세요.',href:workbook+'#gid=2105749969',icon:'cards',tag:'Google Sheets'},
 {name:'F&B 기록',description:'영수증 기록과 메뉴 가격표.',href:workbook+'#gid=11003',icon:'cup',tag:'Google Sheets'},
 {name:'주간정산',description:'월–일 집계 · 검토 · 보고서.',href:'/operations/weekly',icon:'calendar',tag:'AI 지원'},
 {name:'업무 규칙',description:'직원과 에이전트가 함께 쓰는 기준.',href:'/operations/rules',icon:'rules',tag:'공유 규칙'},
 ];}
