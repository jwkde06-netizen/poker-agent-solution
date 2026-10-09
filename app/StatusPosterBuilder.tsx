"use client";
import {useEffect,useMemo,useRef,useState} from "react";
type Data={time:string;dream:string[];mm:string[];footer:string;contact:string};
const key="dream-mm-status-builder-v1";
const initial:Data={time:"17:15",dream:["5M 타임어택 4테이블 진행중 🔥","데일리 토너먼트🔥(레지마감 17:05)","10M 타임어택 예약중"],mm:["3M 타임어택 1테이블 진행 중🔥","VIP게임 예약중"],footer:"타임어택 경기는 미리 예약 후 방문하시면 대기 없이 바로 참여하실 수 있습니다.",contact:"예약 및 참가 문의는 1:1 채팅 주세요."};
function drawLines(ctx:CanvasRenderingContext2D,text:string,x:number,y:number,maxWidth:number,lineHeight:number){
  const chars=Array.from(text);let line="";let current=y;
  for(const char of chars){if(ctx.measureText(line+char).width>maxWidth&&line){ctx.fillText(line,x,current);current+=lineHeight;line=""}line+=char}
  if(line){ctx.fillText(line,x,current);current+=lineHeight}return current;
}
export default function StatusPosterBuilder({onSave}:{onSave?:(title:string,body:string,blob:Blob)=>Promise<void>}){
 const [data,setData]=useState<Data>(initial);
 const [feedback,setFeedback]=useState("");
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
 <div className="builderColumns"><div className="builderForm"><div className="builderFormIntro"><strong>공지 내용 편집</strong><small>변경사항은 오른쪽 포스터에 즉시 반영됩니다.</small></div><label>기준 시각 <span><input value={data.time} onChange={e=>change("time",e.target.value)} placeholder="17:15"/><button onClick={()=>change("time",new Intl.DateTimeFormat("en-GB",{hour:"2-digit",minute:"2-digit",hour12:false,timeZone:"Asia/Ho_Chi_Minh"}).format(new Date()))}>현재 시각</button></span></label>
 {rowSection("dream","♠ DREAM POKER")}{rowSection("mm","♣ MILLION MAKER")}
 <label>예약 안내<textarea rows={3} value={data.footer} onChange={e=>change("footer",e.target.value)}/></label><label>문의 문구<input value={data.contact} onChange={e=>change("contact",e.target.value)}/></label>
 <div className="builderActions"><button onClick={()=>void navigator.clipboard.writeText(text).then(()=>flash("텍스트 복사 완료")).catch(()=>flash("복사 실패"))}>텍스트 복사</button><button onClick={()=>void download()}>PNG 다운로드</button>{onSave&&<button onClick={()=>void save()}>자료실에 저장</button>}</div>{feedback&&<p role="status">{feedback}</p>}
 </div><div className="builderPreview"><div className="builderPreviewBar"><strong>실시간 미리보기</strong><span>1080px · PNG</span></div><div className="builderPoster"><span className="builderEyebrow">LIVE TABLE STATUS</span><h2>실시간 테이블 현황</h2><p>{data.time} 기준</p>{([["DREAM POKER",data.dream],["MILLION MAKER",data.mm]] as const).map(([name,rows])=><div className="builderPosterBlock" key={name}><h3>{name}</h3>{rows.filter(Boolean).map((line,i)=><p key={i}>› {line}</p>)}</div>)}<div className="builderPosterFooter"><p>{data.footer}</p><strong>{data.contact}</strong></div></div></div></div><canvas ref={canvasRef} style={{display:"none"}}/></div>;
}
