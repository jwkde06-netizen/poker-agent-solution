'use client';
import {useEffect,useId,useState} from 'react';
import styles from './LiveLedger.module.css';
const key=(v:any)=>String(v||'').toUpperCase().replace(/[^A-Z0-9가-힣]/g,'');
const money=(v:any)=>typeof v==='number'&&Number.isSafeInteger(v)?v.toLocaleString('en-US'):'—';
export default function LedgerGameTable({game,rows,players,playerIndex,locked,counterLocked,action,onCommit,onStep,onRetry,onDismiss}:{game:number;rows:any[];players:any[];playerIndex:Map<string,any>;locked:boolean;counterLocked:boolean;action:any;onCommit:(row:any,operation:any)=>Promise<boolean>;onStep:(row:any,delta:number)=>void;onRetry:()=>void;onDismiss:()=>void}){
 const [editing,setEditing]=useState<any>(null);const listId=useId();
 useEffect(()=>{if(action?.stage==='done')setEditing((edit:any)=>edit?.row.row===action.row?null:edit);},[action?.stage,action?.row]);
 const open=(row:any)=>{if(!locked)setEditing({row,player:row.player,buyins:row.buyins});};
 async function saveEdit(deleting=false){
  if(!editing||locked)return;
  const {row,player,buyins}=editing;setEditing(null);
  await onCommit(row,{kind:deleting?'cancel':player===row.player?'buyins':'participant',row:row.row,expected:row.expected,player,buyins:Number(buyins)});
 }
 return <div className={styles.sheetScroll}><table className={styles.sheetTable} aria-label={game+'번 참가 장부'}>
 <colgroup><col className={styles.indexCol}/><col className={styles.nameCol}/><col className={styles.agencyCol}/><col className={styles.idCol}/><col className={styles.buyinCol}/><col className={styles.moneyCol}/><col className={styles.moneyCol}/></colgroup>
 <thead><tr><th scope='col'>#</th><th scope='col'>이름</th><th scope='col'>소속</th><th scope='col'>ID</th><th scope='col'>바인</th><th scope='col'>레이크</th><th scope='col'>레이크백</th></tr></thead>
 <tbody>{rows.flatMap((r,i)=>{
  const p=playerIndex.get(key(r.player)),current=action?.row===r.row&&action?.player===r.player?action:null;
  const edit=editing?.row.row===r.row?editing:null;
  const row=<tr key={r.row} aria-busy={!!r._pending}>
   <td className={styles.sheetIndex}>{i+1}</td><th scope='row'><button className={styles.sheetName} disabled={locked} aria-label={game+'번 '+r.player+' 수정'} onClick={()=>open(r)}>{r.player}<span aria-hidden='true'>✎</span></button></th>
   <td>{p?.agency||'—'}</td><td className={styles.sheetId}>{p?.card||'—'}</td>
   <td><div className={styles.cellStepper}><button aria-label={game+'번 '+r.player+' 바인 감소'} disabled={counterLocked||Number(r.buyins)<=1} onClick={()=>onStep(r,-1)}>−</button><button className={styles.buyinValue} aria-label={game+'번 '+r.player+' 바인 수정'} title={r._pending?'저장 중':'총 바인'} disabled={locked} onClick={()=>open(r)}>{r.buyins}{r._pending&&<i className={styles.pendingDot} aria-label='저장 중'/>}</button><button className={styles.rebuyPlus} aria-label={game+'번 '+r.player+' 리바인 1회 추가'} disabled={counterLocked||Number(r.buyins)>=50} onClick={()=>onStep(r,1)}>＋</button></div></td>
   <td className={styles.sheetMoney} title='구글 시트 확인값 · VND'>{money(r.rake)}</td><td className={styles.sheetMoney} title='구글 시트 확인값 · VND'>{money(r.rakeback)}</td>
  </tr>;
  const feedback=current&&['error','uncertain'].includes(current.stage)?<tr key={r.row+'-status'}><td colSpan={7} className={styles.cellFeedback}><span role={current.stage==='error'?'alert':'status'}>{current.message}</span>{current.stage==='uncertain'&&<button onClick={onRetry}>결과 확인</button>}{current.stage==='error'&&<button onClick={onDismiss}>닫기</button>}</td></tr>:null;
  const editor=edit?<tr key={r.row+'-edit'}><td colSpan={7} className={styles.rowEditorCell}><form className={styles.rowEditor} onSubmit={e=>{e.preventDefault();void saveEdit();}}><fieldset disabled={locked}>
   <div className={styles.rowEditorFields}><label>이름<input list={listId} required value={edit.player} onChange={e=>setEditing({...edit,player:e.target.value})}/></label><label>총 바인<input type='number' min='1' max='50' required value={edit.buyins} onChange={e=>setEditing({...edit,buyins:e.target.value})}/></label></div>
   <div className={styles.rowEditorActions}><button type='submit' className={styles.primary}>저장</button><button type='button' onClick={()=>setEditing(null)}>닫기</button><button type='button' className={styles.deleteEntry} onClick={()=>void saveEdit(true)}>삭제</button></div>
  </fieldset></form><datalist id={listId}>{players.map((p,i)=><option key={i} value={p.name}/>)}</datalist></td></tr>:null;
  return [row,feedback,editor];
 })}{!rows.length&&<tr><td colSpan={7} className={styles.sheetEmpty}>표시할 참가자가 없습니다.</td></tr>}</tbody>
 </table></div>;
}
