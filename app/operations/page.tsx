'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {supabase} from '../../lib/supabase';
import {rooms,selectedRoom,roomActions,workbook,RoomId} from '../../lib/operations-rooms';
import OpIcon from './OpIcon';
import s from './operations.module.css';
export default function OperationsHome(){
 const [roomId,setRoomId]=useState<RoomId>('dream'),[report,setReport]=useState<any>(null),[loading,setLoading]=useState(false),[notice,setNotice]=useState(''),[isAdmin,setIsAdmin]=useState(false);
 const room=selectedRoom(roomId);
 useEffect(()=>{const r=selectedRoom(new URL(window.location.href).searchParams.get('room'));setRoomId(r.id);},[]);
 useEffect(()=>{let alive=true;setReport(null);setNotice('');setIsAdmin(false);if(roomId!=='dream')return;
  setLoading(true);void(async()=>{try{const session=(await supabase?.auth.getSession())?.data.session;if(!session)throw Error('관리자 로그인 후 이번 주 현황을 확인할 수 있어요.');const r=await fetch('/api/operations/settlement',{headers:{Authorization:'Bearer '+session.access_token},cache:'no-store'});const b=await r.json();if(!r.ok)throw Error(b.error);if(alive){setReport(b);setIsAdmin(true);}}catch(e){if(alive)setNotice((e as Error).message);}finally{if(alive)setLoading(false);}})();return()=>{alive=false;};
 },[roomId]);
 function choose(id:RoomId){setRoomId(id);const u=new URL(window.location.href);u.searchParams.set('room',id);window.history.replaceState({},'',u);}
 const n=(v:any)=>typeof v==='number'?v.toLocaleString('ko-KR'):'—';
 return <div className={s.content}>
 <header className={s.heading}><div><p className={s.eyebrow}>YOUR OPERATIONS, CONNECTED</p><h1>오늘의 운영을 한곳에서.</h1><p>매장을 선택하고, 필요한 업무부터 시작하세요.</p></div><a href='/?tab=dashboard' className={s.oldLink}>기존 솔루션 열기 ↗</a></header>
 <div className={s.roomGrid} aria-label='운영 매장 선택'>{rooms.map(r=><button key={r.id} onClick={()=>choose(r.id)} aria-pressed={roomId===r.id} className={roomId===r.id?s.selectedRoom:s.room}><span className={s.roomMonogram}>{r.short}</span><span className={s.roomText}><strong>{r.name}</strong><small>{r.region}</small></span><span className={r.connected?s.connected:s.pending}>{r.connected?'연결됨':'연결 준비'}</span></button>)}</div>
 <section className={s.roomHeader}><div><span className={s.pill}>{room.currency} · {room.zone}</span><h2>{room.name}</h2></div>{room.connected?<a href={workbook} target='_blank' rel='noreferrer' className={s.outline}><OpIcon name='link'/> 원본 시트</a>:<span className={s.pending}>미연결</span>}</section>
 {room.connected?<>
 <section className={s.hero}><div><span className={s.heroLabel}>이번 주 정산</span><h2>{report?`${report.start.slice(5).replace('-','.')} — ${report.end.slice(5).replace('-','.')}`:'기록에서 보고까지.'}</h2><p>{report?`원본 시트를 읽었습니다. ${report.issues.length}개 항목을 검토해주세요.`:'직원은 익숙한 시트를 쓰고, 관리자는 검토와 보고에 집중하세요.'}</p><Link href='/operations/weekly' className={s.whiteButton}>{isAdmin?'주간정산 검토하기':'로그인하고 정산 확인'}<OpIcon name='arrow'/></Link></div><div className={s.heroStats}><span>총 레이크백</span><strong>{loading?'조회 중':n(report?.totals.back)}<small> VND</small></strong><span className={s.heroNote}>{report?'주간 진행 자료 · 확정 전':'로그인 후 실제 금액 표시'}</span></div></section>
 {notice&&<p className={s.notice} role='status'>{notice}</p>}
 <div className={s.sectionHeading}><h2>바로 처리하기</h2><span>입력은 한 번, 확인은 간단하게.</span></div>
 <div className={s.actionGrid}>{roomActions(roomId).map(a=><a key={a.name} href={a.href} target={a.href.startsWith('https:')?'_blank':undefined} rel={a.href.startsWith('https:')?'noreferrer':undefined} className={s.action}><div className={s.actionTop}><span className={s.actionIcon}><OpIcon name={a.icon}/></span><small>{a.tag}</small></div><h3>{a.name}<span>↗</span></h3><p>{a.description}</p></a>)}</div>
 <div className={s.twoColumns}><section className={s.panel}><div className={s.sectionHeading}><h2>확인할 일</h2><Link href='/operations/weekly'>전체 보기 →</Link></div>{loading?<p>시트와 처리 내역을 대조하고 있어요.</p>:report?<>{report.issues.length?report.issues.slice(0,4).map((i:any,k:number)=><div className={s.issue} key={k}><span className={s.issueDot}/><p>{i.message}</p>{i.row&&<small>{i.row}행</small>}</div>):<p>자동 점검에서 확인할 항목이 발견되지 않았어요.</p>}</>:<p>로그인 후 확인할 항목을 보여드려요.</p>}</section><section className={s.panel}><h2>함께 쓰는 도구</h2><a className={s.toolRow} href='https://dream-poker-reservation.vercel.app/desk'><span><strong>예약 데스크</strong><small>예약 접수·캐셔 승인</small></span><span>↗</span></a><a className={s.toolRow} href='https://dream-poker-reservation.vercel.app/exchange'><span><strong>환전 관리</strong><small>시제·거래·수익 관리</small></span><span>↗</span></a><a className={s.toolRow} href='/?tab=expenses'><span><strong>지출·상계</strong><small>기존 솔루션 장부 · 주간 집계와 별도</small></span><span>↗</span></a></section></div>
 <section className={s.connection}><span className={s.connectionIcon}><OpIcon name='link'/></span><div><h3>Google Sheets + AI Agent</h3><p>드림 정산은 구글 시트를 기준으로 집계합니다. 기존 솔루션의 장부를 중복 합산하지 않습니다.</p></div><a href={workbook} target='_blank' rel='noreferrer'>연결된 시트 ↗</a></section>
 </>:<section className={s.empty}><span className={s.emptyIcon}><OpIcon name='link'/></span><h2>{room.name}의 업무 공간을 준비했어요.</h2><p>이 매장의 시트와 운영 권한이 연결되면 정산을 시작할 수 있습니다.<br/>드림의 데이터가 이 매장에 표시되거나 기록되지 않습니다.</p><div className={s.setupSteps}><div><b>01</b><strong>원본 시트</strong><span>일일 기록·주간정산표</span></div><div><b>02</b><strong>정산 기준</strong><span>통화·코드·수수료·영업일</span></div><div><b>03</b><strong>운영 담당자</strong><span>직원방·관리자별 권한</span></div></div><p className={s.setupNote}>현재는 연결 준비 상태입니다. 매장별 원본 시트와 권한을 확인한 후 활성화합니다.</p></section>}
 </div>;
}
