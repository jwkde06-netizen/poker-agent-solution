'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {gameStateFor,gameStatusFor,orderGames,validLedgerDay} from '../lib/live-game-order';
import {db} from '../lib/db';
import styles from './LiveLedger.module.css';
import LedgerGameTable from './LedgerGameTable';
import ReceiptScanner from './ReceiptScanner';
import {submitLedgerChange} from '../lib/ledger-inline';
import {LedgerCounterQueue,counterKey,CounterEntry} from '../lib/ledger-counter-queue';
import {FlowLink,ScanQueue} from './SettlementFlow';
import {rememberSettlementDay} from '../lib/settlement-navigation';
const today=()=>new Date(Date.now()+7*3600000).toISOString().slice(0,10);
const key=(v:any)=>String(v||'').toUpperCase().replace(/[^A-Z0-9가-힣]/g,'');
const gameStatusLabels:Record<string,string>={active:'진행 중',prepared:'시작 전',closed:'종료',unknown:'상태 미확인',unconfirmed:'상태 미확인'};
const statuses:Record<string,string>={pending:'승인 대기',confirmed:'예약 확정',checked_in:'입장 완료',waitlisted:'대기',cancelled:'취소',rejected:'거절',no_show:'노쇼'};
export default function LiveLedger({view='games'}:{view?:'games'|'daily'|'fnb'|'players'}){
 const [day,setDay]=useState(()=>{if(typeof window==='undefined')return today();const params=new URLSearchParams(window.location.search),d=params.get('day'),game=Number(params.get('game'));const hasGameTarget=Number.isInteger(game)&&game>0;if(view==='games'&&!hasGameTarget)return today();return d&&/^20\d{2}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d))?d:today();}),[data,setRawData]=useState<any>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[login,setLogin]=useState(false);
 const [account,setAccount]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[refreshing,setRefreshing]=useState(false),[query,setQuery]=useState(''),[tab,setTab]=useState('main');
 const followCurrent=useRef(view==='games'&&(typeof window==='undefined'||!(Number.isInteger(Number(new URLSearchParams(window.location.search).get('game')))&&Number(new URLSearchParams(window.location.search).get('game'))>0)));
 const [nextDay,setNextDay]=useState('');
 const [gameChooserOpen,setGameChooserOpen]=useState(false);
 const dataRef=useRef<any>(null);
 const setData=(next:any)=>{dataRef.current=next;setRawData(next);};
 const [counterEntries,setCounterEntries]=useState<CounterEntry[]>([]),counterQueue=useRef<LedgerCounterQueue|null>(null);
 const [undoTarget,setUndoTarget]=useState<any>(null);
 const rememberUndo=(target:any)=>{setUndoTarget(target);try{if(target)sessionStorage.setItem('dream-ledger-undo:'+day,JSON.stringify(target));else sessionStorage.removeItem('dream-ledger-undo:'+day);}catch{}};
 useEffect(()=>{try{setUndoTarget(JSON.parse(sessionStorage.getItem('dream-ledger-undo:'+day)||'null'));}catch{setUndoTarget(null);}},[day]);
 useEffect(()=>{if(view==='games'){const params=new URLSearchParams(window.location.search),game=Number(params.get('game'));if(!Number.isInteger(game)||game<1)rememberSettlementDay(day);}},[view,day]);
 const [statusTarget,setStatusTarget]=useState<any>(null);
 const [statusMessage,setStatusMessage]=useState('');
 useEffect(()=>{if(!statusMessage)return;const timer=setTimeout(()=>setStatusMessage(''),4000);return()=>clearTimeout(timer);},[statusMessage]);
 const [referenceDraft,setReferenceDraft]=useState<any>(null),[referenceError,setReferenceError]=useState('');
 const [draft,setDraft]=useState<any>(null),[preview,setPreview]=useState<any>(null),[uncertain,setUncertain]=useState(false);
 const [rowAction,setRowAction]=useState<any>(null),inlineRunning=useRef(false);
 const reading=useRef<string|null>(null),revision=useRef(0),alive=useRef(true);
 async function request(body?:any,selectedDay=day){
  const session=(await db?.auth.getSession())?.data.session;
  if(!session){setLogin(true);setData(null);throw Error('기존 관리자 계정으로 로그인해주세요.');}
  const r=await fetch('/api/operations/ledger'+(body?'':(selectedDay?'?day='+selectedDay:'')),{method:body?'POST':'GET',cache:'no-store',signal:AbortSignal.timeout(body?60000:20000),headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
  const b=await r.json();if(!r.ok){if(r.status===403){setLogin(true);setData(null);}throw Error(b.error||'연결을 확인해주세요.');}if(!body&&(!Array.isArray(b.gameStates)||!Array.isArray(b.daily)||!Array.isArray(b.fnb)||!Array.isArray(b.players)||!Array.isArray(b.menu)||!Array.isArray(b.history)||!Array.isArray(b.reservations)||!validLedgerDay(b.day)||(!!selectedDay&&b.day!==selectedDay)||typeof b.sourceHash!=='string'))throw Error('정산 서비스의 연동 자료를 확인하지 못했습니다. 잠시 후 새로고침해주세요.');return b;
 }
 const load=useCallback(async()=>{
  if(reading.current===day||counterQueue.current?.pending||inlineRunning.current)return;reading.current=day;const rev=revision.current;setRefreshing(true);
  try{const b=await request(undefined,followCurrent.current?'':day);if(alive.current&&rev===revision.current){if(dataRef.current&&b.day!==day){setNextDay(b.day);return;}setData(b);if(b.day!==day)setDay(b.day);setNextDay('');setLogin(false);setError('');}}
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
  const savedOperation=draft?.operation,pendingKey='dream-ledger-pending:'+day;
  if(savedOperation)try{sessionStorage.setItem(pendingKey,JSON.stringify({id,day,kind:savedOperation.kind,row:savedOperation.row||0,game:savedOperation.game||'',player:savedOperation.label||'게임 입력',reference:(savedOperation.kind==='game'||savedOperation.kind==='scan'&&savedOperation.mode==='new')&&savedOperation.sourceNo?{day:savedOperation.date,game:savedOperation.game,sourceNo:savedOperation.sourceNo}:undefined}));}catch{}
  try{
   setUncertain(true);const b=await request({action,id});
   if(b.applied){
    const operation=draft?.operation;if(operation&&['game','scan','buyins','participant','cancel'].includes(operation.kind))rememberUndo({kind:'ledger',id,label:['game','scan'].includes(operation.kind)?operation.game+'번 입력':operation.label});
    if(operation?.kind==='game_edit')rememberUndo(null);setNotice('');setStatusMessage(operation?.kind==='game_edit'?operation.game+'번 수정 완료':['game','scan'].includes(operation?.kind)?operation.game+'번 반영 완료':'입력 완료');try{sessionStorage.removeItem(pendingKey);}catch{}
    setDraft(null);setPreview(null);setUncertain(false);
    if(['game','scan','game_edit'].includes(operation?.kind)){
     setSelectedGame('');
     if(operation.sourceNo&&(operation.kind==='game'||operation.kind==='scan'&&operation.mode==='new')){
      const reference={day:operation.date,game:Number(operation.game),sourceNo:operation.sourceNo};
      try{await persistReference(reference);}catch(e){setReferenceDraft(reference);setReferenceError('참가 기록은 저장됐습니다. No.만 저장하지 못했습니다. '+(e as Error).message);}
     }
    }
    await load();
    if(['game','scan','game_edit'].includes(operation?.kind)){
     try{const fresh=await request(undefined,operation.date);setData(fresh);const row=fresh.daily.find((r:any)=>r.game===Number(operation.game));if(row){const id=[row.game,row.table,row.blind].join('|');setSelectedGame(id);pendingScroll.current=id;}if(operation.kind==='scan'&&operation.mode==='new'){const state=fresh.gameStates.find((g:any)=>g.game_no===operation.game);await request({action:'game_status',day:operation.date,game:operation.game,status:'prepared',version:state?.version??null,sourceHash:fresh.sourceHash});const ready=await request(undefined,operation.date);setData(ready);}}catch{setNotice('참가 기록은 저장됐습니다. 화면 갱신을 기다려주세요.');}
    }
   }else{setNotice((b.summary||[]).join(' · '));setUncertain(false);await load();}
  }catch(e){setNotice((e as Error).message);await load();}finally{setBusy(false);}
 }

 const op=draft?.operation;

 const counterLocked=busy||rowAction?.stage==='uncertain'||!!error||!data||data.day!==day;
 const locked=counterLocked||counterEntries.length>0;
 const stale=!!draft&&data?.sourceHash!==draft.sourceHash;
 function gameDraft(reservation?:any,group?:any){
  edit({kind:'game',date:day,game:group?.game??Math.max(0,...groups.map(g=>Number(g.game)||0))+1,table:group?Number(String(group.table).split('-')[0]):reservation?.game?.table_no?Number(reservation.game.table_no):'',blind:group?.blind||'',players:[{player:reservation?.player_name_en||reservation?.player_name||'',buyins:1}],...(reservation?{reservationId:reservation.id,reservationVersion:reservation.version}:{})});
 }

 async function reviewScan(result:any,signal:AbortSignal){
  if(!Array.isArray(result.players)||!result.players.length)throw Error('읽은 명단을 확인하지 못했습니다.');
  const fresh=await request(undefined,day);if(signal.aborted)return;setData(fresh);setError('');setTab('main');
  setDraft({sourceHash:fresh.sourceHash,operation:{kind:'scan',date:day,mode:'',game:Math.max(0,...fresh.daily.map((r:any)=>Number(r.game)||0))+1,table:result.table,blind:result.blind,sourceNo:result.sourceNo||'',players:result.players,scanHash:result.scanHash,scanTable:result.table,scanBlind:result.blind,warnings:result.warnings||[]}});setPreview(null);setUncertain(false);setNotice('');
 }
 function scanTarget(value:string){
  if(value==='new')change({mode:'new',game:Math.max(0,...groups.map(g=>g.game))+1,table:op.scanTable,blind:op.scanBlind});
  else{const group=groups.find(g=>g.id===value);if(group)change({mode:'existing',game:group.game,table:Number(group.physical),blind:group.blind});}
 }
 function editGame(group:any){
  const state=gameState(group);edit({kind:'game_edit',date:day,game:group.game,tableLabel:group.table,blind:group.blind,sourceNo:state?.source_no||'',expectedTable:group.table,expectedBlind:group.blind,version:state?.version??null});
 }
 const [gameFilter,setGameFilter]=useState(''),[floorFilter,setFloorFilter]=useState('');
 const [selectedGame,setSelectedGame]=useState(''),[agency,setAgency]=useState(''),[limit,setLimit]=useState(80);
 const [rosterQueries,setRosterQueries]=useState<Record<string,string>>({});
 const gameStack=useRef<HTMLDivElement>(null),gamePanels=useRef(new Map<string,HTMLElement>()),openedDay=useRef(''),pendingScroll=useRef<string|null>(null);
 const playerIndex=useMemo(()=>new Map<string,any>((data?.players||[]).map((p:any)=>[key(p.name),p])),[data?.players]);
 const records=(data?.daily||[]).filter((r:any)=>(!query||key(r.player).includes(key(query))||String(r.game)===query)&&(!gameFilter||String(r.game)===gameFilter)&&(!agency||playerIndex.get(key(r.player))?.agency===agency));
 const orders=(data?.fnb||[]).filter((r:any)=>(!query||key(r.note).includes(key(query)))&&(!floorFilter||r.floor===floorFilter));
 function selectDay(value:string){if(!value||busy||draft||counterQueue.current?.pending||rowAction?.stage==='uncertain')return;rememberSettlementDay(value);revision.current++;setDay(value);setData(null);setError('');setSelectedGame('');setRosterQueries({});openedDay.current='';pendingScroll.current=null;setStatusTarget(null);setReferenceDraft(null);setReferenceError('');setGameFilter('');setNotice('');setRowAction(null);}
 useEffect(()=>{const sync=()=>{const params=new URLSearchParams(window.location.search),d=params.get('day');if(d&&d!==day)selectDay(d);else{const target=groups.find(g=>g.game===Number(params.get('game')));if(target)chooseGame(target);}};window.addEventListener('popstate',sync);return()=>window.removeEventListener('popstate',sync);},[day,data,busy,!!draft]);
 function shiftDay(delta:number){selectDay(new Date(Date.parse(day+'T12:00:00Z')+delta*86400000).toISOString().slice(0,10));}
 const dialog=useRef<HTMLDialogElement>(null);
 const dialogOpen=!!draft&&view!=='games';
 const inlineEditor=useRef<HTMLElement>(null);
 useEffect(()=>{if(draft&&view==='games'){inlineEditor.current?.scrollIntoView({block:'nearest',behavior:'smooth'});inlineEditor.current?.querySelector<HTMLInputElement>('input')?.focus({preventScroll:true});}},[!!draft,view]);
 useEffect(()=>{if(dialogOpen){dialog.current?.showModal();}else if(dialog.current?.open)dialog.current.close();},[dialogOpen]);
 function closeEditor(){if(busy)return;setDraft(null);setPreview(null);setUncertain(false);}
 function buyin(r:any,delta=0){edit({kind:'buyins',row:r.row,expected:r.expected,buyins:Number(r.buyins)+delta,reason:'',label:r.game+'번 게임 · '+r.player});}
 const counterMap=new Map(counterEntries.map(e=>[e.key,e]));
 const displayDaily=(data?.daily||[]).filter((r:any)=>!(rowAction?.stage==='saving'&&rowAction?.kind==='cancel'&&r.row===rowAction.row)).map((r:any)=>{
  const c=counterMap.get(counterKey(r));if(c)return {...r,buyins:c.target,_pending:true};
  if(rowAction?.stage==='saving'&&rowAction?.row===r.row)return {...r,player:rowAction.replacement||r.player,buyins:rowAction.value??r.buyins,_pending:true};
  return r;
 });
 const groups=Object.values(displayDaily.reduce((all:Record<string,any>,r:any)=>{const id=[r.game,r.table,r.blind].join('|');if(!all[id])all[id]={id,game:r.game,table:r.table,physical:String(r.table).split('-')[0],blind:r.blind,players:[],buyins:0};all[id].players.push(r);all[id].buyins+=Number(r.buyins)||0;return all;},{})) as any[];
 const gameState=(g:any)=>gameStateFor(data?.gameStates||[],g);
 const statusOf=(g:any)=>gameStatusFor(data?.gameStates||[],g);
 const liveGames=groups.filter(g=>statusOf(g)==='active').sort((a,b)=>Number(b.game)-Number(a.game));
 const liveTableCount=new Set(liveGames.map(g=>String(g.physical))).size;
 const orderedGames=orderGames(groups,data?.gameStates||[]);
 const worksheetGames=[...groups].sort((a,b)=>Number(b.game)-Number(a.game)||a.id.localeCompare(b.id));
 const shortcutGames=[...liveGames,...worksheetGames.filter(g=>statusOf(g)!=='active')];
 const unmatchedActive=(data?.gameStates||[]).filter((s:any)=>s.status==='active'&&!groups.some(g=>gameState(g)===s));

 function scrollToGame(id:string,behavior:ScrollBehavior='smooth'){
  const stack=gameStack.current,panel=gamePanels.current.get(id);if(!stack||!panel)return false;
  stack.scrollTo({top:stack.scrollTop+panel.getBoundingClientRect().top-stack.getBoundingClientRect().top,behavior});return true;
 }
 function chooseGame(g:any){if(draft||referenceDraft)return;setSelectedGame(g.id);setStatusTarget(null);scrollToGame(g.id);gamePanels.current.get(g.id)?.focus({preventScroll:true});}
 useEffect(()=>{
  if(view!=='games'||tab!=='main'||!data||data.day!==day||draft||!gameStack.current)return;
  if(pendingScroll.current){if(scrollToGame(pendingScroll.current)){pendingScroll.current=null;}return;}
  if((openedDay.current===day&&orderedGames.some(g=>g.id===selectedGame))||!orderedGames.length)return;
  const requested=Number(new URLSearchParams(window.location.search).get('game'));
  const first=orderedGames.find(g=>g.game===requested)||worksheetGames[0];if(scrollToGame(first.id,'instant')){openedDay.current=day;setSelectedGame(first.id);}
 },[data,day,view,tab,!!draft]);
 async function updateGameStatus(target=statusTarget){
  if(!target||locked)return;setBusy(true);setNotice('');
  try{
   await request({action:'game_status',day,game:target.game,status:target.status,version:target.version,sourceHash:target.sourceHash});
   // Ignore reads started before this write, and verify the saved state before announcing completion.
   revision.current++;
   const fresh=await request(undefined,day);setData(fresh);setError('');
   const saved=fresh.gameStates.find((s:any)=>s.game_no===target.game);
   if(saved?.status!==target.status)throw Error('게임 상태를 다시 확인해주세요. 다른 직원의 변경이 있을 수 있습니다.');
   rememberUndo({kind:'status',game:target.game,status:target.previousStatus||'unconfirmed',version:saved.version});
   setStatusTarget(null);setStatusMessage(target.game+'번 · '+gameStatusLabels[saved.status]);
  }
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
  if(item.version===undefined&&state?.source_no&&state.source_no!==item.sourceNo)throw Error('다른 No.가 이미 저장되어 있습니다. 해당 게임에서 번호를 확인해주세요.');
  await request({action:'game_reference',day:item.day,game:item.game,sourceNo:item.sourceNo,version:item.version===undefined?(state?.version??null):item.version,sourceHash:fresh.sourceHash});
 }
 async function saveReference(){
  if(!referenceDraft)return;setBusy(true);setReferenceError('');
  try{const before=dataRef.current.gameStates.find((s:any)=>s.game_no===referenceDraft.game);await persistReference(referenceDraft);revision.current++;const fresh=await request(undefined,day);setData(fresh);const saved=fresh.gameStates.find((s:any)=>s.game_no===referenceDraft.game);rememberUndo({kind:'reference',game:referenceDraft.game,sourceNo:before?.source_no||'',version:saved?.version});setReferenceDraft(null);setStatusMessage('No. 저장 완료');}
  catch(e){setReferenceError((e as Error).message);}finally{setBusy(false);}
 }

 useEffect(()=>{if(view!=='games')return;try{const saved=JSON.parse(sessionStorage.getItem('dream-ledger-pending:'+day)||'null');if(saved&&/^[-a-f0-9]{36}$/.test(saved.id))setRowAction({...saved,stage:'uncertain',message:'이전 저장 결과를 확인해주세요.'});}catch{}},[day,view]);
 async function commitRow(row:any,operation:any,retry=false){
  if(inlineRunning.current||(!retry&&(locked||draft||referenceDraft)))return false;
  inlineRunning.current=true;setBusy(true);setNotice('');revision.current++;
  let commandId=retry?rowAction?.id:undefined;
  const context=retry?{...rowAction}:{row:row.row,player:row.player,game:row.game,value:operation.buyins,kind:operation.kind,replacement:operation.kind==='participant'?operation.player:undefined,day};
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
    if(retry&&context.reference)try{await persistReference(context.reference);}catch(e){setReferenceDraft(context.reference);setReferenceError((e as Error).message);}
    clear();setRowAction({...context,stage:'done'});if(context.kind==='undo'||context.kind==='game_edit')rememberUndo(null);else if(commandId)rememberUndo({kind:'ledger',id:commandId,label:context.player});if(retry&&counterQueue.current?.pending){const row=dataRef.current?.daily.find((r:any)=>r.row===context.row&&r.player===context.player);if(row)counterQueue.current.reconcile(row);}setStatusMessage(context.kind==='undo'?'실행 취소 완료':context.game+'번 · '+context.player+' 반영 완료');return true;
   }
   if(!commandId||result?.status==='preview'||result?.status==='failed'||result?.failed||result?.applied===false&&result?.status!=='writing'){
    clear();setRowAction({...context,stage:'error',message:failure||'저장되지 않았습니다. 최신 기록을 확인해주세요.'});await load();return false;
   }
   setRowAction({...context,id:commandId,stage:'uncertain',message:failure||'저장 결과를 확인 중입니다. 같은 요청의 결과를 확인해주세요.'});return false;
  }finally{inlineRunning.current=false;setBusy(false);}
 }

 async function saveCounter(row:any,count:number){
  revision.current++;
  let id:string|undefined,result:any=null;
  const context={row:row.row,player:row.player,game:row.game,value:count,kind:'buyins',day};
  const pendingKey='dream-ledger-pending:'+day;
  const remember=(value:string)=>{id=value;try{sessionStorage.setItem(pendingKey,JSON.stringify({...context,id}));}catch{}};
  try{
   try{result=await submitLedgerChange(body=>request(body),{operation:{kind:'buyins',row:row.row,expected:row.expected,buyins:count},sourceHash:dataRef.current?.sourceHash},remember);}
   catch(error){if(id){try{result=await request({action:'result',id});}catch{}}if(!result?.applied)throw error;}
   if(!result?.applied)throw Error('저장 결과를 확인해주세요.');
   const fresh=await request(undefined,day),saved=fresh.daily.find((r:any)=>counterKey(r)===counterKey(row));
   if(!saved||Number(saved.buyins)!==count)throw Error('최신 바이인 기록과 저장 결과를 다시 확인해주세요.');
   revision.current++;setData(fresh);setError('');try{sessionStorage.removeItem(pendingKey);}catch{}
   if(id)rememberUndo({kind:'ledger',id,label:row.game+'번 · '+row.player});
   return saved;
  }catch(error:any){
   const uncertain=!!id&&!['preview','failed'].includes(result?.status)&&!result?.failed;
   if(!uncertain){try{sessionStorage.removeItem(pendingKey);}catch{}}
   throw Object.assign(Error(error.message||'저장하지 못했습니다.'),{uncertain,context:{...context,id}});
  }
 }
 useEffect(()=>{
  const queue=new LedgerCounterQueue({save:saveCounter,change:setCounterEntries,error:(row,error)=>{
   const context=error.context||{row:row.row,player:row.player,game:row.game,day};
   setRowAction({...context,stage:error.uncertain?'uncertain':'error',message:error.message});
   if(!error.uncertain)setNotice(row.player+' · '+error.message);
  }});
  counterQueue.current=queue;
  const leave=(event:BeforeUnloadEvent)=>{if(queue.pending||inlineRunning.current){event.preventDefault();event.returnValue='';}};
  window.addEventListener('beforeunload',leave);
  return()=>{window.removeEventListener('beforeunload',leave);if(!queue.pending)queue.dispose();};
 },[day]);
 function stepCounter(row:any,delta:number){if(counterLocked||draft||referenceDraft)return;setNotice('');counterQueue.current?.change(row,delta);}
 async function undoLast(){
  if(!undoTarget||locked)return;setBusy(true);setNotice('');let id:string|undefined,result:any;
  try{
   if(['status','reference'].includes(undoTarget.kind)){
    await request({action:undoTarget.kind==='status'?'game_status':'game_reference',day,game:undoTarget.game,status:undoTarget.status,sourceNo:undoTarget.sourceNo,version:undoTarget.version,sourceHash:dataRef.current.sourceHash});
   }else{
    const preview=await request({action:'undo_preview',id:undoTarget.id});id=preview.id;
    if(!id)throw Error('실행 취소 요청을 확인하지 못했습니다.');
    const item={id,kind:'undo',row:0,player:'실행 취소',game:'',day};try{sessionStorage.setItem('dream-ledger-pending:'+day,JSON.stringify(item));}catch{}
    try{result=await request({action:'apply',id});}catch(error){try{result=await request({action:'result',id});}catch{}if(!result?.applied)throw error;}
    if(!result?.applied)throw Error('실행 취소 결과를 확인해주세요.');
   }
   revision.current++;const fresh=await request(undefined,day);setData(fresh);setError('');rememberUndo(null);setStatusMessage('실행 취소 완료');
   try{sessionStorage.removeItem('dream-ledger-pending:'+day);}catch{}
  }catch(error:any){
   if(id&&!['preview','failed'].includes(result?.status))setRowAction({id,kind:'undo',row:0,player:'실행 취소',game:'',day,stage:'uncertain',message:'실행 취소 결과를 확인해주세요.'});
   else{try{sessionStorage.removeItem('dream-ledger-pending:'+day);}catch{}setNotice(error.message);}
  }finally{setBusy(false);}
 }
 async function saveGameInline(){
  if(!draft||locked||stale)return;setBusy(true);setNotice('');
  try{
   if(preview?.id){await save('apply',preview.id);return;}
   const next=await request({action:'preview',...draft});
   if(next.noop){setDraft(null);setStatusMessage('이미 입력된 명단입니다.');await load();return;}
   setPreview(next);await save('apply',next.id);
  }catch(error){setNotice((error as Error).message);}finally{setBusy(false);}
 }
 const gameEntryContent=['game','scan'].includes(op?.kind)&&<form className={styles.inlineGameForm} onSubmit={e=>{e.preventDefault();void saveGameInline();}}>
  <fieldset disabled={busy||uncertain}>
   {op.kind==='scan'&&<div className={styles.scanReviewHead}><strong>스캔 명단</strong><select aria-label='스캔 입력할 게임' required value={op.mode==='new'?'new':op.mode==='existing'?groups.find(g=>g.game===op.game)?.id||'':''} onChange={e=>scanTarget(e.target.value)}><option value=''>입력할 게임 선택</option><option value='new'>새 게임</option>{orderedGames.map(g=><option key={g.id} value={g.id}>{g.game}번 · 테이블 {g.physical} · {g.blind}</option>)}</select>{op.mode==='existing'&&op.scanTable&&Number(op.scanTable)!==op.table&&<span>사진 테이블 {op.scanTable} → 선택한 테이블 {op.table}</span>}</div>}
   <div className={styles.gameFormatRow}>
    <label>게임<input aria-label='새 게임 번호' readOnly={op.kind==='scan'&&op.mode==='existing'} type='number' min='1' max='100' required value={op.game} onChange={e=>change({game:Number(e.target.value)})}/></label>
    <label>테이블<input aria-label='새 게임 테이블' readOnly={op.kind==='scan'&&op.mode==='existing'} type='number' min='1' max='100' required value={op.table} onChange={e=>change({table:Number(e.target.value)})}/></label>
    <label>게임 포맷<select aria-label='게임 포맷' disabled={op.kind==='scan'&&op.mode==='existing'} required value={op.blind} onChange={e=>change({blind:e.target.value})}><option value=''>선택</option>{['3M','5M','10M','15M'].map(x=><option key={x}>{x}</option>)}</select></label>
    <label>No.<input aria-label='새 게임 No.' readOnly={op.kind==='scan'&&op.mode==='existing'} inputMode='numeric' pattern='[0-9]{1,8}' maxLength={8} value={op.sourceNo||''} onChange={e=>change({sourceNo:e.target.value})}/></label>
    <button type='submit' className={styles.primary} disabled={stale}>{busy?'저장 중…':'저장'}</button><button type='button' onClick={closeEditor}>취소</button>
   </div>
   <div className={styles.entryTable}><table><thead><tr><th>이름</th><th>소속</th><th>바인</th><th></th></tr></thead><tbody>{op.players.map((p:any,i:number)=><tr key={i}><td><input aria-label={'참가자 '+(i+1)+' 영문명'} list='quick-game-players' required readOnly={!!op.reservationId} placeholder='플레이어 이름' value={p.player} onChange={e=>change({players:op.players.map((v:any,j:number)=>j===i?{...v,player:e.target.value}:v)})}/></td><td>{playerIndex.get(key(p.player))?.agency||'—'}</td><td><input aria-label={'참가자 '+(i+1)+' 총 바인'} type='number' min='1' max='50' required value={p.buyins} onChange={e=>change({players:op.players.map((v:any,j:number)=>j===i?{...v,buyins:Number(e.target.value)}:v)})}/></td><td>{op.players.length>1&&!op.reservationId&&<button type='button' aria-label={'참가자 '+(i+1)+' 제외'} onClick={()=>change({players:op.players.filter((_:any,j:number)=>i!==j)})}>×</button>}</td></tr>)}</tbody></table></div>
   {!op.reservationId&&<button type='button' className={styles.addEntryRow} disabled={op.players.length>=20} onClick={()=>change({players:[...op.players,{player:'',buyins:1}]})}>＋ 참가자</button>}
  </fieldset>
  <datalist id='quick-game-players'>{data?.players.map((p:any,i:number)=><option key={i} value={p.name}/>)}</datalist>
  {op.kind==='scan'&&op.warnings?.map((warning:string,i:number)=><p key={i} className={styles.scanWarning}>{warning}</p>)}
  {notice&&<p role='alert'>{notice}</p>}{stale&&<p role='alert'>기록이 변경됐습니다. 입력을 닫고 다시 확인해주세요.</p>}
  {uncertain&&<button type='button' disabled={busy} onClick={()=>void save('apply',preview?.id)}>저장 결과 확인</button>}
 </form>;

 const gameSettingsContent=op?.kind==='game_edit'&&<form className={styles.inlineGameForm} onSubmit={e=>{e.preventDefault();void saveGameInline();}}><fieldset disabled={busy||uncertain}><div className={styles.gameFormatRow}>
  <label>게임<input value={op.game+'번'} readOnly aria-label='수정할 게임'/></label>
  <label>테이블<input aria-label='게임 테이블 수정' required pattern='[1-9][0-9]?(-[1-9][0-9]?)?' maxLength={5} value={op.tableLabel} onChange={e=>change({tableLabel:e.target.value})}/></label>
  <label>게임 포맷<select aria-label='게임 포맷 수정' value={op.blind} onChange={e=>change({blind:e.target.value})}>{['3M','5M','10M','15M'].map(x=><option key={x}>{x}</option>)}</select></label>
  <label>No.<input aria-label='게임 No. 수정' inputMode='numeric' pattern='[0-9]{1,8}' maxLength={8} value={op.sourceNo} onChange={e=>change({sourceNo:e.target.value})}/></label>
  <button type='submit' className={styles.primary} disabled={stale}>{busy?'저장 중…':'저장'}</button><button type='button' onClick={closeEditor}>취소</button>
 </div></fieldset>{notice&&<p role='alert'>{notice}</p>}{stale&&<p role='alert'>기록이 변경됐습니다. 다시 확인해주세요.</p>}{uncertain&&<button type='button' disabled={busy} onClick={()=>void save('apply',preview?.id)}>저장 결과 확인</button>}</form>;

 const editorContent=draft&&<><div className={styles.dialogHead}><h2 id='ledger-editor-title'>{op.label||({game:'게임 입력',fnb:'F&B 입력',fnb_edit:'F&B 수정',register:'신규 선수 등록'} as any)[op.kind]}</h2><button aria-label='입력창 닫기' disabled={busy} onClick={closeEditor}>✕</button></div><div className={styles.dialogBody}><div className={styles.editContext}><span>{op.date||day}</span><b>{preview?'2 · 저장 확인':'1 · 내용 입력'}</b></div>
 {notice&&<p className={styles.notice} role='status'>{notice}</p>}
 {stale&&<p role='alert'>다른 작업에서 기록이 변경됐습니다. 현재 입력을 닫고 최신 기록에서 다시 선택해주세요.</p>}
 {preview?<><h3>이 내용으로 저장할까요?</h3><ul>{preview.summary.map((s:string,i:number)=><li key={i}>{s}</li>)}{op.kind==='game'&&op.sourceNo&&<li>No. {op.sourceNo} (별도 번호)</li>}</ul><button className={styles.primary} disabled={busy||(!uncertain&&(stale||locked))} onClick={()=>void save()}>{busy?'저장 결과 확인 중…':uncertain?'같은 요청의 결과 다시 확인':'확인한 내용 저장'}</button>{!uncertain&&<button className={styles.backButton} disabled={busy} onClick={()=>setPreview(null)}>← 입력 내용 수정</button>}{uncertain&&<p>응답이 끊겨도 새로 입력하지 마세요. 처리 이력에서 같은 요청의 결과를 확인할 수 있습니다.</p>}</>:<form onSubmit={e=>{e.preventDefault();void prepare();}} className={styles.form}><fieldset disabled={busy}>
 {op.kind==='game'&&<>
 <div className={styles.gameFields}>
 <label>우리 게임 순번<input aria-label='우리 게임 순번' type='number' required min='1' max='100' value={op.game} onChange={e=>change({game:Number(e.target.value)})}/></label>
 <label>실제 테이블<input type='number' required min='1' max='100' value={op.table} onChange={e=>change({table:Number(e.target.value)})}/></label>
 <label>블라인드<select required value={op.blind} onChange={e=>change({blind:e.target.value})}><option value=''>선택</option>{['3M','5M','10M','15M'].map(x=><option key={x}>{x}</option>)}</select></label>
 <label>No.<input inputMode='numeric' pattern='[0-9]{1,8}' maxLength={8} value={op.sourceNo||''} placeholder='영수증·전광판 번호' onChange={e=>change({sourceNo:e.target.value})}/></label>
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
 {statusMessage&&<p className={styles.statusToast} role='status'>✓ {statusMessage}</p>}
 {view!=='games'&&<> <header className={styles.header}><div><span className={styles.eyebrow}>DREAM POKER</span><h1>{title}</h1>{view!=='players'&&<p>{caption}</p>}</div><div className={styles.headerActions}>{view!=='players'&&<div className={styles.datePicker}><button aria-label='이전 날짜' disabled={busy||!!draft} onClick={()=>shiftDay(-1)}>‹</button><input aria-label='영업일' type='date' value={day} disabled={busy||!!draft} onChange={e=>selectDay(e.target.value)}/><button aria-label='다음 날짜' disabled={busy||!!draft} onClick={()=>shiftDay(1)}>›</button>{day!==today()&&<button disabled={busy||!!draft} onClick={()=>selectDay(today())}>오늘</button>}</div>}<button aria-label='기록 새로고침' disabled={refreshing} onClick={()=>void load()}>{refreshing?'갱신 중…':'↻ 새로고침'}</button><button className={styles.primary} disabled={locked||!!draft} onClick={()=>view==='fnb'?newFnb():view==='players'?newPlayer():gameDraft()}>{view==='fnb'?'+ 주문 입력':view==='players'?'+ 플레이어 등록':'+ 새 게임 입력'}</button></div></header>
 <div className={styles.sync} role='status'><span className={error?styles.offline:styles.dot}/>{error?'연결 확인 필요':data?'구글 시트 연결됨':'기록 불러오는 중'}<span className={styles.syncTime}>{data?new Date(data.checkedAt).toLocaleTimeString('ko-KR',{timeZone:'Asia/Ho_Chi_Minh'}):'—'} · 15초마다 갱신</span></div></>}

 {error&&<p className={styles.notice} role='alert'>{error} {data?'마지막으로 확인한 자료를 표시합니다.':''} <button disabled={refreshing} onClick={()=>void load()}>다시 불러오기</button></p>}
 {notice&&!draft&&<p className={styles.notice} role='status'>{notice}</p>}
 {rowAction?.stage==='uncertain'&&<div className={styles.pendingRowNotice} role='status'><span>{rowAction.game}번 · {rowAction.player} — {rowAction.message}</span><button disabled={busy} onClick={()=>void commitRow(null,null,true)}>결과 확인</button></div>}
 {login?<section className={styles.panel}><h2>관리자 로그인</h2><form className={styles.form} onSubmit={e=>{e.preventDefault();void signIn();}}><label>아이디 또는 이메일<input autoComplete='username' value={account} onChange={e=>setAccount(e.target.value)}/></label><label>비밀번호<input autoComplete='current-password' type='password' value={password} onChange={e=>setPassword(e.target.value)}/></label><button disabled={busy}>로그인</button></form></section>:<>
 {view!=='games'&&<> <nav className={styles.tabs} aria-label={title+' 보기'}><button aria-pressed={tab==='main'} onClick={()=>setTab('main')}>{view==='daily'?'일일 장부':view==='fnb'?'주문 내역':'선수 명단'}</button><button aria-pressed={tab==='history'} onClick={()=>setTab('history')}>처리 이력</button></nav></>}
 {view==='games'&&tab!=='main'&&<button className={styles.backButton} onClick={()=>setTab('main')}>← 게임으로 돌아가기</button>}

 {!data&&!error&&<div className={styles.loading} role='status'><div/><div/><div/><p>{view==='players'?'플레이어 명단을 불러오고 있습니다.':'오늘의 기록을 불러오고 있습니다.'}</p></div>}
 {data&&<>

 {tab==='main'&&view==='games'&&<>
 <div className={styles.quickGameBar}>
 <nav className={styles.liveGameTabs} aria-label='게임 바로가기'>{shortcutGames.map(g=><button key={g.id} aria-label={g.game+'번 게임 선택 · 테이블 '+g.physical} aria-pressed={selectedGame===g.id} data-active={statusOf(g)==='active'||undefined} disabled={!!draft||!!referenceDraft} onClick={()=>chooseGame(g)}><strong>{g.game}번</strong><small>{statusOf(g)==='active'?'진행 · ':''}T{g.physical}</small></button>)}{!groups.length&&<span className={styles.gameHint}>새 게임을 입력하세요.</span>}</nav>
 <details className={styles.gameChooser} open={gameChooserOpen} onToggle={e=>setGameChooserOpen(e.currentTarget.open)}><summary>게임 관리</summary><div><small>{day.replace(/-/g,'.')} · {liveGames.length?liveTableCount+'테이블 진행':'영업일'}</small><label>게임 선택<select aria-label='관리할 게임 선택' value={selectedGame} disabled={!!draft||!!referenceDraft} onChange={e=>{const g=groups.find(g=>g.id===e.target.value);if(g){chooseGame(g);setGameChooserOpen(false);}}}>{[['active','진행 중'],['prepared','시작 전'],['unknown','상태 미확인'],['closed','종료 게임']].map(([status,label])=><optgroup key={status} label={label}>{orderedGames.filter(g=>status==='unknown'?['unknown','unconfirmed'].includes(statusOf(g)):statusOf(g)===status).map(g=><option key={g.id} value={g.id}>{g.game}번 · 테이블 {g.physical}</option>)}</optgroup>)}</select></label><span>선택한 게임에서 시작·종료</span>{unmatchedActive.length>0&&<span role='status'>장부 연결 확인 필요 {unmatchedActive.length}건</span>}<FlowLink tab='daily' day={day} disabled={locked||!!draft||!!referenceDraft}>당일 정산 →</FlowLink></div></details>
 <div className={styles.gameTopActions}><ReceiptScanner day={day} disabled={locked||!!draft||!!referenceDraft} onReview={reviewScan}/><button aria-label='실행 취소' title={undoTarget?.label||'최근 입력 실행 취소'} disabled={locked||uncertain||!!referenceDraft||(!draft&&!undoTarget)} onClick={()=>draft?closeEditor():void undoLast()}><svg className={styles.undoIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M3 7v6h6"/><path d="M21 17a8 8 0 0 0-13.66-5.66L3 13"/></svg><span>실행 취소</span></button><button className={styles.primary} disabled={locked||!!draft||!!referenceDraft} onClick={()=>{setTab('main');gameDraft();}}>＋ 새 게임</button>
 <details className={styles.gameMenu}><summary aria-label='게임 설정'>⋯</summary><div className={styles.gameMenuContent}><small>{day.replace(/-/g,'.')} 영업일</small>{!followCurrent.current&&<button type='button' disabled={locked||!!draft||!!referenceDraft} onClick={()=>{const url=new URL(window.location.href);url.searchParams.delete('game');window.history.replaceState(window.history.state,'',url);followCurrent.current=true;revision.current++;setData(null);openedDay.current='';setSelectedGame('');void load();}}>현재 게임</button>}<button disabled={refreshing} onClick={()=>void load()}>새로고침</button><button disabled={!!draft||!!referenceDraft} onClick={()=>setTab('scan')}>스캔 처리</button><FlowLink tab='players' day={day} disabled={locked||!!draft||!!referenceDraft}>플레이어 등록·검색</FlowLink><button disabled={!!draft||!!referenceDraft} onClick={()=>setTab('reservations')}>예약 연결</button><button disabled={!!draft||!!referenceDraft} onClick={()=>setTab('history')}>처리 이력</button><FlowLink tab='daily' day={day} disabled={busy||!!draft||!!referenceDraft||rowAction?.stage==='uncertain'}>일일 정산 →</FlowLink></div></details></div>
 </div>
 {draft&&<section ref={inlineEditor} className={styles.gameEntryRow}>{op.kind==='game_edit'?gameSettingsContent:['game','scan'].includes(op.kind)?gameEntryContent:editorContent}</section>}
 {referenceDraft&&<form className={styles.referenceEditor} onSubmit={e=>{e.preventDefault();void saveReference();}}><strong>{referenceDraft.game}번 게임</strong><label>No.<input aria-label='No.' inputMode='numeric' pattern='[0-9]{1,8}' maxLength={8} value={referenceDraft.sourceNo} disabled={busy} onChange={e=>setReferenceDraft({...referenceDraft,sourceNo:e.target.value})}/></label><button className={styles.primary} disabled={busy}>번호 저장</button><button type='button' disabled={busy} onClick={()=>{setReferenceDraft(null);setReferenceError('');}}>닫기</button>{referenceError&&<p role='alert'>{referenceError}</p>}</form>}
 {nextDay&&<button disabled={locked||!!draft||!!referenceDraft} onClick={()=>selectDay(nextDay)}>현재 영업일 {nextDay} →</button>}

 <div ref={gameStack} className={`${styles.workspace} ${styles.gameStack}`} aria-label='게임별 참가 장부'>
 {worksheetGames.map(g=>{const rosterQuery=rosterQueries[g.id]||'';return <section key={g.id} ref={node=>{if(node)gamePanels.current.set(g.id,node);else gamePanels.current.delete(g.id);}} tabIndex={-1} className={styles.gamePanel} aria-label={g.game+'번 게임 참가자'} data-game={g.game}>
 <div className={styles.selectedHead}><div className={styles.gameIdentity}><h2>{g.game}번</h2><span>테이블 {g.physical} · {g.blind}</span><span className={statusOf(g)==='active'?styles.liveLabel:styles.statusLabel}>{gameStatusLabels[statusOf(g)]||'상태 미확인'}</span><button className={styles.sourceButton} disabled={locked||!!draft||!!referenceDraft} onClick={()=>{setReferenceDraft({day,game:g.game,sourceNo:gameState(g)?.source_no||'',version:gameState(g)?.version??null});setReferenceError('');}}>No. {gameState(g)?.source_no||'—'}</button></div>
 <div className={styles.controls}><button className={styles.gameAction} aria-label={g.game+'번 게임 '+(statusOf(g)==='active'?'종료':'시작')} disabled={locked||!!draft||!!referenceDraft} onClick={()=>void updateGameStatus({game:g.game,status:statusOf(g)==='active'?'closed':'active',previousStatus:statusOf(g)==='unknown'?'unconfirmed':statusOf(g),version:gameState(g)?.version??null,sourceHash:data.sourceHash})}>{statusOf(g)==='active'?'종료':statusOf(g)==='closed'?'다시 시작':'시작'}</button><button className={styles.gameAction} aria-label={g.game+'번 게임 수정'} disabled={locked||!!draft||!!referenceDraft} onClick={()=>editGame(g)}>수정</button><button className={styles.gameAction} disabled={locked||!!draft||!!referenceDraft} onClick={()=>gameDraft(undefined,g)}>＋ 참가자</button></div></div>
 {statusTarget?.game===g.game&&<div className={styles.statusConfirm} role='alert'><strong>{statusTarget.game}번 게임을 ‘{gameStatusLabels[statusTarget.status]}’ 상태로 표시할까요?</strong><div className={styles.controls}><button className={styles.primary} disabled={locked||!!draft||!!referenceDraft} onClick={()=>void updateGameStatus()}>확인</button><button disabled={busy} onClick={()=>setStatusTarget(null)}>취소</button></div></div>}
 <div className={styles.rosterTools}><div><b>{g.players.length}</b>명 <span>·</span> 총 <b>{g.buyins}</b>바인</div><input aria-label={g.game+'번 게임 참가자 검색'} placeholder='참가자 검색' value={rosterQuery} onChange={e=>setRosterQueries(prev=>({...prev,[g.id]:e.target.value}))}/></div>
 <LedgerGameTable counterLocked={counterLocked||!!draft||!!referenceDraft} onStep={stepCounter} game={g.game} rows={g.players.filter((r:any)=>!rosterQuery||key(r.player).includes(key(rosterQuery)))} players={data.players} playerIndex={playerIndex} locked={locked||!!draft||!!referenceDraft} action={rowAction} onCommit={commitRow} onRetry={()=>void commitRow(null,null,true)} onDismiss={()=>setRowAction(null)}/>

 </section>;})}
 {!orderedGames.length&&!draft&&!error&&<section className={styles.gamePanel}><div className={styles.empty}><strong>첫 게임을 입력하세요.</strong><p>게임 번호·실제 테이블·참가자를 한 번에 등록할 수 있습니다.</p><button className={styles.primary} disabled={locked} onClick={()=>gameDraft()}>＋ 새 게임 입력</button></div></section>}
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
 {tab==='scan'&&<ScanQueue intake={data.intake} error={data.intakeError} day={day} expanded/>}
 {tab==='history'&&<section className={styles.panel}><div className={styles.sectionHead}><h2>내 처리 이력</h2><span>최근 20건</span></div>{data.history.map((h:any)=><div className={styles.history} key={h.id}><span className={styles.historyDot}/><div><strong>{({applied:'저장 확인 완료',preview:'변경안 확인 대기',writing:'저장 결과 확인 필요',failed:'미반영'} as Record<string,string>)[h.status]||h.status}</strong><p>{h.summary.join(' · ')}</p><small>{new Date(h.created_at).toLocaleString('ko-KR',{timeZone:'Asia/Ho_Chi_Minh'})}</small></div>{h.status==='writing'&&<button disabled={busy} onClick={()=>void save('reconcile',h.id)}>저장 결과 대조</button>}</div>)}{!data.history.length&&<div className={styles.empty}><strong>아직 웹에서 처리한 내역이 없습니다.</strong><p>저장한 변경안과 처리 결과가 이곳에 표시됩니다.</p></div>}</section>}
 </>}
  {draft&&view!=='games'&&<dialog ref={dialog} className={styles.dialog} aria-labelledby='ledger-editor-title' onCancel={e=>{e.preventDefault();closeEditor();}}>{editorContent}</dialog>}

 </>}
 </section>;
}
