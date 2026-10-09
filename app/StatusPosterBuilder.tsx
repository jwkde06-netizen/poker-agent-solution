"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import {supabase} from "../lib/supabase";
type Data={time:string;dream:string[];mm:string[];footer:string;contact:string};
type LiveSession={id:string;tableNo:string;gameNo:string;game:string;status:string};
const key="dream-mm-status-builder-v1";
const initial:Data={time:"17:15",dream:["5M 타임어택 4테이블 진행중 🔥","데일리 토너먼트🔥(레지마감 17:05)","10M 타임어택 예약중"],mm:["3M 타임어택 1테이블 진행 중🔥","VIP게임 예약중"],footer:"타임어택 경기는 미리 예약 후 방문하시면 대기 없이 바로 참여하실 수 있습니다.",contact:"예약 및 참가 문의는 1:1 채팅 주세요."};
function drawLines(ctx:CanvasRenderingContext2D,text:string,x:number,y:number,maxWidth:number,lineHeight:number){
  const chars=Array.from(text);let line="";let current=y;
  for(const char of chars){if(ctx.measureText(line+char).width>maxWidth&&line){ctx.fillText(line,x,current);current+=lineHeight;line=""}line+=char}
  if(line){ctx.fillText(line,x,current);current+=lineHeight}return current;
}
export default function StatusPosterBuilder({onSave,sessions=[]}:{onSave?:(title:string,body:string,blob:Blob)=>Promise<void>;sessions?:LiveSession[]}){
 const [monitor,setMonitor]=useState<{observed_at:string;tables:Array<{table_no:string|null;event_name?:string;game:string;level:number|null;entries:number|null;entries_display?:string;blinds?:string|null;rebuys_addons?:string|null}>}|null>(null);
 const [monitorError,setMonitorError]=useState("");
 useEffect(()=>{
   if(!supabase)return;
   const client=supabase;let active=true;
   const refresh=async()=>{
     const {data:row,error}=await client.from("live_monitor_snapshot").select("observed_at,tables").eq("id",1).maybeSingle();
     if(!active)return;
     if(error){setMonitorError("전광판 연동 설정 대기");return}
     setMonitorError("");
     if(row&&Array.isArray(row.tables))setMonitor(row as typeof monitor);
   };
   void refresh();const timer=window.setInterval(()=>void refresh(),30000);
   return()=>{active=false;window.clearInterval(timer)};
 },[]);
 const monitorAge=monitor?Date.now()-new Date(monitor.observed_at).getTime():Infinity;
 const monitorFresh=monitorAge>=0&&monitorAge<120000;
 const canvasRef=useRef<HTMLCanvasElement>(null);
 type Status="진행 중"|"예약 완료"|"예약 중"|"대기 중"|"마감";
 type GameRow={id:string;venue:"dream"|"mm";game:string;tables:number;waiting:number;status:Status};
 const rowKey="dream-poker-status-rows-v2";
 const makeRow=(venue:"dream"|"mm",game:string,tables=0,waiting=0,status:Status="진행 중"):GameRow=>({id:crypto.randomUUID(),venue,game,tables,waiting,status});
 const [rows,setRows]=useState<GameRow[]>([]);
 const [loaded,setLoaded]=useState(false);
 const [time,setTime]=useState("17:15");
 const [footer,setFooter]=useState(initial.footer);
 const [contact,setContact]=useState(initial.contact);

 const [feedback,setFeedback]=useState("");
 const flash=(msg:string)=>{setFeedback(msg);window.setTimeout(()=>setFeedback(""),3200)};
 const nowTime=()=>new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Ho_Chi_Minh",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date());
 useEffect(()=>{
   try{
     const raw=localStorage.getItem(rowKey);
     const saved=raw?JSON.parse(raw):null;
     if(saved&&Array.isArray(saved.rows)){
       setRows(saved.rows.filter((row:GameRow)=>row&&typeof row.game==="string"));
       setTime(saved.time||nowTime());setFooter(saved.footer??initial.footer);setContact(saved.contact??initial.contact);
     }else{
       setRows([makeRow("dream","5M",0,0),makeRow("dream","10M",0,0,"예약 중"),makeRow("mm","3M",1,0)]);
       setTime(nowTime());
     }
   }catch{setRows([makeRow("dream","5M",3,4)]);setTime(nowTime())}
   setLoaded(true);
 },[]);
 useEffect(()=>{if(loaded)localStorage.setItem(rowKey,JSON.stringify({rows,time,footer,contact}))},[rows,time,footer,contact,loaded]);
 const updateRow=(id:string,change:Partial<GameRow>)=>setRows(prev=>prev.map(r=>r.id===id?{...r,...change}:r));
 const gameText=(r:GameRow)=>`${r.game} ${r.tables}테이블 · ${r.waiting}명 대기 · ${r.status}`;
 const sections=([{id:"dream" as const,name:"DREAM POKER"},{id:"mm" as const,name:"MILLION MAKER"}]);
 const text=useMemo(()=>["📢 실시간 테이블 현황",time+" 기준","",...sections.flatMap(section=>[section.id==="dream"?"♠️ "+section.name:"♣️ "+section.name,...rows.filter(r=>r.venue===section.id).map(r=>"• "+gameText(r)),""]),footer,"",contact].join("\n"),[rows,time,footer,contact]);
 const applyLive=()=>{
   const active=sessions.filter(s=>s.status==="active");
   const groups=new Map<string,number>();
   for(const session of active){const game=session.game.trim();if(game)groups.set(game,(groups.get(game)||0)+1)}
   setRows(prev=>{
     const next=[...prev];
     for(const [game,count] of groups){const idx=next.findIndex(r=>r.venue==="dream"&&r.game.toLowerCase()===game.toLowerCase());
       if(idx>=0)next[idx]={...next[idx],tables:count,status:"진행 중"};else next.push(makeRow("dream",game,count,0))}
     return next;
   });
   setTime(nowTime());
   flash("운영 시스템의 게임 수를 반영했습니다. 대기 인원은 기존 값을 유지합니다.");
 };
 const applyMonitor=()=>{
   if(!monitor||!monitorFresh){flash("최신 전광판 데이터가 없습니다.");return}
   const counts=new Map<string,number>();
   for(const row of monitor.tables){const match=(row.event_name||row.game||"").match(/(?:CLASH\s+)?(3|5|10)\s*M?\b/i);if(match){const game=match[1]+"M";counts.set(game,(counts.get(game)||0)+1)}}
   if(!counts.size){flash("게임 종류를 확인할 수 없어 기존 숫자를 유지했습니다.");return}
   setRows(prev=>{const next=[...prev];for(const [game,count] of counts){const idx=next.findIndex(r=>r.venue==="dream"&&r.game===game);if(idx>=0)next[idx]={...next[idx],tables:count};else next.push(makeRow("dream",game,count,0))}return next});
   setTime(nowTime());flash("전광판 경기 수를 반영했습니다. 대기 인원은 수동 입력값을 유지합니다.");
 };
 function renderPoster(){
  const canvas=canvasRef.current;if(!canvas)throw new Error("Canvas unavailable");
  const ctx=canvas.getContext("2d");if(!ctx)throw new Error("Canvas unavailable");
  const W=1080,pad=76,usable=W-pad*2;
  const groupHeights=sections.map(section=>Math.max(185,rows.filter(r=>r.venue===section.id).length*86+185));
  const H=Math.max(1100,380+groupHeights.reduce((a,b)=>a+b,0)+220);
  canvas.width=W;canvas.height=H;
  const bg=ctx.createLinearGradient(0,0,W,H);bg.addColorStop(0,"#26303c");bg.addColorStop(1,"#101419");ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
  ctx.fillStyle="#d2ac61";ctx.fillRect(pad,69,110,6);
  ctx.fillStyle="#fff";ctx.font="bold 62px sans-serif";ctx.fillText("LIVE TABLE STATUS",pad,162);
  ctx.fillStyle="#c9cfda";ctx.font="32px sans-serif";ctx.fillText(time+" 기준",pad,226);
  let y=290;
  sections.forEach((section,index)=>{
   const current=rows.filter(r=>r.venue===section.id);
   const height=groupHeights[index];
   ctx.fillStyle="#202935";ctx.beginPath();ctx.roundRect(pad,y,usable,height,20);ctx.fill();
   ctx.fillStyle="#e2bb73";ctx.font="bold 40px sans-serif";ctx.fillText(section.name,pad+25,y+62);
   ctx.fillStyle="#abb4c1";ctx.font="24px sans-serif";ctx.fillText("GAME TYPE",pad+25,y+108);ctx.fillText("TABLES",pad+385,y+108);ctx.fillText("WAITING",pad+570,y+108);ctx.fillText("STATUS",pad+755,y+108);
   current.forEach((r,i)=>{
     const yy=y+158+i*86;
     ctx.fillStyle="#fafafa";ctx.font="bold 38px sans-serif";ctx.fillText(r.game.slice(0,16),pad+25,yy);
     ctx.font="bold 36px sans-serif";ctx.fillText(String(r.tables),pad+410,yy);ctx.fillText(String(r.waiting),pad+598,yy);
     ctx.fillStyle="#e2bb73";ctx.font="bold 27px sans-serif";ctx.fillText(r.status,pad+748,yy);
     ctx.fillStyle="#414b57";ctx.fillRect(pad+25,yy+19,usable-50,1);
   });
   y+=height+22;
  });
  ctx.fillStyle="#dde3eb";ctx.font="26px sans-serif";y=drawLines(ctx,footer,pad,y+38,usable,43);
  ctx.fillStyle="#e2bb73";ctx.font="bold 27px sans-serif";drawLines(ctx,contact,pad,y+24,usable,42);
  return canvas;
 }
 const getPng=async()=>{const canvas=renderPoster();return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("PNG 변환 실패")),"image/png"))};
 const download=async()=>{try{const blob=await getPng();const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="Dream-LIVE-"+time.replace(":","")+".png";a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);flash("PNG 저장 완료")}catch(e){flash(String(e))}};
 const save=async()=>{if(!onSave)return;try{await onSave("Dream & MM 현황 "+time,text,await getPng());flash("자료실 저장 완료")}catch(e){flash("저장 실패: "+String(e))}};
 const listEditor=(venue:"dream"|"mm",name:string)=><section className="statusVenue" key={venue}>
  <div className="statusVenueTitle"><strong>{name}</strong><span>{rows.filter(r=>r.venue===venue).length}종류</span></div>
  <div className="statusTableScroll"><table className="statusEditTable"><thead><tr><th>게임 종류</th><th>테이블</th><th>대기</th><th>상태</th><th aria-label="삭제"></th></tr></thead><tbody>
  {rows.filter(r=>r.venue===venue).map(row=><tr key={row.id}><td><input className="statusGameInput" value={row.game} aria-label="게임 종류" onChange={e=>updateRow(row.id,{game:e.target.value})}/></td>
   <td><input type="number" min="0" className="statusNumberInput" aria-label={row.game+" 테이블 수"} value={row.tables} onChange={e=>updateRow(row.id,{tables:Math.max(0,Number(e.target.value)||0)})}/></td>
   <td><input type="number" min="0" className="statusNumberInput" aria-label={row.game+" 대기 인원"} value={row.waiting} onChange={e=>updateRow(row.id,{waiting:Math.max(0,Number(e.target.value)||0)})}/></td>
   <td><select aria-label={row.game+" 상태"} value={row.status} onChange={e=>updateRow(row.id,{status:e.target.value as Status})}>{(["진행 중","예약 완료","예약 중","대기 중","마감"] as const).map(x=><option key={x}>{x}</option>)}</select></td>
   <td><button className="statusRemove" title="경기 삭제" aria-label={row.game+" 삭제"} onClick={()=>setRows(p=>p.filter(x=>x.id!==row.id))}>×</button></td></tr>)}
  </tbody></table></div><button className="statusAdd" onClick={()=>setRows(prev=>[...prev,makeRow(venue,"새 게임",0,0,"예약 중")])}>+ 경기 추가</button>
 </section>;
 return <div className="builderShell statusBuilder"><div className="builderHead"><div><h2>실시간 게임 현황</h2><p>숫자만 바꾸면 포스터가 바로 업데이트됩니다.</p></div><div className="statusTopActions"><button onClick={applyLive}>운영 현황 불러오기</button><button onClick={()=>{setTime(nowTime());flash("기준 시각 갱신")}}>현재 시각</button></div></div>
 <div className="builderColumns"><div className="builderForm">
 <div className="statusQuickHead"><span>GAME TYPE</span><span>TABLES</span><span>WAITING</span><span>STATUS</span></div>
 {listEditor("dream","♠ DREAM POKER")}{listEditor("mm","♣ MILLION MAKER")}
 <details className="statusAdvanced"><summary>전광판 연동 및 안내 문구 설정</summary>
 <div className="builderMonitor"><div><strong>전광판 동기화</strong><span>{monitorFresh&&monitor?`연결됨 · ${monitor.tables.length}경기`:monitorError||"연동 대기"}</span></div><button type="button" disabled={!monitorFresh} onClick={applyMonitor}>경기 수 반영</button></div>
 <label>기준 시각<input value={time} onChange={e=>setTime(e.target.value)}/></label>
 <label>예약 안내<textarea rows={2} value={footer} onChange={e=>setFooter(e.target.value)}/></label>
 <label>문의 문구<input value={contact} onChange={e=>setContact(e.target.value)}/></label></details>
 <div className="builderActions"><button onClick={()=>void navigator.clipboard.writeText(text).then(()=>flash("문구 복사 완료")).catch(()=>flash("복사 실패"))}>문구 복사</button><button onClick={()=>void download()}>PNG 다운로드</button>{onSave&&<button onClick={()=>void save()}>자료실 저장</button>}</div>
 {feedback&&<p role="status">{feedback}</p>}
 </div><div className="builderPreview"><div className="builderPreviewBar"><strong>포스터 미리보기</strong><span>{time} 기준</span></div><div className="statusPosterPreview"><h2>LIVE TABLE STATUS</h2>{sections.map(section=><div className="statusPosterSection" key={section.id}><h3>{section.name}</h3><div className="statusPosterLabels"><span>GAME TYPE</span><span>TABLES</span><span>WAITING</span><span>STATUS</span></div>{rows.filter(r=>r.venue===section.id).map(r=><div className="statusPosterRow" key={r.id}><strong>{r.game}</strong><b>{r.tables}</b><b>{r.waiting}</b><span>{r.status}</span></div>)}</div>)}<p className="statusPosterFooter">{footer}<br/>{contact}</p></div></div></div><canvas ref={canvasRef} style={{display:"none"}}/></div>;
}
