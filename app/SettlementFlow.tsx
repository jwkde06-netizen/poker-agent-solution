'use client';
import {useState} from 'react';
import type {ReactNode} from 'react';
import {settlementHref,SettlementTab} from '../lib/settlement-navigation';
import styles from './SettlementFlow.module.css';

export function FlowLink({tab,day,game,children,className,disabled=false}:{tab:SettlementTab;day:string;game?:number;children:ReactNode;className?:string;disabled?:boolean}){
 const href=settlementHref(tab,day,game);
 return <a href={href} className={className} aria-disabled={disabled||undefined} tabIndex={disabled?-1:undefined} onClick={e=>{
  if(disabled){e.preventDefault();return;}
  if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||e.button!==0||window.location.pathname!=='/')return;
  e.preventDefault();window.history.pushState({tab},'',href);window.dispatchEvent(new PopStateEvent('popstate'));window.scrollTo({top:0,left:0,behavior:'auto'});
 }}>{children}</a>;
}
export function SettlementFlow({step,day,disabled=false}:{step:'games'|'daily'|'sheetWeekly';day:string;disabled?:boolean}){
 return <nav className={styles.steps} aria-label='정산 진행 단계'>{([['games','바이인 · 스캔'],['daily','일일 정산'],['sheetWeekly','주간 정산']] as const).map(([tab,label],i)=><FlowLink key={tab} tab={tab} day={day} disabled={disabled} className={step===tab?styles.current:''}><span>{i+1}</span>{label}{step===tab&&<span className={styles.srOnly}>현재 단계</span>}</FlowLink>)}</nav>;
}
export function ScanQueue({intake,error,day,expanded=false}:{intake:any;error?:string|null;day:string;expanded?:boolean}){
 const [limit,setLimit]=useState(6);
 if(error)return <p className={styles.warning} role='status'>{error}</p>;
 if(!intake)return null;
 const items=(intake.items||[]).filter((i:any)=>i.dates?.includes(day)||i.date===day);
 const waiting=items.filter((i:any)=>!['verified','manual'].includes(i.status));
 const changed=waiting.filter((i:any)=>i.status==='changed').length;
 const pending=waiting.length-changed;
 const verified=items.filter((i:any)=>i.status==='verified').length;
 const manual=items.filter((i:any)=>i.status==='manual').length;
 return <details className={styles.queue} open={expanded||undefined}><summary><strong>스캔 처리</strong><span>반영 확인 {verified}</span>{manual>0&&<span>수기 확인 {manual}</span>}<b className={waiting.length?styles.pending:styles.clear}>{pending?'처리 대기 '+pending:changed?'기록 변경 '+changed:'대기 없음'}</b></summary>
  {changed>0&&<p>반영 후 달라진 기록 {changed}건이 있습니다. 현재 누락 건수와는 다릅니다.</p>}
  {!items.length?<p>이 날짜에 연결된 스캔 요청이 없습니다.</p>:!waiting.length?<p>등록된 요청과 현재 장부의 대조를 마쳤습니다.</p>:<ul>{waiting.slice(0,limit).map((i:any)=><li key={i.messageId}><div><strong>{i.games.length?i.games.map((g:number)=>g+'번').join(' · ')+' 게임':'게임 확인 필요'} <small>{({review:'확인 대기',failed:'처리 실패',processing:'처리 중',changed:'기록 변경'} as Record<string,string>)[i.status]}</small></strong><p>{i.question}</p></div><FlowLink tab='games' day={i.date||day} game={i.games.length===1?i.games[0]:undefined}>장부 확인 →</FlowLink></li>)}</ul>}
  {waiting.length>limit&&<button onClick={()=>setLimit(n=>n+12)}>나머지 {waiting.length-limit}건 더 보기</button>}
 </details>;
}
