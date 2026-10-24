'use client';
import {useEffect,useId,useState} from 'react';
import styles from './LiveLedger.module.css';
const key=(v:any)=>String(v||'').toUpperCase().replace(/[^A-Z0-9가-힣]/g,'');
const money=(v:any)=>typeof v==='number'&&Number.isSafeInteger(v)?v.toLocaleString('en-US'):'—';
export default function LedgerGameTable({game,rows,players,playerIndex,locked,action,onCommit,onRetry,onDismiss}:{game:number;rows:any[];players:any[];playerIndex:Map<string,any>;locked:boolean;action:any;onCommit:(row:any,operation:any)=>Promise<boolean>;onRetry:()=>void;onDismiss:()=>void}){
 const [editing,setEditing]=useState<any>(null),[agency,setAgency]=useState('');
 const listId=useId();
 useEffect(()=>{if(action?.stage==='done')setEditing((edit:any)=>edit?.row.row===action.row?null:edit);},[action?.stage,action?.row]);
 const agencies=Array.from(new Set(rows.map(r=>String(playerIndex.get(key(r.player))?.agency||'')))).filter(Boolean).sort();
 const visible=rows.filter(r=>!agency||playerIndex.get(key(r.player))?.agency===agency);
 const open=(row:any,count=Number(row.buyins))=>{if(!locked)setEditing({row,player:row.player,buyins:count,reason:'',deleting:false});};
 async function saveEdit(){
  if(!editing||locked)return;
  const {row,player,buyins,reason,deleting}=editing;
  const kind=deleting?'cancel':player===row.player?'buyins':'participant';
  if(await onCommit(row,{kind,row:row.row,expected:row.expected,player,buyins:Number(buyins),reason}))setEditing(null);
 }
 return <div className={styles.sheetScroll}><table className={styles.sheetTable} aria-label={game+'번 참가 장부'}>
 <colgroup><col className={styles.indexCol}/><col className={styles.nameCol}/><col className={styles.agencyCol}/><col className={styles.idCol}/><col className={styles.buyinCol}/><col className={styles.moneyCol}/><col className={styles.moneyCol}/></colgroup>
 <thead><tr><th scope='col'>#</th><th scope='col'>이름</th><th scope='col'><select aria-label={game+'번 소속 필터'} value={agency} onChange={e=>setAgency(e.target.value)}><option value=''>소속</option>{agencies.map(a=><option key={a}>{a}</option>)}</select></th><th scope='col'>ID</th><th scope='col'>바인</th><th scope='col'>레이크</th><th scope='col'>레이크백</th></tr></thead>
 <tbody>{visible.flatMap((r,i)=>{
  const p=playerIndex.get(key(r.player));const current=action?.row===r.row&&action?.player===r.player?action:null;
  const waiting=current&&['saving','uncertain'].includes(current.stage);const edit=editing?.row.row===r.row?editing:null;
  const row=<tr key={r.row} className={waiting?styles.savingRow:undefined} aria-busy={current?.stage==='saving'}>
   <td className={styles.sheetIndex}>{i+1}</td><th scope='row'><button className={styles.sheetName} disabled={locked} aria-label={game+'번 '+r.player+' 수정'} onClick={()=>open(r)}>{r.player}<span aria-hidden='true'>✎</span></button></th>
   <td>{p?.agency||'—'}</td><td className={styles.sheetId}>{p?.card||'—'}</td>
   <td><div className={styles.cellStepper}><button aria-label={game+'번 '+r.player+' 바인 감소'} disabled={locked||Number(r.buyins)<=1} onClick={()=>open(r,Number(r.buyins)-1)}>−</button><button className={styles.buyinValue} aria-label={game+'번 '+r.player+' 바인 수정'} disabled={locked} onClick={()=>open(r)}>{waiting&&current.value!=null?current.value:r.buyins}</button><button className={styles.rebuyPlus} aria-label={game+'번 '+r.player+' 리바인 1회 추가'} disabled={locked||Number(r.buyins)>=50} onClick={()=>void onCommit(r,{kind:'buyins',row:r.row,expected:r.expected,buyins:Number(r.buyins)+1,reason:''})}>＋</button></div></td>
   <td className={styles.sheetMoney} title='구글 시트 계산값 · VND'>{waiting?'…':money(r.rake)}</td><td className={styles.sheetMoney} title='구글 시트 계산값 · VND'>{waiting?'…':money(r.rakeback)}</td>
  </tr>;
  const feedback=current&&current.stage!=='done'?<tr key={r.row+'-status'}><td colSpan={7} className={styles.cellFeedback}><span role={current.stage==='error'?'alert':'status'}>{current.message}</span>{current.stage==='uncertain'&&<button disabled={locked&&current.stage==='saving'} onClick={onRetry}>결과 확인</button>}{current.stage==='error'&&<button onClick={onDismiss}>닫기</button>}</td></tr>:null;
  const editor=edit?<tr key={r.row+'-edit'}><td colSpan={7} className={styles.rowEditorCell}><form className={styles.rowEditor} onSubmit={e=>{e.preventDefault();void saveEdit();}}><fieldset disabled={locked}>
   <div className={styles.rowEditorFields}><label>이름<input list={listId} required value={edit.player} readOnly={edit.deleting} onChange={e=>setEditing({...edit,player:e.target.value})}/></label><label>총 바인<input type='number' min='1' max='50' required value={edit.buyins} readOnly={edit.deleting} onChange={e=>setEditing({...edit,buyins:e.target.value})}/></label><label>수정 사유<input required={edit.deleting||edit.player!==edit.row.player||Number(edit.buyins)<Number(edit.row.buyins)} maxLength={200} placeholder={edit.deleting?'삭제 사유':'이름 변경·바인 감소 시 필수'} value={edit.reason} onChange={e=>setEditing({...edit,reason:e.target.value})}/></label></div>
   {edit.deleting&&<p className={styles.deleteNote}>{game}번에서 {edit.row.player}님의 참가 기록을 삭제합니다. 다른 게임과 선수 명단은 유지됩니다.</p>}
   <div className={styles.rowEditorActions}><button type='submit' className={edit.deleting?styles.deleteConfirm:styles.primary}>{edit.deleting?'참가 기록 삭제':'저장'}</button><button type='button' onClick={()=>setEditing(null)}>취소</button>{!edit.deleting&&<button type='button' className={styles.deleteEntry} onClick={()=>setEditing({...edit,player:edit.row.player,buyins:edit.row.buyins,deleting:true})}>이 게임에서 삭제</button>}</div>
  </fieldset></form><datalist id={listId}>{players.map((p,i)=><option key={i} value={p.name}/>)}</datalist></td></tr>:null;
  return [row,feedback,editor];
 })}{!visible.length&&<tr><td colSpan={7} className={styles.sheetEmpty}>표시할 참가자가 없습니다.{agency&&<button onClick={()=>setAgency('')}>소속 필터 해제</button>}</td></tr>}</tbody>
 </table></div>;
}
