'use client';
import {FlowLink,ScanQueue} from './SettlementFlow';
import styles from './SettlementFlow.module.css';
const num=(v:any)=>typeof v==='number'&&Number.isFinite(v)?v.toLocaleString('ko-KR'):'확인 필요';
export default function DailySettlement({report,day}:{report:any;day:string}){
 const d=report.days.find((r:any)=>r.date===day);if(!d)return <p role='alert'>선택한 날짜의 정산 자료를 확인하지 못했습니다.</p>;
 const groups=new Map<string,any>();let game:any=null;
 for(const source of report.sourceDaily||[]){const r=source.values;if(r[0]!==''&&r[0]!=null)game=r[0];const date=typeof r[1]==='number'?new Date((Math.floor(r[1])-25569)*86400000).toISOString().slice(0,10):r[1];if(date!==day)continue;const id=[game,r[2],r[3]].join('|');const g=groups.get(id)||{id,game,table:r[2],players:0,buyins:0,rake:0,back:0,valid:true};g.players++;for(const [field,col] of [['buyins',7],['rake',8],['back',9]] as const){if(typeof r[col]!=='number'||!Number.isSafeInteger(r[col])||r[col]<0)g.valid=false;else g[field]+=r[col];}groups.set(id,g);}
 const issues=(d.issues||[]).filter((i:any)=>i.kind!=='pending');
 const incomplete=issues.some((i:any)=>['amount','date','duplicate','missing'].includes(i.kind));
 const amount=(v:any)=>incomplete?'확인 필요':num(v);
 return <>
  <div className={styles.dailyHeader}><h2>{d.games}개 게임 · 참가 {d.participants}건</h2><FlowLink tab='games' day={day}>게임 장부 수정 →</FlowLink></div>
  <section className={styles.dailyMetrics} aria-label='일일 정산 합계'>
   <div className={styles.metric}><span>총 바이인</span><strong>{amount(d.buyins)}<small>회</small></strong><p>레이크 {amount(d.rake)}동</p></div>
   <div className={styles.metric}><span>총 레이크백</span><strong>{amount(d.back)}<small>동</small></strong><p>구글 시트 계산값</p></div>
   <div className={styles.metric}><span>F&B · 수익 차감</span><strong>{amount(d.fnbDeductible)}<small>동</small></strong><p>3F 별도 정산 {num(d.fnbExcluded)}동</p></div>
   <div className={styles.metric}><span>당일 정산액 · 급여 전</span><strong>{amount(d.net)}<small>동</small></strong><p>코드별 정산금 {amount(d.payout)}동 차감</p></div>
  </section>
  <div className={styles.calculation}><span>당일 정산액 = 레이크백 − F&B 수익 차감 − 코드별 정산금</span><span>급여·기타 지출·지급 여부 별도</span></div>
  <ScanQueue intake={report.intake} day={day} expanded/>
  {issues.length>0&&<section className={styles.dailyPanel}><h2>장부 확인 {issues.length}건</h2><ul className={styles.issues}>{issues.map((i:any,n:number)=><li key={n}><span>{i.message}</span><FlowLink tab={i.sheet==='F&B 입력'?'fnb':'games'} day={i.date||day} game={i.game}>해당 장부 →</FlowLink></li>)}</ul></section>}
  <section className={styles.dailyPanel}><div className={styles.dailyHeader}><h2>게임별 합계</h2><FlowLink tab='fnb' day={day}>F&B 내역 →</FlowLink></div><div className={styles.scroll}><table><thead><tr><th>게임</th><th>테이블</th><th>참가</th><th>바인</th><th>레이크</th><th>레이크백</th></tr></thead><tbody>{Array.from(groups.values()).map(g=><tr key={g.id}><td><FlowLink tab='games' day={day} game={Number(g.game)}>{g.game||'미지정'}번 ↗</FlowLink></td><td>{g.table}</td><td>{g.players}명</td><td>{g.valid?num(g.buyins):'확인 필요'}</td><td>{g.valid?num(g.rake):'확인 필요'}</td><td>{g.valid?num(g.back):'확인 필요'}</td></tr>)}</tbody></table></div>{!groups.size&&<p className={styles.empty}>이 날짜의 참가 기록이 없습니다.</p>}</section>
  <FlowLink tab='sheetWeekly' day={day} className={styles.next}><span>이 주 정산 검토<small>{report.start} — {report.end} · 일일 기록 자동 합산</small></span><span>→</span></FlowLink>
 </>;
}
