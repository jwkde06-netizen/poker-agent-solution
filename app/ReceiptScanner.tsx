'use client';
import {useEffect,useRef,useState} from 'react';
import {db} from '../lib/db';
import {nativeCamera,receiptImage} from '../lib/receipt-image';
import styles from './ReceiptScanner.module.css';
export default function ReceiptScanner({disabled,day,onReview}:{disabled:boolean;day:string;onReview:(result:any,signal:AbortSignal)=>Promise<void>}){
 const [open,setOpen]=useState(false),[photo,setPhoto]=useState(''),[error,setError]=useState(''),[stage,setStage]=useState(''),[stream,setStream]=useState<MediaStream|null>(null);
 const dialog=useRef<HTMLDialogElement>(null),video=useRef<HTMLVideoElement>(null),file=useRef<HTMLInputElement>(null),cameraFile=useRef<HTMLInputElement>(null),media=useRef<MediaStream|null>(null),generation=useRef(0),abort=useRef<AbortController|null>(null),trigger=useRef<HTMLButtonElement>(null);
 const stop=()=>{media.current?.getTracks().forEach(t=>t.stop());media.current=null;setStream(null);};
 const close=()=>{generation.current++;abort.current?.abort();stop();setOpen(false);setPhoto('');setStage('');setError('');trigger.current?.focus();};
 useEffect(()=>{if(open)dialog.current?.showModal();else dialog.current?.close();},[open]);
 useEffect(()=>{if(video.current&&stream){video.current.srcObject=stream;void video.current.play().catch(()=>setError('카메라 재생을 시작하지 못했습니다. 사진을 선택해주세요.'));}},[stream]);
 useEffect(()=>()=>{generation.current++;abort.current?.abort();media.current?.getTracks().forEach(t=>t.stop());},[]);
 async function startCamera(){
  const current=++generation.current;stop();setPhoto('');setError('');setStage('camera');
  try{
   if(!navigator.mediaDevices?.getUserMedia)throw Error('이 브라우저에서 카메라를 열 수 없습니다. 사진을 선택해주세요.');
   const next=await navigator.mediaDevices.getUserMedia({audio:false,video:{width:{ideal:1920},height:{ideal:1080},facingMode:{ideal:'environment'}}});
   if(current!==generation.current){next.getTracks().forEach(t=>t.stop());return;}
   media.current=next;setStream(next);setStage('');
  }catch(e){if(current===generation.current){setStage('');setError(e instanceof DOMException&&e.name==='NotAllowedError'?'카메라 권한이 꺼져 있습니다. 주소창에서 허용하거나 사진을 선택해주세요.':e instanceof DOMException&&e.name==='NotFoundError'?'연결된 웹캠이 없습니다. 사진을 선택해주세요.':(e as Error).message);}}
 }
 function launch(){setOpen(true);setPhoto('');setError('');if(nativeCamera(navigator.userAgent,navigator.maxTouchPoints)){cameraFile.current?.click();}else void startCamera();}
 async function selectPhoto(blob?:Blob){
  if(!blob)return;const current=++generation.current;stop();setStage('image');setError('');
  try{const data=await receiptImage(blob);if(current===generation.current)setPhoto(data);}catch(e){if(current===generation.current)setError((e as Error).message);}finally{if(current===generation.current)setStage('');}
 }
 async function capture(){
  const current=generation.current,v=video.current;if(!v?.videoWidth||!v.videoHeight){setError('카메라 화면을 기다려주세요.');return;}
  const canvas=document.createElement('canvas');canvas.width=v.videoWidth;canvas.height=v.videoHeight;canvas.getContext('2d')?.drawImage(v,0,0);
  canvas.toBlob(blob=>{if(current!==generation.current)return;if(blob)void selectPhoto(blob);else setError('촬영하지 못했습니다. 다시 시도해주세요.');},'image/jpeg',.95);
 }
 async function analyze(){
  if(!photo||stage)return;const current=++generation.current,controller=new AbortController();abort.current=controller;setStage('reading');setError('');const timer=setTimeout(()=>controller.abort(),115000);
  try{
   const session=(await db?.auth.getSession())?.data.session;if(!session)throw Error('관리자 계정으로 로그인해주세요.');
   const r=await fetch('/api/operations/scan',{method:'POST',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({day,image:photo}),signal:controller.signal});
   const result=await r.json();if(!r.ok)throw Error(result.error||'사진을 읽지 못했습니다.');
   if(current!==generation.current)return;await onReview(result,controller.signal);if(current===generation.current)close();
  }catch(e){if(current===generation.current)setError(controller.signal.aborted?'사진 판독 응답이 늦어졌습니다. 다시 시도해주세요.':(e as Error).message);}finally{clearTimeout(timer);if(current===generation.current)setStage('');}
 }
 return <>
  <button ref={trigger} type='button' disabled={disabled} className={styles.trigger} onClick={launch}><svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'><path d='M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z'/><circle cx='12' cy='13' r='4'/></svg>스캔</button>
  <input className={styles.file} ref={cameraFile} type='file' accept='image/*' capture='environment' aria-label='카메라로 바이인 시트 촬영' onChange={e=>{void selectPhoto(e.target.files?.[0]);e.target.value='';}}/>
  <input className={styles.file} ref={file} type='file' accept='image/*' aria-label='바이인 시트 사진 선택' onChange={e=>{void selectPhoto(e.target.files?.[0]);e.target.value='';}}/>
  <dialog ref={dialog} className={styles.dialog} aria-labelledby='receipt-scan-title' onCancel={e=>{e.preventDefault();close();}}>
   <header><h2 id='receipt-scan-title'>바이인 시트 스캔</h2><button type='button' onClick={close} aria-label='스캔 닫기'>×</button></header>
   <div className={styles.preview}>{photo?<img src={photo} alt='촬영한 바이인 시트'/>:stream?<video ref={video} autoPlay playsInline muted aria-label='웹캠 미리보기'/>:<p>{stage==='camera'?'카메라를 여는 중입니다.':'시트 전체가 보이도록 촬영해주세요.'}</p>}</div>
   {error&&<p className={styles.error} role='alert'>{error}</p>}
   {stage==='reading'&&<p className={styles.progress} role='status'>명단과 바인 수를 읽는 중입니다…</p>}
   {stage==='image'&&<p className={styles.progress} role='status'>사진을 준비하는 중입니다…</p>}
   <footer><button type='button' disabled={!!stage} onClick={()=>{if(nativeCamera(navigator.userAgent,navigator.maxTouchPoints))cameraFile.current?.click();else void startCamera();}}>{photo?'다시 촬영':'카메라'}</button><button type='button' disabled={!!stage} onClick={()=>file.current?.click()}>사진 선택</button>{stream&&<button type='button' className={styles.primary} disabled={!!stage} onClick={()=>void capture()}>촬영</button>}{photo&&<button type='button' className={styles.primary} disabled={!!stage} onClick={()=>void analyze()}>{stage==='reading'?'판독 중…':'명단 확인'}</button>}</footer>
  </dialog>
 </>;
}
