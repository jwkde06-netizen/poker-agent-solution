'use client';
import {useEffect,useState} from 'react';
import {supabase} from '../lib/supabase';
import styles from './SheetLedger.module.css';
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const dateOf=(v:unknown)=>typeof v==='number'?new Date(Math.floor(v-25569)*86400000).toISOString().slice(0,10):String(v||'');
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
  setReport(null);void load();const refresh=()=>{if(!document.hidden)void load();};const timer=setInterval(refresh,60000);window.addEventListener('focus',refresh);document.addEventListener('dream-sheet-refresh',refresh);
  return()=>{alive=false;controller.abort();clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('dream-sheet-refresh',refresh);};
 },[date]);
 const daily=(report?.sourceDaily||[]).filter((r:any)=>dateOf(r.values[1])===date),fnb=(report?.sourceFnb||[]).filter((r:any)=>dateOf(r.values[0])===date);
 const total=report?.days?.find((d:any)=>d.date===date);
 const sheet=(gid:number,row?:number)=>report?.sheetUrl+'#gid='+gid+(row?'&range=A'+row:'');
 return <section className={styles.page}><div className={styles.heading}><div><h1>{view==='dashboard'?'드림 운영 현황':view==='daily'?'일일 정산':'F&B'}</h1><p>구글 시트 원본 · 베트남 시간 기준</p></div><div className={styles.controls}><input aria-label="조회 날짜" type="date" value={date} onChange={e=>{if(e.target.value)setDate(e.target.value);}}/><button disabled={busy} onClick={()=>document.dispatchEvent(new Event('dream-sheet-refresh'))}>{busy?'불러오는 중…':'새로고침'}</button></div></div>
 {error&&<p role="alert">{error} 이전 금액은 표시하지 않습니다.</p>}
 {report&&<><div className={styles.metrics}>{[['바이인',total?.buyins,'회'],['레이크',total?.rake,'VND'],['레이크백',total?.back,'VND'],['F&B',total?.fnb,'VND']].map(([label,value,unit])=><div key={label}><span>{label}</span><strong>{money(value)} <small>{unit}</small></strong></div>)}</div>
 <p className={styles.status}>최근 조회 {new Date(report.generatedAt).toLocaleTimeString('ko-KR',{timeZone:'Asia/Ho_Chi_Minh'})} · 1분마다 갱신 · 수정은 원본 시트에서 반영됩니다.</p>
 {view!=='fnb'&&<div className={styles.panel}><div className={styles.heading}><h2>바이인 기록 · {daily.length}명</h2><a href={sheet(report.sheetIds.daily)} target="_blank" rel="noreferrer">원본에서 수정 ↗</a></div><div className={styles.scroll}><table><thead><tr>{['테이블','블라인드','선수','코드','바이인','레이크','레이크백','원본'].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{daily.map((r:any)=><tr key={r.row}>{[2,3,4,6,7,8,9].map(c=><td key={c}>{c>=7?money(r.values[c]):String(r.values[c]??'')}</td>)}<td><a href={sheet(report.sheetIds.daily,r.row)} target="_blank" rel="noreferrer">{r.row}행 ↗</a></td></tr>)}</tbody></table></div>{!daily.length&&<p>이 날짜에 기록된 바이인이 없습니다.</p>}</div>}
 {(view==='fnb'||view==='dashboard')&&<div className={styles.panel}><div className={styles.heading}><h2>F&B 기록 · {fnb.length}건</h2><a href={sheet(report.sheetIds.fnb)} target="_blank" rel="noreferrer">원본에서 수정 ↗</a></div><div className={styles.scroll}><table><thead><tr><th>층</th><th>내용</th><th>금액 (VND)</th><th>원본</th></tr></thead><tbody>{fnb.map((r:any)=><tr key={r.row}><td>{r.values[1]}</td><td>{r.values[3]}</td><td>{money(r.values[2])}</td><td><a href={sheet(report.sheetIds.fnb,r.row)} target="_blank" rel="noreferrer">{r.row}행 ↗</a></td></tr>)}</tbody></table></div>{!fnb.length&&<p>이 날짜에 기록된 F&B가 없습니다.</p>}</div>}
 <div className={styles.links}><a href="/?tab=sheetWeekly">주간 정산 보기 →</a><a href="/?tab=rules">업무 규칙 →</a></div></>}
 </section>;
}
