"use client";
// deploy-refresh: player-search-copy

import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

type Agency = { id: string; code: string; rate: number; active: boolean };
type Player = { id: string; name: string; koreanName: string; cardNo: string; agencyId: string; note: string; createdAt: string };
type GameEntry = {
  id: string;
  date: string;
  game: string;
  playerId: string;
  buyIn: number;
  rake: number;
  agencyId: string;
  agencyCodeSnapshot: string;
  rateSnapshot: number;
  rakeback: number;
  sessionId?: string;
};

type GameSession = {
  id: string;
  date: string;
  tableNo: string;
  gameNo: string;
  game: string;
  status: "active"|"closed";
};

type FnbEntry = {
  id: string;
  date: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  expenseGroup: string;
  note: string;
};

const FNB_MENU = [
  {name:"Americano", label:"아메리카노", price:60000},
  {name:"Coconut Coffee", label:"코코넛커피", price:70000},
  {name:"Salted Coffee", label:"소금커피", price:60000},
  {name:"White Coffee", label:"박시우", price:60000},
  {name:"Black Coffee", label:"블랙커피", price:50000},
  {name:"Condensed Milk Coffee", label:"연유커피", price:55000},
  {name:"Espresso", label:"에스프레소", price:60000},
  {name:"Caramel Macchiato", label:"카라멜 마키아토", price:75000},
  {name:"Cappuccino", label:"카푸치노", price:65000},
  {name:"Latte", label:"라떼", price:65000},
  {name:"Chocolate", label:"초콜릿", price:70000},
  {name:"Sunshine", label:"선샤인", price:75000},
  {name:"New Day", label:"뉴데이", price:75000},
  {name:"Watermelon", label:"수박주스", price:60000},
  {name:"Orange", label:"오렌지주스", price:60000},
  {name:"Pineapple", label:"파인애플주스", price:60000},
  {name:"Fresh Coconut Water", label:"코코넛워터", price:65000},
  {name:"Mango Smoothie", label:"망고스무디", price:75000},
  {name:"Avocado & Coco Milk", label:"아보카도 코코넛", price:75000},
  {name:"Coconut Smoothie", label:"코코넛스무디", price:75000},
  {name:"Lychee Tea", label:"리치티", price:75000},
  {name:"Peach Tea", label:"피치티", price:70000},
  {name:"Ginger Tea", label:"진저티", price:70000},
  {name:"Heineken Beer", label:"하이네켄", price:55000},
  {name:"Red Bull", label:"레드불", price:45000},
  {name:"Aquarius", label:"아쿠아리우스", price:45000},
  {name:"Sprite", label:"스프라이트", price:45000},
  {name:"Coca", label:"콜라", price:45000},
  {name:"Coca Light", label:"콜라 라이트", price:45000},
  {name:"Blue Soda", label:"블루소다", price:65000},
  {name:"Fruit Special", label:"과일 스페셜", price:220000},
  {name:"Fruit Normal", label:"과일", price:90000},
] as const;

const DEFAULT_AGENCIES: Agency[] = [
  { id: "agency-korea", code: "KOREA", rate: 0, active: true },
  { id: "agency-mongol", code: "MONGOL", rate: 30, active: true },
  { id: "agency-japan", code: "JAPAN", rate: 35, active: true },
  { id: "agency-china-ak", code: "CHINA (AK)", rate: 40, active: true },
  { id: "agency-house", code: "HOUSE", rate: 50, active: true },
  { id: "agency-korea2", code: "KOREA2", rate: 25, active: true },
];

