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
 
 type GameRow={id:string;venue:"dream"|"mm";game:string;tables:number;waiting:number;reserved:number};
 const rowKey="dream-poker-status-rows-v3";
 const reservationTarget=9;
 const getStatus=(r:GameRow)=>r.tables>0?"진행 중":r.waiting>=reservationTarget?"예약 완료":r.waiting>=8?"곧 스타트":"예약 중";
 const makeRow=(venue:"dream"|"mm",game:string,tables=0,waiting=0,reserved=0):GameRow=>({id:crypto.randomUUID(),venue,game,tables,waiting,reserved});
 const [rows,setRows]=useState<GameRow[]>([]);
 const [loaded,setLoaded]=useState(false);
 const [time,setTime]=useState("17:15");
 const [clock,setClock]=useState("");
 useEffect(()=>{const tick=()=>setClock(new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Ho_Chi_Minh",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date()));tick();const timer=window.setInterval(tick,15000);return()=>window.clearInterval(timer)},[]);
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
       setRows([makeRow("dream","5M",0,0),makeRow("dream","10M",0,0),makeRow("mm","3M",0,0)]);
       setTime(nowTime());
     }
   }catch{setRows([makeRow("dream","5M",0,0)]);setTime(nowTime())}
   setLoaded(true);
 },[]);
 useEffect(()=>{if(loaded)localStorage.setItem(rowKey,JSON.stringify({rows,time,footer,contact}))},[rows,time,footer,contact,loaded]);
 const updateRow=(id:string,change:Partial<GameRow>)=>setRows(prev=>prev.map(r=>r.id===id?{...r,...change}:r));
 const gameText=(r:GameRow)=>`${r.game} · ${getStatus(r)}${r.waiting>0?` · ${r.waiting}명 대기`:""}`;
 const sections=([{id:"dream" as const,name:"DREAM POKER"},{id:"mm" as const,name:"MILLION MAKER"}]);
 const displayTime=clock||time;
 const text=useMemo(()=>["📢 실시간 테이블 현황",displayTime+" 기준","",...sections.flatMap(section=>[section.id==="dream"?"♠️ "+section.name:"♣️ "+section.name,...rows.filter(r=>r.venue===section.id).map(r=>"• "+gameText(r)),""]),footer,"",contact].join("\n"),[rows,displayTime,footer,contact]);
 const applyLive=()=>{
   // Count physical tables, not historical session rows. The store has five
   // registered physical tables; invalid/duplicate rows must never inflate the poster.
   const knownTables=new Set(["2","4","5","12","13"]);
   const active=sessions.filter(session=>session.status==="active"&&knownTables.has(session.tableNo.trim()));
   const byTable=new Map<string,string>();
   for(const session of active){
     const table=session.tableNo.trim();
     const game=session.game.trim().toUpperCase();
     if(!game)continue;
     if(byTable.has(table)&&byTable.get(table)!==game){
       flash("테이블별 진행 경기 데이터가 중복됩니다. 자동 반영하지 않았습니다.");
       return;
     }
     byTable.set(table,game);
   }
   const groups=new Map<string,number>();
   for(const game of byTable.values())groups.set(game,(groups.get(game)||0)+1);
   if(sessions.some(session=>session.status==="active"&&!knownTables.has(session.tableNo.trim()))){
     flash("미등록 테이블 데이터가 있어 자동 반영하지 않았습니다. 게임 입력을 확인해주세요.");
     return;
   }
   setRows(prev=>{
     const next=prev.map(row=>row.venue==="dream"?{...row,tables:groups.get(row.game.trim().toUpperCase())||0}:row);
     for(const [game,count] of groups)if(!next.some(row=>row.venue==="dream"&&row.game.trim().toUpperCase()===game))next.push(makeRow("dream",game,count,0));
     return next;
   });
   flash("실제 테이블 번호 기준으로 중복 없이 반영했습니다. 예약·대기는 유지됩니다.");
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
  const groupHeights=sections.map(section=>160+Math.max(1,rows.filter(r=>r.venue===section.id).length)*124);
  const H=Math.max(1050,290+groupHeights.reduce((a,b)=>a+b+20,0)+270);
  canvas.width=W;canvas.height=H;
  const bg=ctx.createLinearGradient(0,0,W,H);bg.addColorStop(0,"#26303c");bg.addColorStop(1,"#101419");ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
  ctx.fillStyle="#d2ac61";ctx.fillRect(pad,69,110,6);
  ctx.fillStyle="#fff";ctx.font="bold 62px sans-serif";ctx.fillText("실시간 테이블 현황",pad,162);
  ctx.fillStyle="#c9cfda";ctx.font="32px sans-serif";ctx.textAlign="right";ctx.fillText(displayTime+" 기준",W-pad,145);ctx.textAlign="left";
  let y=290;
  sections.forEach((section,index)=>{
   const current=rows.filter(r=>r.venue===section.id);
   const height=groupHeights[index];
   ctx.fillStyle="#202935";ctx.beginPath();ctx.roundRect(pad,y,usable,height,22);ctx.fill();
   ctx.fillStyle="#eac17a";ctx.font="bold 46px sans-serif";ctx.fillText(section.name,pad+26,y+66);
   const col=[pad+28,pad+315,pad+505,pad+704];
   ctx.fillStyle="#aab5c6";ctx.font="bold 24px sans-serif";
   ["GAME","TABLE","WAITING","STATUS"].forEach((name,i)=>ctx.fillText(name,col[i],y+125));
   current.forEach((r,i)=>{
     const yy=y+203+i*124;
     ctx.fillStyle="#f8fafc";ctx.font="bold 63px sans-serif";ctx.fillText(r.game.slice(0,10),col[0],yy);
     ctx.fillText(String(r.tables),col[1]+15,yy);ctx.fillText(String(r.waiting),col[2]+16,yy);
     const status=getStatus(r);
     ctx.fillStyle=r.tables>0?"#e6bd73":"#e5eaf0";
     ctx.font="bold 32px sans-serif";ctx.fillText((r.tables>0?"🔥 ":"")+status,col[3],yy-8);
     ctx.fillStyle="#46505d";ctx.fillRect(pad+24,yy+29,usable-48,1);
   });
   y+=height+20;
  });
  ctx.fillStyle="#dde3eb";ctx.font="25px sans-serif";y=drawLines(ctx,footer,pad,y+27,usable,38);
  ctx.fillStyle="#e2bb73";ctx.font="bold 29px sans-serif";drawLines(ctx,contact,pad,y+18,usable,42);
  return canvas;
 }
 const getPng=async()=>{const canvas=renderPoster();return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("PNG 변환 실패")),"image/png"))};
 const download=async()=>{try{const blob=await getPng();const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="Dream-LIVE-"+displayTime.replace(":","")+".png";a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);flash("PNG 저장 완료")}catch(e){flash(String(e))}};
 const copyPoster=async()=>{try{if(!navigator.clipboard?.write||typeof ClipboardItem==="undefined"){flash("이 브라우저는 이미지 복사를 지원하지 않습니다. PNG 다운로드를 이용해주세요.");return}await navigator.clipboard.write([new ClipboardItem({"image/png":getPng()})]);flash("포스터 이미지 복사 완료 · Ctrl+V로 붙여넣으세요")}catch(e){flash("이미지 복사 실패 · 브라우저 권한을 확인하거나 PNG를 다운로드하세요")}};
 const save=async()=>{if(!onSave)return;try{await onSave("Dream & MM 현황 "+displayTime,text,await getPng());flash("자료실 저장 완료")}catch(e){flash("저장 실패: "+String(e))}};
 const adjustNumber=(id:string,field:"tables"|"waiting",delta:number)=>setRows(prev=>prev.map(row=>row.id===id?{...row,[field]:Math.max(0,(row[field]||0)+delta)}:row));
 const numberEditor=(r:GameRow,field:"tables"|"waiting",label:string)=><div className="statusInlineNumber">
   <input type="number" min="0" step="1" aria-label={r.game+" "+label} value={r[field]} onChange={e=>updateRow(r.id,{[field]:Math.max(0,Number(e.target.value)||0)})}/>
   <div className="statusNumberSteppers"><button type="button" aria-label={r.game+" "+label+" 증가"} onClick={()=>adjustNumber(r.id,field,1)}>▲</button><button type="button" aria-label={r.game+" "+label+" 감소"} onClick={()=>adjustNumber(r.id,field,-1)}>▼</button></div>
 </div>;
 const posterSection=(venue:"dream"|"mm",name:string)=><section className="statusPosterSection statusEditableSection" key={venue}>
  <div className="statusEditableSectionHeading"><h3>{name}</h3><button type="button" onClick={()=>setRows(prev=>[...prev,makeRow(venue,"5M",0,0)])}>+ 경기 추가</button></div>
  <div className="statusPosterLabels"><span>GAME</span><span>TABLE</span><span>WAITING</span><span>STATUS</span></div>
  {rows.filter(r=>r.venue===venue).map(r=><div className="statusPosterRow statusDirectEditRow" key={r.id}>
    <input type="text" aria-label={r.game+" 게임명"} value={r.game} onChange={e=>updateRow(r.id,{game:e.target.value})} spellCheck={false}/>
    {numberEditor(r,"tables","테이블 수")}
    {numberEditor(r,"waiting","대기 인원")}
    <span className={"statusInlineState"+(r.tables>0?" statusRunning":"")}>{r.tables>0&&<span className="statusFire" aria-hidden="true">🔥</span>}{getStatus(r)}</span>
    <button type="button" className="statusInlineRemove" aria-label={r.game+" 경기 삭제"} title="경기 삭제" onClick={()=>setRows(prev=>prev.filter(x=>x.id!==r.id))}>×</button>
  </div>)}
 </section>;
 return <div className="builderShell statusBuilder statusDirectBuilder">
  <div className="builderHead"><div><p>포스터를 직접 클릭해 게임명·숫자를 수정하세요.</p></div>
   <div className="statusTopActions"><button type="button" className="statusCopyImage" onClick={()=>void copyPoster()}>이미지 복사</button><button type="button" className="statusQuickDownload" aria-label="PNG 다운로드" title="PNG 다운로드" onClick={()=>void download()}>↓</button><button type="button" onClick={applyLive}>운영 현황 불러오기</button></div>
  </div>
  <div className="statusDirectCanvas">
   <div className="statusPosterPreview"><div className="statusPosterGoldLine"/><div className="statusPosterTitleLine"><h2>실시간 테이블 현황</h2><p className="statusPosterTime">{displayTime} 기준</p></div>
   {posterSection("dream","DREAM POKER")}{posterSection("mm","MILLION MAKER")}
   <div className="statusDirectFooter"><textarea aria-label="예약 안내" value={footer} onChange={e=>setFooter(e.target.value)} rows={2}/><input aria-label="문의 문구" value={contact} onChange={e=>setContact(e.target.value)}/></div>
   </div>
  </div>
  <div className="statusDirectBottom"><details className="statusAdvanced"><summary>전광판 연동</summary><div className="builderMonitor"><div><strong>전광판 동기화</strong><span>{monitorFresh&&monitor?`연결됨 · ${monitor.tables.length}경기`:monitorError||"연동 대기"}</span></div><button type="button" disabled={!monitorFresh} onClick={applyMonitor}>경기 수 반영</button></div></details>
  <div className="builderActions"><button onClick={()=>void navigator.clipboard.writeText(text).then(()=>flash("문구 복사 완료")).catch(()=>flash("복사 실패"))}>문구 복사</button>{onSave&&<button onClick={()=>void save()}>자료실 저장</button>}</div></div>
  {feedback&&<p role="status">{feedback}</p>}<canvas ref={canvasRef} style={{display:"none"}}/>
 </div>;
}
