"use client";
import {useEffect,useState} from "react";
import {supabase} from "../lib/supabase";
type Game={id:string;title:string;starts_at:string;capacity:number;table_no:string;is_open:boolean};
type Stat={game_id:string;confirmed_count:number;pending_count:number;waiting_count:number};
export default function ReservationOverview(){
 const [games,setGames]=useState<Game[]>([]),[stats,setStats]=useState<Stat[]>([]),[error,setError]=useState("");
 useEffect(()=>{
  if(!supabase)return;
  let alive=true;
  const load=async()=>{
   const [g,s]=await Promise.all([
    supabase!.from("reservation_games").select("id,title,starts_at,capacity,table_no,is_open").gte("starts_at",new Date(Date.now()-12*3600000).toISOString()).order("starts_at").limit(25),
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
 return <section className="panel opsReservationPanel" aria-label="예약 현황">
  <div className="opsReservationTop"><div><h3>Dream Poker 예약 현황</h3><p>플레이어 신청 · 캐셔 승인 현황 (12초마다 갱신)</p></div><a href="/?tab=games">테이블 확인</a></div>
  {error?<p>{error}</p>:games.length===0?<p>현재 등록된 예약 게임이 없습니다.</p>:<div className="opsReservationGrid">
    {games.map(g=>{const s=stats.find(x=>x.game_id===g.id);return <div className="opsReservationGame" key={g.id}><strong>{g.title}</strong><small>{g.table_no?"Table "+g.table_no+" · ":""}{new Date(g.starts_at).toLocaleString("ko-KR",{timeZone:"Asia/Ho_Chi_Minh",month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"})}</small><div><span>확정 {s?.confirmed_count||0}/{g.capacity}</span><span>승인 대기 {s?.pending_count||0}</span><span>웨이팅 {s?.waiting_count||0}</span></div></div>})}
   </div>}
 </section>;
}
