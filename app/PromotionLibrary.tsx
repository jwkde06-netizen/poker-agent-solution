"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type LiveSession = {id:string;tableNo:string;gameNo:string;game:string;status:string};
type Item = {id:string;title:string;category:"poster"|"notice";body:string;image_url:string;created_at?:string};
const STORAGE_KEY="dream-poker-promotion-library-v1";

export default function PromotionLibrary({sessions,canEdit}:{sessions:LiveSession[];canEdit:boolean}) {
  const [items,setItems]=useState<Item[]>([]);
  const [category,setCategory]=useState<"all"|"poster"|"notice"|"live">("all");
  const [query,setQuery]=useState("");
  const [title,setTitle]=useState("");
  const [body,setBody]=useState("");
  const [editingId,setEditingId]=useState("");
  const [imageUrl,setImageUrl]=useState("");
  const [uploading,setUploading]=useState(false);
  const [notice,setNotice]=useState("");
  const [connected,setConnected]=useState(false);
  const [draftLive,setDraftLive]=useState<string|null>(null);
  const liveText=useMemo(()=>["♠ DREAM POKER DA NANG","📍 Live Table Status",...sessions.filter(s=>s.status==="active").sort((a,b)=>Number(a.tableNo)-Number(b.tableNo)).map(s=>`• Table ${s.tableNo} · ${s.game} · No.${s.gameNo}`),sessions.some(s=>s.status==="active")?"문의 및 예약은 데스크로 연락주세요.":"현재 진행 중인 테이블이 없습니다."].join("\n"),[sessions]);
  useEffect(()=>{try{const cached=JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]");if(Array.isArray(cached))setItems(cached)}catch{}},[]);
  useEffect(()=>{
    if(!supabase)return;
    let mounted=true;
    const fetchItems=async()=>{
      const {data,error}=await supabase.from("promotion_items").select("id,title,category,body,image_url,created_at").order("created_at",{ascending:false});
      if(!mounted)return;
      if(!error){setConnected(true);setItems((data||[]) as Item[])}
    };
    void fetchItems();
    const channel=supabase.channel("promotion-library").on("postgres_changes",{event:"*",schema:"public",table:"promotion_items"},()=>{void fetchItems()}).subscribe();
    return()=>{mounted=false;void supabase?.removeChannel(channel)};
  },[]);
  useEffect(()=>{if(!connected){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(items))}catch{}}},[items,connected]);
  const flash=(t:string)=>{setNotice(t);window.setTimeout(()=>setNotice(""),2800)};
  async function copy(text:string){try{await navigator.clipboard.writeText(text);flash("텍스트 복사 완료")}catch{flash("복사에 실패했습니다. 브라우저 권한을 확인해주세요.")}}
  async function save(){
    if(!canEdit)return;
    if(!title.trim()){flash("제목을 입력해주세요.");return}
    const item:Item={id:editingId||crypto.randomUUID(),title:title.trim(),body,category:imageUrl?"poster":"notice",image_url:imageUrl};
    if(connected&&supabase){
      const {error}=await supabase.from("promotion_items").upsert(item);
      if(error){flash("저장 실패: "+error.message);return}
    }
    setItems(old=>[item,...old.filter(x=>x.id!==item.id)]);
    setTitle("");setBody("");setImageUrl("");setEditingId("");flash(connected?"저장 완료":"이 기기에 저장했습니다. 서버 자료실 테이블 연결이 필요합니다.");
  }
  async function remove(item:Item){
    if(!canEdit||!window.confirm("삭제하시겠습니까?"))return;
    if(connected&&supabase){const {error}=await supabase.from("promotion_items").delete().eq("id",item.id);if(error){flash(error.message);return}}
    setItems(old=>old.filter(x=>x.id!==item.id));
  }
  async function upload(file:File|undefined){
    if(!file||!supabase)return;
    if(!file.type.startsWith("image/")){flash("이미지 파일만 업로드할 수 있습니다.");return}
    if(file.size>10*1024*1024){flash("이미지는 10MB 이하로 업로드해주세요.");return}
    setUploading(true);
    const safeExt=(file.name.split(".").pop()||"png").replace(/[^a-z0-9]/gi,"").toLowerCase()||"png";
    const path=`${crypto.randomUUID()}.${safeExt}`;
    const {error}=await supabase.storage.from("promotion-posters").upload(path,file,{contentType:file.type});
    if(error){flash("포스터 업로드 실패: "+error.message);setUploading(false);return}
    const url=supabase.storage.from("promotion-posters").getPublicUrl(path).data.publicUrl;
    setImageUrl(url);if(!title)setTitle(file.name.replace(/\.[^.]+$/,""));setUploading(false);
  }
  async function copyImage(url:string){
    try{
      const res=await fetch(url);const blob=await res.blob();
      const png=blob.type==="image/png"?blob:await new Promise<Blob>((resolve,reject)=>{
        const img=new Image();img.crossOrigin="anonymous";img.onload=()=>{const canvas=document.createElement("canvas");canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;canvas.getContext("2d")?.drawImage(img,0,0);canvas.toBlob(b=>b?resolve(b):reject(new Error("변환 실패")),"image/png")};img.onerror=reject;img.src=url;
      });
      await navigator.clipboard.write([new ClipboardItem({"image/png":png})]);flash("이미지 복사 완료");
    }catch{flash("이 브라우저는 이미지 복사를 지원하지 않습니다. 다운로드를 이용해주세요.")}
  }
  const visible=items.filter(i=>(category==="all"||(category==="poster"&&i.category==="poster")||(category==="notice"&&i.category==="notice"))&&(i.title+" "+i.body).toLowerCase().includes(query.toLowerCase()));
  const buttonStyle={padding:"9px 13px",borderRadius:8,border:"1px solid var(--border-color, #7775)",cursor:"pointer"};
  return <section className="panel" style={{padding:24,maxWidth:1250,margin:"0 auto"}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
      <div><h2 style={{margin:"0 0 5px"}}>홍보 자료실</h2><p style={{margin:0,opacity:.65}}>포스터 · 홍보 문구 · 실시간 게임 현황</p></div>
      <span style={{fontSize:12,opacity:.65}}>{connected?"공유 자료실 연결됨":"이 기기 임시 저장 · 서버 연결 필요"}</span>
    </div>
    <div style={{display:"flex",gap:8,flexWrap:"wrap",margin:"24px 0 16px"}}>
      {([["all","전체"],["poster","포스터"],["notice","공지 템플릿"],["live","실시간 현황"]] as const).map(([key,label])=><button key={key} style={{...buttonStyle,background:category===key?"var(--accent, #334155)":"transparent",color:category===key?"white":"inherit"}} onClick={()=>setCategory(key)}>{label}</button>)}
    </div>
    {notice&&<p role="status" style={{fontSize:13}}>{notice}</p>}
    {category==="live"?<div style={{display:"grid",gap:12}}>
      <h3 style={{margin:0}}>LIVE 테이블 현황 공지</h3>
      <p style={{margin:0,opacity:.7,fontSize:13}}>현재 운영 중인 게임을 기준으로 자동 작성합니다. 수정한 문구는 아래에서 복사할 수 있습니다.</p>
      <textarea rows={Math.max(6,sessions.length+4)} value={draftLive??liveText} onChange={e=>setDraftLive(e.target.value)} style={{width:"100%",padding:14,borderRadius:10,boxSizing:"border-box"}}/>
      <div style={{display:"flex",gap:8}}><button style={buttonStyle} onClick={()=>setDraftLive(null)}>최신 현황 불러오기</button><button style={buttonStyle} onClick={()=>void copy(draftLive??liveText)}>공지문 복사</button></div>
    </div>:<>
      <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="자료 검색" style={{width:"100%",padding:12,borderRadius:9,boxSizing:"border-box",marginBottom:16}}/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(min(100%, 280px),1fr))",gap:14}}>
        {visible.map(item=><article key={item.id} style={{border:"1px solid #8884",borderRadius:12,padding:14,minWidth:0}}>
          {item.image_url&&<img src={item.image_url} alt={item.title} style={{width:"100%",height:185,objectFit:"contain",borderRadius:8,background:"#8881"}}/>}
          <h3 style={{margin:"10px 0"}}>{item.title}</h3>
          {item.body&&<p style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere",fontSize:13,maxHeight:160,overflow:"auto"}}>{item.body}</p>}
          <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
            {item.body&&<button style={buttonStyle} onClick={()=>void copy(item.body)}>문구 복사</button>}
            {item.image_url&&<><button style={buttonStyle} onClick={()=>void copyImage(item.image_url)}>이미지 복사</button><a style={buttonStyle} href={item.image_url} target="_blank" rel="noreferrer">원본 보기 / 저장</a></>}
            {canEdit&&<><button style={buttonStyle} onClick={()=>{setEditingId(item.id);setTitle(item.title);setBody(item.body);setImageUrl(item.image_url)}}>수정</button><button style={buttonStyle} onClick={()=>void remove(item)}>삭제</button></>}
          </div>
        </article>)}
      </div>
      {!visible.length&&<p style={{opacity:.65}}>등록된 자료가 없습니다.</p>}
      {canEdit&&<div style={{borderTop:"1px solid #8884",marginTop:24,paddingTop:20,display:"grid",gap:10}}>
        <h3>{editingId?"자료 수정":"새 자료 등록"}</h3>
        <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="자료 제목" style={{padding:12,borderRadius:8}}/>
        <textarea rows={5} value={body} onChange={e=>setBody(e.target.value)} placeholder="공지문 내용 (포스터 설명도 입력 가능)" style={{padding:12,borderRadius:8}}/>
        <label style={{fontSize:13}}>포스터 이미지 업로드 <input type="file" accept="image/*" onChange={e=>void upload(e.target.files?.[0])}/></label>
        {imageUrl&&<span style={{fontSize:12}}>포스터 준비됨 · <button onClick={()=>setImageUrl("")}>제거</button></span>}
        <div style={{display:"flex",gap:8}}><button style={buttonStyle} disabled={uploading} onClick={()=>void save()}>{uploading?"업로드 중...":editingId?"수정 저장":"자료 저장"}</button>{editingId&&<button style={buttonStyle} onClick={()=>{setEditingId("");setTitle("");setBody("");setImageUrl("")}}>취소</button>}</div>
      </div>}
    </>}
  </section>;
}
