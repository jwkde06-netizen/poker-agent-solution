'use client';
import {useEffect,useState} from 'react';
import {supabase} from '../lib/supabase';
import ReservationOverview from './ReservationOverview';
import styles from './SheetLedger.module.css';
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const dateOf=(v:unknown)=>typeof v==='number'?new Date(Math.floor(v-25569)*86400000).toISOString().slice(0,10):String(v||'');
const tableLabel=(v:unknown)=>{if(typeof v==='number'&&v>40000&&v<60000){const d=new Date((v-25569)*86400000);return `${d.getUTCMonth()+1}-${d.getUTCDate()}`;}return String(v??'—');};
const money=(v:unknown)=>typeof v==='number'?v.toLocaleString('ko-KR'):'—';
export default function SheetLedger({view}:{view:'dashboard'|'daily'|'fnb'}){
 const [date,setDate]=useState(today),[report,setReport]=useState<any>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{
  let alive=true;const controller=new AbortController();let loading=false;
  async function load(){if(loading)return;loading=true;if(alive)setBusy(true);
   try{const session=(await supabase?.auth.getSession())?.data.session;if(!session)throw Error('다시 로그인해주세요.');
    const r=await fetch('/api/operations/settlement?day='+date,{headers:{Authorization:'Bearer '+session.access_token},cache:'no-store',signal:controller.signal});const data=await r.json();if(!r.ok)throw Error(data.error||'시트를 불러오지 못했어요.');if(alive){setReport(data);setError('');}
   }catch(e){if(alive&&!controller.signal.aborted){setError((e as Error).message);setReport(null);}}finally{loading=false;if(alive)setBusy(false);}
  }
  setReport(null);void load();const refresh=()=>{if(!document.hidden)void load();};const timer=setInterval(refresh,15000);window.addEventListener('focus',refresh);document.addEventListener('dream-sheet-refresh',refresh);
  return()=>{alive=false;controller.abort();clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('dream-sheet-refresh',refresh);};
 },[date]);
 const daily=(report?.sourceDaily||[]).filter((r:any)=>dateOf(r.values[1])===date),fnb=(report?.sourceFnb||[]).filter((r:any)=>dateOf(r.values[0])===date);
 const total=report?.days?.find((d:any)=>d.date===date);

 const games=Object.values(daily.reduce((all:Record<string,any>,r:any)=>{const t=tableLabel(r.values[2]),blind=String(r.values[3]||'');const id=t+'|'+blind;if(!all[id])all[id]={id,table:t,blind,players:0,buyins:0};all[id].players++;all[id].buyins+=Number(r.values[7])||0;return all;},{})) as any[];
 const gameCount=new Set(daily.map((r:any)=>Number(r.values[0])).filter((n:number)=>Number.isInteger(n)&&n>0)).size;
 return <section className={styles.page} aria-label='대시보드'><div className={styles.dashboardToolbar}><div className={styles.controls}><input aria-label="조회 날짜" type="date" value={date} onChange={e=>{if(e.target.value)setDate(e.target.value);}}/><button disabled={busy} onClick={()=>document.dispatchEvent(new Event('dream-sheet-refresh'))}>{busy?'갱신 중…':'↻ 새로고침'}</button></div></div>
 {error&&<p className={styles.error} role="alert">{error}</p>}
 {!report&&!error&&<div className={styles.empty} role="status">시트에서 오늘의 현황을 불러오고 있습니다.</div>}
 {report&&<>
 <div className={styles.metrics}>{[['총 바이인',total?.buyins,'회','games'],['레이크백',total?.back,'동','sheetWeekly'],['F&B 지출',total?.fnb,'동','fnb'],['게임 수',gameCount,'게임','daily']].map(([label,value,unit,tab])=><a className={styles.metricCard} href={'/?tab='+tab+'&day='+date} key={String(label)}><span>{label}<b aria-hidden="true">↗</b></span><strong>{money(value)} <small>{unit}</small></strong></a>)}</div>
 <p className={styles.status}><i/>구글 시트 연결됨 · {new Date(report.generatedAt).toLocaleTimeString('ko-KR',{timeZone:'Asia/Ho_Chi_Minh'})} 확인 · 15초마다 갱신</p>

 <div className={styles.dashboardGrid}><section className={styles.panel}><div className={styles.heading}><h2>테이블별 참가 기록</h2><a href="/?tab=games">게임 입력 →</a></div><p className={styles.caption}>선택한 날짜의 누적 기록 · 게임 진행 여부와는 별도입니다.</p><div className={styles.scroll}><table><thead><tr><th>테이블 / 회차</th><th>블라인드</th><th>참가</th><th>바이인</th></tr></thead><tbody>{games.map(g=><tr key={g.id}><td><b>Table {g.table}</b></td><td><span className={styles.badge}>{g.blind}</span></td><td>{g.players}건</td><td><b>{g.buyins}</b>회</td></tr>)}</tbody></table>{!games.length&&<p className={styles.empty}>기록된 게임이 없습니다.</p>}</div></section>
 <section className={styles.panel}><div className={styles.heading}><h2>F&B 요약</h2><a href="/?tab=fnb">내역 보기 →</a></div>{['2F','3F','4F'].map(f=>{const rows=fnb.filter((r:any)=>r.values[1]===f);return <div className={styles.floor} key={f}><span className={styles.floorIcon}>{f}</span><div><strong>{f} 주문</strong><small>{rows.length}건</small></div><b>{rows.reduce((n:number,r:any)=>n+(Number(r.values[2])||0),0).toLocaleString()}<small> 동</small></b></div>;})}<p className={styles.caption}>주문 합계이며 정산 차감 기준은 주간 정산에서 적용합니다.</p></section></div>
 <ReservationOverview/>
 </>}
 </section>;
}
