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
 const [data,setData]=useState<Data>(initial);
 const activeDream=sessions.filter(s=>s.status==="active");
 const fiveM=activeDream.filter(s=>/^5\s*M\b/i.test(s.game.trim()));
 const dreamSummary=fiveM.length?`5M 타임어택 ${fiveM.length}테이블 진행 중 🔥`:"5M 타임어택 진행 테이블 없음";
 const tableSummary=fiveM.map(s=>`T${s.tableNo} No.${s.gameNo||"-"}`).join(" · ");
 const applyLive=()=>{
   const other=activeDream.filter(s=>!/^5\s*M\b/i.test(s.game.trim())).map(s=>`${s.game} · T${s.tableNo} No.${s.gameNo||"-"} 진행 중`);
   const now=new Intl.DateTimeFormat("en-GB",{hour:"2-digit",minute:"2-digit",hour12:false,timeZone:"Asia/Ho_Chi_Minh"}).format(new Date());
   setData(p=>({...p,time:now,dream:[dreamSummary,...(tableSummary?["테이블 "+tableSummary]:[]),...other]}));
   flash("현재 Dream 게임 현황을 적용했습니다. MM과 예약 항목은 별도로 확인해주세요.");
 };
 const [feedback,setFeedback]=useState("");
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
 const applyMonitor=()=>{
   if(!monitor||!monitorFresh){flash("최신 전광판 동기화 데이터가 없습니다.");return}
   const entries=monitor.tables.filter(t=>t.game);
   const fives=entries.filter(t=>/^5\s*M\b/i.test(t.game));
   const summary=fives.length?`5M 타임어택 ${fives.length}테이블 진행 중 🔥`:"5M 진행 테이블 없음";
   const details=entries.map(t=>`${t.table_no?`T${t.table_no} · `:""}${t.event_name||t.game}${t.level===null?"":` · Lv.${t.level}`}${t.entries===null?"":` · Entry ${t.entries_display||t.entries}`}${t.blinds?` · ${t.blinds}`:""}`);
   const time=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Ho_Chi_Minh",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date());
   setData(p=>({...p,time,dream:[summary,...details]}));
   flash("전광판 최신 데이터 적용 완료");
 };

 const canvasRef=useRef<HTMLCanvasElement>(null);
 const change=(field:keyof Data,value:string)=>setData(p=>({...p,[field]:value}));
 useEffect(()=>{try{const saved=localStorage.getItem(key);if(saved){const parsed=JSON.parse(saved);setData({...initial,...parsed})}}catch{}},[]);
 useEffect(()=>{localStorage.setItem(key,JSON.stringify(data))},[data]);
 const text=useMemo(()=>["📢 실시간 테이블 현황",data.time+" 기준","","♠️ DREAM POKER","",...data.dream.filter(Boolean).map(x=>"➡️ "+x),"","♣️ MILLION MAKER","",...data.mm.filter(Boolean).map(x=>"➡️ "+x),"","📌 "+data.footer,"",data.contact].join("\n"),[data]);
 const modify=(side:"dream"|"mm",index:number,value:string)=>setData(p=>({...p,[side]:p[side].map((v,i)=>i===index?value:v)}));
 const move=(side:"dream"|"mm",index:number,dir:number)=>setData(p=>{const next=[...p[side]];const to=index+dir;if(to<0||to>=next.length)return p;[next[index],next[to]]=[next[to],next[index]];return {...p,[side]:next}});
 const flash=(msg:string)=>{setFeedback(msg);window.setTimeout(()=>setFeedback(""),2800)};
 function renderPoster(){
  const canvas=canvasRef.current;if(!canvas)throw new Error("Canvas unavailable");
  const ctx=canvas.getContext("2d");if(!ctx)throw new Error("Canvas unavailable");
  const W=1080,pad=80,usable=W-pad*2;
  canvas.width=W;canvas.height=1650;
  ctx.fillStyle="#101419";ctx.fillRect(0,0,W,1650);
  const gradient=ctx.createLinearGradient(0,0,W,950);gradient.addColorStop(0,"#252d38");gradient.addColorStop(1,"#101419");ctx.fillStyle=gradient;ctx.fillRect(0,0,W,1650);
  ctx.fillStyle="#d4a948";ctx.fillRect(pad,74,100,6);
  ctx.fillStyle="#faf8f3";ctx.font="bold 62px sans-serif";ctx.fillText("LIVE TABLE STATUS",pad,164);
  ctx.fillStyle="#d6bd80";ctx.font="bold 37px sans-serif";ctx.fillText("실시간 테이블 현황",pad,225);
  ctx.fillStyle="#b9c0c9";ctx.font="30px sans-serif";ctx.fillText(data.time+" 기준",pad,285);
  let y=338;
  const sections:[string,string[]][]=[["DREAM POKER",data.dream],["MILLION MAKER",data.mm]];
  for(const [name,rows] of sections){
   const top=y;ctx.font="31px sans-serif";
   const heights=rows.filter(Boolean).map(line=>Math.max(52,Math.ceil(ctx.measureText(line).width/(usable-105))*48+20));
   const h=110+heights.reduce((a,b)=>a+b,0)+26;
   ctx.fillStyle="#202731";ctx.beginPath();ctx.roundRect(pad,top,usable,h,24);ctx.fill();
   ctx.fillStyle="#d1a045";ctx.fillRect(pad+24,top+24,5,49);
   ctx.fillStyle="#f5e4ba";ctx.font="bold 40px sans-serif";ctx.fillText(name,pad+52,top+68);
   let yy=top+126;
   for(const line of rows.filter(Boolean)){
    ctx.fillStyle="#e2b24d";ctx.font="bold 28px sans-serif";ctx.fillText("›",pad+40,yy);
    ctx.fillStyle="#f4f5f7";ctx.font="30px sans-serif";
    yy=drawLines(ctx,line,pad+78,yy,usable-125,47)+12;
   }
   y+=h+26;
  }
  ctx.fillStyle="#dbb465";ctx.fillRect(pad,y+10,usable,2);
  ctx.fillStyle="#d4d9de";ctx.font="28px sans-serif";y=drawLines(ctx,data.footer,pad,y+72,usable,43);
  ctx.fillStyle="#f9d681";ctx.font="bold 30px sans-serif";y=drawLines(ctx,data.contact,pad,y+45,usable,45);
  // The canvas is intentionally fixed-height for stable exports.
  return canvas;
 }
 async function getPng(){
  const canvas=canvasRef.current;if(!canvas)throw new Error("No canvas");
  const ctx=canvas.getContext("2d");if(!ctx)throw new Error("No canvas");
  // Draw to a tall canvas, then crop safely without losing painted content.
  renderPoster();
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("PNG export failed")),"image/png"));
  return blob;
 }
 const download=async()=>{try{const blob=await getPng();const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="Dream-MM-LIVE-"+data.time.replace(":","")+".png";a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);flash("PNG 다운로드 완료")}catch(e){flash(String(e))}};
 const save=async()=>{if(!onSave)return;try{await onSave("Dream & MM 실시간 현황 "+data.time,text,await getPng());flash("자료실에 저장 완료")}catch(e){flash("저장 실패: "+String(e))}};
 const rowSection=(side:"dream"|"mm",label:string)=><div className="builderSection"><div className="builderSectionTitle"><h3>{label}</h3><span>{data[side].length}개 항목</span></div>{data[side].map((line,i)=><div className="builderRow" key={i}><input aria-label={label+" 항목 "+(i+1)} value={line} onChange={e=>modify(side,i,e.target.value)}/><div className="builderRowTools"><button onClick={()=>move(side,i,-1)} title="위로" aria-label="위로 이동">↑</button><button onClick={()=>move(side,i,1)} title="아래로" aria-label="아래로 이동">↓</button><button onClick={()=>setData(p=>({...p,[side]:p[side].filter((_,j)=>j!==i)}))} title="삭제" aria-label="항목 삭제">×</button></div></div>)}<button onClick={()=>setData(p=>({...p,[side]:[...p[side],""]}))}>+ 항목 추가</button></div>;
 return <div className="builderShell"><div className="builderHead"><div><h2>Dream & MM 현황 포스터 생성기</h2><p>문구를 변경한 뒤 텍스트 복사 또는 PNG로 저장하세요.</p></div><button onClick={()=>setData(initial)}>기본 양식 복원</button></div>
 <div className="builderColumns"><div className="builderForm"><div className="builderFormIntro"><strong>빠른 현황 업데이트</strong><small>Dream 게임 입력 기준 · 테이블 ${activeDream.length}개 운영 중</small></div><div className="builderMonitor"><div><strong>블라인드 전광판 연동</strong><span>{monitorFresh&&monitor?`연결됨 · ${monitor.tables.length}개 경기 · 최근 업데이트 ${new Date(monitor.observed_at).toLocaleTimeString("ko-KR",{timeZone:"Asia/Ho_Chi_Minh"})}`:monitorError||"동기화 대기 · 매장 PC 브리지 실행 필요"}</span></div><button type="button" disabled={!monitorFresh} onClick={applyMonitor}>레벨·엔트리 반영</button></div><div className="builderQuickSync"><div><b>5M ${fiveM.length}테이블 진행</b><span>${tableSummary||"진행 중인 5M 테이블 없음"}</span></div><button type="button" onClick={applyLive}>현황 자동 입력</button></div><p className="builderSourceNotice">블라인드 레벨은 매장 현황판 연결 전까지 자동 입력하지 않습니다. 현황판: 192.168.1.9:8080 (매장 Wi-Fi)</p><label>기준 시각 <span><input value={data.time} onChange={e=>change("time",e.target.value)} placeholder="17:15"/><button onClick={()=>change("time",new Intl.DateTimeFormat("en-GB",{hour:"2-digit",minute:"2-digit",hour12:false,timeZone:"Asia/Ho_Chi_Minh"}).format(new Date()))}>현재 시각</button></span></label>
 {rowSection("dream","♠ DREAM POKER")}{rowSection("mm","♣ MILLION MAKER")}
 <label>예약 안내<textarea rows={3} value={data.footer} onChange={e=>change("footer",e.target.value)}/></label><label>문의 문구<input value={data.contact} onChange={e=>change("contact",e.target.value)}/></label>
 <div className="builderActions"><button onClick={()=>void navigator.clipboard.writeText(text).then(()=>flash("텍스트 복사 완료")).catch(()=>flash("복사 실패"))}>텍스트 복사</button><button onClick={()=>void download()}>PNG 다운로드</button>{onSave&&<button onClick={()=>void save()}>자료실에 저장</button>}</div>{feedback&&<p role="status">{feedback}</p>}
 </div><div className="builderPreview"><div className="builderPreviewBar"><strong>실시간 미리보기</strong><span>1080px · PNG</span></div><div className="builderPoster"><span className="builderEyebrow">LIVE TABLE STATUS</span><h2>실시간 테이블 현황</h2><p>{data.time} 기준</p>{([["DREAM POKER",data.dream],["MILLION MAKER",data.mm]] as const).map(([name,rows])=><div className="builderPosterBlock" key={name}><h3>{name}</h3>{rows.filter(Boolean).map((line,i)=><p key={i}>› {line}</p>)}</div>)}<div className="builderPosterFooter"><p>{data.footer}</p><strong>{data.contact}</strong></div></div></div></div><canvas ref={canvasRef} style={{display:"none"}}/></div>;
}
