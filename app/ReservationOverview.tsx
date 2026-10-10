"use client";
import {useEffect,useState} from "react";
import {supabase} from "../lib/supabase";
type Game={id:string;title:string;starts_at:string;capacity:number;table_no:string;game_no?:string;is_open:boolean};
type Stat={game_id:string;confirmed_count:number;pending_count:number;waiting_count:number};
export default function ReservationOverview(){
 const [games,setGames]=useState<Game[]>([]),[stats,setStats]=useState<Stat[]>([]),[error,setError]=useState("");
 const staffUrl="https://dream-poker-reservation.vercel.app/staff";
 useEffect(()=>{
  if(!supabase)return;
  let alive=true;
  const load=async()=>{
   const [g,s]=await Promise.all([
    supabase!.from("reservation_games").select("id,title,starts_at,capacity,table_no,game_no,is_open").gte("starts_at",new Date(Date.now()-36*3600000).toISOString()).order("starts_at").limit(25),
    supabase!.rpc("reservation_public_stats")
   ]);
   if(!alive)return;
   if(g.error||s.error){setError("예약 데이터 연동 확인 필요");return;}
   setError("");setGames(g.data||[]);setStats((s.data||[]).map((x:any)=>({...x,confirmed_count:Number(x.confirmed_count),pending_count:Number(x.pending_count),waiting_count:Number(x.waiting_count)})));
  };
  void load();
  const timer=setInterval(()=>void load(),12000);
  return()=>{alive=false;clearInterval(timer)};
 },[]);
 const summary=games.reduce((acc,g)=>{const st=stats.find(x=>x.game_id===g.id);if(g.is_open)acc.open++;acc.pending+=st?.pending_count||0;acc.confirmed+=st?.confirmed_count||0;return acc},{open:0,pending:0,confirmed:0});
 const fmt=(v:string)=>new Date(v).toLocaleString("ko-KR",{timeZone:"Asia/Ho_Chi_Minh",month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"});
 return <section className="panel opsReservationPanel opsBookingV2" aria-label="예약 현황">
  <div className="opsBookingHead"><div className="opsBookingHeading"><span className="opsBookingEyebrow">LIVE RESERVATIONS</span><h3>예약 현황</h3><p>게임별 예약과 캐셔 승인 현황 · 12초마다 자동 갱신</p></div><div className="opsBookingActions"><a className="opsBookingManage" href={staffUrl} target="_blank" rel="noopener noreferrer">예약 관리 <span aria-hidden="true">↗</span></a><a className="opsBookingGuest" href="https://dream-poker-reservation.vercel.app" target="_blank" rel="noopener noreferrer">손님 화면 <span aria-hidden="true">↗</span></a></div></div>
  <div className="opsBookingSummary"><div><span>접수 중인 게임</span><strong>{summary.open}</strong></div><div><span>예약 확정</span><strong>{summary.confirmed}</strong></div><div><span>승인 대기</span><strong>{summary.pending}</strong></div></div>
  {error?<div className="opsBookingEmpty" role="status">{error}</div>:games.length===0?<div className="opsBookingEmpty">현재 등록된 예약 게임이 없습니다. 예약 관리에서 다음 게임을 열 수 있습니다.</div>:<div className="opsBookingCards">
   {games.map(g=>{const st=stats.find(x=>x.game_id===g.id);const confirmed=st?.confirmed_count||0;const pending=st?.pending_count||0;const waiting=st?.waiting_count||0;return <article className="opsBookingCard" key={g.id}><div className="opsBookingCardHead"><div><strong className="opsBookingGameTitle">{g.title}</strong><div className="opsBookingMeta"><span>Table {g.table_no||"—"}</span><span>No.{g.game_no||"—"}</span><span>시작 예정 {fmt(g.starts_at)}</span></div></div><span className={"opsBookingState "+(g.is_open?"isOpen":"isClosed")}>{g.is_open?"접수 중":"예약 마감"}</span></div><div className="opsBookingMetrics"><div><span>남은 좌석</span><strong>{Math.max(0,g.capacity-confirmed)}<small> / {g.capacity}석</small></strong></div><div><span>확정</span><strong>{confirmed}<small>명</small></strong></div><div><span>승인 대기</span><strong>{pending}<small>명</small></strong></div><div><span>웨이팅</span><strong>{waiting}<small>명</small></strong></div></div></article>})}
  </div>}
 </section>;
}
