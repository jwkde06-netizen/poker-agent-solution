"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import StatusPosterBuilder from "./StatusPosterBuilder";

type LiveSession = {id:string;tableNo:string;gameNo:string;game:string;status:string};
type Item = {id:string;title:string;category:"poster"|"notice";body:string;image_url:string;created_at?:string};
const STORAGE_KEY="dream-poker-promotion-library-v1";

export default function PromotionLibrary({sessions,canEdit}:{sessions:LiveSession[];canEdit:boolean}) {
  const [items,setItems]=useState<Item[]>([]);
  const [category,setCategory]=useState<"all"|"poster"|"notice"|"live"|"builder">("builder");
  const [query,setQuery]=useState("");
  const [title,setTitle]=useState("");
  const [body,setBody]=useState("");
  const [editingId,setEditingId]=useState("");
  const [imageUrl,setImageUrl]=useState("");
  const [uploading,setUploading]=useState(false);
  const [dragging,setDragging]=useState(false);
  const [notice,setNotice]=useState("");
  const [connected,setConnected]=useState(false);
  const [draftLive,setDraftLive]=useState<string|null>(null);
  const liveText=useMemo(()=>["♠ DREAM POKER DA NANG","📍 Live Table Status",...sessions.filter(s=>s.status==="active").sort((a,b)=>Number(a.tableNo)-Number(b.tableNo)).map(s=>`• Table ${s.tableNo} · ${s.game} · No.${s.gameNo}`),sessions.some(s=>s.status==="active")?"문의 및 예약은 데스크로 연락주세요.":"현재 진행 중인 테이블이 없습니다."].join("\n"),[sessions]);
  useEffect(()=>{try{const cached=JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]");if(Array.isArray(cached))setItems(cached)}catch{}},[]);
  useEffect(()=>{
    if(!supabase)return;
    const client=supabase;
    let mounted=true;
    const fetchItems=async()=>{
      const {data,error}=await client.from("promotion_items").select("id,title,category,body,image_url,created_at").order("created_at",{ascending:false});
      if(!mounted)return;
      if(!error){setConnected(true);setItems((data||[]) as Item[])}
    };
    void fetchItems();
    const channel=client.channel("promotion-library").on("postgres_changes",{event:"*",schema:"public",table:"promotion_items"},()=>{void fetchItems()}).subscribe();
    return()=>{mounted=false;void client.removeChannel(channel)};
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
    if(!["image/png","image/jpeg","image/webp"].includes(file.type)){flash("이미지 파일만 업로드할 수 있습니다.");return}
    if(file.size>10*1024*1024){flash("이미지는 10MB 이하로 업로드해주세요.");return}
    setUploading(true);
    const safeExt=(file.name.split(".").pop()||"png").replace(/[^a-z0-9]/gi,"").toLowerCase()||"png";
    const path=`${crypto.randomUUID()}.${safeExt}`;
    const {error}=await supabase.storage.from("promotion-posters").upload(path,file,{contentType:file.type});
    if(error){flash("포스터 업로드 실패: "+error.message);setUploading(false);return}
    const url=supabase.storage.from("promotion-posters").getPublicUrl(path).data.publicUrl;
    setImageUrl(url);if(!title)setTitle(file.name.replace(/\.[^.]+$/,""));setUploading(false);
  }
  async function saveGenerated(title:string,body:string,blob:Blob){
    if(!canEdit||!supabase||!connected)throw new Error("관리자 서버 자료실 연결이 필요합니다.");
    const path=crypto.randomUUID()+".png";
    const uploaded=await supabase.storage.from("promotion-posters").upload(path,blob,{contentType:"image/png"});
    if(uploaded.error)throw uploaded.error;
    const image_url=supabase.storage.from("promotion-posters").getPublicUrl(path).data.publicUrl;
    const item:Item={id:crypto.randomUUID(),title,body,category:"poster",image_url};
    const {error}=await supabase.from("promotion_items").insert(item);
    if(error)throw error;
    setItems(prev=>[item,...prev]);
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

  const posters=items.filter(i=>i.category==="poster"&&(i.title+" "+i.body).toLowerCase().includes(query.toLowerCase()));
  const snippets=items.filter(i=>i.category==="notice"&&(i.title+" "+i.body).toLowerCase().includes(query.toLowerCase()));
  const buttonStyle={padding:"9px 13px",borderRadius:9,border:"1px solid var(--border-color, #7775)",cursor:"pointer"};
  const clearForm=()=>{setTitle("");setBody("");setImageUrl("");setEditingId("")};
  return <section className="panel promotionWorkspace">
    <header className="promotionWorkspaceHeader">
      <div><h2>홍보 자료실</h2><p>현황 업데이트부터 포스터 제작·공유까지 한곳에서</p></div>
      <span className={"promotionConnection"+(connected?" isConnected":"")}>{connected?"● 공유 자료실 연결":"○ 이 기기 임시 저장"}</span>
    </header>
    {notice&&<p className="promotionNotice" role="status">{notice}</p>}
    <section className="promotionPrimary" aria-label="현황 포스터 제작">
      <StatusPosterBuilder sessions={sessions} onSave={canEdit?saveGenerated:undefined}/>
    </section>
    <div className="promotionSecondary" id="promotion-library">
      <section className="promotionUtility">
        <div className="promotionUtilityHead"><div><h3>포스터 업로드</h3><p>이미지를 업로드하고 자료실에 저장하세요.</p></div><span>01</span></div>
        {canEdit?<div className="promotionUtilityBody">
          <div className={"posterDropZone"+(dragging?" dragging":"")} onDragEnter={e=>{e.preventDefault();setDragging(true)}} onDragOver={e=>{e.preventDefault();setDragging(true)}} onDragLeave={e=>{e.preventDefault();setDragging(false)}} onDrop={e=>{e.preventDefault();setDragging(false);void upload(e.dataTransfer.files[0])}}>
            <label><strong>포스터 파일 선택 또는 드래그</strong><span>PNG · JPG · WEBP / 최대 10MB</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>void upload(e.target.files?.[0])}/></label>
            {imageUrl&&<img src={imageUrl} alt="업로드한 포스터" className="promotionUploadedPreview"/>}
          </div>
          <input className="promotionField" value={title} onChange={e=>setTitle(e.target.value)} placeholder="포스터 제목" aria-label="포스터 제목"/>
          <textarea className="promotionField" rows={2} value={body} onChange={e=>setBody(e.target.value)} placeholder="설명 또는 함께 보낼 문구 (선택)" aria-label="포스터 설명"/>
          <div className="promotionButtonRow"><button className="promotionMainButton" style={buttonStyle} disabled={uploading} onClick={()=>void save()}>{uploading?"업로드 중...":editingId?"수정 저장":"자료 저장"}</button>{editingId&&<button style={buttonStyle} onClick={clearForm}>취소</button>}</div>
        </div>:<p className="promotionUtilityHint">포스터 업로드는 관리자 계정에서 사용할 수 있습니다.</p>}
      </section>
      <section className="promotionUtility">
        <div className="promotionUtilityHead"><div><h3>공지문 클립보드</h3><p>현황 문구를 바로 복사하거나 자주 쓰는 문구를 관리합니다.</p></div><span>02</span></div>
        <div className="promotionUtilityBody">
          <div className="promotionClipboardQuick"><div><strong>현재 LIVE 게임 현황</strong><span>진행 중인 게임 정보를 바탕으로 자동 작성</span></div><button style={buttonStyle} onClick={()=>void copy(draftLive??liveText)}>복사</button></div>
          <details className="promotionClipboardDetails"><summary>현황 문구 확인 · 수정</summary><textarea rows={5} value={draftLive??liveText} onChange={e=>setDraftLive(e.target.value)}/><button style={buttonStyle} onClick={()=>setDraftLive(null)}>최신 내용으로 복원</button></details>
          <div className="promotionSnippetList">{snippets.slice(0,5).map(item=><div className="promotionSnippet" key={item.id}><div><strong>{item.title}</strong><span>{item.body}</span></div><button style={buttonStyle} onClick={()=>void copy(item.body)}>복사</button></div>)}</div>
          {!snippets.length&&<p className="promotionUtilityHint">저장된 공지문이 없습니다. 아래 자료 목록에서 공지문을 등록할 수 있습니다.</p>}
        </div>
      </section>
    </div>
    <section className="promotionArchive">
      <div className="promotionArchiveHead"><div><h3>저장된 자료</h3><p>포스터와 공지문을 한눈에 확인하고 재사용하세요.</p></div><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="자료 검색" aria-label="자료 검색"/></div>
      <div className="promotionArchiveGrid">
        {[...posters,...snippets].map(item=><article className="promotionArchiveCard" key={item.id}>
          {item.image_url?<img src={item.image_url} alt={item.title}/>:<div className="promotionTextCard">{item.body.slice(0,180)}</div>}
          <strong>{item.title}</strong>
          <div className="promotionCardActions">
            {item.body&&<button style={buttonStyle} onClick={()=>void copy(item.body)}>문구 복사</button>}
            {item.image_url&&<><button style={buttonStyle} onClick={()=>void copyImage(item.image_url)}>이미지 복사</button><a style={buttonStyle} href={item.image_url} target="_blank" rel="noreferrer">원본 보기</a></>}
            {canEdit&&<><button style={buttonStyle} onClick={()=>{setEditingId(item.id);setTitle(item.title);setBody(item.body);setImageUrl(item.image_url);document.getElementById("promotion-library")?.scrollIntoView({behavior:"smooth"})}}>수정</button><button style={buttonStyle} onClick={()=>void remove(item)}>삭제</button></>}
          </div>
        </article>)}
      </div>
      {!posters.length&&!snippets.length&&<p className="promotionUtilityHint">등록된 자료가 없습니다.</p>}
    </section>
  </section>;
}
