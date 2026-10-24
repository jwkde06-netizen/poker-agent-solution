'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {db} from '../lib/db';
import styles from './LiveLedger.module.css';
import LedgerGameTable from './LedgerGameTable';
import {submitLedgerChange} from '../lib/ledger-inline';
import {SettlementFlow,ScanQueue} from './SettlementFlow';
import {rememberSettlementDay} from '../lib/settlement-navigation';
const today=()=>new Date(Date.now()+7*3600000).toISOString().slice(0,10);
const key=(v:any)=>String(v||'').toUpperCase().replace(/[^A-Z0-9가-힣]/g,'');
const statuses:Record<string,string>={pending:'승인 대기',confirmed:'예약 확정',checked_in:'입장 완료',waitlisted:'대기',cancelled:'취소',rejected:'거절',no_show:'노쇼'};
export default function LiveLedger({view='games'}:{view?:'games'|'daily'|'fnb'|'players'}){
 const [day,setDay]=useState(()=>{if(typeof window==='undefined')return today();const d=new URLSearchParams(window.location.search).get('day');return d&&/^20\d{2}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d))?d:today();}),[data,setData]=useState<any>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[login,setLogin]=useState(false);
 const [account,setAccount]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[refreshing,setRefreshing]=useState(false),[query,setQuery]=useState(''),[tab,setTab]=useState('main');
 const [statusTarget,setStatusTarget]=useState<any>(null);
 const [referenceDraft,setReferenceDraft]=useState<any>(null),[referenceError,setReferenceError]=useState('');
 const [draft,setDraft]=useState<any>(null),[preview,setPreview]=useState<any>(null),[uncertain,setUncertain]=useState(false);
 const [rowAction,setRowAction]=useState<any>(null),inlineRunning=useRef(false);
 const reading=useRef<string|null>(null),revision=useRef(0),alive=useRef(true);
 async function request(body?:any,selectedDay=day){
  const session=(await db?.auth.getSession())?.data.session;
  if(!session){setLogin(true);setData(null);throw Error('기존 관리자 계정으로 로그인해주세요.');}
  const r=await fetch('/api/operations/ledger'+(body?'':'?day='+selectedDay),{method:body?'POST':'GET',cache:'no-store',signal:AbortSignal.timeout(body?60000:20000),headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
  const b=await r.json();if(!r.ok){if(r.status===403){setLogin(true);setData(null);}throw Error(b.error||'연결을 확인해주세요.');}if(!body&&(!Array.isArray(b.gameStates)||!Array.isArray(b.daily)||!Array.isArray(b.fnb)||!Array.isArray(b.players)||!Array.isArray(b.menu)||!Array.isArray(b.history)||!Array.isArray(b.reservations)||b.day!==selectedDay||typeof b.sourceHash!=='string'))throw Error('정산 서비스의 연동 자료를 확인하지 못했습니다. 잠시 후 새로고침해주세요.');return b;
 }
 const load=useCallback(async()=>{
  if(reading.current===day)return;reading.current=day;const rev=revision.current;setRefreshing(true);
  try{const b=await request(undefined,day);if(alive.current&&rev===revision.current){setData(b);setLogin(false);setError('');}}
  catch(e){if(alive.current&&rev===revision.current)setError((e as Error).message);}
  finally{if(reading.current===day)reading.current=null;if(alive.current&&rev===revision.current)setRefreshing(false);}
 },[day]);
 useEffect(()=>{alive.current=true;void load();const refresh=()=>{if(document.visibilityState!=='hidden')void load();};const timer=setInterval(refresh,15000);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);return()=>{alive.current=false;clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};},[load]);
 useEffect(()=>{setTab(view==='games'&&window.location.hash==='#reservations'?'reservations':'main');setQuery('');setGameFilter('');setAgency('');setFloorFilter('');},[view]);
 async function signIn(){if(!db)return;setBusy(true);try{let email=account.trim().toLowerCase();if(!email.includes('@')){const r=await db.rpc('resolve_login_email',{p_username:email});if(r.error||!r.data)throw Error('아이디를 확인해주세요.');email=r.data;}const r=await db.auth.signInWithPassword({email,password});if(r.error)throw Error('아이디와 비밀번호를 확인해주세요.');setPassword('');await load();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 function edit(operation:any){setDraft({operation,sourceHash:data.sourceHash});setPreview(null);setUncertain(false);setNotice('');}
 function change(values:any){setDraft((d:any)=>({...d,operation:{...d.operation,...values}}));}
 async function prepare(){if(!draft)return;setBusy(true);setNotice('');try{const b=await request({action:'preview',...draft});if(b.noop){setNotice('이미 같은 내용이 반영되어 있습니다.');setDraft(null);await load();}else setPreview(b);}catch(e){setNotice((e as Error).message);}finally{setBusy(false);}}
 async function save(action='apply',id=preview?.id){
  if(!id)return;setBusy(true);
  try{
   setUncertain(true);const b=await request({action,id});
   if(b.applied){
    const operation=draft?.operation;
    setNotice(operation?.kind==='buyins'?`✅ ${operation.label} · 총 ${operation.buyins}바인 반영 완료`:'✅ 입력 내용 반영 완료');
    setDraft(null);setPreview(null);setUncertain(false);
    if(operation?.kind==='game'){
     setSelectedGame('');
     if(operation.sourceNo){
      const reference={day:operation.date,game:Number(operation.game),sourceNo:operation.sourceNo};
      try{await persistReference(reference);}catch(e){setReferenceDraft(reference);setReferenceError('참가 기록은 저장됐습니다. K홀덤 No.만 저장하지 못했습니다. '+(e as Error).message);}
     }
    }
    await load();
    if(operation?.kind==='game'){
     try{const fresh=await request(undefined,operation.date);setData(fresh);const row=fresh.daily.find((r:any)=>r.game===Number(operation.game));if(row){const id=[row.game,row.table,row.blind].join('|');setSelectedGame(id);pendingScroll.current=id;}}catch{setNotice('참가 기록은 저장됐습니다. 화면 갱신을 기다려주세요.');}
    }
   }else{setNotice((b.summary||[]).join(' · '));setUncertain(false);await load();}
  }catch(e){setNotice((e as Error).message);await load();}finally{setBusy(false);}
 }

 const op=draft?.operation;

 const locked=busy||rowAction?.stage==='uncertain'||!!error||!data||data.day!==day;
 const stale=!!draft&&data?.sourceHash!==draft.sourceHash;
 function gameDraft(reservation?:any,group?:any){
  edit({kind:'game',date:day,game:group?.game??Math.max(0,...groups.map(g=>Number(g.game)||0))+1,table:group?Number(String(group.table).split('-')[0]):reservation?.game?.table_no?Number(reservation.game.table_no):'',blind:group?.blind||'',players:[{player:reservation?.player_name_en||reservation?.player_name||'',buyins:1}],...(reservation?{reservationId:reservation.id,reservationVersion:reservation.version}:{})});
 }

 const [gameFilter,setGameFilter]=useState(''),[floorFilter,setFloorFilter]=useState('');
 const [selectedGame,setSelectedGame]=useState(''),[agency,setAgency]=useState(''),[limit,setLimit]=useState(80);
 const [rosterQueries,setRosterQueries]=useState<Record<string,string>>({});
 const gameStack=useRef<HTMLDivElement>(null),gamePanels=useRef(new Map<string,HTMLElement>()),openedDay=useRef(''),pendingScroll=useRef<string|null>(null);
 const playerIndex=useMemo(()=>new Map<string,any>((data?.players||[]).map((p:any)=>[key(p.name),p])),[data?.players]);
 const records=(data?.daily||[]).filter((r:any)=>(!query||key(r.player).includes(key(query))||String(r.game)===query)&&(!gameFilter||String(r.game)===gameFilter)&&(!agency||playerIndex.get(key(r.player))?.agency===agency));
 const orders=(data?.fnb||[]).filter((r:any)=>(!query||key(r.note).includes(key(query)))&&(!floorFilter||r.floor===floorFilter));
 function selectDay(value:string){if(!value||busy||draft||rowAction?.stage==='uncertain')return;rememberSettlementDay(value);revision.current++;setDay(value);setData(null);setError('');setSelectedGame('');setRosterQueries({});openedDay.current='';pendingScroll.current=null;setStatusTarget(null);setReferenceDraft(null);setReferenceError('');setGameFilter('');setNotice('');setRowAction(null);}
 useEffect(()=>{const sync=()=>{const params=new URLSearchParams(window.location.search),d=params.get('day');if(d&&d!==day)selectDay(d);else{const target=groups.find(g=>g.game===Number(params.get('game')));if(target)chooseGame(target);}};window.addEventListener('popstate',sync);return()=>window.removeEventListener('popstate',sync);},[day,data,busy,!!draft]);
 function shiftDay(delta:number){selectDay(new Date(Date.parse(day+'T12:00:00Z')+delta*86400000).toISOString().slice(0,10));}
 const dialog=useRef<HTMLDialogElement>(null);
 const dialogOpen=!!draft&&view!=='games';
 const inlineEditor=useRef<HTMLElement>(null);
 useEffect(()=>{if(draft&&view==='games'){inlineEditor.current?.scrollIntoView({block:'nearest',behavior:'smooth'});inlineEditor.current?.querySelector<HTMLInputElement>('input')?.focus({preventScroll:true});}},[!!draft,view]);
 useEffect(()=>{if(dialogOpen){dialog.current?.showModal();}else if(dialog.current?.open)dialog.current.close();},[dialogOpen]);
 function closeEditor(){if(busy)return;setDraft(null);setPreview(null);setUncertain(false);}
 function buyin(r:any,delta=0){edit({kind:'buyins',row:r.row,expected:r.expected,buyins:Number(r.buyins)+delta,reason:'',label:r.game+'번 게임 · '+r.player});}
 const groups=Object.values((data?.daily||[]).reduce((all:Record<string,any>,r:any)=>{const id=[r.game,r.table,r.blind].join('|');if(!all[id])all[id]={id,game:r.game,table:r.table,physical:String(r.table).split('-')[0],blind:r.blind,players:[],buyins:0};all[id].players.push(r);all[id].buyins+=Number(r.buyins)||0;return all;},{})) as any[];
 const gameState=(g:any)=>(data?.gameStates||[]).find((s:any)=>s.game_no===g.game);
 const statusOf=(g:any)=>{const s=gameState(g);return s&&s.table_label===g.table&&s.blind===g.blind?s.status:'unknown';};
 const liveGames=groups.filter(g=>statusOf(g)==='active').sort((a,b)=>a.game-b.game);
 const orderedGames=[...groups].sort((a,b)=>a.game-b.game);
 function scrollToGame(id:string,behavior:ScrollBehavior='smooth'){
  const stack=gameStack.current,panel=gamePanels.current.get(id);if(!stack||!panel)return false;
  stack.scrollTo({top:stack.scrollTop+panel.getBoundingClientRect().top-stack.getBoundingClientRect().top,behavior});return true;
 }
 function chooseGame(g:any){if(draft||referenceDraft)return;setSelectedGame(g.id);setStatusTarget(null);scrollToGame(g.id);}
 useEffect(()=>{
  if(view!=='games'||tab!=='main'||!data||data.day!==day||draft||!gameStack.current)return;
  if(pendingScroll.current){if(scrollToGame(pendingScroll.current)){pendingScroll.current=null;}return;}
  if(openedDay.current===day||!orderedGames.length)return;
  const requested=Number(new URLSearchParams(window.location.search).get('game'));
  const first=orderedGames.find(g=>g.game===requested)||liveGames[0]||orderedGames[0];if(scrollToGame(first.id,'instant')){openedDay.current=day;setSelectedGame(first.id);}
 },[data,day,view,tab,!!draft]);
 async function updateGameStatus(){
  if(!statusTarget)return;setBusy(true);setNotice('');
  try{await request({action:'game_status',day,game:statusTarget.game,status:statusTarget.status,version:statusTarget.version,sourceHash:statusTarget.sourceHash});setStatusTarget(null);setNotice('게임 상태 저장 완료');await load();}
  catch(e){setNotice((e as Error).message);setStatusTarget(null);await load();}finally{setBusy(false);}
 }
 const codes=Array.from(new Set<string>((data?.players||[]).map((p:any)=>String(p.agency)).filter(Boolean))).sort();
 const filteredPlayers=(data?.players||[]).filter((p:any)=>(!query||key([p.name,p.card,p.agency].join(' ')).includes(key(query)))&&(!agency||p.agency===agency));
 const title={games:'게임 · 바이인',daily:'일일 정산',fnb:'F&B',players:'플레이어 관리'}[view];
 const caption={games:'게임을 선택하고 참가자·리바인을 바로 입력하세요.',daily:'날짜별 게임과 선수 기록을 한눈에 확인하세요.',fnb:'층별 주문과 지출 내역을 관리하세요.',players:'영문 이름·카드 번호·소속 코드로 선수를 찾으세요.'}[view];
 const totalBuyins=(data?.daily||[]).reduce((n:number,r:any)=>n+(Number(r.buyins)||0),0);
 const newFnb=()=>edit({kind:'fnb',date:day,floor:floorFilter||'2F',amount:'',note:''});
 const newPlayer=()=>edit({kind:'register',player:'',card:'',agency:''});
 async function persistReference(item:any){
  // Re-read the game identity before saving its independent casino reference.
  const fresh=await request(undefined,item.day);
  const state=fresh.gameStates.find((x:any)=>x.game_no===item.game);
  if(item.version===undefined&&state?.source_no&&state.source_no!==item.sourceNo)throw Error('다른 K홀덤 No.가 이미 저장되어 있습니다. 해당 게임에서 번호를 확인해주세요.');
  await request({action:'game_reference',day:item.day,game:item.game,sourceNo:item.sourceNo,version:item.version===undefined?(state?.version??null):item.version,sourceHash:fresh.sourceHash});
 }
 async function saveReference(){
  if(!referenceDraft)return;setBusy(true);setReferenceError('');
  try{await persistReference(referenceDraft);setReferenceDraft(null);setNotice('K홀덤 No. 저장 완료');await load();}
  catch(e){setReferenceError((e as Error).message);}finally{setBusy(false);}
 }

 useEffect(()=>{if(view!=='games')return;try{const saved=JSON.parse(sessionStorage.getItem('dream-ledger-pending:'+day)||'null');if(saved&&/^[-a-f0-9]{36}$/.test(saved.id))setRowAction({...saved,stage:'uncertain',message:'이전 저장 결과를 확인해주세요.'});}catch{}},[day,view]);
 async function commitRow(row:any,operation:any,retry=false){
  if(inlineRunning.current||(!retry&&(locked||draft||referenceDraft)))return false;
  inlineRunning.current=true;setBusy(true);setNotice('');revision.current++;
  let commandId=retry?rowAction?.id:undefined;
  const context=retry?{...rowAction}:{row:row.row,player:row.player,game:row.game,value:operation.buyins,day};
  const pendingKey='dream-ledger-pending:'+day;
  const remember=(id:string)=>{commandId=id;const item={...context,id};try{sessionStorage.setItem(pendingKey,JSON.stringify(item));}catch{}setRowAction({...item,stage:'saving',message:'저장 중…'});};
  const clear=()=>{try{sessionStorage.removeItem(pendingKey);}catch{}};
  setRowAction({...context,id:commandId,stage:'saving',message:'저장 중…'});
  let result:any=null,failure='';
  try{
   try{result=await submitLedgerChange(body=>request(body),{id:commandId,operation,sourceHash:data?.sourceHash},remember);}
   catch(e){failure=(e as Error).message;if(commandId){try{result=await request({action:'result',id:commandId});}catch{}}}
   if(result?.applied){
    revision.current++;try{const fresh=await request(undefined,day);setData(fresh);setError('');}
    catch{setRowAction({...context,id:commandId,stage:'uncertain',message:'저장은 완료됐습니다. 최신 화면을 다시 불러와주세요.'});return false;}
    clear();setRowAction({...context,stage:'done'});setNotice('✓ '+context.game+'번 · '+context.player+' 반영 완료');return true;
   }
   if(!commandId||result?.status==='preview'||result?.status==='failed'||result?.failed||result?.applied===false&&result?.status!=='writing'){
    clear();setRowAction({...context,stage:'error',message:failure||'저장되지 않았습니다. 최신 기록을 확인해주세요.'});await load();return false;
   }
   setRowAction({...context,id:commandId,stage:'uncertain',message:failure||'저장 결과를 확인 중입니다. 같은 요청의 결과를 확인해주세요.'});return false;
  }finally{inlineRunning.current=false;setBusy(false);}
 }

 const editorContent=draft&&<><div className={styles.dialogHead}><h2 id='ledger-editor-title'>{op.label||({game:'게임 입력',fnb:'F&B 입력',fnb_edit:'F&B 수정',register:'신규 선수 등록'} as any)[op.kind]}</h2><button aria-label='입력창 닫기' disabled={busy} onClick={closeEditor}>✕</button></div><div className={styles.dialogBody}><div className={styles.editContext}><span>{op.date||day}</span><b>{preview?'2 · 저장 확인':'1 · 내용 입력'}</b></div>
 {notice&&<p className={styles.notice} role='status'>{notice}</p>}
 {stale&&<p role='alert'>다른 작업에서 기록이 변경됐습니다. 현재 입력을 닫고 최신 기록에서 다시 선택해주세요.</p>}
 {preview?<><h3>이 내용으로 저장할까요?</h3><ul>{preview.summary.map((s:string,i:number)=><li key={i}>{s}</li>)}{op.kind==='game'&&op.sourceNo&&<li>K홀덤 No. {op.sourceNo} (별도 번호)</li>}</ul><button className={styles.primary} disabled={busy||(!uncertain&&(stale||locked))} onClick={()=>void save()}>{busy?'저장 결과 확인 중…':uncertain?'같은 요청의 결과 다시 확인':'확인한 내용 저장'}</button>{!uncertain&&<button className={styles.backButton} disabled={busy} onClick={()=>setPreview(null)}>← 입력 내용 수정</button>}{uncertain&&<p>응답이 끊겨도 새로 입력하지 마세요. 처리 이력에서 같은 요청의 결과를 확인할 수 있습니다.</p>}</>:<form onSubmit={e=>{e.preventDefault();void prepare();}} className={styles.form}><fieldset disabled={busy}>
 {op.kind==='game'&&<>
 <div className={styles.gameFields}>
 <label>우리 게임 순번<input aria-label='우리 게임 순번' type='number' required min='1' max='100' value={op.game} onChange={e=>change({game:Number(e.target.value)})}/></label>
 <label>실제 테이블<input type='number' required min='1' max='100' value={op.table} onChange={e=>change({table:Number(e.target.value)})}/></label>
 <label>블라인드<select required value={op.blind} onChange={e=>change({blind:e.target.value})}><option value=''>선택</option>{['3M','5M','10M','15M'].map(x=><option key={x}>{x}</option>)}</select></label>
 <label>K홀덤 No. (선택)<input inputMode='numeric' pattern='[0-9]{1,8}' maxLength={8} value={op.sourceNo||''} placeholder='영수증·전광판 번호' onChange={e=>change({sourceNo:e.target.value})}/></label>
 </div>
 <div className={styles.entryTable}><table><thead><tr><th>선수 영문명</th><th>소속</th><th>총 바인</th><th></th></tr></thead><tbody>{op.players.map((p:any,i:number)=><tr key={i}><td><input aria-label={'참가자 '+(i+1)+' 영문명'} list='ledger-players' required readOnly={!!op.reservationId} value={p.player} onChange={e=>change({players:op.players.map((v:any,j:number)=>j===i?{...v,player:e.target.value}:v)})}/></td><td>{playerIndex.get(key(p.player))?.agency||'—'}</td><td><input aria-label={'참가자 '+(i+1)+' 총 바인'} type='number' required min='1' max='50' value={p.buyins} onChange={e=>change({players:op.players.map((v:any,j:number)=>j===i?{...v,buyins:Number(e.target.value)}:v)})}/></td><td>{!op.reservationId&&op.players.length>1&&<button type='button' aria-label={'참가자 '+(i+1)+' 제외'} onClick={()=>change({players:op.players.filter((_:any,j:number)=>j!==i)})}>×</button>}</td></tr>)}</tbody></table></div>
 {!op.reservationId&&<button className={styles.addEntryRow} type='button' disabled={op.players.length>=20} onClick={()=>change({players:[...op.players,{player:'',buyins:1}]})}>＋ 참가자 행 추가</button>}
 <datalist id='ledger-players'>{data?.players.map((p:any,i:number)=><option key={i} value={p.name}/>)}</datalist>
 </>}

 {op.kind==='buyins'&&<><div className={styles.buyinChange}><div><span>현재</span><strong>{op.expected[5]}<small>바인</small></strong></div><span>→</span><div><span>변경 후</span><strong>{op.buyins}<small>바인</small></strong></div></div><div className={styles.stepper}><button type='button' aria-label='총 바인 1 감소' disabled={Number(op.buyins)<=1} onClick={()=>change({buyins:Number(op.buyins)-1})}>−</button><label>누적 총 바인<input required type='number' min='1' max='50' value={op.buyins} onChange={e=>change({buyins:Number(e.target.value)})}/></label><button type='button' aria-label='총 바인 1 증가' disabled={Number(op.buyins)>=50} onClick={()=>change({buyins:Number(op.buyins)+1})}>＋</button></div><p className={styles.delta}>{Number(op.buyins)>Number(op.expected[5])?'리바인 '+(Number(op.buyins)-Number(op.expected[5]))+'회 추가':Number(op.buyins)<Number(op.expected[5])?'바인 수를 줄이는 수정입니다. 사유를 남겨주세요.':'바인 수가 같습니다.'}</p><label>수정 사유 {op.buyins<Number(op.expected[5])?'(필수)':'(선택)'}<input placeholder='예: 중복 입력 정정' maxLength={200} required={op.buyins<Number(op.expected[5])} value={op.reason} onChange={e=>change({reason:e.target.value})}/></label></>}
 {['fnb','fnb_edit'].includes(op.kind)&&<>{op.kind==='fnb'&&<label>가격표에서 선택 (선택 사항)<select value={op.menuName||''} onChange={e=>{const item=data.menu.find((m:any)=>m.name===e.target.value);change({menuName:e.target.value,...(item?{amount:Number(item.price),note:item.name+' 1'+(item.unit||'잔')}:{})});}}><option value=''>직접 입력</option>{data.menu.map((m:any,i:number)=><option key={i} value={m.name}>{m.name} · {Number(m.price).toLocaleString()}동</option>)}</select></label>}<label>층<select value={op.floor} onChange={e=>change({floor:e.target.value})}>{['2F','3F','4F'].map(x=><option key={x}>{x}</option>)}</select></label><label>금액 (동)<input required type='number' min='1' max='100000000' value={op.amount} onChange={e=>change({amount:Number(e.target.value)})}/></label><label>주문 내용<input required maxLength={500} value={op.note} onChange={e=>change({note:e.target.value})}/></label></>}
 {op.kind==='register'&&<><label>영문 이름<input required maxLength={80} value={op.player} onChange={e=>change({player:e.target.value.toUpperCase()})}/></label><label>카드 번호<input value={op.card} onChange={e=>change({card:e.target.value})}/></label><label>소속 코드<select required value={op.agency} onChange={e=>change({agency:e.target.value})}><option value=''>선택</option>{Array.from(new Set<string>((data?.players||[]).map((p:any)=>String(p.agency)).filter(Boolean))).map(x=><option key={x}>{x}</option>)}</select></label></>}
 <button className={styles.primary} disabled={locked||stale}>입력 내용 확인</button>
 </fieldset></form>}
 <button disabled={busy} className={styles.closeButton} onClick={closeEditor}>{uncertain?'닫고 처리 이력에서 확인':'닫기'}</button></div></>;

 return <section className={`${styles.page} ${view==='games'?styles.gamePage:''}`}>
 {view==='games'&&<SettlementFlow step='games' day={day} disabled={busy||!!draft||!!referenceDraft||rowAction?.stage==='uncertain'}/>}
 {view!=='games'&&<> <header className={styles.header}><div><span className={styles.eyebrow}>DREAM POKER</span><h1>{title}</h1><p>{caption}</p></div><div className={styles.headerActions}>{view!=='players'&&<div className={styles.datePicker}><button aria-label='이전 날짜' disabled={busy||!!draft} onClick={()=>shiftDay(-1)}>‹</button><input aria-label='영업일' type='date' value={day} disabled={busy||!!draft} onChange={e=>selectDay(e.target.value)}/><button aria-label='다음 날짜' disabled={busy||!!draft} onClick={()=>shiftDay(1)}>›</button>{day!==today()&&<button disabled={busy||!!draft} onClick={()=>selectDay(today())}>오늘</button>}</div>}<button aria-label='기록 새로고침' disabled={refreshing} onClick={()=>void load()}>{refreshing?'갱신 중…':'↻ 새로고침'}</button><button className={styles.primary} disabled={locked||!!draft} onClick={()=>view==='fnb'?newFnb():view==='players'?newPlayer():gameDraft()}>{view==='fnb'?'+ 주문 입력':view==='players'?'+ 선수 등록':'+ 새 게임 입력'}</button></div></header>
 <div className={styles.sync} role='status'><span className={error?styles.offline:styles.dot}/>{error?'연결 확인 필요':data?'구글 시트 연결됨':'기록 불러오는 중'}<span className={styles.syncTime}>{data?new Date(data.checkedAt).toLocaleTimeString('ko-KR',{timeZone:'Asia/Ho_Chi_Minh'}):'—'} · 15초마다 갱신</span></div></>}

 {error&&<p className={styles.notice} role='alert'>{error} {data?'마지막으로 확인한 자료를 표시합니다.':''}</p>}
 {notice&&!draft&&<p className={styles.notice} role='status'>{notice}</p>}
 {rowAction?.stage==='uncertain'&&<div className={styles.pendingRowNotice} role='status'><span>{rowAction.game}번 · {rowAction.player} — {rowAction.message}</span><button disabled={busy} onClick={()=>void commitRow(null,null,true)}>결과 확인</button></div>}
 {login?<section className={styles.panel}><h2>관리자 로그인</h2><form className={styles.form} onSubmit={e=>{e.preventDefault();void signIn();}}><label>아이디 또는 이메일<input autoComplete='username' value={account} onChange={e=>setAccount(e.target.value)}/></label><label>비밀번호<input autoComplete='current-password' type='password' value={password} onChange={e=>setPassword(e.target.value)}/></label><button disabled={busy}>로그인</button></form></section>:<>
 {view!=='games'&&<> <nav className={styles.tabs} aria-label={title+' 보기'}><button aria-pressed={tab==='main'} onClick={()=>setTab('main')}>{view==='daily'?'일일 장부':view==='fnb'?'주문 내역':'선수 명단'}</button><button aria-pressed={tab==='history'} onClick={()=>setTab('history')}>처리 이력</button></nav></>}
 {view==='games'&&tab!=='main'&&<button className={styles.backButton} onClick={()=>setTab('main')}>← 게임으로 돌아가기</button>}

 {!data&&!error&&<div className={styles.loading} role='status'><div/><div/><div/><p>오늘의 기록을 불러오고 있습니다.</p></div>}
 {data&&<>

 {tab==='main'&&view==='games'&&<>
 <ScanQueue intake={data.intake} error={data.intakeError} day={day}/>
 <div className={styles.gameTop}>
 <section className={styles.compactLiveCards} aria-label='진행 중인 게임'>{liveGames.map(g=><button key={g.id} aria-label={g.game+'번 게임 · 테이블 '+g.physical+' · '+g.blind} disabled={!!draft||!!referenceDraft} aria-pressed={selectedGame===g.id} onClick={()=>chooseGame(g)}><div className={styles.cardTitle}><strong>{g.game}번</strong><span><i/>진행 중</span></div><div className={styles.cardTable}>테이블 {g.physical}<b>{g.blind}</b><span className={styles.sourceNumber}>K홀덤 No. {gameState(g)?.source_no||'—'}</span></div><small>우리 코드 <b>{new Set(g.players.map((p:any)=>key(p.player))).size}명</b><span>·</span><b>{g.buyins}바인</b></small></button>)}
 {!liveGames.length&&<div className={styles.noLive}>진행 중인 게임 없음</div>}</section>
 <div className={styles.gameTopActions}>{day!==today()&&<time className={styles.pastDate} dateTime={day}>{day}</time>}<button className={styles.primary} disabled={locked||!!draft||!!referenceDraft} onClick={()=>{setTab('main');gameDraft();}}>＋ 새 게임</button>
 <details className={styles.gameMenu}><summary aria-label='날짜·예약·처리 이력'>⋯</summary><div className={styles.gameMenuContent}><label>영업일<input aria-label='영업일' type='date' value={day} disabled={busy||!!draft} onChange={e=>selectDay(e.target.value)}/></label><button disabled={refreshing} onClick={()=>void load()}>새로고침</button><button onClick={()=>setTab('reservations')}>예약 연결</button><button onClick={()=>setTab('history')}>처리 이력</button></div></details></div>
 </div>
 {referenceDraft&&<form className={styles.referenceEditor} onSubmit={e=>{e.preventDefault();void saveReference();}}><strong>{referenceDraft.game}번 게임</strong><label>K홀덤 No.<input aria-label='K홀덤 번호' inputMode='numeric' pattern='[0-9]{1,8}' maxLength={8} value={referenceDraft.sourceNo} disabled={busy} onChange={e=>setReferenceDraft({...referenceDraft,sourceNo:e.target.value})}/></label><button className={styles.primary} disabled={busy}>번호 저장</button><button type='button' disabled={busy} onClick={()=>{setReferenceDraft(null);setReferenceError('');}}>닫기</button>{referenceError&&<p role='alert'>{referenceError}</p>}</form>}
 <div className={styles.sheetNavigation}><select aria-label='게임 바로가기' value={selectedGame} disabled={!!draft||!!referenceDraft} onChange={e=>{const g=groups.find(g=>g.id===e.target.value);if(g)chooseGame(g);}}>{orderedGames.map(g=><option key={g.id} value={g.id}>{g.game}번 · 테이블 {g.physical}</option>)}</select><span>VND</span></div>
 {draft&&<section ref={inlineEditor} className={styles.inlineEditor} aria-labelledby='ledger-editor-title'>{editorContent}</section>}
 <div ref={gameStack} className={`${styles.workspace} ${styles.gameStack}`} aria-label='게임별 참가 장부'>
 {orderedGames.map(g=>{const rosterQuery=rosterQueries[g.id]||'';return <section key={g.id} ref={node=>{if(node)gamePanels.current.set(g.id,node);else gamePanels.current.delete(g.id);}} className={styles.gamePanel} aria-label={g.game+'번 게임 참가자'} data-game={g.game}>
 <div className={styles.selectedHead}><div className={styles.gameIdentity}><h2>{g.game}번</h2><span>테이블 {g.physical} · {g.blind}</span><span className={statusOf(g)==='active'?styles.liveLabel:styles.statusLabel}>{statusOf(g)==='active'?'● 진행 중':statusOf(g)==='closed'?'종료':'상태 미확인'}</span><button className={styles.sourceButton} disabled={locked||!!draft||!!referenceDraft} onClick={()=>{setReferenceDraft({day,game:g.game,sourceNo:gameState(g)?.source_no||'',version:gameState(g)?.version??null});setReferenceError('');}}>K홀덤 No. {gameState(g)?.source_no||'입력'}</button></div>
 <div className={styles.controls}><button disabled={locked||!!draft||!!referenceDraft} onClick={()=>setStatusTarget({game:g.game,status:statusOf(g)==='active'?'closed':'active',version:gameState(g)?.version??null,sourceHash:data.sourceHash})}>{statusOf(g)==='active'?'게임 종료':statusOf(g)==='closed'?'다시 시작':'게임 시작'}</button><button className={styles.primary} disabled={locked||!!draft||!!referenceDraft} onClick={()=>gameDraft(undefined,g)}>＋ 참가자</button></div></div>
 {statusTarget?.game===g.game&&<div className={styles.statusConfirm} role='alert'><strong>{statusTarget.game}번 게임을 {statusTarget.status==='active'?'진행 중':'종료'}으로 표시할까요?</strong><div className={styles.controls}><button className={styles.primary} disabled={locked||!!draft||!!referenceDraft} onClick={()=>void updateGameStatus()}>확인</button><button disabled={busy} onClick={()=>setStatusTarget(null)}>취소</button></div></div>}
 <div className={styles.rosterTools}><div><b>{g.players.length}</b>명 <span>·</span> 총 <b>{g.buyins}</b>바인</div><input aria-label={g.game+'번 게임 참가자 검색'} placeholder='참가자 검색' value={rosterQuery} onChange={e=>setRosterQueries(prev=>({...prev,[g.id]:e.target.value}))}/></div>
 <LedgerGameTable game={g.game} rows={g.players.filter((r:any)=>!rosterQuery||key(r.player).includes(key(rosterQuery)))} players={data.players} playerIndex={playerIndex} locked={locked||!!draft||!!referenceDraft} action={rowAction} onCommit={commitRow} onRetry={()=>void commitRow(null,null,true)} onDismiss={()=>setRowAction(null)}/>

 </section>;})}
 {!orderedGames.length&&!draft&&<section className={styles.gamePanel}><div className={styles.empty}><strong>첫 게임을 입력하세요.</strong><p>게임 번호·실제 테이블·참가자를 한 번에 등록할 수 있습니다.</p><button className={styles.primary} disabled={locked} onClick={()=>gameDraft()}>＋ 새 게임 입력</button></div></section>}
 </div></>}
 {tab==='main'&&view==='daily'&&<>
 <div className={styles.metrics}>{[['기록된 게임',groups.length,'게임'],['참가 기록',data.daily.length,'건'],['총 바이인',totalBuyins,'회'],['플레이어',new Set(data.daily.map((r:any)=>key(r.player))).size,'명']].map(([label,value,unit])=><div key={String(label)}><span>{label}</span><strong>{value}<small>{unit}</small></strong></div>)}</div>
 <section className={styles.panel}><div className={styles.sectionHead}><h2>게임별 참가 장부</h2><span>{records.length}건 · {records.reduce((n:number,r:any)=>n+Number(r.buyins),0)}바인</span></div><div className={styles.filterBar}><input aria-label='선수 또는 게임 검색' placeholder='선수 이름 또는 게임 번호 검색' value={query} onChange={e=>setQuery(e.target.value)}/><select aria-label='게임 필터' value={gameFilter} onChange={e=>setGameFilter(e.target.value)}><option value=''>전체 게임</option>{Array.from(new Set<string>(groups.map(g=>String(g.game)))).sort((a,b)=>Number(a)-Number(b)).map(g=><option key={g} value={g}>{g}번 게임</option>)}</select><select aria-label='장부 소속 필터' value={agency} onChange={e=>setAgency(e.target.value)}><option value=''>전체 소속</option>{codes.map(c=><option key={c}>{c}</option>)}</select>{(query||gameFilter||agency)&&<button onClick={()=>{setQuery('');setGameFilter('');setAgency('');}}>초기화</button>}</div><div className={styles.scroll}><table><thead><tr><th>게임</th><th>테이블</th><th>블라인드</th><th>플레이어</th><th>소속</th><th>총 바이인</th><th>처리</th></tr></thead><tbody>{records.map((r:any)=><tr key={r.row}><td><b>{r.game??'미지정'}</b></td><td>{r.table}</td><td><span className={styles.badge}>{r.blind}</span></td><td className={styles.nameCell}>{r.player}</td><td><span className={styles.badge}>{playerIndex.get(key(r.player))?.agency||'미지정'}</span></td><td><b>{r.buyins}회</b></td><td><div className={styles.rowActions}><button aria-label={r.player+' 바인 수 수정'} disabled={locked} onClick={()=>buyin(r)}>수정</button><button aria-label={r.player+' 리바인 1회 추가'} disabled={locked} onClick={()=>buyin(r,1)}>＋ 리바인</button></div></td></tr>)}</tbody></table>{!records.length&&<div className={styles.empty}>표시할 기록이 없습니다.</div>}</div><div className={styles.panelFooter}><span>{records.length}건 표시</span><a href='/?tab=sheetWeekly'>주간 정산 보기 →</a></div></section>
 </>}
 {tab==='main'&&view==='fnb'&&<>
 <div className={styles.metrics}>{['2F','3F','4F'].map(f=><div key={f}><span>{f} 주문 금액</span><strong>{data.fnb.filter((r:any)=>r.floor===f).reduce((n:number,r:any)=>n+(Number(r.amount)||0),0).toLocaleString()}<small>동</small></strong></div>)}<div><span>전체 주문</span><strong>{data.fnb.length}<small>건</small></strong></div></div>
 <section className={styles.panel}><div className={styles.sectionHead}><h2>주문 내역</h2><input aria-label='주문 검색' placeholder='주문 내용 검색' value={query} onChange={e=>setQuery(e.target.value)}/></div><div className={styles.filterBar}><select aria-label='층별 주문 필터' value={floorFilter} onChange={e=>setFloorFilter(e.target.value)}><option value=''>전체 층</option>{['2F','3F','4F'].map(f=><option key={f}>{f}</option>)}</select><span>{orders.length}건 · {orders.reduce((n:number,r:any)=>n+Number(r.amount),0).toLocaleString()}동</span></div><div className={styles.scroll}><table><thead><tr><th>층</th><th>주문 내용</th><th>금액</th><th>처리</th></tr></thead><tbody>{orders.map((r:any)=><tr key={r.row}><td><span className={styles.badge}>{r.floor}</span></td><td>{r.note}</td><td><b>{Number(r.amount).toLocaleString()}</b> 동</td><td><button disabled={locked} onClick={()=>edit({...r,kind:'fnb_edit'})}>수정</button></td></tr>)}</tbody></table>{!orders.length&&<div className={styles.empty}><strong>표시할 주문이 없습니다.</strong><p>주문 입력에서 층과 내용을 선택하세요.</p></div>}</div><p className={styles.footnote}>층별 금액은 주문 합계입니다. 정산 차감 기준은 주간 정산에 적용됩니다.</p></section>
 </>}
 {tab==='main'&&view==='players'&&<>
 <div className={styles.metrics}><div><span>전체 등록 선수</span><strong>{data.players.length}<small>명</small></strong></div><div><span>등록된 소속 코드</span><strong>{codes.length}<small>개</small></strong></div><div><span>소속 확인 필요</span><strong>{data.players.filter((p:any)=>!p.agency).length}<small>명</small></strong></div></div>
 <section className={styles.panel}><div className={styles.sectionHead}><h2>플레이어 명단</h2><div className={styles.controls}><input aria-label='플레이어 검색' placeholder='이름 · 카드 번호 · 소속 검색' value={query} onChange={e=>{setQuery(e.target.value);setLimit(80);}}/><select aria-label='소속 필터' value={agency} onChange={e=>{setAgency(e.target.value);setLimit(80);}}><option value=''>전체 소속</option>{codes.map(x=><option key={x}>{x}</option>)}</select></div></div><div className={styles.scroll}><table><thead><tr><th>플레이어</th><th>카드 번호</th><th>소속 코드</th></tr></thead><tbody>{filteredPlayers.slice(0,limit).map((p:any,i:number)=><tr key={i}><td className={styles.nameCell}><span className={styles.avatar}>{String(p.name).charAt(0)}</span>{p.name}</td><td>{p.card||'—'}</td><td><span className={styles.badge}>{p.agency||'미지정'}</span></td></tr>)}</tbody></table>{!filteredPlayers.length&&<div className={styles.empty}>검색 결과가 없습니다.</div>}</div><div className={styles.panelFooter}><span>{filteredPlayers.length}명 검색됨</span>{filteredPlayers.length>limit&&<button onClick={()=>setLimit(n=>n+80)}>더 보기</button>}</div></section>
 </>}
 {tab==='reservations'&&<section className={styles.panel}><div className={styles.sectionHead}><div><h2>예약 → 실제 참가</h2><p>입장 완료된 예약을 실제 게임에 연결합니다.</p></div><a className={styles.buttonLink} href='https://dream-poker-reservation.vercel.app/desk'>예약 관리 ↗</a></div>
 <div className={styles.reservations}>{data.reservations.map((r:any)=>{const matches=data.daily.filter((d:any)=>key(d.player)===key(r.player_name_en||r.player_name));return <article key={r.id}><div className={styles.reservationTop}><span className={styles.badge}>{statuses[r.status]||r.status}</span><small>{new Date(r.arrival_at).toLocaleTimeString('ko-KR',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',minute:'2-digit'})} 도착 예정</small></div><h3>{r.player_name_en||r.player_name}</h3>{r.player_name_ko&&<p>{r.player_name_ko}</p>}<dl><div><dt>예약 테이블 / No.</dt><dd>{r.game?.table_no||'미배정'} / {r.game?.game_no||'—'}</dd></div><div><dt>동일 이름의 오늘 기록</dt><dd>{matches.length?matches.map((m:any)=>m.game+'번 · '+m.buyins+'바인').join(', '):'없음'}</dd></div></dl><div className={styles.controls}><button className={styles.primary} disabled={locked||r.status!=='checked_in'} onClick={()=>gameDraft(r)}>실제 참가 입력</button><a href={'https://dream-poker-reservation.vercel.app/desk?reservation='+r.id}>예약 상세 ↗</a></div></article>;})}</div>{!data.reservations.length&&<div className={styles.empty}>선택한 날짜의 도착 예정 예약이 없습니다.</div>}<p className={styles.footnote}>예약 No.와 장부 게임 번호는 다를 수 있어요. 실제 게임과 테이블을 확인한 후 저장하세요.</p></section>}
 {tab==='history'&&<section className={styles.panel}><div className={styles.sectionHead}><h2>내 처리 이력</h2><span>최근 20건</span></div>{data.history.map((h:any)=><div className={styles.history} key={h.id}><span className={styles.historyDot}/><div><strong>{({applied:'저장 확인 완료',preview:'변경안 확인 대기',writing:'저장 결과 확인 필요',failed:'미반영'} as Record<string,string>)[h.status]||h.status}</strong><p>{h.summary.join(' · ')}</p><small>{new Date(h.created_at).toLocaleString('ko-KR',{timeZone:'Asia/Ho_Chi_Minh'})}</small></div>{h.status==='writing'&&<button disabled={busy} onClick={()=>void save('reconcile',h.id)}>저장 결과 대조</button>}</div>)}{!data.history.length&&<div className={styles.empty}><strong>아직 웹에서 처리한 내역이 없습니다.</strong><p>저장한 변경안과 처리 결과가 이곳에 표시됩니다.</p></div>}</section>}
 </>}
  {draft&&view!=='games'&&<dialog ref={dialog} className={styles.dialog} aria-labelledby='ledger-editor-title' onCancel={e=>{e.preventDefault();closeEditor();}}>{editorContent}</dialog>}

 </>}
 </section>;
}
