'use client';
import {useState} from 'react';
import {FlowLink,ScanQueue} from './SettlementFlow';
import {dailyPlayerTotals} from '../lib/daily-player-totals';
import styles from './DailySettlement.module.css';
const num=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v.toLocaleString('ko-KR'):'—';
type SortKey='name'|'buyins'|'back';

// Default view: toolbar, totals, player rows. Keep explanations and processing
// history inside the optional review disclosure; do not restore intro banners.
export default function DailySettlement({report,day}:{report:any;day:string}){
 const [sort,setSort]=useState<{key:SortKey;asc:boolean}>({key:'buyins',asc:false});
 const [review,setReview]=useState(false);
 const d=report.days.find((r:any)=>r.date===day);if(!d)return <p role='alert'>선택한 날짜의 정산 자료를 확인하지 못했습니다.</p>;
 const issues=(d.issues||[]).filter((i:any)=>i.kind!=='pending'&&i.date===day);
 const undated=(report.issues||[]).filter((i:any)=>i.kind==='date'&&!i.date);
 const blockedRows=new Set<number>(issues.filter((i:any)=>i.sheet==='일일 입력'&&i.row).map((i:any)=>Number(i.row)));
 const players=dailyPlayerTotals(report.sourceDaily||[],day,blockedRows).sort((a,b)=>{
  const av=a[sort.key],bv=b[sort.key];if(av===null)return bv===null?0:1;if(bv===null)return -1;
  const comparison=typeof av==='string'&&typeof bv==='string'?av.localeCompare(bv,'ko'):Number(av)-Number(bv);
  return (sort.asc?comparison:-comparison)||a.name.localeCompare(b.name,'ko');
 });
 const incomplete=issues.some((i:any)=>['amount','date','duplicate','missing'].includes(i.kind));
 const total=(v:unknown)=>incomplete?'—':num(v);
 const pending=(report.intake?.items||[]).filter((i:any)=>(i.date===day||i.dates?.includes(day))&&!['verified','manual'].includes(i.status));
 const reviewCount=new Set(issues.map((i:any)=>[i.sheet,i.row??i.message].join(':'))).size+undated.length+pending.length;
 const sortBy=(key:SortKey)=>setSort(s=>({key,asc:s.key===key?!s.asc:key==='name'}));
 const order=(key:SortKey)=>sort.key===key?(sort.asc?'ascending':'descending'):'none';
 const arrow=(key:SortKey)=>sort.key===key?(sort.asc?' ↑':' ↓'):'';
 return <div className={styles.sheet}>
  <section className={styles.totals} aria-label='일일 정산 합계'>
   <div className={styles.profit}><span>수익 · 급여 전</span><strong title={incomplete?'입력 확인 필요':undefined}>{total(d.net)}</strong></div>
   <div><span>레이크백</span><strong>{total(d.back)}</strong></div>
   <FlowLink tab='fnb' day={day} className={styles.fnb}><span>F&B</span><strong title={'수익 차감 '+num(d.fnbDeductible)+' · 3F 별도 '+num(d.fnbExcluded)}>{total(d.fnb)}</strong></FlowLink>
   <div><span>총 바이인</span><strong>{total(d.buyins)}{!incomplete&&<small>회</small>}</strong></div>
  </section>
  <div className={styles.tableBar}><div><strong>플레이어 {players.length}</strong><span>{d.games}게임</span></div><div><span>VND</span><button type='button' className={reviewCount?styles.attention:''} aria-expanded={review} aria-controls='daily-review' onClick={()=>setReview(v=>!v)}>확인{reviewCount?' '+reviewCount:''}<span aria-hidden='true'>{review?' ▴':' ▾'}</span></button></div></div>
  {review&&<aside id='daily-review' className={styles.review} aria-label='정산 확인 항목'>
   <dl className={styles.breakdown}><div><dt>레이크백</dt><dd>{num(d.back)}</dd></div><div><dt>F&B 차감</dt><dd>{num(d.fnbDeductible)}</dd></div><div><dt>코드별 정산금</dt><dd>{num(d.payout)}</dd></div><div><dt>3F 별도 정산</dt><dd>{num(d.fnbExcluded)}</dd></div></dl>
   <ScanQueue intake={report.intake} day={day}/>
   {!!undated.length&&<FlowLink tab='sheetWeekly' day={day}>날짜 미확정 {undated.length}건 →</FlowLink>}
   {!!issues.length&&<ul>{issues.map((i:any,n:number)=><li key={n}><span>{i.message}</span><FlowLink tab={i.sheet==='F&B 입력'?'fnb':'games'} day={i.date||day} game={i.game}>장부 →</FlowLink></li>)}</ul>}
  </aside>}
  <div className={styles.gridScroll} tabIndex={0} role='region' aria-label='플레이어 누적 바이인 표'>
   <table className={styles.grid} aria-label='플레이어별 누적 바이인'>
    <thead><tr><th scope='col' className={styles.index}>#</th><th scope='col' className={styles.name} aria-sort={order('name')}><button onClick={()=>sortBy('name')}>플레이어{arrow('name')}</button></th><th scope='col'>소속</th><th scope='col'>ID</th><th scope='col'>참가 게임</th><th scope='col' aria-sort={order('buyins')} className={styles.buyins}><button onClick={()=>sortBy('buyins')}>누적 바이인{arrow('buyins')}</button></th><th scope='col'>레이크</th><th scope='col' aria-sort={order('back')}><button onClick={()=>sortBy('back')}>레이크백{arrow('back')}</button></th></tr></thead>
    <tbody>{players.map((p,i)=><tr key={p.key}><td className={styles.index}>{i+1}</td><th scope='row' className={styles.name}>{p.name}</th><td className={styles.agency}>{p.agencies.join(' / ')||'—'}</td><td className={styles.card}>{p.card||'—'}</td><td><div className={styles.games}>{p.games.map(game=><FlowLink key={game} tab='games' day={day} game={game}>{game}</FlowLink>)}</div></td><td className={styles.buyins} title={p.buyins===null?'입력 확인 필요':undefined}>{num(p.buyins)}</td><td>{num(p.rake)}</td><td>{num(p.back)}</td></tr>)}</tbody>
    <tfoot><tr><th colSpan={5} scope='row'>합계</th><td className={styles.buyins}>{total(d.buyins)}</td><td>{total(d.rake)}</td><td>{total(d.back)}</td></tr></tfoot>
   </table>
   {!players.length&&<div className={styles.empty}>참가 기록 없음</div>}
  </div>
 </div>;
}