const money = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 });
const vnd = (value:number) => `${money.format(value)} ₫`;
const today = () => new Date().toISOString().slice(0, 10);
const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function monday(dateString: string) {
  const d = new Date(`${dateString}T00:00:00`);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().slice(0, 10);
}
function plusDays(dateString: string, days: number) {
  const d = new Date(`${dateString}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function MobileBottomIcon({type}:{type:"dashboard"|"players"|"games"|"fnb"|"settlement"}) {
  const common={width:"100%",height:"100%",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2.2,strokeLinecap:"round" as const,strokeLinejoin:"round" as const,ariaHidden:true};
  if(type==="dashboard") return <svg {...common}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>;
  if(type==="players") return <svg {...common}><circle cx="9" cy="8" r="3"/><path d="M3.5 19c.7-3.2 2.6-5 5.5-5s4.8 1.8 5.5 5"/><path d="M16 7h5"/><path d="M16 11h5"/><path d="M16 15h5"/></svg>;
  if(type==="games") return <svg {...common} strokeWidth={2.5}><path d="M12 5v14"/><path d="M5 12h14"/></svg>;
  if(type==="fnb") return <svg {...common}><path d="M5 8h11v5.5A4.5 4.5 0 0 1 11.5 18h-2A4.5 4.5 0 0 1 5 13.5V8Z"/><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M4 21h15"/><path d="M8 3c0 1 .8 1.2.8 2.2S8 6.4 8 7"/><path d="M12 3c0 1 .8 1.2.8 2.2S12 6.4 12 7"/></svg>;
  return <svg {...common}><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8"/><path d="M8 12h8"/><path d="M8 16h5"/></svg>;
}


export default function Home() {
  const [tab, setTab] = useState<"dashboard"|"agencies"|"players"|"games"|"daily"|"weekly"|"reports"|"settings"|"fnb">("dashboard");
  const [agencies, setAgencies] = useState<Agency[]>(DEFAULT_AGENCIES);
  const [players, setPlayers] = useState<Player[]>([]);
  const [entries, setEntries] = useState<GameEntry[]>([]);
  const [gameSessions, setGameSessions] = useState<GameSession[]>([]);
  const [newTableNo, setNewTableNo] = useState("");
  const [selectedTableNo, setSelectedTableNo] = useState("5");
  const [newGameNo, setNewGameNo] = useState("");
  const [newSessionGame, setNewSessionGame] = useState("5M");
  const [gamesView, setGamesView] = useState<"live"|"logs">("live");
  const [sessionSearch, setSessionSearch] = useState<Record<string,string>>({});
  const [manageEntryId, setManageEntryId] = useState<string | null>(null);
  const [managePlayerSearch, setManagePlayerSearch] = useState("");
  const [fnbEntries, setFnbEntries] = useState<FnbEntry[]>([]);
  const [fnbDate, setFnbDate] = useState(today());
  const [fnbMenuName, setFnbMenuName] = useState("Americano");
  const [fnbQuantity, setFnbQuantity] = useState("1");
  const [fnbExpenseGroup, setFnbExpenseGroup] = useState("2FLOOR");
  const [fnbNote, setFnbNote] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");
  const [theme, setTheme] = useState<"light"|"dark">("light");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [mobileSideMenuOpen, setMobileSideMenuOpen] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [newAgencyCode, setNewAgencyCode] = useState("");
  const [newAgencyRate, setNewAgencyRate] = useState("25");
  const [editingAgencyId, setEditingAgencyId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState("");
  const [playerKoreanName, setPlayerKoreanName] = useState("");
  const [playerSearch, setPlayerSearch] = useState("");
  const [globalSearch, setGlobalSearch] = useState("");
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [playerView, setPlayerView] = useState<"list"|"add">("list");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [detailAgencyId, setDetailAgencyId] = useState("");
  const [playerCard, setPlayerCard] = useState("");
  const [playerNote, setPlayerNote] = useState("");
  const [playerAgencyId, setPlayerAgencyId] = useState("agency-korea2");
  const [gameDate, setGameDate] = useState(today());
  const [gameName, setGameName] = useState("5M");
  const [gamePlayerId, setGamePlayerId] = useState("");
  const [gameBuyIn, setGameBuyIn] = useState("1");
  const [gameRake, setGameRake] = useState("500000");
  const [summaryDate, setSummaryDate] = useState(today());
  const [dailyLogSearch, setDailyLogSearch] = useState("");
  const [fnbDetailOpen, setFnbDetailOpen] = useState(false);
  const [reportPreset, setReportPreset] = useState<"today"|"week"|"custom">("today");
  const [reportStart, setReportStart] = useState(today());
  const [reportEnd, setReportEnd] = useState(today());
  const start = monday(today());
  const [weekStart, setWeekStart] = useState(start);
  const [weekEnd, setWeekEnd] = useState(plusDays(start, 6));

  useEffect(() => {
    const saved = localStorage.getItem("dream-poker-theme");
    const nextTheme = saved === "dark" ? "dark" : "light";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
  }, []);

  useEffect(() => {
    const onShortcut=(e:KeyboardEvent)=>{
      if((e.metaKey||e.ctrlKey) && e.key.toLowerCase()==="k"){
        e.preventDefault();
        const input=document.querySelector(".globalSearchInput") as HTMLInputElement | null;
        input?.focus();
        setGlobalSearchOpen(true);
      }
    };
    window.addEventListener("keydown",onShortcut);
    return ()=>window.removeEventListener("keydown",onShortcut);
  }, []);

  function applyTheme(nextTheme: "light"|"dark") {
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem("dream-poker-theme", nextTheme);
  }

  async function loadAllPlayers() {
    if (!supabase) return { data: [] as any[], error: null as any };
    const pageSize = 1000;
    const rows: any[] = [];
    let from = 0;

    while (true) {
      const { data, error } = await supabase
        .from("players")
        .select("*")
        .order("created_at")
        .range(from, from + pageSize - 1);

      if (error) return { data: rows, error };
      const batch = data ?? [];
      rows.push(...batch);

      if (batch.length < pageSize) break;
      from += pageSize;
    }

    return { data: rows, error: null };
  }

  async function loadFromDatabase() {
    if (!supabase) return;
    setSyncing(true);
    setMessage("");

    const [a, p, g, gs, fnb] = await Promise.all([
      supabase.from("agencies").select("*").order("created_at"),
      loadAllPlayers(),
      supabase.from("game_entries").select("*").order("played_on"),
      supabase.from("game_sessions").select("*").order("created_at"),
      supabase.from("fnb_entries").select("*").order("spent_on").order("created_at"),
    ]);

    if (a.error || p.error || g.error || gs.error || fnb.error) {
      setMessage(a.error?.message || p.error?.message || g.error?.message || gs.error?.message || fnb.error?.message || "데이터를 불러오지 못했습니다.");
      setSyncing(false);
      return;
    }

    setAgencies((a.data ?? []).map((x:any)=>({id:x.id,code:x.code,rate:Number(x.rate),active:x.active})));
    setPlayers((p.data ?? []).map((x:any)=>({id:x.id,name:x.name,koreanName:x.korean_name ?? "",cardNo:x.card_no ?? "",agencyId:x.agency_id,note:x.note ?? "",createdAt:x.created_at ?? ""})));
    setEntries((g.data ?? []).map((x:any)=>({
      id:x.id,date:x.played_on,game:x.game_name,playerId:x.player_id,buyIn:Number(x.buy_in),
      rake:Number(x.rake),agencyId:x.agency_id,agencyCodeSnapshot:x.agency_code_snapshot,
      rateSnapshot:Number(x.rate_snapshot),rakeback:Number(x.rakeback),sessionId:x.session_id ?? undefined
    })));
    setGameSessions((gs.data ?? []).map((x:any)=>({
      id:x.id,date:x.played_on,tableNo:x.table_no,gameNo:x.game_no ?? "",game:x.game_name,status:x.status
    })));
    setFnbEntries((fnb.data ?? []).map((x:any)=>({
      id:x.id,date:x.spent_on,itemName:x.item_name,quantity:Number(x.quantity),
      unitPrice:Number(x.unit_price),totalAmount:Number(x.total_amount),
      expenseGroup:x.expense_group ?? "",note:x.note ?? ""
    })));
    setSyncing(false);
  }

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      const raw = localStorage.getItem("poker-agent-solution-v1");
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          setAgencies(parsed.agencies ?? DEFAULT_AGENCIES);
          setPlayers(parsed.players ?? []);
          setEntries(parsed.entries ?? []);
          setFnbEntries(parsed.fnbEntries ?? []);
        } catch {}
      }
      setLoaded(true);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoaded(true);
      if (data.session) loadFromDatabase();
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) loadFromDatabase();
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!loaded || isSupabaseConfigured) return;
    localStorage.setItem("poker-agent-solution-v1", JSON.stringify({ agencies, players, entries, fnbEntries }));
  }, [agencies, players, entries, fnbEntries, loaded]);

  const activeAgencies = agencies.filter(a=>a.active);
  const filteredPlayers = useMemo(()=>{
    const q = playerSearch.trim().toUpperCase();
    if (!q) return players;
    return players.filter(p=>p.name.toUpperCase().includes(q) || p.koreanName.includes(playerSearch.trim()));
  },[players,playerSearch]);

  const selectedPlayer = players.find(p=>p.id===selectedPlayerId) ?? null;
  const selectedPlayerEntries = useMemo(
    ()=>selectedPlayerId ? entries.filter(e=>e.playerId===selectedPlayerId) : [],
    [entries,selectedPlayerId]
  );
  const selectedPlayerBuyIns = selectedPlayerEntries.reduce((s,e)=>s+e.buyIn,0);
  const selectedPlayerRake = selectedPlayerEntries.reduce((s,e)=>s+e.rake,0);
  const selectedPlayerGameBreakdown = useMemo(()=>{
    const map = new Map<string,{game:string;games:number;buyIns:number;rake:number}>();
    selectedPlayerEntries.forEach(e=>{
      const old=map.get(e.game);
      if(old){old.games+=1;old.buyIns+=e.buyIn;old.rake+=e.rake;}
      else map.set(e.game,{game:e.game,games:1,buyIns:e.buyIn,rake:e.rake});
    });
    return [...map.values()].sort((a,b)=>b.rake-a.rake);
  },[selectedPlayerEntries]);
  const dailyEntries = useMemo(()=>entries.filter(e=>e.date===summaryDate),[entries,summaryDate]);
  const filteredDailyEntries = useMemo(()=>{
    const q=dailyLogSearch.trim().toLowerCase();
    const rows=[...dailyEntries].reverse();
    if(!q)return rows;
    return rows.filter(e=>{
      const player=players.find(p=>p.id===e.playerId);
      const haystack=[
        e.game,
        e.agencyCodeSnapshot,
        player?.name ?? "",
        player?.koreanName ?? "",
        player?.cardNo ?? ""
      ].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  },[dailyEntries,dailyLogSearch,players]);
  const weeklyEntries = useMemo(()=>entries.filter(e=>e.date>=weekStart && e.date<=weekEnd),[entries,weekStart,weekEnd]);

  const total = (items: GameEntry[], key: "rake"|"rakeback") => items.reduce((s,e)=>s+e[key],0);
  const agencyTotals = (items: GameEntry[]) => agencies.map(a=>({
    ...a, amount: items.filter(e=>e.agencyId===a.id).reduce((s,e)=>s+e.rakeback,0)
  }));

  const weeklyPlayerRows = useMemo(()=>{
    const map = new Map<string,{playerId:string;playerName:string;agency:string;buyIn:number;rake:number;rakeback:number}>();
    weeklyEntries.forEach(e=>{
      const key=`${e.playerId}::${e.agencyId}`;
      const old=map.get(key);
      if(old){old.buyIn+=e.buyIn;old.rake+=e.rake;old.rakeback+=e.rakeback;}
      else map.set(key,{playerId:e.playerId,playerName:getPlayerName(e.playerId),agency:e.agencyCodeSnapshot,buyIn:e.buyIn,rake:e.rake,rakeback:e.rakeback});
    });
    return [...map.values()];
  },[weeklyEntries,players]);

  function getPlayerName(id:string){ return players.find(p=>p.id===id)?.name ?? "알 수 없음"; }

  async function signIn() {
    if (!supabase) return;
    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setMessage("이메일과 비밀번호를 입력해주세요.");
      return;
    }
    setMessage("");
    const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
    if (error) setMessage(error.message);
  }

  async function signUp() {
    if (!supabase) return;
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setMessage("관리자 이메일을 입력해주세요.");
      return;
    }
    if (!password) {
      setMessage("비밀번호를 입력해주세요.");
      return;
    }
    if (password.length < 6) {
      setMessage("비밀번호는 6자 이상으로 입력해주세요.");
      return;
    }
    setMessage("");
    const { error } = await supabase.auth.signUp({ email: cleanEmail, password });
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage("관리자 계정 생성 요청이 완료되었습니다. 이메일 인증이 켜져 있으면 메일함을 확인해주세요.");
  }
  async function resetPassword() {
    if (!supabase) return;
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setMessage("비밀번호를 재설정할 이메일을 입력해주세요.");
      return;
    }
    setMessage("");
    const redirectTo =
      typeof window !== "undefined" ? window.location.origin : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo,
    });
    setMessage(
      error
        ? error.message
        : "비밀번호 재설정 메일을 보냈습니다. 이메일의 링크를 열어 새 비밀번호를 설정해주세요."
    );
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
  }

  async function addAgency() {
    const code=newAgencyCode.trim().toUpperCase();
    const rate=Number(newAgencyRate);
    if(!code || Number.isNaN(rate) || rate<0 || rate>100) return;
    if(agencies.some(a=>a.code.toUpperCase()===code)){ alert("이미 존재하는 코드입니다."); return; }

    if (isSupabaseConfigured && supabase && session) {
      const { data, error } = await supabase.from("agencies").insert({code,rate,active:true}).select().single();
      if(error){setMessage(error.message);return;}
      setAgencies(prev=>[...prev,{id:data.id,code:data.code,rate:Number(data.rate),active:data.active}]);
    } else {
      setAgencies(prev=>[...prev,{id:uid("agency"),code,rate,active:true}]);
    }
    setNewAgencyCode("");
  }

  async function updateAgency(id:string, patch:Partial<Agency>) {
    setAgencies(prev=>prev.map(a=>a.id===id?{...a,...patch}:a));
    if(isSupabaseConfigured && supabase && session && !id.startsWith("agency-")){
      const dbPatch:any={};
      if(patch.code!==undefined) dbPatch.code=patch.code;
      if(patch.rate!==undefined) dbPatch.rate=patch.rate;
      if(patch.active!==undefined) dbPatch.active=patch.active;
      const { error }=await supabase.from("agencies").update(dbPatch).eq("id",id);
      if(error)setMessage(error.message);
    }
  }

  async function deleteAgency(id:string){
    const agency=agencies.find(a=>a.id===id);
    if(!agency)return;
    const assignedPlayers=players.filter(p=>p.agencyId===id);
    if(assignedPlayers.length>0){
      alert(`${agency.code} 소속 플레이어가 ${assignedPlayers.length}명 있어 삭제할 수 없습니다. 먼저 플레이어의 에이전트 코드를 변경해주세요.`);
      return;
    }
    if(!confirm(`${agency.code} 에이전트 코드를 삭제할까요?`))return;

    if(isSupabaseConfigured && supabase && session && !id.startsWith("agency-")){
      const {error}=await supabase.from("agencies").delete().eq("id",id);
      if(error){setMessage(error.message);return;}
    }
    setAgencies(prev=>prev.filter(a=>a.id!==id));
    setEditingAgencyId(null);
  }

  async function addPlayer() {
    const name=playerName.trim().toUpperCase();
    if(!name || !playerAgencyId) return;
    if(isSupabaseConfigured && supabase && session){
      const { data,error }=await supabase.from("players").insert({name,korean_name:playerKoreanName.trim()||null,card_no:playerCard.trim()||null,agency_id:playerAgencyId,note:playerNote.trim()||null}).select().single();
      if(error){setMessage(error.message);return;}
      const p={id:data.id,name:data.name,koreanName:data.korean_name??"",cardNo:data.card_no??"",agencyId:data.agency_id,note:data.note??"",createdAt:data.created_at??new Date().toISOString()};
      setPlayers(prev=>[...prev,p]); setGamePlayerId(p.id);
    } else {
      const p={id:uid("player"),name,koreanName:playerKoreanName.trim(),cardNo:playerCard.trim(),agencyId:playerAgencyId,note:playerNote.trim(),createdAt:new Date().toISOString()};
      setPlayers(prev=>[...prev,p]); setGamePlayerId(p.id);
    }
    setPlayerName(""); setPlayerKoreanName(""); setPlayerCard(""); setPlayerNote("");
  }

  function openPlayerDetail(playerId:string) {
    const player = players.find(p=>p.id===playerId);
    setSelectedPlayerId(playerId);
    setDetailAgencyId(player?.agencyId ?? "");
  }

  async function updatePlayerAgency(playerId:string, agencyId:string) {
    setPlayers(prev=>prev.map(p=>p.id===playerId?{...p,agencyId}:p));
    if(isSupabaseConfigured && supabase && session){
      const { error }=await supabase.from("players").update({agency_id:agencyId}).eq("id",playerId);
      if(error)setMessage(error.message);
    }
  }

  function rakePerBuyIn(game:string){
    const map:Record<string,number>={"3M":300000,"5M":500000,"10M":1000000,"15M":1500000};
    return map[game] ?? 500000;
  }

  function revenuePerBuyIn(game:string){
    return Math.round(rakePerBuyIn(game)*0.5);
  }

  async function startGameSession(){
    const tableNo=(selectedTableNo || newTableNo).trim();
    if(!tableNo){setMessage("테이블 번호를 입력해주세요.");return;}
    if(gameSessions.some(s=>s.status==="active" && s.tableNo===tableNo && s.date===today())){
      setMessage("오늘 이미 진행 중인 테이블입니다.");
      return;
    }

    if(isSupabaseConfigured && supabase && session){
      const payload={played_on:today(),table_no:tableNo,game_no:newGameNo.trim() || null,game_name:newSessionGame,status:"active"};
      const {data,error}=await supabase.from("game_sessions").insert(payload).select().single();
      if(error){setMessage(error.message);return;}
      setGameSessions(prev=>[...prev,{id:data.id,date:data.played_on,tableNo:data.table_no,gameNo:data.game_no ?? "",game:data.game_name,status:data.status}]);
    }else{
      setGameSessions(prev=>[...prev,{id:uid("session"),date:today(),tableNo,gameNo:newGameNo.trim(),game:newSessionGame,status:"active"}]);
    }
    setSelectedTableNo(tableNo);
    setNewTableNo("");
    setNewGameNo("");
    setMessage(`T${tableNo} · ${newSessionGame} 게임 시작`);
  }

  async function addPlayerToSession(gameSession:GameSession,playerId:string){
    if(!playerId)return;
    const existing=entries.find(e=>e.sessionId===gameSession.id && e.playerId===playerId);
    if(existing){
      await changeSessionBuyIn(existing,1);
      return;
    }
    const player=players.find(p=>p.id===playerId);
    if(!player)return;
    const agency=agencies.find(a=>a.id===player.agencyId);
    if(!agency)return;
    const perBuyIn=rakePerBuyIn(gameSession.game);
    const rateSnapshot=agency.rate;
    const rakeback=Math.round(perBuyIn*(rateSnapshot/100));

    if(isSupabaseConfigured && supabase && session){
      const payload={
        played_on:gameSession.date,game_name:gameSession.game,player_id:player.id,buy_in:1,
        rake:perBuyIn,agency_id:agency.id,agency_code_snapshot:agency.code,
        rate_snapshot:rateSnapshot,rakeback,session_id:gameSession.id
      };
      const {data,error}=await supabase.from("game_entries").insert(payload).select().single();
      if(error){setMessage(error.message);return;}
      setEntries(prev=>[...prev,{
        id:data.id,date:data.played_on,game:data.game_name,playerId:data.player_id,
        buyIn:Number(data.buy_in),rake:Number(data.rake),agencyId:data.agency_id,
        agencyCodeSnapshot:data.agency_code_snapshot,rateSnapshot:Number(data.rate_snapshot),
        rakeback:Number(data.rakeback),sessionId:data.session_id ?? gameSession.id
      }]);
    }else{
      setEntries(prev=>[...prev,{
        id:uid("entry"),date:gameSession.date,game:gameSession.game,playerId:player.id,buyIn:1,
        rake:perBuyIn,agencyId:agency.id,agencyCodeSnapshot:agency.code,
        rateSnapshot,rakeback,sessionId:gameSession.id
      }]);
    }
    setSessionSearch(prev=>({...prev,[gameSession.id]:""}));
  }

  async function changeSessionBuyIn(entry:GameEntry,delta:number){
    const nextBuyIn=Math.max(1,entry.buyIn+delta);
    if(nextBuyIn===entry.buyIn)return;
    const perBuyIn=rakePerBuyIn(entry.game);
    const nextRake=perBuyIn*nextBuyIn;
    const nextRakeback=Math.round(nextRake*(entry.rateSnapshot/100));

    if(isSupabaseConfigured && supabase && session){
      const {error}=await supabase.from("game_entries").update({
        buy_in:nextBuyIn,rake:nextRake,rakeback:nextRakeback
      }).eq("id",entry.id);
      if(error){setMessage(error.message);return;}
    }
    setEntries(prev=>prev.map(e=>e.id===entry.id?{...e,buyIn:nextBuyIn,rake:nextRake,rakeback:nextRakeback}:e));
  }

  async function setSessionBuyInCount(entry:GameEntry,count:number){
    const nextBuyIn=Math.max(1,Math.floor(count)||1);
    const perBuyIn=rakePerBuyIn(entry.game);
    const nextRake=perBuyIn*nextBuyIn;
    const nextRakeback=Math.round(nextRake*(entry.rateSnapshot/100));

    if(isSupabaseConfigured && supabase && session){
      const {error}=await supabase.from("game_entries").update({
        buy_in:nextBuyIn,rake:nextRake,rakeback:nextRakeback
      }).eq("id",entry.id);
      if(error){setMessage(error.message);return;}
    }
    setEntries(prev=>prev.map(e=>e.id===entry.id?{...e,buyIn:nextBuyIn,rake:nextRake,rakeback:nextRakeback}:e));
  }

  async function replaceSessionPlayer(entry:GameEntry,nextPlayerId:string){
    const nextPlayer=players.find(p=>p.id===nextPlayerId);
    if(!nextPlayer)return;
    const agency=agencies.find(a=>a.id===nextPlayer.agencyId);
    if(!agency)return;
    const nextRakeback=Math.round(entry.rake*(agency.rate/100));

    if(isSupabaseConfigured && supabase && session){
      const {error}=await supabase.from("game_entries").update({
        player_id:nextPlayer.id,
        agency_id:agency.id,
        agency_code_snapshot:agency.code,
        rate_snapshot:agency.rate,
        rakeback:nextRakeback
      }).eq("id",entry.id);
      if(error){setMessage(error.message);return;}
    }
    setEntries(prev=>prev.map(e=>e.id===entry.id?{
      ...e,playerId:nextPlayer.id,agencyId:agency.id,agencyCodeSnapshot:agency.code,
      rateSnapshot:agency.rate,rakeback:nextRakeback
    }:e));
    setManagePlayerSearch("");
  }

  async function removePlayerFromSession(entry:GameEntry){
    if(!confirm("이 플레이어를 현재 게임에서 삭제할까요?")) return;
    if(isSupabaseConfigured && supabase && session){
      const {error}=await supabase.from("game_entries").delete().eq("id",entry.id);
      if(error){setMessage(error.message);return;}
    }
    setEntries(prev=>prev.filter(e=>e.id!==entry.id));
  }

  async function closeGameSession(id:string){
    if(isSupabaseConfigured && supabase && session){
      const {error}=await supabase.from("game_sessions").update({status:"closed",closed_at:new Date().toISOString()}).eq("id",id);
      if(error){setMessage(error.message);return;}
    }
    setGameSessions(prev=>prev.map(s=>s.id===id?{...s,status:"closed"}:s));
  }

  async function addGameEntry() {
    const player=players.find(p=>p.id===gamePlayerId);
    if(!player){alert("플레이어를 선택해주세요.");return;}
    const agency=agencies.find(a=>a.id===player.agencyId);
    if(!agency)return;
    const buyIn=Number(gameBuyIn), rake=Number(gameRake);
    if(Number.isNaN(buyIn)||Number.isNaN(rake)||rake<0)return;
    const rateSnapshot=agency.rate;
    const rakeback=Math.round(rake*(rateSnapshot/100));

    if(isSupabaseConfigured && supabase && session){
      const payload={played_on:gameDate,game_name:gameName,player_id:player.id,buy_in:buyIn,rake,agency_id:agency.id,agency_code_snapshot:agency.code,rate_snapshot:rateSnapshot,rakeback};
      const { data,error }=await supabase.from("game_entries").insert(payload).select().single();
      if(error){setMessage(error.message);return;}
      setEntries(prev=>[...prev,{id:data.id,date:data.played_on,game:data.game_name,playerId:data.player_id,buyIn:Number(data.buy_in),rake:Number(data.rake),agencyId:data.agency_id,agencyCodeSnapshot:data.agency_code_snapshot,rateSnapshot:Number(data.rate_snapshot),rakeback:Number(data.rakeback)}]);
    } else {
      setEntries(prev=>[...prev,{id:uid("entry"),date:gameDate,game:gameName,playerId:player.id,buyIn,rake,agencyId:agency.id,agencyCodeSnapshot:agency.code,rateSnapshot,rakeback}]);
    }
  }

  async function addFnbEntry() {
    const menu=FNB_MENU.find(item=>item.name===fnbMenuName);
    if(!menu)return;
    const quantity=Math.max(1,Number(fnbQuantity)||1);
    const totalAmount=menu.price*quantity;

    if(isSupabaseConfigured && supabase && session){
      const payload={
        spent_on:fnbDate,
        item_name:menu.name,
        quantity,
        unit_price:menu.price,
        expense_group:fnbExpenseGroup,
        note:fnbNote.trim() || null,
      };
      const {data,error}=await supabase.from("fnb_entries").insert(payload).select().single();
      if(error){setMessage(error.message);return;}
      setFnbEntries(prev=>[...prev,{
        id:data.id,date:data.spent_on,itemName:data.item_name,quantity:Number(data.quantity),
        unitPrice:Number(data.unit_price),totalAmount:Number(data.total_amount),
        expenseGroup:data.expense_group ?? "",note:data.note ?? ""
      }]);
    } else {
      setFnbEntries(prev=>[...prev,{
        id:uid("fnb"),date:fnbDate,itemName:menu.name,quantity,
        unitPrice:menu.price,totalAmount,expenseGroup:fnbExpenseGroup,note:fnbNote.trim()
      }]);
    }

    setFnbQuantity("1");
    setFnbNote("");
    setMessage(`${menu.label} ${quantity}개 · ${vnd(totalAmount)} 저장 완료`);
  }

  async function deleteFnbEntry(id:string) {
    if(isSupabaseConfigured && supabase && session){
      const {error}=await supabase.from("fnb_entries").delete().eq("id",id);
      if(error){setMessage(error.message);return;}
    }
    setFnbEntries(prev=>prev.filter(item=>item.id!==id));
  }

  function applyReportPreset(preset:"today"|"week"|"custom"){
    setReportPreset(preset);
    if(preset==="today"){
      setReportStart(today());
      setReportEnd(today());
    } else if(preset==="week"){
      const ws=monday(today());
      setReportStart(ws);
      setReportEnd(plusDays(ws,6));
    }
  }

  function downloadBlob(filename:string,blob:Blob){
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;
    a.download=filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function exportSettlementCsv(){
    const reportEntries=entries.filter(e=>e.date>=reportStart && e.date<=reportEnd);
    const reportFnb=fnbEntries.filter(e=>e.date>=reportStart && e.date<=reportEnd);
    const revenue=reportEntries.reduce((sum,e)=>sum+revenuePerBuyIn(e.game)*e.buyIn,0);
    const rakeback=reportEntries.reduce((sum,e)=>sum+e.rakeback,0);
    const fnb=reportFnb.reduce((sum,e)=>sum+e.totalAmount,0);
    const net=revenue-rakeback-fnb;
    const rows:string[][]=[
      ["드림포커 운영 시스템 정산표"],
      ["기간",reportStart,reportEnd],
      ["바이인 금액",String(revenue)],
      ["에이전트 레이크백",String(rakeback)],
      ["F&B",String(fnb)],
      ["순수익",String(net)],
      [],
      ["게임 내역"],
      ["날짜","테이블","게임번호","게임","플레이어","에이전트","바이인","바이인 금액","레이크백"]
    ];
    reportEntries.forEach(e=>{
      const gs=gameSessions.find(s=>s.id===e.sessionId);
      rows.push([
        e.date,
        gs?.tableNo ? "T"+gs.tableNo : "",
        gs?.gameNo ? "No."+gs.gameNo : "",
        e.game,
        getPlayerName(e.playerId),
        e.agencyCodeSnapshot,
        String(e.buyIn),
        String(revenuePerBuyIn(e.game)*e.buyIn),
        String(e.rakeback)
      ]);
    });
    rows.push([],["F&B 상세"],["날짜","항목","수량","단가","금액","구분","비고"]);
    reportFnb.forEach(x=>rows.push([x.date,x.itemName,String(x.quantity),String(x.unitPrice),String(x.totalAmount),x.expenseGroup,x.note||""]));
    const csv="\uFEFF"+rows.map(r=>r.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(",")).join("\n");
    downloadBlob("dream-poker-settlement-"+reportStart+"-"+reportEnd+".csv",new Blob([csv],{type:"text/csv;charset=utf-8"}));
  }

  function exportSettlementPng(){
    const reportEntries=entries.filter(e=>e.date>=reportStart && e.date<=reportEnd);
    const reportFnb=fnbEntries.filter(e=>e.date>=reportStart && e.date<=reportEnd);
    const revenue=reportEntries.reduce((sum,e)=>sum+revenuePerBuyIn(e.game)*e.buyIn,0);
    const rakeback=reportEntries.reduce((sum,e)=>sum+e.rakeback,0);
    const fnb=reportFnb.reduce((sum,e)=>sum+e.totalAmount,0);
    const net=revenue-rakeback-fnb;
    const width=1200;
    const lineCount=Math.min(reportEntries.length,18);
    const height=820+lineCount*42;
    const canvas=document.createElement("canvas");
    canvas.width=width; canvas.height=height;
    const ctx=canvas.getContext("2d");
    if(!ctx)return;
    ctx.fillStyle="#0d0d0d"; ctx.fillRect(0,0,width,height);
    ctx.fillStyle="#d7aa4d"; ctx.fillRect(0,0,width,10);
    ctx.fillStyle="#ffffff"; ctx.font="700 42px sans-serif"; ctx.fillText("드림포커 운영 시스템 정산표",70,85);
    ctx.fillStyle="#a0a0a0"; ctx.font="24px sans-serif"; ctx.fillText(reportStart+" ~ "+reportEnd,70,125);

    const cards:[string,number][]=[
      ["바이인 금액",revenue],
      ["에이전트 레이크백",rakeback],
      ["F&B",fnb],
      ["순수익",net]
    ];
    cards.forEach((item,i)=>{
      const x=70+(i%2)*540, y=175+Math.floor(i/2)*145;
      ctx.fillStyle="#171717"; ctx.fillRect(x,y,500,115);
      ctx.fillStyle="#9a9a9a"; ctx.font="22px sans-serif"; ctx.fillText(item[0],x+24,y+36);
      ctx.fillStyle=i===3?"#e0ad49":"#ffffff"; ctx.font="700 34px sans-serif";
      ctx.fillText(money.format(item[1])+" ₫",x+24,y+82);
    });

    let y=510;
    ctx.fillStyle="#ffffff"; ctx.font="700 28px sans-serif"; ctx.fillText("바이인 내역",70,y);
    y+=36;
    ctx.fillStyle="#8c8c8c"; ctx.font="20px sans-serif"; ctx.fillText("날짜   테이블   게임   플레이어   BUY-IN   바이인 금액",70,y);
    y+=28;
    reportEntries.slice(0,18).forEach(e=>{
      const gs=gameSessions.find(s=>s.id===e.sessionId);
      ctx.fillStyle="#202020"; ctx.fillRect(70,y-24,1060,36);
      ctx.fillStyle="#e8e8e8"; ctx.font="19px sans-serif";
      const label=e.date+"   "+(gs?.tableNo?"T"+gs.tableNo:"-")+"   "+(gs?.gameNo?"No."+gs.gameNo+" ":"")+e.game+"   "+getPlayerName(e.playerId)+"   "+e.buyIn+"회   "+money.format(revenuePerBuyIn(e.game)*e.buyIn)+" ₫";
      ctx.fillText(label.slice(0,95),82,y);
      y+=42;
    });
    ctx.fillStyle="#777"; ctx.font="17px sans-serif"; ctx.fillText("Dream Poker Operations Report",70,height-42);
    canvas.toBlob(blob=>{if(blob)downloadBlob("dream-poker-settlement-"+reportStart+"-"+reportEnd+".png",blob)},"image/png");
  }

  if (isSupabaseConfigured && !session) {
    return <main className="shell authShell">
      <section className="panel authPanel">
        <button className="authThemeToggle" onClick={()=>applyTheme(theme==="dark"?"light":"dark")}>
          <span className="toggleIcon">{theme==="dark"?"☾":"☀"}</span>
          <span>{theme==="dark"?"다크 모드":"라이트 모드"}</span>
        </button>
        <img className="authLogo" src="/dream-poker-logo.svg" alt="Dream Poker Da Nang"/>
        <p className="eyebrow">포커 에이전트 통합 정산</p>
        <h1>관리자 로그인</h1>
        <p className="sub">로그인하면 모든 기기에서 같은 데이터를 사용할 수 있습니다.</p>
        <div className="authForm">
          <label>이메일<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="admin@example.com"/></label>
          <label>비밀번호<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="비밀번호"/></label>
          <div className="authButtons">
            <button className="primary" onClick={signIn}>로그인</button>
            <button className="secondary" onClick={signUp}>관리자 계정 만들기</button>
            <button className="secondary" onClick={resetPassword}>비밀번호 재설정</button>
          </div>
          {message && <div className="note">{message}</div>}
        </div>
      </section>
    </main>;
  }

  const modeText=isSupabaseConfigured ? (syncing?"서버 동기화 중":"서버 DB 연결") : "브라우저 저장";
  const todayEntries = entries.filter(e=>e.date===today());
  const thisWeekEntries = entries.filter(e=>e.date>=weekStart && e.date<=weekEnd);
  const activeAgentCount = agencies.filter(a=>a.active).length;
  const todaySettlement = total(todayEntries,"rakeback");
  const todayRevenue = total(todayEntries,"rake");
  const todayGameCount = todayEntries.length;
  const weekSettlement = total(thisWeekEntries,"rakeback");
  const recentEntries = [...entries].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,6);
  const activeGameSessions = gameSessions.filter(s=>s.status==="active" && s.date===today());
  const selectedGameSession = activeGameSessions.find(s=>s.tableNo===selectedTableNo) ?? null;

  const globalFeatureItems = [
    {key:"dashboard",label:"대시보드",description:"오늘 운영 현황",keywords:"대시보드 홈 현황"},
    {key:"players",label:"플레이어 관리",description:"플레이어 검색 · 등록 · 정보 확인",keywords:"플레이어 선수 회원 명단 등록"},
    {key:"agencies",label:"에이전트 관리",description:"에이전트 코드와 정산 요율",keywords:"에이전트 코드 요율"},
    {key:"games",label:"게임 입력",description:"테이블 현황 · 바이인 입력",keywords:"게임 바이인 테이블 현황 좌석"},
    {key:"daily",label:"일일 정산",description:"오늘 정산 · 지난 게임 로그 수정",keywords:"일일 정산 로그 수정 매출 수익"},
    {key:"weekly",label:"주간 정산",description:"주간 정산 내역",keywords:"주간 정산"},
    {key:"fnb",label:"F&B",description:"F&B 비용 입력 · 내역",keywords:"f&b fnb 음식 음료 비용"},
    {key:"reports",label:"리포트",description:"정산 리포트 · 내보내기",keywords:"리포트 보고서 csv png"},
    {key:"settings",label:"설정",description:"계정 · 시스템 설정",keywords:"설정 계정 다크모드"}
  ] as const;

  const globalSearchResults = useMemo(()=>{
    const q=globalSearch.trim().toLowerCase();
    if(!q)return {players:[] as Player[],features:[] as typeof globalFeatureItems,tables:[] as GameSession[],agencies:[] as Agency[]};

    const playerResults=players.filter(p=>[
      p.name,p.koreanName,p.cardNo,agencies.find(a=>a.id===p.agencyId)?.code ?? ""
    ].join(" ").toLowerCase().includes(q)).slice(0,6);

    const featureResults=globalFeatureItems.filter(item=>
      (item.label+" "+item.description+" "+item.keywords).toLowerCase().includes(q)
    ).slice(0,5);

    const tableResults=activeGameSessions.filter(gs=>{
      const tableEntries=entries.filter(e=>e.sessionId===gs.id);
      const playerNames=tableEntries.map(e=>{
        const p=players.find(x=>x.id===e.playerId);
        return [p?.name,p?.koreanName].filter(Boolean).join(" ");
      }).join(" ");
      return ("t"+gs.tableNo+" "+gs.tableNo+" "+gs.game+" "+gs.gameNo+" "+playerNames).toLowerCase().includes(q);
    }).slice(0,5);

    const agencyResults=agencies.filter(a=>
      (a.code+" "+a.rate).toLowerCase().includes(q)
    ).slice(0,4);

    return {players:playerResults,features:featureResults,tables:tableResults,agencies:agencyResults};
  },[globalSearch,players,agencies,activeGameSessions,entries]);

  const hasGlobalSearchResults =
    globalSearchResults.players.length+
    globalSearchResults.features.length+
    globalSearchResults.tables.length+
    globalSearchResults.agencies.length>0;

  function closeGlobalSearch(){
    setGlobalSearch("");
    setGlobalSearchOpen(false);
  }

  function goToPlayerFromSearch(playerId:string){
    setTab("players");
    openPlayerDetail(playerId);
    closeGlobalSearch();
  }

  function goToFeatureFromSearch(key:string){
    setTab(key as any);
    closeGlobalSearch();
  }

  function goToTableFromSearch(tableNo:string){
    setSelectedTableNo(tableNo);
    setTab("games");
    closeGlobalSearch();
  }
  const selectedTableEntries = selectedGameSession ? entries.filter(e=>e.sessionId===selectedGameSession.id) : [];
  const selectedTableBuyIns = selectedTableEntries.reduce((sum,e)=>sum+e.buyIn,0);
  const selectedTableRevenue = selectedGameSession ? selectedTableBuyIns*revenuePerBuyIn(selectedGameSession.game) : 0;
  const selectedTableSearch = selectedGameSession ? (sessionSearch[selectedGameSession.id]||"") : "";
  const selectedTableQuery = selectedTableSearch.trim().toUpperCase();
  const selectedTableMatches = selectedGameSession && selectedTableQuery
    ? players.filter(p=>
        p.name.toUpperCase().includes(selectedTableQuery) ||
        p.koreanName.includes(selectedTableSearch) ||
        p.cardNo.toUpperCase().includes(selectedTableQuery)
      ).slice(0,8)
    : [];
  const managedEntry = manageEntryId ? entries.find(e=>e.id===manageEntryId) ?? null : null;
  const managedPlayer = managedEntry ? players.find(p=>p.id===managedEntry.playerId) ?? null : null;
  const manageQuery = managePlayerSearch.trim().toUpperCase();
  const managePlayerMatches = manageQuery
    ? players.filter(p=>
        p.id!==managedEntry?.playerId &&
        (p.name.toUpperCase().includes(manageQuery) ||
         p.koreanName.includes(managePlayerSearch) ||
         p.cardNo.toUpperCase().includes(manageQuery))
      ).slice(0,6)
    : [];
  const selectedFnbMenu = FNB_MENU.find(item=>item.name===fnbMenuName) ?? FNB_MENU[0];
  const fnbDayEntries = fnbEntries.filter(item=>item.date===fnbDate);
  const fnbDayTotal = fnbDayEntries.reduce((sum,item)=>sum+item.totalAmount,0);
  const fnbTodayTotal = fnbEntries.filter(item=>item.date===today()).reduce((sum,item)=>sum+item.totalAmount,0);
  const todayBuyinRevenue = todayEntries.reduce((sum,e)=>sum + revenuePerBuyIn(e.game)*e.buyIn,0);
  const activeTableBuyins = activeGameSessions.reduce((sum,s)=>sum+entries.filter(e=>e.sessionId===s.id).reduce((n,e)=>n+e.buyIn,0),0);
  const activeTablePlayers = activeGameSessions.reduce((sum,s)=>sum+entries.filter(e=>e.sessionId===s.id).length,0);
  const todayOperatingNet = todayBuyinRevenue - todaySettlement - fnbTodayTotal;
  const dailyFnbTotal = fnbEntries.filter(item=>item.date===summaryDate).reduce((sum,item)=>sum+item.totalAmount,0);
  const dailyGrossAmount = total(dailyEntries,"rake");
  const dailyAgentRows = agencyTotals(dailyEntries).filter(a=>a.amount>0);
  const dailyAgentTotal = dailyAgentRows.reduce((sum,a)=>sum+a.amount,0);
  const dailyExpenseTotal = dailyFnbTotal + dailyAgentTotal;
  const dailyProfit = dailyGrossAmount - dailyExpenseTotal;
  const reportEntries = entries.filter(e=>e.date>=reportStart && e.date<=reportEnd);
  const reportFnbEntries = fnbEntries.filter(e=>e.date>=reportStart && e.date<=reportEnd);
  const reportRevenue = reportEntries.reduce((sum,e)=>sum+revenuePerBuyIn(e.game)*e.buyIn,0);
  const reportRakeback = reportEntries.reduce((sum,e)=>sum+e.rakeback,0);
  const reportFnbTotal = reportFnbEntries.reduce((sum,e)=>sum+e.totalAmount,0);
  const reportNet = reportRevenue-reportRakeback-reportFnbTotal;

  const reportPanel = <section className="panel settlementExportPanel">
    <div className="settlementExportHeader">
      <div><strong>정산표 출력</strong></div>
    </div>
    <div className="reportPresetButtons">
      <button className={reportPreset==="today"?"active":""} onClick={()=>applyReportPreset("today")}>오늘</button>
      <button className={reportPreset==="week"?"active":""} onClick={()=>applyReportPreset("week")}>이번주</button>
      <button className={reportPreset==="custom"?"active":""} onClick={()=>setReportPreset("custom")}>기간 선택</button>
    </div>
    {reportPreset==="custom" && <div className="reportDateRange">
      <input type="date" value={reportStart} onChange={e=>setReportStart(e.target.value)}/>
      <span>~</span>
      <input type="date" value={reportEnd} onChange={e=>setReportEnd(e.target.value)}/>
    </div>}
    <div className="reportMiniSummary">
      <div><span>바이인</span><b>{vnd(reportRevenue)}</b></div>
      <div><span>레이크백</span><b>{vnd(reportRakeback)}</b></div>
      <div><span>F&B</span><b>{vnd(reportFnbTotal)}</b></div>
      <div><span>순수익</span><b>{vnd(reportNet)}</b></div>
    </div>
    <div className="reportExportActions">
      <button onClick={exportSettlementPng}>PNG 저장</button>
      <button onClick={exportSettlementCsv}>시트 CSV 저장</button>
    </div>
  </section>;

  const navItems = [
    {key:"dashboard",label:"대시보드",icon:"▦"},
    {key:"agencies",label:"에이전트 관리",icon:"♙"},
    {key:"players",label:"플레이어 관리",icon:"♟"},
    {key:"games",label:"게임 입력",icon:"▣"},
    {key:"daily",label:"일일 정산",icon:"▤"},
    {key:"weekly",label:"주간 정산",icon:"▥"},
    {key:"reports",label:"리포트",icon:"▧"},
    {key:"settings",label:"설정",icon:"⚙"},
  ] as const;

  const mobileNavItems = [
    {key:"dashboard",label:"대시보드"},
    {key:"players",label:"플레이어"},
    {key:"games",label:"바이인"},
    {key:"fnb",label:"F&B"},
    {key:"settlement",label:"정산"},
  ] as const;

  return <main className="appShell">
    <aside className="sidebar">
      <div className="brand">
        <img className="brandLogo" src="/dream-poker-logo.svg" alt="Dream Poker Da Nang"/>
        <div><strong>드림포커 운영 시스템</strong><span>관리자</span></div>
      </div>

      <nav className="sideNav">
        {navItems.map(item=><button key={item.key} className={tab===item.key?"active":""} onClick={()=>setTab(item.key as any)}>
          <span className="navIcon">{item.icon}</span><span>{item.label}</span>
        </button>)}
      </nav>

      <div className="agentPreview">
        <div className="previewIcon">◉</div>
        <div><b>에이전트 보기로 전환하기 →</b><span>에이전트 권한 화면을 확인할 수 있습니다.</span></div>
      </div>
    </aside>

    <section className="workspace">
      <header className="workspaceTopbar">
        <div className="mobileTopTitle">
          <img src="/dream-poker-logo.svg" alt=""/>
          <span className="mobileProductTitle"><strong>드림포커 운영 시스템 <em>· 관리자</em></strong></span>
        </div>
        <button
          className="mobileSideMenuButton"
          onClick={()=>setMobileSideMenuOpen(true)}
          aria-label="메뉴 열기"
        >
          <span></span><span></span><span></span>
        </button>
        <div className="searchBox globalSearchBox">
          <span className="globalSearchIcon">⌕</span>
          <input
            className="globalSearchInput"
            value={globalSearch}
            onChange={e=>{setGlobalSearch(e.target.value);setGlobalSearchOpen(true);}}
            onFocus={()=>setGlobalSearchOpen(true)}
            onBlur={()=>window.setTimeout(()=>setGlobalSearchOpen(false),160)}
            onKeyDown={e=>{if(e.key==="Escape"){closeGlobalSearch();(e.currentTarget as HTMLInputElement).blur();}}}
            placeholder="플레이어, 기능, 테이블 검색..."
          />
          {globalSearch?<button className="globalSearchClear" onMouseDown={e=>e.preventDefault()} onClick={closeGlobalSearch}>×</button>:<kbd>⌘ K</kbd>}

          {globalSearchOpen && globalSearch.trim() && <div className="globalSearchDropdown" onMouseDown={e=>e.preventDefault()}>
            {!hasGlobalSearchResults && <div className="globalSearchEmpty">검색 결과가 없습니다.</div>}

            {globalSearchResults.players.length>0 && <div className="globalSearchGroup">
              <span className="globalSearchGroupTitle">플레이어</span>
              {globalSearchResults.players.map(p=><button key={p.id} onClick={()=>goToPlayerFromSearch(p.id)}>
                <span className="globalSearchResultIcon">♟</span>
                <span className="globalSearchResultText">
                  <strong>{p.name}{p.koreanName&&<em>{p.koreanName}</em>}</strong>
                  <small>{p.cardNo||"회원번호 없음"} · {agencies.find(a=>a.id===p.agencyId)?.code||"에이전트 없음"}</small>
                </span>
                <span className="globalSearchArrow">›</span>
              </button>)}
            </div>}

            {globalSearchResults.tables.length>0 && <div className="globalSearchGroup">
              <span className="globalSearchGroupTitle">현재 테이블</span>
              {globalSearchResults.tables.map(gs=>{
                const tableEntries=entries.filter(e=>e.sessionId===gs.id);
                const buyIns=tableEntries.reduce((sum,e)=>sum+e.buyIn,0);
                return <button key={gs.id} onClick={()=>goToTableFromSearch(gs.tableNo)}>
                  <span className="globalSearchResultIcon tableIcon">T{gs.tableNo}</span>
                  <span className="globalSearchResultText">
                    <strong>{gs.game} <em>LIVE</em></strong>
                    <small>{tableEntries.length}명 · 바이인 {buyIns}회{gs.gameNo?" · No."+gs.gameNo:""}</small>
                  </span>
                  <span className="globalSearchArrow">›</span>
                </button>;
              })}
            </div>}

            {globalSearchResults.features.length>0 && <div className="globalSearchGroup">
              <span className="globalSearchGroupTitle">기능</span>
              {globalSearchResults.features.map(item=><button key={item.key} onClick={()=>goToFeatureFromSearch(item.key)}>
                <span className="globalSearchResultIcon">↗</span>
                <span className="globalSearchResultText">
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </span>
                <span className="globalSearchArrow">›</span>
              </button>)}
            </div>}

            {globalSearchResults.agencies.length>0 && <div className="globalSearchGroup">
              <span className="globalSearchGroupTitle">에이전트</span>
              {globalSearchResults.agencies.map(a=><button key={a.id} onClick={()=>goToFeatureFromSearch("agencies")}>
                <span className="globalSearchResultIcon">♙</span>
                <span className="globalSearchResultText">
                  <strong>{a.code}</strong>
                  <small>정산 요율 {a.rate}% · 에이전트 관리로 이동</small>
                </span>
                <span className="globalSearchArrow">›</span>
              </button>)}
            </div>}
          </div>}
        </div>
        <div className="accountArea accountMenuArea">
          <button
            className="accountMenuTrigger"
            onClick={()=>setAccountMenuOpen(v=>!v)}
            aria-expanded={accountMenuOpen}
            aria-label="계정 메뉴 열기"
          >
            <span className="avatar">{session?.user.email?.slice(0,1).toUpperCase() || "A"}</span>
            <span className="accountMenuText">
              <strong>관리자</strong>
              <small>{session?.user.email}</small>
            </span>
            <span className="menuChevron">{accountMenuOpen?"⌃":"⌄"}</span>
          </button>

          {accountMenuOpen && <div className="accountDropdown">
            <div className="accountDropdownProfile">
              <span className="avatar largeAvatar">{session?.user.email?.slice(0,1).toUpperCase() || "A"}</span>
              <div>
                <strong>관리자 계정</strong>
                <small>{session?.user.email}</small>
              </div>
            </div>

            <button onClick={()=>{setTab("settings");setAccountMenuOpen(false)}}>
              <span>⚙</span><div><strong>설정</strong></div>
            </button>

            <button onClick={()=>{applyTheme(theme==="dark"?"light":"dark");setAccountMenuOpen(false)}}>
              <span>{theme==="dark"?"☀":"☾"}</span><div><strong>{theme==="dark"?"라이트 모드":"다크 모드"}</strong></div>
            </button>

            <button onClick={()=>setAccountMenuOpen(false)}>
              <span>⇄</span><div><strong>에이전트 보기</strong></div>
            </button>

            <div className="accountDropdownDivider"/>

            <button className="logoutMenuItem" onClick={signOut}>
              <span>↪</span><div><strong>로그아웃</strong></div>
            </button>
          </div>}
        </div>
      </header>

      {mobileSideMenuOpen && <>
        <button className="mobileSideMenuBackdrop" aria-label="메뉴 닫기" onClick={()=>setMobileSideMenuOpen(false)}/>
        <aside className="mobileSideMenu" aria-label="계정 메뉴">
          <div className="mobileSideMenuHeader">
            <div>
              <span className="avatar largeAvatar">{session?.user.email?.slice(0,1).toUpperCase() || "A"}</span>
              <div>
                <strong>관리자</strong>
                <small>{session?.user.email}</small>
              </div>
            </div>
            <button className="mobileSideMenuClose" onClick={()=>setMobileSideMenuOpen(false)} aria-label="메뉴 닫기">×</button>
          </div>

          <nav className="mobileSideMenuNav">
            <button onClick={()=>{setTab("settings");setMobileSideMenuOpen(false)}}>
              <span className="sideMenuIcon">⚙</span>
              <div><strong>설정</strong></div>
            </button>

            <button onClick={()=>applyTheme(theme==="dark"?"light":"dark")}>
              <span className="sideMenuIcon">{theme==="dark"?"☀":"☾"}</span>
              <div><strong>{theme==="dark"?"라이트 모드":"다크 모드"}</strong></div>
              <span className={`sideThemeSwitch ${theme==="dark"?"on":""}`}><i/></span>
            </button>

            <button onClick={()=>setMobileSideMenuOpen(false)}>
              <span className="sideMenuIcon">⇄</span>
              <div><strong>에이전트 보기</strong></div>
            </button>
          </nav>

          <div className="mobileSideMenuFooter">
            <button onClick={signOut}>
              <span>↪</span><strong>로그아웃</strong>
            </button>
          </div>
        </aside>
      </>}

      <div className="contentArea">
        <div className="pageHeading">
          <div>
            <p className="eyebrow">드림 포커 · 에이전트 운영</p>
            <h1>{tab==="dashboard"?"대시보드":
              tab==="agencies"?"에이전트 관리":
              tab==="players"?"플레이어 관리":
              tab==="games"?"게임 입력":
              tab==="daily"?"일일 정산":
              tab==="weekly"?"주간 정산":
              tab==="fnb"?"F&B":
              tab==="reports"?"리포트":"설정"}</h1>
            <p className="sub">플레이어 등록부터 코드별 레이크백, 일일·주간 정산까지 한 곳에서 관리합니다.</p>
          </div>

        </div>

        {message && <div className="note globalNote">{message}</div>}

        {tab==="dashboard" && <>
          <section className="dashboardOverview dashboardOverviewV2">
            <div className="dashboardOverviewHeader">
              <div>
                <span>오늘</span>
                <strong>{today()}</strong>
              </div>
              <small>{activeGameSessions.length} LIVE</small>
            </div>

            <div className="dashboardMetricGrid dashboardMetricGridV2">
              <button className="dashboardMetricCard revenue heroMetric" onClick={()=>setTab("games")}>
                <span>오늘 바이인</span>
                <b>{vnd(todayBuyinRevenue)}</b>
                <small>{activeTableBuyins} BUY-IN</small>
                <em>›</em>
              </button>

              <button className="dashboardMetricCard profit" onClick={()=>setTab("daily")}>
                <span>오늘 순수익</span>
                <b>{vnd(todayOperatingNet)}</b>
                <small>정산 보기</small>
                <em>›</em>
              </button>

              <button className="dashboardMetricCard fnb" onClick={()=>setTab("fnb")}>
                <span>F&B</span>
                <b>{vnd(fnbTodayTotal)}</b>
                <small>오늘 비용</small>
                <em>›</em>
              </button>
            </div>
          </section>

          <section className="dashCard dashboardLiveTables dashboardSectionCard">
            <div className="cardHeader compactCardHeader">
              <h2>LIVE 테이블</h2>
              <span className="headerCount">{activeGameSessions.length}</span>
            </div>

            {activeGameSessions.length===0
              ? <div className="dashboardEmpty liveEmpty">진행 중인 테이블이 없습니다.</div>
              : <div className="dashboardLiveTableList">
                  {activeGameSessions.map(gs=>{
                    const tableEntries=entries.filter(e=>e.sessionId===gs.id);
                    const buyins=tableEntries.reduce((sum,e)=>sum+e.buyIn,0);
                    const revenue=buyins*revenuePerBuyIn(gs.game);
                    return <button key={gs.id} onClick={()=>{setSelectedTableNo(gs.tableNo);setTab("games")}}>
                      <div className="dashTableMain">
                        <span className="dashLiveDot"/>
                        <strong>T{gs.tableNo}</strong>
                        <em>{gs.gameNo?`No.${gs.gameNo}`:"No.-"}</em>
                        <b>{gs.game}</b>
                      </div>
                      <div className="dashTableStats">
                        <span>{tableEntries.length}명</span>
                        <span>{buyins} BUY-IN</span>
                        <strong>{vnd(revenue)}</strong>
                        <i>›</i>
                      </div>
                    </button>
                  })}
                </div>}
          </section>

          <section className="dashCard recentCard dashboardRecent dashboardSectionCard">
            <div className="cardHeader compactCardHeader">
              <h2>최근 바이인</h2>
              <span className="headerCount">{Math.min(recentEntries.length,4)}</span>
            </div>
            {recentEntries.length===0
              ? <div className="dashboardEmpty">아직 입력된 기록이 없습니다.</div>
              : <div className="dashboardRecentList">
                  {recentEntries.slice(0,4).map(e=><div key={e.id}>
                    <div>
                      <strong>{getPlayerName(e.playerId)}</strong>
                      <span>{e.agencyCodeSnapshot} · {e.game}</span>
                    </div>
                    <div>
                      <small>{e.buyIn} BUY-IN</small>
                      <b>{vnd(revenuePerBuyIn(e.game)*e.buyIn)}</b>
                    </div>
                  </div>)}
                </div>}
          </section>
        </>}

        {tab==="agencies" && <section className="panel agencyManagePanel">
          <div className="mobileSectionSwitcher playerAccessSwitcher">
            <button onClick={()=>setTab("players")}>플레이어 명단</button>
            <button className="active">에이전트 코드</button>
          </div>

          <div className="agencyManageHeader">
            <div>
              <h2>에이전트 코드</h2>
              <p>코드를 탭하면 이름과 정산 요율을 수정할 수 있습니다.</p>
            </div>
          </div>

          <div className="agencyAddRow">
            <input
              placeholder="새 코드명"
              value={newAgencyCode}
              onChange={e=>setNewAgencyCode(e.target.value.toUpperCase())}
            />
            <select value={newAgencyRate} onChange={e=>setNewAgencyRate(e.target.value)}>
              {Array.from({length:21},(_,i)=>i*5).map(rate=><option key={rate} value={rate}>{rate}%</option>)}
            </select>
            <button className="primary" onClick={addAgency}>＋ 추가</button>
          </div>

          <div className="agencySimpleList">
            {agencies.map(a=><button key={a.id} className="agencySimpleRow" onClick={()=>setEditingAgencyId(a.id)}>
              <div>
                <strong>{a.code}</strong>
                <small>{a.active?"사용 중":"사용 중지"}</small>
              </div>
              <div className="agencyRateDisplay">
                <b>{a.rate}%</b>
                <span>›</span>
              </div>
            </button>)}
          </div>

          {editingAgencyId && (()=> {
            const agency=agencies.find(a=>a.id===editingAgencyId);
            if(!agency)return null;
            return <div className="agencyEditBackdrop" onClick={()=>setEditingAgencyId(null)}>
              <section className="agencyEditModal" onClick={e=>e.stopPropagation()}>
                <div className="agencyEditHeader">
                  <div><span>에이전트 수정</span><strong>{agency.code}</strong></div>
                  <button onClick={()=>setEditingAgencyId(null)}>×</button>
                </div>

                <label>
                  <span>에이전트 코드</span>
                  <input value={agency.code} onChange={e=>updateAgency(agency.id,{code:e.target.value.toUpperCase()})}/>
                </label>

                <label>
                  <span>정산 요율</span>
                  <select value={agency.rate} onChange={e=>updateAgency(agency.id,{rate:Number(e.target.value)})}>
                    {Array.from({length:21},(_,i)=>i*5).map(rate=><option key={rate} value={rate}>{rate}%</option>)}
                  </select>
                </label>

                <button
                  className={`agencyStatusToggle ${agency.active?"active":""}`}
                  onClick={()=>updateAgency(agency.id,{active:!agency.active})}
                >
                  <span>{agency.active?"●":"○"}</span>
                  {agency.active?"사용 중":"사용 중지"}
                </button>

                <div className="agencyPlayerSection">
                  <div className="agencyPlayerSectionTitle">
                    <strong>소속 플레이어</strong>
                    <span>{players.filter(p=>p.agencyId===agency.id).length}명</span>
                  </div>
                  <div className="agencyPlayerList">
                    {players.filter(p=>p.agencyId===agency.id).length===0
                      ? <div className="agencyPlayerEmpty">등록된 플레이어가 없습니다.</div>
                      : players.filter(p=>p.agencyId===agency.id).slice(0,50).map(p=>{
                          const lastEntry=entries.filter(e=>e.playerId===p.id).sort((a,b)=>b.date.localeCompare(a.date))[0];
                          return <button key={p.id} onClick={()=>{setEditingAgencyId(null);openPlayerDetail(p.id);setTab("players")}}>
                            <div>
                              <strong>{p.name}</strong>
                              <small>{p.koreanName || p.cardNo || "회원번호 없음"}</small>
                            </div>
                            <div>
                              <span>등록 {p.createdAt?p.createdAt.slice(0,10):"-"}</span>
                              <em>최근 {lastEntry?.date || "-"}</em>
                            </div>
                          </button>
                        })}
                  </div>
                </div>

                <button
                  className="agencyDeleteButton"
                  onClick={()=>deleteAgency(agency.id)}
                >
                  에이전트 삭제
                </button>

                <button className="primary agencyEditDone" onClick={()=>setEditingAgencyId(null)}>완료</button>
              </section>
            </div>
          })()}
        </section>}

        {tab==="players" && <section className="panel">
          <div className="mobileSectionSwitcher playerAccessSwitcher">
            <button className="active">플레이어 명단</button>
            <button onClick={()=>setTab("agencies")}>에이전트 코드</button>
          </div>
          <div className="playerSectionActions">
            <div>
              <h3>플레이어 검색</h3>
            </div>
            <button className="primary addPlayerButton" onClick={()=>setPlayerView("add")}>＋ 플레이어 추가</button>
          </div>

          <div className="playerSearchSection compactSearchSection">
            <div className="playerSearchBar">
              <div className="playerSearchInput">⌕
                <input
                  value={playerSearch}
                  onChange={e=>setPlayerSearch(e.target.value)}
                  placeholder="영문 또는 한글로 성함을 입력하세요"
                />
                {playerSearch && <button onClick={()=>setPlayerSearch("")}>✕</button>}
              </div>
              <span className="searchCount">{filteredPlayers.length}명 / 전체 {players.length}명</span>
            </div>
          </div>



          <div className="tableWrap playerListTable"><table><thead><tr><th>플레이어</th><th>등록일</th><th>에이전트</th></tr></thead><tbody>{filteredPlayers.length===0?<tr><td colSpan={3} className="empty">{playerSearch?"검색 결과가 없습니다.":"등록된 플레이어가 없습니다."}</td></tr>:filteredPlayers.map(p=>{return <tr key={p.id} className="clickablePlayerRow" onClick={()=>openPlayerDetail(p.id)} tabIndex={0} role="button" onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openPlayerDetail(p.id);}}}><td><div className="playerNameButton playerNameStack"><strong>{p.name}</strong>{p.koreanName && <span>{p.koreanName}</span>}</div></td><td>{p.createdAt?p.createdAt.slice(0,10):"-"}</td><td><span className="agencyCodeText">{agencies.find(x=>x.id===p.agencyId)?.code || "-"}</span></td></tr>})}</tbody></table></div>




          {playerView==="add" && <div className="modalBackdrop" onClick={()=>setPlayerView("list")}>
            <div className="playerModal playerAddModal" onClick={e=>e.stopPropagation()}>
              <div className="modalHeader">
                <div>
                  <span className="modalEyebrow">NEW PLAYER</span>
                  <h3>플레이어 추가</h3>
                  
                </div>
                <button className="modalClose" onClick={()=>setPlayerView("list")} aria-label="닫기">×</button>
              </div>

              <div className="modalForm playerModalForm">
                <label>
                  <span>영문성함</span>
                  <input autoFocus value={playerName} onChange={e=>setPlayerName(e.target.value)} placeholder="예: KIM JI WON"/>
                </label>
                <label>
                  <span>한글성함</span>
                  <input value={playerKoreanName} onChange={e=>setPlayerKoreanName(e.target.value)} placeholder="예: 김지원"/>
                </label>
                <label>
                  <span>회원번호</span>
                  <input value={playerCard} onChange={e=>setPlayerCard(e.target.value)} placeholder="선택 입력"/>
                </label>
                <label>
                  <span>에이전트 코드</span>
                  <select value={playerAgencyId} onChange={e=>setPlayerAgencyId(e.target.value)}>
                    {activeAgencies.map(a=><option key={a.id} value={a.id}>{a.code} · {a.rate}%</option>)}
                  </select>
                </label>
                <label>
                  <span>메모 / 비고</span>
                  <textarea value={playerNote} onChange={e=>setPlayerNote(e.target.value)} placeholder="예: 크레딧 플레이어, 선호 게임, 특이사항 등"/>
                </label>
              </div>

              <div className="modalActions">
                <button className="secondary" onClick={()=>setPlayerView("list")}>취소</button>
                <button className="primary modalPrimary" onClick={async()=>{await addPlayer();setPlayerView("list");}}>플레이어 등록</button>
              </div>
            </div>
          </div>}

          {selectedPlayer && <div className="modalBackdrop playerDetailBackdrop" onClick={()=>setSelectedPlayerId(null)}>
            <div className="playerDetailModal" onClick={e=>e.stopPropagation()}>
              <div className="modalHeader">
                <div>
                  <span className="modalEyebrow">PLAYER DETAIL</span>
                  <h3>{selectedPlayer.name}</h3>
                  <p>{selectedPlayer.koreanName ? `${selectedPlayer.koreanName} · ` : ""}회원번호 {selectedPlayer.cardNo || "-"} · {agencies.find(a=>a.id===selectedPlayer.agencyId)?.code || "-"} · 정산 요율 {agencies.find(a=>a.id===selectedPlayer.agencyId)?.rate ?? 0}%</p>
                </div>
                <button className="modalClose" onClick={()=>setSelectedPlayerId(null)} aria-label="닫기">×</button>
              </div>

              <div className="playerStatsGrid">
                <div className="playerStatCard"><span>참여 게임</span><b>{selectedPlayerEntries.length}회</b></div>
                <div className="playerStatCard"><span>총 바이인</span><b>{vnd(selectedPlayerBuyIns)}</b></div>
                <div className="playerStatCard"><span>총 발생 레이크</span><b>{vnd(selectedPlayerRake)}</b></div>
              </div>

              <div className="playerAgencyEditor">
                <div>
                  <span>에이전트</span>
                  <small>현재 정산 요율 {agencies.find(a=>a.id===selectedPlayer.agencyId)?.rate ?? 0}%</small>
                </div>
                <div className="playerAgencyControls">
                  <select value={detailAgencyId || selectedPlayer.agencyId} onChange={e=>setDetailAgencyId(e.target.value)}>
                    {agencies.map(a=><option key={a.id} value={a.id}>{a.code} · {a.rate}%</option>)}
                  </select>
                  <button
                    className="primary"
                    disabled={!detailAgencyId || detailAgencyId===selectedPlayer.agencyId}
                    onClick={async()=>{
                      if(!detailAgencyId || detailAgencyId===selectedPlayer.agencyId) return;
                      await updatePlayerAgency(selectedPlayer.id,detailAgencyId);
                    }}
                  >
                    변경 저장
                  </button>
                </div>
              </div>

              {selectedPlayer.note && <div className="playerNoteBox">
                <span>메모 / 비고</span>
                <p>{selectedPlayer.note}</p>
              </div>}

              <div className="playerDetailSection">
                <div className="playerDetailTitle"><h4>게임별 기록</h4><span>{selectedPlayerGameBreakdown.length}개 게임</span></div>
                <div className="tableWrap playerDetailTable"><table>
                  <thead><tr><th>게임</th><th>참여</th><th>바이인</th><th>레이크</th></tr></thead>
                  <tbody>{selectedPlayerGameBreakdown.length===0
                    ? <tr><td colSpan={4} className="empty">아직 게임 기록이 없습니다.</td></tr>
                    : selectedPlayerGameBreakdown.map(r=><tr key={r.game}><td><strong>{r.game}</strong></td><td>{r.games}회</td><td>{vnd(r.buyIns)}</td><td>{vnd(r.rake)}</td></tr>)}
                  </tbody>
                </table></div>
              </div>

              <div className="playerDetailSection">
                <div className="playerDetailTitle"><h4>게임 내역</h4><span>최근 기록순</span></div>
                <div className="tableWrap playerDetailTable"><table>
                  <thead><tr><th>날짜</th><th>게임</th><th>바이인</th><th>레이크</th><th>레이크백</th></tr></thead>
                  <tbody>{selectedPlayerEntries.length===0
                    ? <tr><td colSpan={5} className="empty">아직 게임 기록이 없습니다.</td></tr>
                    : [...selectedPlayerEntries].sort((a,b)=>b.date.localeCompare(a.date)).map(e=><tr key={e.id}><td>{e.date}</td><td>{e.game}</td><td>{vnd(e.buyIn)}</td><td>{vnd(e.rake)}</td><td>{vnd(e.rakeback)}</td></tr>)}
                  </tbody>
                </table></div>
              </div>
            </div>
          </div>}
        </section>}

        {tab==="games" && <section className="buyinPage floorBuyinPage">
          <div className="mobileSectionSwitcher buyinModeSwitcher">
            <button className={gamesView==="live"?"active":""} onClick={()=>setGamesView("live")}>진행 중</button>
            <button className={gamesView==="logs"?"active":""} onClick={()=>setGamesView("logs")}>게임 로그</button>
          </div>

          {gamesView==="live" && <>
          <section className="panel floorSelectorPanel">
            <div className="floorSelectorHeader">
              <div><h2>테이블 선택</h2></div>
              <span className="liveTableCount">{activeGameSessions.length} TABLE LIVE</span>
            </div>

            <div className="pokerFloorMap">
              <button
                className={`floorTableButton table4 ${selectedTableNo==="4"?"selected":""} ${activeGameSessions.some(s=>s.tableNo==="4")?"live":""}`}
                onClick={()=>setSelectedTableNo("4")}
              >
                <strong>T4</strong>
                {activeGameSessions.some(s=>s.tableNo==="4") && <small>LIVE</small>}
              </button>

              {["12","13","5","2"].map(no=>{
                const liveSession=activeGameSessions.find(s=>s.tableNo===no);
                const liveEntries=liveSession ? entries.filter(e=>e.sessionId===liveSession.id) : [];
                return <button
                  key={no}
                  className={`floorTableButton table${no} ${selectedTableNo===no?"selected":""} ${liveSession?"live":""}`}
                  onClick={()=>setSelectedTableNo(no)}
                >
                  <strong>T{no}</strong>
                  <small>{liveSession?`${liveEntries.length}명 · LIVE`:"대기"}</small>
                </button>
              })}
            </div>

          </section>

          <section className="panel selectedTablePanel">
            <div className="selectedTableTop">
              <div className="selectedTableHeadline">
                <strong>T{selectedTableNo || "-"}</strong>
                {selectedGameSession && <span>{selectedGameSession.gameNo ? `No.${selectedGameSession.gameNo}` : "No.-"}</span>}
                {selectedGameSession && <b>{selectedGameSession.game}</b>}
              </div>

              {!selectedGameSession
                ? <div className="selectedGameStart">
                    <label className="gameNoField">
                      <span>게임 번호</span>
                      <input inputMode="numeric" value={newGameNo} onChange={e=>setNewGameNo(e.target.value.replace(/\D/g,""))} placeholder="No."/>
                    </label>
                    <label>
                      <span>게임</span>
                      <select value={newSessionGame} onChange={e=>setNewSessionGame(e.target.value)}>
                        <option value="3M">3M</option>
                        <option value="5M">5M</option>
                        <option value="10M">10M</option>
                        <option value="15M">15M</option>
                      </select>
                    </label>
                    <button className="primary startTableButton" onClick={startGameSession}>게임 시작</button>
                  </div>
                : <button className="closeTableButton selectedCloseButton" onClick={()=>closeGameSession(selectedGameSession.id)}>경기 종료</button>}
            </div>

            {selectedGameSession && <div className="selectedTableStats compactSelectedStats">
              <div><span>플레이어</span><b>{selectedTableEntries.length}명</b></div>
              <div><span>총 바이인</span><b>{selectedTableBuyIns}회</b></div>
              <div><span>현재 매출</span><b>{vnd(selectedTableRevenue)}</b></div>
            </div>}

            {!selectedGameSession
              ? <div className="selectedTableEmpty">
                  <div className="emptyPlayersIcon">♙</div>
                  <strong>T{selectedTableNo}에서 진행 중인 게임이 없습니다.</strong>
                  <span>게임 종류를 선택하고 게임 시작을 눌러주세요.</span>
                </div>
              : <>
                  <div className="selectedPlayerSection">
                    <div className="selectedPlayerSectionTitle">
                      <div>
                        <strong>플레이어</strong>
                        <span>{selectedTableEntries.length}명</span>
                      </div>
                      <b>{selectedTableBuyIns} BUY-IN · {vnd(selectedTableRevenue)}</b>
                    </div>

                    {selectedTableEntries.length===0
                      ? <div className="selectedTableEmpty playerEmpty">
                          <div className="emptyPlayersIcon">♙</div>
                          <strong>등록된 플레이어가 없습니다.</strong>
                          <span>플레이어를 검색해 추가하세요.</span>
                        </div>
                      : <div className="selectedPlayerList">
                          {[...selectedTableEntries].sort((a,b)=>b.buyIn-a.buyIn).map(entry=>{
                            const player=players.find(p=>p.id===entry.playerId);
                            const perEntryRevenue=revenuePerBuyIn(entry.game);
                            return <button className="selectedPlayerRow compactPlayerRow playerManageTrigger" key={entry.id} onClick={()=>setManageEntryId(entry.id)}>
                              <div className="selectedPlayerIdentity">
                                <strong>{player?.name || "알 수 없음"}</strong>
                                <span>{player?.koreanName && `${player.koreanName} · `}{entry.agencyCodeSnapshot}</span>
                              </div>

                              <div className="playerFinancialGrid">
                                <div>
                                  <small>바이인</small>
                                  <b>{entry.buyIn}회</b>
                                </div>
                                <div>
                                  <small>금액</small>
                                  <b>{vnd(perEntryRevenue*entry.buyIn)}</b>
                                </div>
                                <div>
                                  <small>레이크백</small>
                                  <b>{vnd(entry.rakeback)}</b>
                                </div>
                              </div>

                              <span className="manageChevron">›</span>
                            </button>
                          })}
                        </div>}

                    <div className="selectedPlayerSearch">
                      <div className="selectedSearchLabel">
                        <strong>플레이어 추가</strong>
                        <small>선택 즉시 1 BUY-IN</small>
                      </div>
                      <div className="tableSearchInput selectedSearchInput">
                        <span>⌕</span>
                        <input
                          value={selectedTableSearch}
                          onChange={e=>setSessionSearch(prev=>({...prev,[selectedGameSession.id]:e.target.value}))}
                          placeholder="이름 · 한글명 · 회원번호 검색"
                        />
                      </div>
                      {selectedTableMatches.length>0 && <div className="selectedSearchResults">
                        {selectedTableMatches.map(p=>{
                          const already=selectedTableEntries.find(e=>e.playerId===p.id);
                          const agency=agencies.find(a=>a.id===p.agencyId);
                          return <button key={p.id} onClick={()=>addPlayerToSession(selectedGameSession,p.id)}>
                            <span>
                              <strong>{p.name}</strong>
                              <small>{p.koreanName || p.cardNo || "회원번호 없음"}</small>
                            </span>
                            <em>{agency?.code || "-"}</em>
                            <b>{already?"+1 리바인":"추가"}</b>
                          </button>
                        })}
                      </div>}
                    </div>
                  </div>
                </>}
          </section>
          </>}

          {gamesView==="logs" && <section className="panel gameLogPanel">
            <div className="gameLogHeader">
              <div><h2>게임 로그</h2></div>
              <span>{gameSessions.length} GAME</span>
            </div>
            <div className="gameLogList">
              {[...gameSessions].sort((a,b)=>(b.date+a.id).localeCompare(a.date+b.id)).map(gs=>{
                const logEntries=entries.filter(e=>e.sessionId===gs.id);
                const buyins=logEntries.reduce((sum,e)=>sum+e.buyIn,0);
                const revenue=logEntries.reduce((sum,e)=>sum+revenuePerBuyIn(e.game)*e.buyIn,0);
                const rakeback=logEntries.reduce((sum,e)=>sum+e.rakeback,0);
                return <details className="gameLogItem" key={gs.id}>
                  <summary>
                    <div>
                      <strong>T{gs.tableNo}</strong>
                      <span>{gs.gameNo?`No.${gs.gameNo}`:"No.-"} · {gs.game}</span>
                      <small>{gs.date} · {gs.status==="active"?"진행 중":"종료"}</small>
                    </div>
                    <div>
                      <b>{buyins} BUY-IN</b>
                      <em>{vnd(revenue)}</em>
                    </div>
                  </summary>
                  <div className="gameLogSummary">
                    <span>플레이어 {logEntries.length}명</span>
                    <span>레이크백 {vnd(rakeback)}</span>
                    <span>바이인 금액 {vnd(revenue)}</span>
                  </div>
                  <div className="gameLogPlayers">
                    {logEntries.length===0
                      ? <div className="gameLogEmpty">바이인 기록이 없습니다.</div>
                      : logEntries.map(e=><div key={e.id}>
                          <span><strong>{getPlayerName(e.playerId)}</strong><small>{e.agencyCodeSnapshot}</small></span>
                          <span>{e.buyIn}회</span>
                          <b>{vnd(revenuePerBuyIn(e.game)*e.buyIn)}</b>
                        </div>)}
                  </div>
                </details>
              })}
              {gameSessions.length===0 && <div className="dashboardEmpty">아직 게임 로그가 없습니다.</div>}
            </div>
          </section>}
        </section>}

        {tab==="daily" && <section className="compactDailyPage">
          <div className="mobileSectionSwitcher settlementSwitcher">
            <button className="active">일일정산</button>
            <button onClick={()=>setTab("weekly")}>주간정산</button>
          </div>
          {reportPanel}
          <section className="panel compactDailyPanel">
            <div className="compactDailyHeader">
              <div>
                <span>일일 정산</span>
                <strong>{summaryDate}</strong>
              </div>
              <input className="datePicker compactDailyDate" type="date" value={summaryDate} onChange={e=>setSummaryDate(e.target.value)}/>
            </div>

            <div className="dailyStatementList">
              <div className="dailyStatementLine income">
                <span>총 레이크백</span>
                <b>{vnd(dailyGrossAmount)}</b>
              </div>

              <button className="dailyStatementLine expense clickableStatementLine" onClick={()=>setFnbDetailOpen(true)}>
                <span>F&B <small>상세보기 ›</small></span>
                <b>− {vnd(dailyFnbTotal)}</b>
              </button>

              <div className="dailyStatementSectionLabel">에이전트별 레이크백</div>

              {dailyAgentRows.length===0
                ? <div className="dailyStatementLine muted">
                    <span>에이전트 레이크백</span>
                    <b>− {vnd(0)}</b>
                  </div>
                : dailyAgentRows.map(a=><div className="dailyStatementLine expense agentLine" key={a.id}>
                    <span>{a.code}<small>{a.rate}%</small></span>
                    <b>− {vnd(a.amount)}</b>
                  </div>)}

              <div className="dailyStatementLine subtotal">
                <span>총 비용</span>
                <b>− {vnd(dailyExpenseTotal)}</b>
              </div>

              <div className="dailyStatementLine profit">
                <span>일일 수익</span>
                <b>{vnd(dailyProfit)}</b>
              </div>
            </div>

            <section className="dailyGameLog">
              <div className="dailyGameLogHeader">
                <div>
                  <h3>지난 게임 로그</h3>
                  <p>선택한 날짜의 게임 기록을 확인하고 플레이어 또는 바이인을 바로 수정할 수 있습니다.</p>
                </div>
                <span className="dailyLogCount">{dailyEntries.length}건</span>
              </div>

              <div className="dailyLogSearch">
                <span>⌕</span>
                <input
                  value={dailyLogSearch}
                  onChange={e=>setDailyLogSearch(e.target.value)}
                  placeholder="플레이어, 게임, 에이전트 검색"
                />
                {dailyLogSearch && <button onClick={()=>setDailyLogSearch("")}>×</button>}
              </div>

              <div className="tableWrap dailyLogTable">
                <table>
                  <thead><tr><th>게임</th><th>플레이어</th><th>에이전트</th><th>바이인</th><th>레이크</th><th>레이크백</th><th></th></tr></thead>
                  <tbody>{filteredDailyEntries.length===0
                    ? <tr><td colSpan={7} className="empty">{dailyEntries.length===0?"해당 날짜의 게임 기록이 없습니다.":"검색 결과가 없습니다."}</td></tr>
                    : filteredDailyEntries.map(e=><tr key={e.id}>
                        <td><span className="dailyGameBadge">{e.game}</span></td>
                        <td>
                          <select className="dailyPlayerSelect" value={e.playerId} onChange={ev=>replaceSessionPlayer(e,ev.target.value)}>
                            {players.map(p=><option key={p.id} value={p.id}>{p.name}{p.koreanName?` · ${p.koreanName}`:""}</option>)}
                          </select>
                        </td>
                        <td><span className="agencyCodeText">{e.agencyCodeSnapshot}</span></td>
                        <td>
                          <div className="dailyBuyInEditor">
                            <button onClick={()=>changeSessionBuyIn(e,-1)} aria-label="바이인 감소">−</button>
                            <input
                              type="number"
                              min="1"
                              value={e.buyIn}
                              onChange={ev=>{
                                const value=Math.max(1,Number(ev.target.value)||1);
                                setEntries(prev=>prev.map(row=>row.id===e.id?{...row,buyIn:value}:row));
                              }}
                              onBlur={ev=>setSessionBuyInCount(e,Number(ev.target.value))}
                              onKeyDown={ev=>{if(ev.key==="Enter"){(ev.currentTarget as HTMLInputElement).blur();}}}
                            />
                            <button onClick={()=>changeSessionBuyIn(e,1)} aria-label="바이인 증가">＋</button>
                          </div>
                        </td>
                        <td>{vnd(e.rake)}</td>
                        <td className="strong">{vnd(e.rakeback)}</td>
                        <td><button className="dailyDeleteButton" onClick={()=>removePlayerFromSession(e)}>삭제</button></td>
                      </tr>)}
                  </tbody>
                </table>
              </div>
            </section>
          </section>
        </section>}

        {tab==="weekly" && <section className="panel weeklyPanel">
          <div className="mobileSectionSwitcher settlementSwitcher">
            <button onClick={()=>setTab("daily")}>일일정산</button>
            <button className="active">주간정산</button>
          </div>
          <div className="sectionTitle"><div><h2>주간 정산</h2></div><div className="dateRange"><input className="datePicker" type="date" value={weekStart} onChange={e=>setWeekStart(e.target.value)}/><span>~</span><input className="datePicker" type="date" value={weekEnd} onChange={e=>setWeekEnd(e.target.value)}/></div></div>
          <div className="cards"><div className="metric"><span>주간 총 레이크</span><b>{vnd(total(weeklyEntries,"rake"))}</b></div><div className="metric"><span>주간 총 에이전트 정산액</span><b>{vnd(total(weeklyEntries,"rakeback"))}</b></div><div className="metric"><span>주간 정산 후 순액</span><b>{vnd(total(weeklyEntries,"rake")-total(weeklyEntries,"rakeback"))}</b></div></div>
          <div className="agencyGrid">{agencyTotals(weeklyEntries).map(a=><div className="agencyCard" key={a.id}><span>{a.code}</span><small>현재 정산 요율 {a.rate}%</small><b>{vnd(a.amount)}</b></div>)}</div>
          <div className="sectionTitle compact"><div><h2>플레이어별 주간 정산</h2><p>각 게임 입력 당시 저장된 정산 요율을 기준으로 계산합니다.</p></div></div>
          <div className="tableWrap"><table><thead><tr><th>플레이어</th><th>에이전트</th><th>바이인</th><th>총 레이크</th><th>레이크백</th></tr></thead><tbody>{weeklyPlayerRows.length===0?<tr><td colSpan={5} className="empty">해당 기간의 정산 기록이 없습니다.</td></tr>:weeklyPlayerRows.map(r=><tr key={`${r.playerId}-${r.agency}`}><td>{r.playerName}</td><td>{r.agency}</td><td>{vnd(r.buyIn)}</td><td>{vnd(r.rake)}</td><td className="strong">{vnd(r.rakeback)}</td></tr>)}</tbody></table></div>
        </section>}

        {tab==="fnb" && <section className="fnbPage">
          <div className="fnbSummary">
            <div>
              <span>오늘 F&B 경비</span>
              <b>{vnd(fnbTodayTotal)}</b>
              <small>{today()} 기준</small>
            </div>
            <div className="fnbCoffeeIcon">☕</div>
          </div>

          <section className="panel fnbEntryPanel">
            <div className="sectionTitle">
              <div><h2>F&B 빠른 입력</h2></div>
              <input className="datePicker" type="date" value={fnbDate} onChange={e=>setFnbDate(e.target.value)}/>
            </div>

            <div className="fnbQuickMenu">
              {FNB_MENU.slice(0,8).map(item=><button
                key={item.name}
                className={fnbMenuName===item.name?"active":""}
                onClick={()=>setFnbMenuName(item.name)}
              >
                <span>{item.label}</span>
                <small>{money.format(item.price)} ₫</small>
              </button>)}
            </div>

            <div className="fnbFormGrid">
              <label>메뉴
                <select value={fnbMenuName} onChange={e=>setFnbMenuName(e.target.value)}>
                  {FNB_MENU.map(item=><option key={item.name} value={item.name}>{item.label} · {money.format(item.price)} ₫</option>)}
                </select>
              </label>
              <label>수량
                <div className="quantityControl">
                  <button type="button" onClick={()=>setFnbQuantity(String(Math.max(1,(Number(fnbQuantity)||1)-1)))}>−</button>
                  <input inputMode="numeric" type="number" min="1" value={fnbQuantity} onChange={e=>setFnbQuantity(e.target.value)}/>
                  <button type="button" onClick={()=>setFnbQuantity(String((Number(fnbQuantity)||1)+1))}>＋</button>
                </div>
              </label>
              <label>경비 구분
                <select value={fnbExpenseGroup} onChange={e=>setFnbExpenseGroup(e.target.value)}>
                  <option value="2FLOOR">2FLOOR</option>
                  <option value="3FLOOR">3FLOOR</option>
                  <option value="4FLOOR">4FLOOR</option>
                  <option value="10M">10M</option>
                  <option value="AGENT">AGENT</option>
                  <option value="TIME ATTACK">TIME ATTACK</option>
                  <option value="OTHER">기타</option>
                </select>
              </label>
              <label className="fnbNoteField">대상 / 메모
                <input value={fnbNote} onChange={e=>setFnbNote(e.target.value)} placeholder="예: 성현행님, 얼리버드 손님"/>
              </label>
            </div>

            <div className="fnbSaveBar">
              <div><span>입력 금액</span><strong>{vnd(selectedFnbMenu.price*Math.max(1,Number(fnbQuantity)||1))}</strong></div>
              <button className="primary" onClick={addFnbEntry}>F&B 경비 저장</button>
            </div>
          </section>

          <section className="panel fnbHistoryPanel">
            <div className="sectionTitle">
              <div><h2>{fnbDate===today()?"오늘":"선택 날짜"} 입력 내역</h2><p>{fnbDayEntries.length}건 입력</p></div>
              <strong className="fnbDayTotal">{vnd(fnbDayTotal)}</strong>
            </div>
            {fnbDayEntries.length===0
              ? <div className="dashboardEmpty">이 날짜에 입력된 F&B 경비가 없습니다.</div>
              : <div className="fnbEntryList">{[...fnbDayEntries].reverse().map(item=>{
                  const menu=FNB_MENU.find(m=>m.name===item.itemName);
                  return <div className="fnbEntryRow" key={item.id}>
                    <div className="fnbEntryMain">
                      <strong>{menu?.label || item.itemName}</strong>
                      <span>{item.expenseGroup}{item.note?` · ${item.note}`:""}</span>
                    </div>
                    <div className="fnbEntryAmount">
                      <small>{item.quantity}개 × {money.format(item.unitPrice)} ₫</small>
                      <b>{vnd(item.totalAmount)}</b>
                    </div>
                    <button className="fnbDeleteButton" onClick={()=>deleteFnbEntry(item.id)} aria-label="F&B 항목 삭제">×</button>
                  </div>
                })}</div>}
          </section>
        </section>}

        {tab==="reports" && <section className="panel placeholderPanel"><h2>리포트</h2><p>에이전트별 정산 리포트와 다운로드 기능을 다음 단계에서 연결합니다.</p></section>}
        {tab==="settings" && <section className="panel placeholderPanel"><h2>설정</h2><p>권한, 에이전트 계정, 시스템 설정을 이곳에서 관리하게 됩니다.</p></section>}
      </div>
    </section>

    {managedEntry && <div className="playerManageOverlay" onClick={()=>{setManageEntryId(null);setManagePlayerSearch("")}}>
      <section className="playerManageModal" onClick={e=>e.stopPropagation()}>
        <div className="playerManageHeader">
          <div>
            <span>플레이어 관리</span>
            <strong>{managedPlayer?.name || "알 수 없음"}</strong>
            <small>{managedPlayer?.koreanName ? `${managedPlayer.koreanName} · `:""}{managedEntry.agencyCodeSnapshot}</small>
          </div>
          <button onClick={()=>{setManageEntryId(null);setManagePlayerSearch("")}} aria-label="닫기">×</button>
        </div>

        <div className="manageBuyinSection">
          <span>바이인 수</span>
          <div className="manageBuyinControl">
            <button onClick={()=>setSessionBuyInCount(managedEntry,managedEntry.buyIn-1)} disabled={managedEntry.buyIn<=1}>−</button>
            <strong>{managedEntry.buyIn}회</strong>
            <button onClick={()=>setSessionBuyInCount(managedEntry,managedEntry.buyIn+1)}>＋</button>
          </div>
          <div className="manageFinancialSummary">
            <div><small>금액</small><b>{vnd(revenuePerBuyIn(managedEntry.game)*managedEntry.buyIn)}</b></div>
            <div><small>레이크백</small><b>{vnd(managedEntry.rakeback)}</b></div>
          </div>
        </div>

        <div className="manageReplaceSection">
          <label>플레이어 변경</label>
          <div className="managePlayerSearchInput">
            <span>⌕</span>
            <input
              value={managePlayerSearch}
              onChange={e=>setManagePlayerSearch(e.target.value)}
              placeholder="이름 · 한글명 · 회원번호 검색"
            />
          </div>
          {managePlayerMatches.length>0 && <div className="managePlayerResults">
            {managePlayerMatches.map(p=>{
              const agency=agencies.find(a=>a.id===p.agencyId);
              return <button key={p.id} onClick={()=>replaceSessionPlayer(managedEntry,p.id)}>
                <span><strong>{p.name}</strong><small>{p.koreanName || p.cardNo || "회원번호 없음"}</small></span>
                <em>{agency?.code || "-"}</em>
                <b>변경</b>
              </button>
            })}
          </div>}
        </div>

        <button className="manageDeleteButton" onClick={async()=>{await removePlayerFromSession(managedEntry);setManageEntryId(null);setManagePlayerSearch("")}}>
          플레이어 삭제
        </button>
      </section>
    </div>}

    {fnbDetailOpen && <div className="playerManageOverlay" onClick={()=>setFnbDetailOpen(false)}>
      <section className="playerManageModal fnbDetailModal" onClick={e=>e.stopPropagation()}>
        <div className="playerManageHeader">
          <div><span>F&B 상세</span><strong>{summaryDate}</strong><small>총 {vnd(dailyFnbTotal)}</small></div>
          <button onClick={()=>setFnbDetailOpen(false)}>×</button>
        </div>
        <div className="fnbDetailList">
          {fnbEntries.filter(x=>x.date===summaryDate).length===0
            ? <div className="agencyPlayerEmpty">해당 날짜의 F&B 내역이 없습니다.</div>
            : fnbEntries.filter(x=>x.date===summaryDate).map(x=><div key={x.id}>
                <span><strong>{x.itemName}</strong><small>{x.expenseGroup}{x.note?" · "+x.note:""}</small></span>
                <span>{x.quantity}개</span>
                <b>{vnd(x.totalAmount)}</b>
              </div>)}
        </div>
      </section>
    </div>}

    <nav className="mobileBottomNav" aria-label="모바일 메뉴">
      {mobileNavItems.map(item=>{
        const isActive =
          item.key==="settlement" ? (tab==="daily" || tab==="weekly") :
          item.key==="players" ? (tab==="players" || tab==="agencies") :
          tab===item.key;
        return <button
          key={item.key}
          className={`${isActive?"active":""} ${item.key==="games"?"buyinNavItem":""}`}
          onClick={()=>{
            if(item.key==="settlement") setTab("daily");
            else setTab(item.key as any);
          }}
        >
          <span className="mobileNavIcon"><MobileBottomIcon type={item.key}/></span>
          <span>{item.label}</span>
        </button>
      })}
    </nav>
  </main>;
}
