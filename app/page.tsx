"use client";
// deploy-refresh: player-search-copy

import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { createProvisioningClient, isSupabaseConfigured, supabase } from "../lib/supabase";
import { jsPDF } from "jspdf";

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

type UserRole = "admin"|"staff"|"agent"|"pending";
type UserProfile = { userId:string; username:string; email:string; displayName:string; role:UserRole; agencyId:string; active:boolean };

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

type ExpenseItem = {
  id:string;
  date:string;
  category:string;
  description:string;
  amount:number;
  processedAmount:number;
  status:"pending"|"partial"|"processed";
  sourceRef:string;
  prepaidBy:string;
  note:string;
};

type ExpenseDeposit = {
  id:string;
  date:string;
  description:string;
  amount:number;
  distributionId:string;
  sourceRef:string;
  note:string;
};

type Shareholder = {
  id:string;
  name:string;
  rate:number;
  active:boolean;
  sortOrder:number;
};

type WeeklyDistribution = {
  id:string;
  weekStart:string;
  weekEnd:string;
  operatingProfit:number;
  expenseApplied:number;
  distributableProfit:number;
  status:"draft"|"finalized";
  finalizedAt:string;
};

type ShareholderPayout = {
  id:string;
  distributionId:string;
  shareholderId:string;
  name:string;
  rate:number;
  amount:number;
  status:"pending"|"paid";
  paidAt:string;
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

const money = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 });
const vnd = (value:number) => money.format(value);
const isOperatingFnbExpense = (item:FnbEntry) => item.expenseGroup==="2FLOOR";
const formatLocalDate = (date:Date) => {
  const year=date.getFullYear();
  const month=String(date.getMonth()+1).padStart(2,"0");
  const day=String(date.getDate()).padStart(2,"0");
  return `${year}-${month}-${day}`;
};
const today = () => formatLocalDate(new Date());
const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function monday(dateString: string) {
  const [year,month,dayOfMonth]=dateString.split("-").map(Number);
  const d = new Date(year,month-1,dayOfMonth);
  const weekday = d.getDay();
  d.setDate(d.getDate() + (weekday === 0 ? -6 : 1 - weekday));
  return formatLocalDate(d);
}
function plusDays(dateString: string, days: number) {
  const [year,month,dayOfMonth]=dateString.split("-").map(Number);
  const d = new Date(year,month-1,dayOfMonth);
  d.setDate(d.getDate() + days);
  return formatLocalDate(d);
}

function MobileBottomIcon({type}:{type:"dashboard"|"players"|"games"|"fnb"|"settlement"}) {
  const common={width:"100%",height:"100%",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2.2,strokeLinecap:"round" as const,strokeLinejoin:"round" as const,ariaHidden:true};
  if(type==="dashboard") return <svg {...common}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>;
  if(type==="players") return <svg {...common}><circle cx="9" cy="8" r="3"/><path d="M3.5 19c.7-3.2 2.6-5 5.5-5s4.8 1.8 5.5 5"/><path d="M16 7h5"/><path d="M16 11h5"/><path d="M16 15h5"/></svg>;
  if(type==="games") return <svg {...common} strokeWidth={2.5}><path d="M12 5v14"/><path d="M5 12h14"/></svg>;
  if(type==="fnb") return <svg {...common}><path d="M5 8h11v5.5A4.5 4.5 0 0 1 11.5 18h-2A4.5 4.5 0 0 1 5 13.5V8Z"/><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M4 21h15"/><path d="M8 3c0 1 .8 1.2.8 2.2S8 6.4 8 7"/><path d="M12 3c0 1 .8 1.2.8 2.2S12 6.4 12 7"/></svg>;
  return <svg {...common}><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8"/><path d="M8 12h8"/><path d="M8 16h5"/></svg>;
}

function DesktopNavIcon({type}:{type:"dashboard"|"players"|"agencies"|"games"|"fnb"|"daily"|"weekly"|"expenses"|"reports"|"settings"}) {
  const common={width:"100%",height:"100%",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2,strokeLinecap:"round" as const,strokeLinejoin:"round" as const,ariaHidden:true};
  if(type==="dashboard") return <svg {...common}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>;
  if(type==="players") return <svg {...common}><circle cx="9" cy="8" r="3"/><path d="M3.5 19c.7-3.2 2.6-5 5.5-5s4.8 1.8 5.5 5"/><path d="M16 7h5"/><path d="M16 11h5"/><path d="M16 15h5"/></svg>;
  if(type==="agencies") return <svg {...common}><circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M2.8 19c.7-3.2 2.5-5 5.2-5s4.5 1.8 5.2 5"/><path d="M14 15c2.6 0 4.3 1.4 5 4"/></svg>;
  if(type==="games") return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M8 12h8"/><path d="M12 8v8"/></svg>;
  if(type==="fnb") return <svg {...common}><path d="M5 8h11v5.5A4.5 4.5 0 0 1 11.5 18h-2A4.5 4.5 0 0 1 5 13.5V8Z"/><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M4 21h15"/><path d="M8 3c0 1 .8 1.2.8 2.2S8 6.4 8 7"/></svg>;
  if(type==="daily") return <svg {...common}><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8"/><path d="M8 11h8"/><path d="M8 15h5"/></svg>;
  if(type==="weekly") return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4"/><path d="M17 3v4"/><path d="M3 10h18"/><path d="M7 14h3"/><path d="M14 14h3"/></svg>;
  if(type==="expenses") return <svg {...common}><path d="M4 7h16"/><path d="M6 3h12v18H6z"/><path d="M9 11h6"/><path d="M9 15h4"/></svg>;
  if(type==="reports") return <svg {...common}><path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/></svg>;
  return <svg {...common}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21h-4v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3v-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.3 7 7.1 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3h4v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.1v4H21a1.7 1.7 0 0 0-1.6 1Z"/></svg>;
}


export default function Home() {
  const [tab, setTab] = useState<"dashboard"|"agencies"|"players"|"games"|"daily"|"weekly"|"expenses"|"reports"|"settings"|"fnb">("dashboard");
  const validTabs = ["dashboard","agencies","players","games","daily","weekly","expenses","reports","settings","fnb"] as const;
  type TabKey = (typeof validTabs)[number];

  function navigateTab(next:TabKey){
    setTab(next);
    if(typeof window==="undefined") return;
    const url=new URL(window.location.href);
    const current=url.searchParams.get("tab");
    if(current===next)return;
    url.searchParams.set("tab",next);
    window.history.pushState({tab:next},"",url.toString());
  }

  const [agencies, setAgencies] = useState<Agency[]>(DEFAULT_AGENCIES);
  const [players, setPlayers] = useState<Player[]>([]);
  const [entries, setEntries] = useState<GameEntry[]>([]);
  const [gameSessions, setGameSessions] = useState<GameSession[]>([]);
  const [newTableNo, setNewTableNo] = useState("");
  const [selectedTableNo, setSelectedTableNo] = useState("5");
  const [newGameNo, setNewGameNo] = useState("");
  const [newSessionGame, setNewSessionGame] = useState("5M");
  const [gamesView, setGamesView] = useState<"live"|"logs">("live");
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editSessionTableNo, setEditSessionTableNo] = useState("");
  const [editSessionGame, setEditSessionGame] = useState("5M");
  const [editSessionGameNo, setEditSessionGameNo] = useState("");
  const [extraTableNos, setExtraTableNos] = useState<string[]>([]);
  const [removedTableNos, setRemovedTableNos] = useState<string[]>([]);
  const [selectedSearchIndex, setSelectedSearchIndex] = useState(0);
  const [playerValueView, setPlayerValueView] = useState<"amount"|"rakeback">("amount");
  const [sessionSearch, setSessionSearch] = useState<Record<string,string>>({});
  const [manageEntryId, setManageEntryId] = useState<string | null>(null);
  const [managePlayerSearch, setManagePlayerSearch] = useState("");
  const [fnbEntries, setFnbEntries] = useState<FnbEntry[]>([]);
  const [fnbDate, setFnbDate] = useState(today());
  const [fnbMenuName, setFnbMenuName] = useState("Americano");
  const [fnbQuantity, setFnbQuantity] = useState("1");
  const [fnbExpenseGroup, setFnbExpenseGroup] = useState("2FLOOR");
  const [fnbNote, setFnbNote] = useState("");
  const [expenseItems,setExpenseItems]=useState<ExpenseItem[]>([]);
  const [expenseDeposits,setExpenseDeposits]=useState<ExpenseDeposit[]>([]);
  const [shareholders,setShareholders]=useState<Shareholder[]>([]);
  const [weeklyDistributions,setWeeklyDistributions]=useState<WeeklyDistribution[]>([]);
  const [shareholderPayouts,setShareholderPayouts]=useState<ShareholderPayout[]>([]);
  const [expenseDate,setExpenseDate]=useState(today());
  const [expenseCategory,setExpenseCategory]=useState("OTHER");
  const [expenseDescription,setExpenseDescription]=useState("");
  const [expenseAmount,setExpenseAmount]=useState("");
  const [expensePrepaidBy,setExpensePrepaidBy]=useState("");
  const [expenseNote,setExpenseNote]=useState("");
  const [expenseEntryType,setExpenseEntryType]=useState<"expense"|"deposit">("expense");
  const [expenseFilter,setExpenseFilter]=useState<"all"|"pending"|"processed">("all");
  const [editingExpenseId,setEditingExpenseId]=useState<string | null>(null);
  const [expenseEditDate,setExpenseEditDate]=useState("");
  const [expenseEditCategory,setExpenseEditCategory]=useState("OTHER");
  const [expenseEditDescription,setExpenseEditDescription]=useState("");
  const [expenseEditPrepaidBy,setExpenseEditPrepaidBy]=useState("");
  const [expenseEditAmount,setExpenseEditAmount]=useState("");
  const [expenseEditProcessedAmount,setExpenseEditProcessedAmount]=useState("");
  const [expenseEditNote,setExpenseEditNote]=useState("");
  const [savingExpenseEdit,setSavingExpenseEdit]=useState(false);
  const [finalizingDistribution,setFinalizingDistribution]=useState(false);
  const [loaded, setLoaded] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");
  const [theme, setTheme] = useState<"light"|"dark">("light");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [mobileSideMenuOpen, setMobileSideMenuOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [accountProfiles, setAccountProfiles] = useState<UserProfile[]>([]);
  const [newAccountUsername, setNewAccountUsername] = useState("");
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountPassword, setNewAccountPassword] = useState("");
  const [newAccountRole, setNewAccountRole] = useState<UserRole>("staff");
  const [newAccountAgencyId, setNewAccountAgencyId] = useState("");
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [ownUsername, setOwnUsername] = useState("");
  const [ownPassword, setOwnPassword] = useState("");
  const [updatingOwnLogin, setUpdatingOwnLogin] = useState(false);
  const isStaff = profile?.role==="staff";
  const staffAllowedTabs = ["dashboard","players","games","fnb"] as const;

  const [loginId, setLoginId] = useState("");
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
  const [dailyExportOpen, setDailyExportOpen] = useState(false);
  const [dailyEditingCell, setDailyEditingCell] = useState<{entryId:string;field:"agency"|"buyin"} | null>(null);
  const [dailyEditBuyInValue, setDailyEditBuyInValue] = useState("");
  const [lastDeletedEntry, setLastDeletedEntry] = useState<GameEntry | null>(null);
  const [fnbDetailOpen, setFnbDetailOpen] = useState(false);
  const [reportPreset, setReportPreset] = useState<"today"|"week"|"custom">("today");
  const [reportStart, setReportStart] = useState(today());
  const [reportEnd, setReportEnd] = useState(today());
  const [dashboardTrendMode, setDashboardTrendMode] = useState<"daily"|"weekly">("daily");
  const start = monday(today());
  const [weekStart, setWeekStart] = useState(start);
  const [weekEnd, setWeekEnd] = useState(plusDays(start, 6));

  useEffect(() => {
    if(!message)return;
    const autoDismiss=/저장 완료|게임 시작|계정을 생성했습니다|변경되었습니다|복원했습니다/.test(message);
    if(!autoDismiss)return;
    const timer=window.setTimeout(()=>{
      setMessage(current=>current===message?"":current);
    },2500);
    return ()=>window.clearTimeout(timer);
  },[message]);

  useEffect(() => {
    const saved = localStorage.getItem("dream-poker-theme");
    const nextTheme = saved === "dark" ? "dark" : "light";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
  }, []);

  useEffect(() => {
    const readTabFromUrl=()=>{
      const value=new URLSearchParams(window.location.search).get("tab");
      const next=(validTabs as readonly string[]).includes(value||"") ? value as TabKey : "dashboard";
      setTab(next);
      if(!value){
        const url=new URL(window.location.href);
        url.searchParams.set("tab",next);
        window.history.replaceState({tab:next},"",url.toString());
      }
    };
    readTabFromUrl();
    window.addEventListener("popstate",readTabFromUrl);
    return ()=>window.removeEventListener("popstate",readTabFromUrl);
  }, []);

  useEffect(() => {
    if(profile?.role!=="staff")return;
    if((staffAllowedTabs as readonly string[]).includes(tab))return;
    setTab("dashboard");
    if(typeof window!=="undefined"){
      const url=new URL(window.location.href);
      url.searchParams.set("tab","dashboard");
      window.history.replaceState({tab:"dashboard"},"",url.toString());
    }
  },[profile?.role,tab]);

  useEffect(() => {
    try{
      const saved=JSON.parse(localStorage.getItem("dream-poker-extra-tables") || "[]");
      const removed=JSON.parse(localStorage.getItem("dream-poker-removed-tables") || "[]");
      if(Array.isArray(saved)) setExtraTableNos(saved.map(String).filter(Boolean));
      if(Array.isArray(removed)) setRemovedTableNos(removed.map(String).filter(Boolean));
    }catch{}
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

    const { data: authData } = await supabase.auth.getUser();
    const currentUser = authData.user;
    if (!currentUser) {
      setSyncing(false);
      return;
    }

    const { data: profileRow, error: profileError } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", currentUser.id)
      .single();

    if (profileError || !profileRow) {
      setMessage(profileError?.message || "계정 권한 정보를 불러오지 못했습니다.");
      setSyncing(false);
      return;
    }

    const currentProfile:UserProfile = {
      userId:profileRow.user_id,
      username:profileRow.username ?? "",
      email:profileRow.email ?? currentUser.email ?? "",
      displayName:profileRow.display_name ?? "",
      role:profileRow.role as UserRole,
      agencyId:profileRow.agency_id ?? "",
      active:Boolean(profileRow.active)
    };
    setProfile(currentProfile);
    setOwnUsername(currentProfile.username || "");

    if (!currentProfile.active || currentProfile.role==="pending") {
      setMessage(!currentProfile.active ? "비활성화된 계정입니다. 관리자에게 문의해주세요." : "관리자 승인 대기 중인 계정입니다.");
      setSyncing(false);
      return;
    }

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

    if (currentProfile.role==="admin") {
      const [profilesResult,expenseResult,depositResult,shareholderResult,distributionResult,payoutResult]=await Promise.all([
        supabase.from("user_profiles").select("*").order("created_at"),
        supabase.from("expense_items").select("*").order("expense_date").order("created_at"),
        supabase.from("expense_deposits").select("*").order("deposited_on").order("created_at"),
        supabase.from("shareholders").select("*").order("sort_order").order("created_at"),
        supabase.from("weekly_distributions").select("*").order("week_start",{ascending:false}),
        supabase.from("shareholder_payouts").select("*").order("created_at")
      ]);
      const profiles=profilesResult.data;
      setAccountProfiles((profiles ?? []).map((x:any)=>({
        userId:x.user_id,username:x.username ?? "",email:x.email ?? "",displayName:x.display_name ?? "",
        role:x.role as UserRole,agencyId:x.agency_id ?? "",active:Boolean(x.active)
      })));
      setExpenseItems((expenseResult.data ?? []).map((x:any)=>({
        id:x.id,date:x.expense_date,category:x.category ?? "OTHER",description:x.description,
        amount:Number(x.amount),processedAmount:Number(x.processed_amount),status:x.status,
        sourceRef:x.source_ref ?? "",prepaidBy:x.prepaid_by ?? "",note:x.note ?? ""
      })));
      setExpenseDeposits((depositResult.data ?? []).map((x:any)=>({
        id:x.id,date:x.deposited_on,description:x.description,amount:Number(x.amount),
        distributionId:x.weekly_distribution_id ?? "",sourceRef:x.source_ref ?? "",note:x.note ?? ""
      })));
      setShareholders((shareholderResult.data ?? []).map((x:any)=>({
        id:x.id,name:x.name,rate:Number(x.ownership_rate),active:Boolean(x.active),sortOrder:Number(x.sort_order)
      })));
      setWeeklyDistributions((distributionResult.data ?? []).map((x:any)=>({
        id:x.id,weekStart:x.week_start,weekEnd:x.week_end,operatingProfit:Number(x.operating_profit),
        expenseApplied:Number(x.expense_applied),distributableProfit:Number(x.distributable_profit),
        status:x.status,finalizedAt:x.finalized_at ?? ""
      })));
      setShareholderPayouts((payoutResult.data ?? []).map((x:any)=>({
        id:x.id,distributionId:x.weekly_distribution_id,shareholderId:x.shareholder_id,
        name:x.shareholder_name_snapshot,rate:Number(x.rate_snapshot),amount:Number(x.amount),
        status:x.status,paidAt:x.paid_at ?? ""
      })));
    } else {
      setAccountProfiles([currentProfile]);
    }
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

  const dailyGameGroups = useMemo(()=>{
    const groups = new Map<string,{
      key:string;
      tableNo:string;
      gameNo:string;
      game:string;
      entries:GameEntry[];
    }>();

    if(!dailyLogSearch.trim()){
      gameSessions
        .filter(s=>s.date===summaryDate)
        .forEach(gs=>groups.set(gs.id,{
          key:gs.id,
          tableNo:gs.tableNo,
          gameNo:gs.gameNo,
          game:gs.game,
          entries:[]
        }));
    }

    filteredDailyEntries.forEach(entry=>{
      const gs=gameSessions.find(s=>s.id===entry.sessionId);
      const key=entry.sessionId || `legacy-${entry.game}`;
      const existing=groups.get(key);
      if(existing){
        existing.entries.push(entry);
      }else{
        groups.set(key,{
          key,
          tableNo:gs?.tableNo ?? "",
          gameNo:gs?.gameNo ?? "",
          game:entry.game,
          entries:[entry]
        });
      }
    });

    return [...groups.values()];
  },[filteredDailyEntries,gameSessions,dailyLogSearch,summaryDate]);
  const weeklyEntries = useMemo(()=>entries.filter(e=>e.date>=weekStart && e.date<=weekEnd),[entries,weekStart,weekEnd]);
  const weeklyFnbEntries = useMemo(()=>fnbEntries.filter(e=>e.date>=weekStart && e.date<=weekEnd),[fnbEntries,weekStart,weekEnd]);

  const total = (items: GameEntry[], key: "rake"|"rakeback") => items.reduce((s,e)=>s+e[key],0);
  const agencyTotals = (items: GameEntry[]) => agencies.map(a=>({
    ...a, amount: items.filter(e=>e.agencyId===a.id).reduce((s,e)=>s+e.rakeback,0)
  }));

  const weeklyEntryFee = total(weeklyEntries,"rake");
  const weeklyRakeback = total(weeklyEntries,"rakeback");
  const weeklyFnbAllTotal = weeklyFnbEntries.reduce((sum,e)=>sum+e.totalAmount,0);
  const weeklyFnbTotal = weeklyFnbEntries.filter(isOperatingFnbExpense).reduce((sum,e)=>sum+e.totalAmount,0);
  const weeklyProfit = weeklyEntryFee-weeklyRakeback-weeklyFnbTotal;
  const pendingExpenseRows=expenseItems.filter(x=>x.processedAmount<x.amount);
  const pendingExpenseTotal=pendingExpenseRows.reduce((sum,x)=>sum+(x.amount-x.processedAmount),0);
  const processedExpenseRows=expenseItems.filter(x=>x.processedAmount>=x.amount);
  const expenseProcessedTotal=expenseItems.reduce((sum,x)=>sum+x.processedAmount,0);
  const totalExpenseAmount=expenseItems.reduce((sum,x)=>sum+x.amount,0);
  const totalDepositAmount=expenseDeposits.reduce((sum,x)=>sum+x.amount,0);
  const ledgerBalance=totalDepositAmount-totalExpenseAmount;
  const ledgerRows=(()=>{
    const rows=[
      ...expenseDeposits.map(x=>({
        kind:"deposit" as const,
        id:x.id,
        date:x.date,
        description:x.description,
        amount:x.amount,
        sourceRef:x.sourceRef,
        note:x.note,
        expense:null as ExpenseItem|null
      })),
      ...expenseItems.map(x=>({
        kind:"expense" as const,
        id:x.id,
        date:x.date,
        description:x.description,
        amount:x.amount,
        sourceRef:x.sourceRef,
        note:x.note,
        expense:x
      }))
    ].sort((a,b)=>a.date.localeCompare(b.date) || (a.kind==="deposit"?-1:1) || a.id.localeCompare(b.id));
    let balance=0;
    return rows.map(row=>{
      balance += row.kind==="deposit" ? row.amount : -row.amount;
      return {...row,balance};
    });
  })();
  const visibleLedgerRows=ledgerRows.filter(row=>{
    if(expenseFilter==="all")return true;
    if(row.kind==="deposit")return false;
    if(!row.expense)return false;
    return expenseFilter==="pending"
      ? row.expense.processedAmount<row.expense.amount
      : row.expense.processedAmount>=row.expense.amount;
  });
  const selectedWeekDistribution=weeklyDistributions.find(x=>x.weekStart===weekStart) ?? null;
  const selectedWeekPayouts=selectedWeekDistribution
    ? shareholderPayouts.filter(x=>x.distributionId===selectedWeekDistribution.id)
    : [];
  const previewExpenseApplied=selectedWeekDistribution
    ? selectedWeekDistribution.expenseApplied
    : Math.min(Math.max(weeklyProfit,0),pendingExpenseTotal);
  const previewDistributableProfit=selectedWeekDistribution
    ? selectedWeekDistribution.distributableProfit
    : Math.max(weeklyProfit-previewExpenseApplied,0);
  const shareholderRateTotal=shareholders.filter(x=>x.active).reduce((sum,x)=>sum+x.rate,0);
  const weeklyFnbGroups = useMemo(()=>{
    const map=new Map<string,{group:string;amount:number;count:number;operating:boolean}>();
    weeklyFnbEntries.forEach(item=>{
      const current=map.get(item.expenseGroup) ?? {group:item.expenseGroup,amount:0,count:0,operating:item.expenseGroup==="2FLOOR"};
      current.amount+=item.totalAmount;
      current.count+=1;
      map.set(item.expenseGroup,current);
    });
    return [...map.values()].sort((a,b)=>Number(b.operating)-Number(a.operating) || b.amount-a.amount);
  },[weeklyFnbEntries]);
  const weeklyAgentRows = agencyTotals(weeklyEntries).filter(a=>a.amount>0).sort((a,b)=>b.amount-a.amount);

  const weeklyPlayerRows = useMemo(()=>{
    const map = new Map<string,{playerId:string;playerName:string;agency:string;buyIn:number;rake:number;rakeback:number}>();
    weeklyEntries.forEach(e=>{
      const key=`${e.playerId}::${e.agencyId}`;
      const old=map.get(key);
      if(old){old.buyIn+=e.buyIn;old.rake+=e.rake;old.rakeback+=e.rakeback;}
      else map.set(key,{playerId:e.playerId,playerName:getPlayerName(e.playerId),agency:e.agencyCodeSnapshot,buyIn:e.buyIn,rake:e.rake,rakeback:e.rakeback});
    });
    return [...map.values()].filter(row=>row.rakeback>0).sort((a,b)=>b.rakeback-a.rakeback);
  },[weeklyEntries,players]);

  const weeklyPlayerGroups = useMemo(()=>{
    const groups=new Map<string,typeof weeklyPlayerRows>();
    weeklyPlayerRows.forEach(row=>{
      const list=groups.get(row.agency) ?? [];
      list.push(row);
      groups.set(row.agency,list);
    });
    return [...groups.entries()].map(([agency,rows])=>({
      agency,
      rows,
      totalRakeback:rows.reduce((sum,row)=>sum+row.rakeback,0),
      totalBuyIn:rows.reduce((sum,row)=>sum+row.buyIn,0)
    })).sort((a,b)=>b.totalRakeback-a.totalRakeback);
  },[weeklyPlayerRows]);

  function getPlayerName(id:string){ return players.find(p=>p.id===id)?.name ?? "알 수 없음"; }

  async function signIn() {
    if (!supabase) return;
    const cleanId = loginId.trim().toLowerCase();
    if (!cleanId || !password) {
      setMessage("아이디와 비밀번호를 입력해주세요.");
      return;
    }
    setMessage("");
    const authEmail = cleanId.includes("@") ? cleanId : `${cleanId}@dream-poker.local`;
    const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password });
    if (error) setMessage("아이디 또는 비밀번호가 올바르지 않습니다.");
  }

  async function updateOwnLogin() {
    if (!supabase || !profile) return;
    const cleanUsername=ownUsername.trim().toLowerCase().replace(/\s+/g,"");
    const nextPassword=ownPassword.trim();

    if(!cleanUsername){
      setMessage("로그인 아이디를 입력해주세요.");
      return;
    }
    if(!/^[a-z0-9._-]+$/.test(cleanUsername)){
      setMessage("아이디는 영문 소문자, 숫자, ., _, - 만 사용할 수 있습니다.");
      return;
    }
    if(nextPassword && nextPassword.length<6){
      setMessage("새 비밀번호는 6자 이상이어야 합니다.");
      return;
    }

    setUpdatingOwnLogin(true);
    setMessage("");

    const usernameChanged=cleanUsername!==(profile.username || "").toLowerCase();
    const internalEmail=`${cleanUsername}@dream-poker.local`;

    if(usernameChanged){
      const {data:authUpdate,error:authError}=await supabase.auth.updateUser({
        email:internalEmail,
        data:{username:cleanUsername}
      });
      if(authError){
        setUpdatingOwnLogin(false);
        setMessage("아이디 변경에 실패했습니다: "+authError.message);
        return;
      }
      if(authUpdate.user?.email && authUpdate.user.email.toLowerCase()!==internalEmail){
        setUpdatingOwnLogin(false);
        setMessage("아이디 변경에 이메일 확인이 필요한 설정입니다. Supabase Auth 설정을 확인해주세요.");
        return;
      }
    }

    if(nextPassword){
      const {error:passwordError}=await supabase.auth.updateUser({password:nextPassword});
      if(passwordError){
        setUpdatingOwnLogin(false);
        setMessage("비밀번호 변경에 실패했습니다: "+passwordError.message);
        return;
      }
    }

    const {error:profileUpdateError}=await supabase.from("user_profiles").update({
      username:cleanUsername,
      email:internalEmail,
      updated_at:new Date().toISOString()
    }).eq("user_id",profile.userId);

    setUpdatingOwnLogin(false);
    if(profileUpdateError){
      setMessage("로그인 정보는 변경됐지만 프로필 저장에 실패했습니다: "+profileUpdateError.message);
      return;
    }

    setOwnPassword("");
    setProfile(prev=>prev?{...prev,username:cleanUsername,email:internalEmail}:prev);
    setMessage("로그인 정보가 변경되었습니다. 다음 로그인부터 새 아이디와 비밀번호를 사용하세요.");
  }

  async function createManagedAccount() {
    if (!supabase || profile?.role!=="admin") return;
    const cleanUsername=newAccountUsername.trim().toLowerCase().replace(/\s+/g,"");
    const cleanName=newAccountName.trim();
    if(!cleanUsername || !newAccountPassword || !cleanName){
      setMessage("이름, 아이디, 임시 비밀번호를 모두 입력해주세요.");
      return;
    }
    if(newAccountPassword.length<6){
      setMessage("임시 비밀번호는 6자 이상이어야 합니다.");
      return;
    }
    if(newAccountRole==="agent" && !newAccountAgencyId){
      setMessage("에이전트 계정은 연결할 Agency를 선택해주세요.");
      return;
    }

    const provisioning=createProvisioningClient();
    if(!provisioning){
      setMessage("계정 생성 클라이언트를 초기화하지 못했습니다.");
      return;
    }

    setCreatingAccount(true);
    setMessage("");
    if(!/^[a-z0-9._-]+$/.test(cleanUsername)){
      setCreatingAccount(false);
      setMessage("아이디는 영문 소문자, 숫자, ., _, - 만 사용할 수 있습니다.");
      return;
    }
    const internalEmail=`${cleanUsername}@dream-poker.local`;
    const {data,error}=await provisioning.auth.signUp({
      email:internalEmail,
      password:newAccountPassword,
      options:{data:{display_name:cleanName,username:cleanUsername}}
    });

    if(error || !data.user){
      setCreatingAccount(false);
      setMessage(error?.message || "계정을 생성하지 못했습니다.");
      return;
    }

    const {error:roleError}=await supabase.from("user_profiles").update({
      display_name:cleanName,
      username:cleanUsername,
      role:newAccountRole,
      agency_id:newAccountRole==="agent"?newAccountAgencyId:null,
      active:true,
      updated_at:new Date().toISOString()
    }).eq("user_id",data.user.id);

    setCreatingAccount(false);
    if(roleError){
      setMessage("Auth 계정은 생성됐지만 권한 연결에 실패했습니다: "+roleError.message);
      return;
    }

    setNewAccountUsername("");
    setNewAccountName("");
    setNewAccountPassword("");
    setNewAccountRole("staff");
    setNewAccountAgencyId("");
    setMessage(`${cleanName} 계정을 생성했습니다. 로그인 아이디는 ${cleanUsername} 입니다.`);
    await loadFromDatabase();
  }

  async function updateManagedAccount(userId:string,patch:Partial<Pick<UserProfile,"role"|"agencyId"|"active">>) {
    if(!supabase || profile?.role!=="admin")return;
    const nextRole=patch.role;
    const payload:any={updated_at:new Date().toISOString()};
    if(patch.role!==undefined) payload.role=patch.role;
    if(patch.active!==undefined) payload.active=patch.active;
    if(patch.agencyId!==undefined) payload.agency_id=patch.agencyId || null;
    if(nextRole && nextRole!=="agent") payload.agency_id=null;

    const {error}=await supabase.from("user_profiles").update(payload).eq("user_id",userId);
    if(error){setMessage(error.message);return;}
    await loadFromDatabase();
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
    setSelectedSearchIndex(0);
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

  async function updateDailyEntryAgency(entry:GameEntry,agencyId:string){
    const agency=agencies.find(a=>a.id===agencyId);
    if(!agency)return;
    const nextRakeback=Math.round(entry.rake*(agency.rate/100));
    if(isSupabaseConfigured && supabase && session){
      const {error}=await supabase.from("game_entries").update({
        agency_id:agency.id,
        agency_code_snapshot:agency.code,
        rate_snapshot:agency.rate,
        rakeback:nextRakeback
      }).eq("id",entry.id);
      if(error){setMessage(error.message);return;}
    }
    setEntries(prev=>prev.map(e=>e.id===entry.id?{
      ...e,
      agencyId:agency.id,
      agencyCodeSnapshot:agency.code,
      rateSnapshot:agency.rate,
      rakeback:nextRakeback
    }:e));
    setDailyEditingCell(null);
  }

  async function undoLastDeletedEntry(){
    const entry=lastDeletedEntry;
    if(!entry)return;
    if(isSupabaseConfigured && supabase && session){
      const payload={
        id:entry.id,
        played_on:entry.date,
        game_name:entry.game,
        player_id:entry.playerId,
        buy_in:entry.buyIn,
        rake:entry.rake,
        agency_id:entry.agencyId,
        agency_code_snapshot:entry.agencyCodeSnapshot,
        rate_snapshot:entry.rateSnapshot,
        rakeback:entry.rakeback,
        session_id:entry.sessionId ?? null
      };
      const {error}=await supabase.from("game_entries").insert(payload);
      if(error){setMessage(error.message);return;}
    }
    setEntries(prev=>prev.some(e=>e.id===entry.id)?prev:[...prev,entry]);
    setLastDeletedEntry(null);
    setMessage("삭제한 기록을 복원했습니다.");
  }

  async function removePlayerFromSession(entry:GameEntry){
    if(isSupabaseConfigured && supabase && session){
      const {error}=await supabase.from("game_entries").delete().eq("id",entry.id);
      if(error){setMessage(error.message);return;}
    }
    setEntries(prev=>prev.filter(e=>e.id!==entry.id));
    setLastDeletedEntry(entry);
  }

  function addAvailableTable(){
    const tableNo=newTableNo.trim().replace(/\D/g,"");
    if(!tableNo)return;
    const next=Array.from(new Set([...extraTableNos,tableNo]));
    const nextRemoved=removedTableNos.filter(no=>no!==tableNo);
    setExtraTableNos(next);
    setRemovedTableNos(nextRemoved);
    localStorage.setItem("dream-poker-extra-tables",JSON.stringify(next));
    localStorage.setItem("dream-poker-removed-tables",JSON.stringify(nextRemoved));
    setSelectedTableNo(tableNo);
    setNewTableNo("");
  }

  function deleteSelectedTable(){
    const tableNo=selectedTableNo.trim();
    if(!tableNo)return;
    if(activeGameSessions.some(s=>s.tableNo===tableNo)){
      setMessage(`Table ${tableNo}는 진행 중이라 삭제할 수 없습니다. 먼저 경기를 종료해주세요.`);
      return;
    }
    const nextRemoved=Array.from(new Set([...removedTableNos,tableNo]));
    const nextExtra=extraTableNos.filter(no=>no!==tableNo);
    setRemovedTableNos(nextRemoved);
    setExtraTableNos(nextExtra);
    localStorage.setItem("dream-poker-removed-tables",JSON.stringify(nextRemoved));
    localStorage.setItem("dream-poker-extra-tables",JSON.stringify(nextExtra));
    const nextTable=availableTableNos.find(no=>no!==tableNo) || "";
    setSelectedTableNo(nextTable);
  }

  async function updateActiveGameSession(gameSession:GameSession,patch:{tableNo?:string;game?:string;gameNo?:string}){
    const nextTableNo=(patch.tableNo ?? gameSession.tableNo).trim();
    const nextGame=patch.game ?? gameSession.game;
    const nextGameNo=(patch.gameNo ?? gameSession.gameNo).trim();
    if(!nextTableNo)return;
    if(nextTableNo!==gameSession.tableNo && gameSessions.some(s=>s.id!==gameSession.id && s.status==="active" && s.date===gameSession.date && s.tableNo===nextTableNo)){
      setMessage(`T${nextTableNo}는 이미 진행 중입니다.`);
      return;
    }

    if(isSupabaseConfigured && supabase && session){
      const payload:any={};
      if(patch.tableNo!==undefined)payload.table_no=nextTableNo;
      if(patch.game!==undefined)payload.game_name=nextGame;
      if(patch.gameNo!==undefined)payload.game_no=nextGameNo || null;
      const {error}=await supabase.from("game_sessions").update(payload).eq("id",gameSession.id);
      if(error){setMessage(error.message);return;}

      if(patch.game!==undefined){
        const sessionEntries=entries.filter(e=>e.sessionId===gameSession.id);
        for(const entry of sessionEntries){
          const nextRake=rakePerBuyIn(nextGame)*entry.buyIn;
          const nextRakeback=Math.round(nextRake*(entry.rateSnapshot/100));
          const {error:entryError}=await supabase.from("game_entries").update({
            game_name:nextGame,rake:nextRake,rakeback:nextRakeback
          }).eq("id",entry.id);
          if(entryError){setMessage(entryError.message);return;}
        }
      }
    }

    setGameSessions(prev=>prev.map(s=>s.id===gameSession.id?{...s,tableNo:nextTableNo,game:nextGame,gameNo:nextGameNo}:s));
    if(patch.game!==undefined){
      setEntries(prev=>prev.map(e=>{
        if(e.sessionId!==gameSession.id)return e;
        const nextRake=rakePerBuyIn(nextGame)*e.buyIn;
        return {...e,game:nextGame,rake:nextRake,rakeback:Math.round(nextRake*(e.rateSnapshot/100))};
      }));
    }
    if(patch.tableNo!==undefined)setSelectedTableNo(nextTableNo);
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


  async function addDepositItem(){
    const amount=Number(expenseAmount.replace(/,/g,""));
    const description=expenseDescription.trim() || "주간 정산금";
    if(!amount || amount<=0){
      setMessage("Deposit 금액을 입력해주세요.");
      return;
    }
    if(!supabase || !session){
      setMessage("Deposit은 서버 연결 상태에서만 저장할 수 있습니다.");
      return;
    }
    const {error}=await supabase.rpc("record_expense_deposit",{
      p_deposited_on:expenseDate,
      p_description:description,
      p_amount:amount,
      p_note:expenseNote.trim() || null,
      p_source_ref:"Dream Poker Solution"
    });
    if(error){setMessage(error.message);return;}
    setExpenseDescription("");
    setExpenseAmount("");
    setExpenseNote("");
    await loadFromDatabase();
    setMessage("Deposit을 등록하고 미처리 경비에 반영했습니다.");
  }

  async function addLedgerItem(){
    if(expenseEntryType==="deposit"){
      await addDepositItem();
      return;
    }
    await addExpenseItem();
  }

  async function addExpenseItem(){
    const amount=Number(expenseAmount.replace(/,/g,""));
    const description=expenseDescription.trim();
    if(!description || !amount || amount<=0){
      setMessage("지출 항목과 금액을 입력해주세요.");
      return;
    }
    if(!supabase || !session){
      setMessage("지출 내역은 서버 연결 상태에서만 저장할 수 있습니다.");
      return;
    }
    const payload={
      expense_date:expenseDate,
      category:expenseCategory,
      description,
      amount,
      processed_amount:0,
      status:"pending",
      source_ref:"Dream Poker Solution",
      prepaid_by:expensePrepaidBy.trim() || null,
      note:expenseNote.trim() || null
    };
    const {data,error}=await supabase.from("expense_items").insert(payload).select().single();
    if(error){setMessage(error.message);return;}
    setExpenseItems(prev=>[...prev,{
      id:data.id,date:data.expense_date,category:data.category,description:data.description,
      amount:Number(data.amount),processedAmount:Number(data.processed_amount),status:data.status,
      sourceRef:data.source_ref ?? "",prepaidBy:data.prepaid_by ?? "",note:data.note ?? ""
    }].sort((a,b)=>(a.date+a.id).localeCompare(b.date+b.id)));
    setExpenseDescription("");
    setExpenseAmount("");
    setExpensePrepaidBy("");
    setExpenseNote("");
    setMessage("지출 항목을 등록했습니다.");
  }

  async function deleteExpenseItem(item:ExpenseItem){
    if(item.processedAmount>0){
      setMessage("이미 일부 또는 전액 처리된 지출은 삭제할 수 없습니다.");
      return;
    }
    if(!confirm(`"${item.description}" 지출 항목을 삭제할까요?`))return;
    if(supabase && session){
      const {error}=await supabase.from("expense_items").delete().eq("id",item.id);
      if(error){setMessage(error.message);return;}
    }
    setExpenseItems(prev=>prev.filter(x=>x.id!==item.id));
  }

  async function updateExpensePrepaidBy(item:ExpenseItem,value:string){
    const prepaidBy=value.trim();
    if(prepaidBy===item.prepaidBy)return;
    if(!supabase || !session)return;
    const {error}=await supabase.from("expense_items").update({
      prepaid_by:prepaidBy || null,
      updated_at:new Date().toISOString()
    }).eq("id",item.id);
    if(error){setMessage(error.message);return;}
    setExpenseItems(prev=>prev.map(x=>x.id===item.id?{...x,prepaidBy}:x));
  }

  function openExpenseEditor(item:ExpenseItem){
    setEditingExpenseId(item.id);
    setExpenseEditDate(item.date);
    setExpenseEditCategory(item.category);
    setExpenseEditDescription(item.description);
    setExpenseEditPrepaidBy(item.prepaidBy);
    setExpenseEditAmount(String(item.amount));
    setExpenseEditProcessedAmount(String(item.processedAmount));
    setExpenseEditNote(item.note);
  }

  function closeExpenseEditor(){
    setEditingExpenseId(null);
  }

  async function saveExpenseEditor(){
    const item=expenseItems.find(x=>x.id===editingExpenseId);
    if(!item || !supabase || !session)return;
    const amount=Number(expenseEditAmount.replace(/,/g,""));
    const processedAmount=Number(expenseEditProcessedAmount.replace(/,/g,""));
    const description=expenseEditDescription.trim();
    if(!description || !amount || amount<=0){
      setMessage("경비 항목과 원래 금액을 확인해주세요.");
      return;
    }
    if(Number.isNaN(processedAmount) || processedAmount<0 || processedAmount>amount){
      setMessage("처리된 금액은 0 이상, 원래 금액 이하로 입력해주세요.");
      return;
    }
    const status:ExpenseItem["status"]=
      processedAmount>=amount ? "processed" :
      processedAmount>0 ? "partial" : "pending";
    setSavingExpenseEdit(true);
    const {error}=await supabase.from("expense_items").update({
      expense_date:expenseEditDate,
      category:expenseEditCategory,
      description,
      prepaid_by:expenseEditPrepaidBy.trim() || null,
      amount,
      processed_amount:processedAmount,
      status,
      note:expenseEditNote.trim() || null,
      updated_at:new Date().toISOString()
    }).eq("id",item.id);
    setSavingExpenseEdit(false);
    if(error){setMessage(error.message);return;}
    setExpenseItems(prev=>prev.map(x=>x.id===item.id?{
      ...x,
      date:expenseEditDate,
      category:expenseEditCategory,
      description,
      prepaidBy:expenseEditPrepaidBy.trim(),
      amount,
      processedAmount,
      status,
      note:expenseEditNote.trim()
    }:x));
    setEditingExpenseId(null);
    setMessage("지출 항목을 수정했습니다.");
  }

  async function updateShareholderRate(holder:Shareholder,rate:number){
    const next=Math.max(0,Math.min(100,Number(rate)||0));
    if(!supabase || !session)return;
    const {error}=await supabase.from("shareholders").update({ownership_rate:next,updated_at:new Date().toISOString()}).eq("id",holder.id);
    if(error){setMessage(error.message);return;}
    setShareholders(prev=>prev.map(x=>x.id===holder.id?{...x,rate:next}:x));
  }

  async function finalizeSelectedWeek(){
    if(!supabase || !session || profile?.role!=="admin")return;
    if(weeklyDistributions.some(x=>x.weekStart===weekStart)){
      setMessage("이 주차는 이미 지출 처리와 배당 계산이 확정되었습니다.");
      return;
    }
    if(!confirm(`${weekStart} ~ ${weekEnd} 주간 수익에서 미처리 경비를 먼저 차감하고 배당을 확정할까요?`))return;
    setFinalizingDistribution(true);
    const {error}=await supabase.rpc("finalize_weekly_distribution",{
      p_week_start:weekStart,
      p_week_end:weekEnd,
      p_operating_profit:weeklyProfit
    });
    setFinalizingDistribution(false);
    if(error){setMessage(error.message);return;}
    await loadFromDatabase();
    setMessage("주간 지출 처리와 지분 배당을 확정했습니다.");
  }

  async function markShareholderPayoutPaid(payout:ShareholderPayout){
    if(!supabase || !session)return;
    const nextStatus=payout.status==="paid"?"pending":"paid";
    const {error}=await supabase.from("shareholder_payouts").update({
      status:nextStatus,
      paid_at:nextStatus==="paid"?new Date().toISOString():null
    }).eq("id",payout.id);
    if(error){setMessage(error.message);return;}
    setShareholderPayouts(prev=>prev.map(x=>x.id===payout.id?{...x,status:nextStatus,paidAt:nextStatus==="paid"?new Date().toISOString():""}:x));
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

  function exportSettlementCsv(startDate=reportStart,endDate=reportEnd){
    const reportEntries=entries.filter(e=>e.date>=startDate && e.date<=endDate);
    const reportFnb=fnbEntries.filter(e=>e.date>=startDate && e.date<=endDate);
    const entryFee=reportEntries.reduce((sum,e)=>sum+revenuePerBuyIn(e.game)*e.buyIn,0);
    const rakeback=reportEntries.reduce((sum,e)=>sum+e.rakeback,0);
    const fnb=reportFnb.reduce((sum,e)=>sum+e.totalAmount,0);
    const net=entryFee-rakeback-fnb;
    const rows:string[][]=[
      ["드림포커 정산서"],
      ["기간",startDate,endDate],
      ["총 엔트리피",String(entryFee)],
      ["레이크백",String(rakeback)],
      ["F&B",String(fnb)],
      ["오늘 수익",String(net)],
      [],
      ["게임별 정산"],
      ["날짜","테이블","게임번호","게임","플레이어","에이전트","바이인","엔트리피","레이크백"]
    ];
    reportEntries.forEach(e=>{
      const gs=gameSessions.find(s=>s.id===e.sessionId);
      rows.push([
        e.date,
        gs?.tableNo ? "Table "+gs.tableNo : "",
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
    downloadBlob("드림포커_정산서_"+startDate+(startDate!==endDate?"_"+endDate:"")+".csv",new Blob([csv],{type:"text/csv;charset=utf-8"}));
    setDailyExportOpen(false);
  }

  function buildSettlementCanvas(startDate=reportStart,endDate=reportEnd){
    const reportEntries=entries.filter(e=>e.date>=startDate && e.date<=endDate);
    const reportFnb=fnbEntries.filter(e=>e.date>=startDate && e.date<=endDate);
    const entryFee=reportEntries.reduce((sum,e)=>sum+revenuePerBuyIn(e.game)*e.buyIn,0);
    const rakeback=reportEntries.reduce((sum,e)=>sum+e.rakeback,0);
    const fnb=reportFnb.reduce((sum,e)=>sum+e.totalAmount,0);
    const net=entryFee-rakeback-fnb;

    const groups=new Map<string,{tableNo:string;gameNo:string;game:string;entries:GameEntry[]}>();
    reportEntries.forEach(entry=>{
      const gs=gameSessions.find(s=>s.id===entry.sessionId);
      const key=entry.sessionId || `legacy-${entry.game}`;
      const existing=groups.get(key);
      if(existing) existing.entries.push(entry);
      else groups.set(key,{
        tableNo:gs?.tableNo||"-",
        gameNo:gs?.gameNo||"-",
        game:entry.game,
        entries:[entry]
      });
    });

    const detailRows=Math.max(1,reportEntries.length);
    const groupCount=Math.max(1,groups.size);
    const width=1400;
    const height=Math.max(900,430 + detailRows*54 + groupCount*64 + 100);
    const canvas=document.createElement("canvas");
    canvas.width=width;
    canvas.height=height;
    const ctx=canvas.getContext("2d");
    if(!ctx)return null;

    const text=(value:string,x:number,y:number,size:number,weight=500,color="#202328",align:"left"|"right"="left")=>{
      ctx.fillStyle=color;
      ctx.font=`${weight} ${size}px Arial, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`;
      ctx.textAlign=align;
      ctx.textBaseline="middle";
      ctx.fillText(value,x,y);
    };
    const line=(x1:number,y1:number,x2:number,y2:number,color="#e2e5e9")=>{
      ctx.strokeStyle=color;
      ctx.lineWidth=1;
      ctx.beginPath();
      ctx.moveTo(x1,y1);
      ctx.lineTo(x2,y2);
      ctx.stroke();
    };
    const roundRect=(x:number,y:number,w:number,h:number,r:number,fill:string,stroke="#e1e4e8")=>{
      ctx.beginPath();
      ctx.roundRect(x,y,w,h,r);
      ctx.fillStyle=fill;
      ctx.fill();
      ctx.strokeStyle=stroke;
      ctx.lineWidth=1;
      ctx.stroke();
    };

    ctx.fillStyle="#f5f6f8";
    ctx.fillRect(0,0,width,height);
    roundRect(45,35,width-90,height-70,22,"#ffffff","#dfe3e7");

    // Header
    text("드림포커 정산서",80,92,34,800,"#17191c");
    text(startDate===endDate?startDate:`${startDate} ~ ${endDate}`,width-80,92,18,600,"#757d86","right");
    line(80,132,width-80,132);

    // Accounting summary
    const summary=[
      ["총 엔트리피",entryFee],
      ["레이크백",-rakeback],
      ["F&B",-fnb],
      ["오늘 수익",net]
    ] as [string,number][];
    const cardGap=14;
    const cardW=(width-160-cardGap*3)/4;
    summary.forEach(([label,value],i)=>{
      const x=80+i*(cardW+cardGap);
      const isProfit=i===3;
      roundRect(x,158,cardW,112,14,isProfit?"#fff9eb":"#fafbfc",isProfit?"#e5c77f":"#e3e6ea");
      text(label,x+18,188,15,700,isProfit?"#8b6518":"#6a727b");
      text((value<0?"− ":"")+money.format(Math.abs(value)),x+18,232,26,800,isProfit?"#9c6b0c":"#17191c");
    });

    // Section heading
    text("게임별 정산",80,322,23,800,"#17191c");
    text(`${groups.size} GAME · ${reportEntries.length}명`,width-80,322,14,700,"#7b838c","right");

    let y=358;
    if(groups.size===0){
      roundRect(80,y,width-160,86,12,"#fafbfc");
      text("해당 기간의 게임 기록이 없습니다.",100,y+43,16,600,"#8a929a");
      y+=110;
    }else{
      [...groups.values()].forEach(group=>{
        const groupBuyIns=group.entries.reduce((sum,e)=>sum+e.buyIn,0);
        const groupEntryFee=group.entries.reduce((sum,e)=>sum+revenuePerBuyIn(e.game)*e.buyIn,0);

        roundRect(80,y,width-160,52,10,"#f7f8fa","#e0e4e8");
        text(`Table ${group.tableNo}   No.${group.gameNo}   ${group.game}`,100,y+26,17,750,"#202328");
        text(`${groupBuyIns} BUY-IN   ·   ${money.format(groupEntryFee)}`,width-100,y+26,15,700,"#4f5862","right");
        y+=52;

        // Table header
        ctx.fillStyle="#ffffff";
        ctx.fillRect(80,y,width-160,40);
        const cols=[
          {label:"플레이어",x:100},
          {label:"에이전트",x:610},
          {label:"바이인",x:790},
          {label:"엔트리피",x:940},
          {label:"레이크백",x:1180}
        ];
        cols.forEach(col=>text(col.label,col.x,y+20,13,700,"#777f88"));
        line(80,y+40,width-80,y+40);
        y+=40;

        group.entries.forEach(entry=>{
          const rowH=54;
          text(getPlayerName(entry.playerId),100,y+rowH/2,16,600,"#202328");
          text(entry.agencyCodeSnapshot,610,y+rowH/2,14,600,"#59616a");
          text(`${entry.buyIn}회`,790,y+rowH/2,15,650,"#202328");
          text(money.format(revenuePerBuyIn(entry.game)*entry.buyIn),940,y+rowH/2,15,650,"#202328");
          text(money.format(entry.rakeback),1180,y+rowH/2,15,700,"#202328");
          line(80,y+rowH,width-80,y+rowH);
          y+=rowH;
        });
        y+=20;
      });
    }

    // Footer
    line(80,height-105,width-80,height-105);
    text("Dream Poker",80,height-72,14,700,"#9aa1a8");
    text("정산 데이터는 시스템 입력 내역을 기준으로 생성되었습니다.",width-80,height-72,12,500,"#9aa1a8","right");
    return canvas;
  }

  function exportSettlementPng(startDate=reportStart,endDate=reportEnd){
    const canvas=buildSettlementCanvas(startDate,endDate);
    if(!canvas)return;
    canvas.toBlob(blob=>{
      if(blob)downloadBlob("드림포커_정산서_"+startDate+(startDate!==endDate?"_"+endDate:"")+".png",blob);
    },"image/png");
    setDailyExportOpen(false);
  }

  function exportSettlementPdf(startDate=reportStart,endDate=reportEnd){
    const canvas=buildSettlementCanvas(startDate,endDate);
    if(!canvas)return;
    const image=canvas.toDataURL("image/jpeg",0.94);
    const pdf=new jsPDF({
      orientation:"landscape",
      unit:"pt",
      format:"a4"
    });
    const pageWidth=pdf.internal.pageSize.getWidth();
    const pageHeight=pdf.internal.pageSize.getHeight();
    const ratio=Math.min((pageWidth-24)/canvas.width,(pageHeight-24)/canvas.height);
    const width=canvas.width*ratio;
    const height=canvas.height*ratio;
    pdf.addImage(image,"JPEG",(pageWidth-width)/2,(pageHeight-height)/2,width,height);
    pdf.save("드림포커_정산서_"+startDate+(startDate!==endDate?"_"+endDate:"")+".pdf");
    setDailyExportOpen(false);
  }

  function buildWeeklySettlementCanvas(){
    const width=1400;
    const playerRows=weeklyPlayerRows.length;
    const agentRows=weeklyAgentRows.length;
    const height=Math.max(980,500 + agentRows*48 + playerRows*48 + weeklyPlayerGroups.length*58);
    const canvas=document.createElement("canvas");
    canvas.width=width; canvas.height=height;
    const ctx=canvas.getContext("2d");
    if(!ctx)return null;

    const text=(value:string,x:number,y:number,size:number,weight=500,color="#202328",align:"left"|"right"="left")=>{
      ctx.fillStyle=color;
      ctx.font=`${weight} ${size}px Arial, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`;
      ctx.textAlign=align;
      ctx.textBaseline="middle";
      ctx.fillText(value,x,y);
    };
    const line=(x1:number,y1:number,x2:number,y2:number,color="#e2e5e9")=>{
      ctx.strokeStyle=color; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    };
    const roundRect=(x:number,y:number,w:number,h:number,r:number,fill:string,stroke="#e1e4e8")=>{
      ctx.beginPath(); ctx.roundRect(x,y,w,h,r); ctx.fillStyle=fill; ctx.fill(); ctx.strokeStyle=stroke; ctx.lineWidth=1; ctx.stroke();
    };

    ctx.fillStyle="#f4f5f7"; ctx.fillRect(0,0,width,height);
    roundRect(45,35,width-90,height-70,22,"#fff","#dde1e5");
    text("드림포커 주간 정산 보고서",80,90,34,800,"#17191c");
    text(`${weekStart} ~ ${weekEnd} · 월요일–일요일`,width-80,90,17,600,"#727a83","right");
    line(80,132,width-80,132);

    const cards:[string,number,boolean][]=[
      ["총 엔트리피",weeklyEntryFee,false],
      ["레이크백",-weeklyRakeback,false],
      ["F&B",-weeklyFnbTotal,false],
      ["주간 수익",weeklyProfit,true]
    ];
    const gap=14, cardW=(width-160-gap*3)/4;
    cards.forEach(([label,value,profit],i)=>{
      const x=80+i*(cardW+gap);
      roundRect(x,158,cardW,112,14,profit?"#fff9eb":"#fafbfc",profit?"#e4c77e":"#e2e5e8");
      text(label,x+18,188,15,700,profit?"#8b6518":"#68717a");
      text((value<0?"− ":"")+money.format(Math.abs(value)),x+18,232,26,800,profit?"#9d6a09":"#17191c");
    });

    let y=318;
    text("에이전트별 레이크백",80,y,22,800,"#17191c");
    y+=30;
    if(weeklyAgentRows.length===0){
      text("이번 주 레이크백 지급 내역이 없습니다.",80,y+24,15,600,"#8a929a");
      y+=60;
    }else{
      weeklyAgentRows.forEach(agent=>{
        line(80,y,width-80,y);
        text(agent.code,92,y+24,15,700,"#262a2e");
        text(`${agent.rate}%`,320,y+24,13,600,"#818890");
        text(money.format(agent.amount),width-92,y+24,16,750,"#9a6410","right");
        y+=48;
      });
      line(80,y,width-80,y);
      y+=34;
    }

    text("레이크백 지급 플레이어",80,y,22,800,"#17191c");
    y+=32;
    if(weeklyPlayerGroups.length===0){
      text("레이크백이 발생한 플레이어가 없습니다.",80,y+24,15,600,"#8a929a");
      y+=60;
    }else{
      weeklyPlayerGroups.forEach(group=>{
        roundRect(80,y,width-160,46,9,"#f7f8fa","#e1e4e8");
        text(group.agency,96,y+23,15,800,"#24282c");
        text(`${group.rows.length}명 · ${group.totalBuyIn} BUY-IN · ${money.format(group.totalRakeback)}`,width-96,y+23,14,700,"#6d747c","right");
        y+=46;
        group.rows.forEach(row=>{
          text(row.playerName,100,y+23,15,600,"#25292d");
          text(`${row.buyIn}회`,760,y+23,14,600,"#59616a");
          text(money.format(row.rake),930,y+23,14,600,"#59616a");
          text(money.format(row.rakeback),width-100,y+23,15,750,"#9a6410","right");
          line(80,y+46,width-80,y+46);
          y+=46;
        });
        y+=16;
      });
    }

    line(80,height-105,width-80,height-105);
    text("Dream Poker",80,height-72,14,700,"#9aa1a8");
    text("주주·운영 보고용 주간 정산 자료",width-80,height-72,12,500,"#9aa1a8","right");
    return canvas;
  }

  function exportWeeklyPng(){
    const canvas=buildWeeklySettlementCanvas();
    if(!canvas)return;
    canvas.toBlob(blob=>{if(blob)downloadBlob(`드림포커_주간정산_${weekStart}_${weekEnd}.png`,blob)},"image/png");
  }

  function exportWeeklyPdf(){
    const canvas=buildWeeklySettlementCanvas();
    if(!canvas)return;
    const image=canvas.toDataURL("image/jpeg",0.94);
    const pdf=new jsPDF({orientation:"landscape",unit:"pt",format:"a4"});
    const pageWidth=pdf.internal.pageSize.getWidth();
    const pageHeight=pdf.internal.pageSize.getHeight();
    const ratio=Math.min((pageWidth-24)/canvas.width,(pageHeight-24)/canvas.height);
    const width=canvas.width*ratio, height=canvas.height*ratio;
    pdf.addImage(image,"JPEG",(pageWidth-width)/2,(pageHeight-height)/2,width,height);
    pdf.save(`드림포커_주간정산_${weekStart}_${weekEnd}.pdf`);
  }

  function exportWeeklyCsv(){
    const rows:string[][]=[
      ["드림포커 주간 정산 보고서"],
      ["기간",weekStart,weekEnd],
      ["총 엔트리피",String(weeklyEntryFee)],
      ["레이크백",String(weeklyRakeback)],
      ["F&B",String(weeklyFnbTotal)],
      ["주간 수익",String(weeklyProfit)],
      [],
      ["에이전트별 레이크백"],
      ["에이전트","요율","레이크백"]
    ];
    weeklyAgentRows.forEach(a=>rows.push([a.code,`${a.rate}%`,String(a.amount)]));
    rows.push([],["레이크백 지급 플레이어"],["에이전트","플레이어","바이인","엔트리피","레이크백"]);
    weeklyPlayerGroups.forEach(group=>group.rows.forEach(row=>{
      rows.push([group.agency,row.playerName,String(row.buyIn),String(row.rake),String(row.rakeback)]);
    }));
    const csv="\uFEFF"+rows.map(r=>r.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(",")).join("\n");
    downloadBlob(`드림포커_주간정산_${weekStart}_${weekEnd}.csv`,new Blob([csv],{type:"text/csv;charset=utf-8"}));
  }

  function buildWeeklyAgentCanvas(agencyCode:string){
    const group=weeklyPlayerGroups.find(g=>g.agency===agencyCode);
    if(!group)return null;
    const width=1200;
    const height=Math.max(720,390+group.rows.length*58);
    const canvas=document.createElement("canvas");
    canvas.width=width; canvas.height=height;
    const ctx=canvas.getContext("2d");
    if(!ctx)return null;

    const text=(value:string,x:number,y:number,size:number,weight=500,color="#202328",align:"left"|"right"="left")=>{
      ctx.fillStyle=color;
      ctx.font=`${weight} ${size}px Arial, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`;
      ctx.textAlign=align;
      ctx.textBaseline="middle";
      ctx.fillText(value,x,y);
    };
    const line=(x1:number,y1:number,x2:number,y2:number,color="#e2e5e9")=>{
      ctx.strokeStyle=color; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    };
    const roundRect=(x:number,y:number,w:number,h:number,r:number,fill:string,stroke="#e1e4e8")=>{
      ctx.beginPath(); ctx.roundRect(x,y,w,h,r); ctx.fillStyle=fill; ctx.fill(); ctx.strokeStyle=stroke; ctx.lineWidth=1; ctx.stroke();
    };

    ctx.fillStyle="#f4f5f7"; ctx.fillRect(0,0,width,height);
    roundRect(40,32,width-80,height-64,20,"#fff","#dde1e5");
    text("드림포커 에이전트 주간 정산서",72,82,30,800,"#17191c");
    text(`${weekStart} ~ ${weekEnd}`,width-72,82,16,600,"#727a83","right");
    line(72,122,width-72,122);

    text(agencyCode,72,168,24,800,"#8f6411");
    text(`${group.rows.length}명 · ${group.totalBuyIn} BUY-IN`,72,202,14,600,"#747c84");

    roundRect(72,232,500,96,14,"#fafbfc","#e1e4e8");
    text("지급 레이크백",92,261,14,700,"#6a727b");
    text(money.format(group.totalRakeback),92,301,27,800,"#9a6410");

    const groupEntryFee=group.rows.reduce((sum,row)=>sum+row.rake,0);
    roundRect(590,232,538,96,14,"#fafbfc","#e1e4e8");
    text("총 엔트리피",610,261,14,700,"#6a727b");
    text(money.format(groupEntryFee),610,301,27,800,"#17191c");

    let y=365;
    text("플레이어",82,y,13,700,"#777f88");
    text("바이인",610,y,13,700,"#777f88");
    text("엔트리피",760,y,13,700,"#777f88");
    text("레이크백",width-82,y,13,700,"#777f88","right");
    y+=22; line(72,y,width-72,y);
    y+=8;

    group.rows.forEach(row=>{
      const rowH=56;
      text(row.playerName,82,y+rowH/2,16,600,"#202328");
      text(`${row.buyIn}회`,610,y+rowH/2,14,600,"#59616a");
      text(money.format(row.rake),760,y+rowH/2,14,600,"#59616a");
      text(money.format(row.rakeback),width-82,y+rowH/2,15,750,"#9a6410","right");
      line(72,y+rowH,width-72,y+rowH);
      y+=rowH;
    });

    line(72,height-96,width-72,height-96);
    text("Dream Poker",72,height-64,13,700,"#9aa1a8");
    text(`${agencyCode} 주간 레이크백 정산`,width-72,height-64,12,500,"#9aa1a8","right");
    return canvas;
  }

  function exportWeeklyAgentPng(agencyCode:string){
    const canvas=buildWeeklyAgentCanvas(agencyCode);
    if(!canvas)return;
    canvas.toBlob(blob=>{if(blob)downloadBlob(`드림포커_${agencyCode}_주간정산_${weekStart}_${weekEnd}.png`,blob)},"image/png");
  }

  function exportWeeklyAgentPdf(agencyCode:string){
    const canvas=buildWeeklyAgentCanvas(agencyCode);
    if(!canvas)return;
    const image=canvas.toDataURL("image/jpeg",0.94);
    const pdf=new jsPDF({orientation:"landscape",unit:"pt",format:"a4"});
    const pageWidth=pdf.internal.pageSize.getWidth();
    const pageHeight=pdf.internal.pageSize.getHeight();
    const ratio=Math.min((pageWidth-24)/canvas.width,(pageHeight-24)/canvas.height);
    const width=canvas.width*ratio, height=canvas.height*ratio;
    pdf.addImage(image,"JPEG",(pageWidth-width)/2,(pageHeight-height)/2,width,height);
    pdf.save(`드림포커_${agencyCode}_주간정산_${weekStart}_${weekEnd}.pdf`);
  }

  function exportWeeklyAgentCsv(agencyCode:string){
    const group=weeklyPlayerGroups.find(g=>g.agency===agencyCode);
    if(!group)return;
    const rows:string[][]=[
      ["드림포커 에이전트 주간 정산서"],
      ["에이전트",agencyCode],
      ["기간",weekStart,weekEnd],
      ["총 바이인",String(group.totalBuyIn)],
      ["총 엔트리피",String(group.rows.reduce((sum,row)=>sum+row.rake,0))],
      ["지급 레이크백",String(group.totalRakeback)],
      [],
      ["플레이어","바이인","엔트리피","레이크백"]
    ];
    group.rows.forEach(row=>rows.push([row.playerName,String(row.buyIn),String(row.rake),String(row.rakeback)]));
    const csv="\uFEFF"+rows.map(r=>r.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(",")).join("\n");
    downloadBlob(`드림포커_${agencyCode}_주간정산_${weekStart}_${weekEnd}.csv`,new Blob([csv],{type:"text/csv;charset=utf-8"}));
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
        <h1>Dream Poker 로그인</h1>
        <p className="sub">관리자 · 직원 · 에이전트 전용 계정으로 로그인합니다.</p>
        <div className="authForm">
          <label>아이디<input value={loginId} onChange={e=>setLoginId(e.target.value.toLowerCase())} placeholder="아이디"/></label>
          <label>비밀번호<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="비밀번호"/></label>
          <div className="authButtons">
            <button className="primary" onClick={signIn}>로그인</button>
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
  const todayPlayerCount = new Set(todayEntries.map(e=>e.playerId)).size;
  const weekSettlement = total(thisWeekEntries,"rakeback");
  const recentEntries = [...entries].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,6);
  const activeGameSessions = gameSessions.filter(s=>s.status==="active" && s.date===today());
  const availableTableNos = Array.from(new Set(["4","12","13","5","2",...extraTableNos,...gameSessions.map(s=>s.tableNo).filter(Boolean)]))
    .filter(no=>!removedTableNos.includes(no) || activeGameSessions.some(s=>s.tableNo===no));
  const selectedGameSession = activeGameSessions.find(s=>s.tableNo===selectedTableNo) ?? null;

  const globalFeatureItems = [
    {key:"dashboard",label:"대시보드",description:"오늘 운영 현황",keywords:"대시보드 홈 현황"},
    {key:"players",label:"플레이어 관리",description:"플레이어 검색 · 등록 · 정보 확인",keywords:"플레이어 선수 회원 명단 등록"},
    {key:"agencies",label:"에이전트 관리",description:"에이전트 코드와 정산 요율",keywords:"에이전트 코드 요율"},
    {key:"games",label:"게임 입력",description:"테이블 현황 · 바이인 입력",keywords:"게임 바이인 테이블 현황 좌석"},
    {key:"daily",label:"일일 정산",description:"오늘 정산 · 지난 게임 로그 수정",keywords:"일일 정산 로그 수정 매출 수익"},
    {key:"weekly",label:"주간 정산",description:"주간 정산 내역",keywords:"주간 정산"},
    {key:"expenses",label:"지출 내역서",description:"미처리 경비 · 지분 배당",keywords:"지출 경비 비용 배당 지분"},
    {key:"fnb",label:"F&B",description:"F&B 비용 입력 · 내역",keywords:"f&b fnb 음식 음료 비용"},
    {key:"reports",label:"리포트",description:"정산 리포트 · 내보내기",keywords:"리포트 보고서 csv png"},
    {key:"settings",label:"설정",description:"계정 · 시스템 설정",keywords:"설정 계정 다크모드"}
  ] as const;

  const globalSearchResults = (()=>{
    const q=globalSearch.trim().toLowerCase();
    if(!q)return {players:[] as Player[],features:[] as Array<(typeof globalFeatureItems)[number]>,tables:[] as GameSession[],agencies:[] as Agency[]};

    const playerResults=players.filter(p=>[
      p.name,p.koreanName,p.cardNo,agencies.find(a=>a.id===p.agencyId)?.code ?? ""
    ].join(" ").toLowerCase().includes(q)).slice(0,6);

    const featureResults=globalFeatureItems.filter(item=>
      (item.key!=="expenses" || profile?.role==="admin") &&
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
  })();

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
    navigateTab("players");
    openPlayerDetail(playerId);
    closeGlobalSearch();
  }

  function goToFeatureFromSearch(key:string){
    navigateTab(key as TabKey);
    closeGlobalSearch();
  }

  function goToTableFromSearch(tableNo:string){
    setSelectedTableNo(tableNo);
    navigateTab("games");
    closeGlobalSearch();
  }
  const selectedTableEntries = selectedGameSession ? entries.filter(e=>e.sessionId===selectedGameSession.id) : [];
  const selectedTableBuyIns = selectedTableEntries.reduce((sum,e)=>sum+e.buyIn,0);
  const selectedTableRevenue = selectedGameSession ? selectedTableBuyIns*revenuePerBuyIn(selectedGameSession.game) : 0;
  const selectedTableRakeback = selectedTableEntries.reduce((sum,e)=>sum+e.rakeback,0);
  const selectedTableSearch = selectedGameSession ? (sessionSearch[selectedGameSession.id]||"") : "";
  const selectedTableQuery = selectedTableSearch.trim().toUpperCase();
  const selectedTableMatches = selectedGameSession && selectedTableQuery
    ? players
        .filter(p=>
          p.name.toUpperCase().includes(selectedTableQuery) ||
          p.koreanName.includes(selectedTableSearch) ||
          p.cardNo.toUpperCase().includes(selectedTableQuery)
        )
        .sort((a,b)=>{
          const aName=a.name.toUpperCase();
          const bName=b.name.toUpperCase();
          const aStarts=aName.startsWith(selectedTableQuery) || a.koreanName.startsWith(selectedTableSearch) || a.cardNo.toUpperCase().startsWith(selectedTableQuery);
          const bStarts=bName.startsWith(selectedTableQuery) || b.koreanName.startsWith(selectedTableSearch) || b.cardNo.toUpperCase().startsWith(selectedTableQuery);
          if(aStarts!==bStarts)return aStarts?-1:1;
          return aName.localeCompare(bName);
        })
        .slice(0,8)
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
  const fnbDayOperatingTotal = fnbDayEntries.filter(isOperatingFnbExpense).reduce((sum,item)=>sum+item.totalAmount,0);
  const fnbTodayEntries = fnbEntries.filter(item=>item.date===today());
  const fnbTodayAllTotal = fnbTodayEntries.reduce((sum,item)=>sum+item.totalAmount,0);
  const fnbTodayTotal = fnbTodayEntries.filter(isOperatingFnbExpense).reduce((sum,item)=>sum+item.totalAmount,0);
  const todayBuyinRevenue = todayEntries.reduce((sum,e)=>sum + revenuePerBuyIn(e.game)*e.buyIn,0);
  const activeTableBuyins = activeGameSessions.reduce((sum,s)=>sum+entries.filter(e=>e.sessionId===s.id).reduce((n,e)=>n+e.buyIn,0),0);
  const activeTablePlayers = activeGameSessions.reduce((sum,s)=>sum+entries.filter(e=>e.sessionId===s.id).length,0);
  const todayOperatingNet = todayBuyinRevenue - todaySettlement - fnbTodayTotal;
  const dailyFnbEntries = fnbEntries.filter(item=>item.date===summaryDate);
  const dailyFnbAllTotal = dailyFnbEntries.reduce((sum,item)=>sum+item.totalAmount,0);
  const dailyFnbTotal = dailyFnbEntries.filter(isOperatingFnbExpense).reduce((sum,item)=>sum+item.totalAmount,0);
  const dailyGrossAmount = total(dailyEntries,"rake");
  const dailyAgentRows = agencyTotals(dailyEntries).filter(a=>a.amount>0);
  const dailyAgentTotal = dailyAgentRows.reduce((sum,a)=>sum+a.amount,0);
  const dailyExpenseTotal = dailyFnbTotal + dailyAgentTotal;
  const dailyProfit = dailyGrossAmount - dailyExpenseTotal;
  const reportEntries = entries.filter(e=>e.date>=reportStart && e.date<=reportEnd);
  const reportFnbEntries = fnbEntries.filter(e=>e.date>=reportStart && e.date<=reportEnd);
  const reportRevenue = reportEntries.reduce((sum,e)=>sum+revenuePerBuyIn(e.game)*e.buyIn,0);
  const reportRakeback = reportEntries.reduce((sum,e)=>sum+e.rakeback,0);
  const reportFnbAllTotal = reportFnbEntries.reduce((sum,e)=>sum+e.totalAmount,0);
  const reportFnbTotal = reportFnbEntries.filter(isOperatingFnbExpense).reduce((sum,e)=>sum+e.totalAmount,0);
  const reportNet = reportRevenue-reportRakeback-reportFnbTotal;
  const reportTrendData = (() => {
    const rows:{date:string;entryFee:number;rakeback:number;fnb:number;profit:number}[]=[];
    let cursor=reportStart;
    let guard=0;
    while(cursor<=reportEnd && guard<62){
      const dayEntries=entries.filter(e=>e.date===cursor);
      const entryFee=dayEntries.reduce((sum,e)=>sum+e.rake,0);
      const rakeback=dayEntries.reduce((sum,e)=>sum+e.rakeback,0);
      const fnb=fnbEntries.filter(e=>e.date===cursor && e.expenseGroup==="2FLOOR").reduce((sum,e)=>sum+e.totalAmount,0);
      rows.push({date:cursor,entryFee,rakeback,fnb,profit:entryFee-rakeback-fnb});
      cursor=plusDays(cursor,1);
      guard++;
    }
    return rows;
  })();
  const reportTrendMax=Math.max(1,...reportTrendData.flatMap(x=>[x.entryFee,Math.max(0,x.profit)]));
  const reportPlayerCount=new Set(reportEntries.map(e=>e.playerId)).size;
  const reportBuyInCount=reportEntries.reduce((sum,e)=>sum+e.buyIn,0);
  const reportAgencyRanking=agencyTotals(reportEntries).filter(a=>a.amount>0).sort((a,b)=>b.amount-a.amount).slice(0,8);
  const dashboardTodayProfit = todayRevenue - todaySettlement - fnbTodayTotal;
  const dashboardDailyTrend = Array.from({length:7},(_,index)=>{
    const date=plusDays(today(),index-6);
    const dayEntries=entries.filter(e=>e.date===date);
    const rake=dayEntries.reduce((sum,e)=>sum+e.rake,0);
    const agentRakeback=dayEntries.reduce((sum,e)=>sum+e.rakeback,0);
    const fnb=fnbEntries.filter(e=>e.date===date && e.expenseGroup==="2FLOOR").reduce((sum,e)=>sum+e.totalAmount,0);
    return {
      label: date.slice(5).replace("-","/"),
      rake,
      profit: rake-agentRakeback-fnb
    };
  });
  const thisMonday=monday(today());
  const dashboardWeeklyTrend = Array.from({length:4},(_,index)=>{
    const startDate=plusDays(thisMonday,(index-3)*7);
    const endDate=plusDays(startDate,6);
    const weekEntries=entries.filter(e=>e.date>=startDate && e.date<=endDate);
    const rake=weekEntries.reduce((sum,e)=>sum+e.rake,0);
    const agentRakeback=weekEntries.reduce((sum,e)=>sum+e.rakeback,0);
    const fnb=fnbEntries.filter(e=>e.date>=startDate && e.date<=endDate && e.expenseGroup==="2FLOOR").reduce((sum,e)=>sum+e.totalAmount,0);
    return {
      label: `${startDate.slice(5).replace("-","/")}`,
      rake,
      profit: rake-agentRakeback-fnb
    };
  });
  const dashboardTrendData=dashboardTrendMode==="daily"?dashboardDailyTrend:dashboardWeeklyTrend;
  const dashboardTrendMax=Math.max(1,...dashboardTrendData.flatMap(item=>[item.rake,Math.max(0,item.profit)]));
  const dashboardTrendRake=dashboardTrendData.reduce((sum,item)=>sum+item.rake,0);
  const dashboardTrendProfit=dashboardTrendData.reduce((sum,item)=>sum+item.profit,0);

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
      <button onClick={()=>exportSettlementPng(reportStart,reportEnd)}>PNG 저장</button>
      <button onClick={()=>exportSettlementCsv(reportStart,reportEnd)}>시트 CSV 저장</button>
    </div>
  </section>;

  const allNavItems = [
    {key:"dashboard",label:"대시보드"},
    {key:"players",label:"플레이어 관리"},
    {key:"agencies",label:"에이전트 관리"},
    {key:"games",label:"게임 입력"},
    {key:"fnb",label:"F&B"},
    {key:"daily",label:"일일 정산"},
    {key:"weekly",label:"주간 정산"},
    {key:"expenses",label:"지출 내역서"},
    {key:"reports",label:"리포트"},
    {key:"settings",label:"계정 관리"},
  ] as const;
  const navItems = allNavItems.filter(item=>{
    if(profile?.role==="admin") return true;
    if(profile?.role==="staff") return ["dashboard","players","games","fnb"].includes(item.key);
    if(profile?.role==="agent") return ["dashboard","players","daily","weekly","reports"].includes(item.key);
    return item.key==="dashboard";
  });

  const mobileNavItems = [
    {key:"dashboard",label:"대시보드"},
    {key:"players",label:"플레이어"},
    {key:"games",label:"바이인"},
    {key:"fnb",label:"F&B"},
    {key:"settlement",label:"정산"},
  ] as const;

  return <main className={`appShell theme-${theme}`}>
    <aside className="sidebar">
      <div className="brand">
        <img className="brandLogo" src="/dream-poker-logo.svg" alt="Dream Poker Da Nang"/>
        <div><strong>Dream Poker</strong><span>{profile?.role==="admin"?"관리자":profile?.role==="staff"?"직원":profile?.role==="agent"?"에이전트":"승인 대기"}</span></div>
      </div>

      <nav className="sideNav">
        {navItems.map(item=><button key={item.key} className={tab===item.key?"active":""} onClick={()=>navigateTab(item.key as TabKey)}>
          <span className="navIcon"><DesktopNavIcon type={item.key}/></span><span>{item.label}</span>
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
          <span className="mobileProductTitle"><strong>Dream Poker <em>· {profile?.role==="admin"?"관리자":profile?.role==="staff"?"직원":profile?.role==="agent"?"에이전트":"승인 대기"}</em></strong></span>
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
            <span className="avatar">{(profile?.displayName || profile?.username || "A").slice(0,1).toUpperCase()}</span>
            <span className="accountMenuText">
              <strong>{profile?.role==="admin"?"관리자":profile?.role==="staff"?"직원":profile?.role==="agent"?"에이전트":"승인 대기"}</strong>
              <small>{profile?.username ? `@${profile.username}` : ""}</small>
            </span>
            <span className="menuChevron">{accountMenuOpen?"⌃":"⌄"}</span>
          </button>

          {accountMenuOpen && <div className="accountDropdown">
            <div className="accountDropdownProfile">
              <span className="avatar largeAvatar">{(profile?.displayName || profile?.username || "A").slice(0,1).toUpperCase()}</span>
              <div>
                <strong>{profile?.displayName || (profile?.role==="admin"?"관리자 계정":profile?.role==="staff"?"직원 계정":profile?.role==="agent"?"에이전트 계정":"승인 대기")}</strong>
                <small>{session?.user.email}</small>
              </div>
            </div>

            <button onClick={()=>{navigateTab("settings");setAccountMenuOpen(false)}}>
              <span>⚙</span><div><strong>계정 관리</strong></div>
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
            {profile?.role==="admin" && <button onClick={()=>{navigateTab("settings");setMobileSideMenuOpen(false)}}>
              <span className="sideMenuIcon">⚙</span>
              <div><strong>계정 관리</strong><small>직원 · 에이전트 계정 생성</small></div>
            </button>}

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
        {message && <div className="note globalNote">{message}</div>}

        {tab==="dashboard" && <>
          <section className={isStaff?"dashboardFinanceStrip staffDashboardStrip":"dashboardFinanceStrip"}>
            <div className="dashboardFinanceHeader">
              <div>
                <span>오늘 운영 현황</span>
                <strong>{today()}</strong>
              </div>
              <div className={activeGameSessions.length>0?"dashboardLiveStatus on":"dashboardLiveStatus"}>
                <i/>
                {activeGameSessions.length>0?`${activeGameSessions.length} LIVE`:"대기"}
              </div>
            </div>

            {isStaff
              ? <div className="dashboardFinanceGrid staffOperationsGrid">
                  <button className="dashboardFinanceCard" onClick={()=>navigateTab("games")}>
                    <span>진행 테이블</span><strong>{activeGameSessions.length}</strong><small>현재 LIVE</small>
                  </button>
                  <button className="dashboardFinanceCard" onClick={()=>navigateTab("games")}>
                    <span>오늘 플레이어</span><strong>{todayPlayerCount}명</strong><small>참여 인원</small>
                  </button>
                  <button className="dashboardFinanceCard" onClick={()=>navigateTab("games")}>
                    <span>오늘 BUY-IN</span><strong>{todayEntries.reduce((sum,e)=>sum+e.buyIn,0)}</strong><small>총 바이인 수</small>
                  </button>
                  <button className="dashboardFinanceCard fnb" onClick={()=>navigateTab("fnb")}>
                    <span>F&B 입력</span><strong>{fnbTodayEntries.length}건</strong><small>오늘 등록 내역</small>
                  </button>
                </div>
              : <div className="dashboardFinanceGrid">
                  <button className="dashboardFinanceCard gross" onClick={()=>navigateTab("daily")}>
                    <span>오늘 엔트리피</span><strong>{vnd(todayRevenue)}</strong><small>오늘 발생 금액</small>
                  </button>
                  <button className="dashboardFinanceCard agent" onClick={()=>navigateTab("daily")}>
                    <span>에이전트 레이크백</span><strong>{vnd(todaySettlement)}</strong><small>지급 예정</small>
                  </button>
                  <button className="dashboardFinanceCard fnb" onClick={()=>navigateTab("fnb")}>
                    <span>F&B</span><strong>{vnd(fnbTodayTotal)}</strong><small>오늘 비용</small>
                  </button>
                  <button className="dashboardFinanceCard profit" onClick={()=>navigateTab("daily")}>
                    <span>오늘 수익</span><strong>{vnd(dashboardTodayProfit)}</strong><small>엔트리피 - 레이크백 - F&B</small>
                  </button>
                </div>}
          </section>

          <section className="dashboardMainSplit">
            <section className="dashboardLivePanel">
              <div className="dashboardPanelHeader">
                <div>
                  <h2>테이블 실시간 현황</h2>
                  <span>{activeGameSessions.length} LIVE</span>
                </div>
                <button onClick={()=>navigateTab("games")}>게임 입력 ›</button>
              </div>

              {activeGameSessions.length===0
                ? <button className="dashboardNoLive" onClick={()=>navigateTab("games")}>
                    <strong>진행 중인 테이블이 없습니다.</strong>
                    <span>테이블을 오픈하려면 클릭하세요.</span>
                  </button>
                : <div className="dashboardLiveCardGrid">
                    {activeGameSessions.map(gs=>{
                      const tableEntries=entries.filter(e=>e.sessionId===gs.id);
                      const buyins=tableEntries.reduce((sum,e)=>sum+e.buyIn,0);
                      const rake=tableEntries.reduce((sum,e)=>sum+e.rake,0);
                      return <button className="dashboardLiveCard" key={gs.id} onClick={()=>{setSelectedTableNo(gs.tableNo);navigateTab("games")}}>
                        <div className="dashboardLiveCardTop">
                          <strong>Table {gs.tableNo}</strong>
                          <span><i/>LIVE</span>
                        </div>
                        <p>{gs.game} <span>{gs.gameNo?`No.${gs.gameNo}`:"No.-"}</span></p>
                        <div className="dashboardLiveMetrics">
                          <div><small>플레이어</small><b>{tableEntries.length}명</b></div>
                          <div><small>BUY-IN</small><b>{buyins}</b></div>
                          {!isStaff && <div className="rake"><small>엔트리피</small><b>{vnd(rake)}</b></div>}
                        </div>
                      </button>
                    })}
                  </div>}
            </section>

            {isStaff
              ? <section className="dashboardTrendPanel staffQuickPanel">
                  <div className="dashboardPanelHeader">
                    <div><h2>빠른 업무</h2><span>직원용</span></div>
                  </div>
                  <div className="staffQuickActions">
                    <button onClick={()=>navigateTab("games")}><strong>게임 입력</strong><span>테이블 · BUY-IN 관리</span></button>
                    <button onClick={()=>navigateTab("players")}><strong>플레이어 관리</strong><span>검색 · 등록 · 정보 수정</span></button>
                    <button onClick={()=>navigateTab("fnb")}><strong>F&B 입력</strong><span>음료 · 경비 등록</span></button>
                  </div>
                </section>
              : <section className="dashboardTrendPanel">
                  <div className="dashboardPanelHeader trendHeader">
                    <div>
                      <h2>운영 추이</h2>
                      <span>{dashboardTrendMode==="daily"?"최근 7일":"최근 4주"}</span>
                    </div>
                    <div className="dashboardTrendToggle">
                      <button className={dashboardTrendMode==="daily"?"active":""} onClick={()=>setDashboardTrendMode("daily")}>일간</button>
                      <button className={dashboardTrendMode==="weekly"?"active":""} onClick={()=>setDashboardTrendMode("weekly")}>주간</button>
                    </div>
                  </div>
                  <div className="dashboardTrendSummary">
                    <div><span>총 엔트리피</span><strong>{vnd(dashboardTrendRake)}</strong></div>
                    <div><span>순수익</span><strong>{vnd(dashboardTrendProfit)}</strong></div>
                  </div>
                  <div className="dashboardTrendChart" aria-label="운영 추이 그래프">
                    {dashboardTrendData.map((item,index)=><div className="dashboardTrendColumn" key={item.label+"-"+index}>
                      <div className="dashboardTrendBars">
                        <span className="rakeBar" style={{height:`${Math.max(item.rake>0?8:2,(item.rake/dashboardTrendMax)*100)}%`}} title={`엔트리피 ${vnd(item.rake)}`}/>
                        <span className="profitBar" style={{height:`${Math.max(item.profit>0?8:2,(Math.max(0,item.profit)/dashboardTrendMax)*100)}%`}} title={`순수익 ${vnd(item.profit)}`}/>
                      </div>
                      <small>{item.label}</small>
                    </div>)}
                  </div>
                  <div className="dashboardTrendLegend">
                    <span><i className="rakeLegend"/>총 엔트리피</span>
                    <span><i className="profitLegend"/>순수익</span>
                  </div>
                </section>}
          </section>
        </>}

        {!isStaff && tab==="agencies" && <section className="agencyPage">
          {!editingAgencyId ? <section className="panel agencyManagePanel">
            <div className="mobileSectionSwitcher playerAccessSwitcher">
              <button onClick={()=>navigateTab("players")}>플레이어 명단</button>
              <button className="active">에이전트 코드</button>
            </div>

            <div className="agencyManageHeader">
              <div>
                <h2>에이전트 관리</h2>
                <p>에이전트를 선택하면 상세 정보와 소속 플레이어를 확인할 수 있습니다.</p>
              </div>
            </div>

            <div className="agencyAddRow">
              <input placeholder="새 코드명" value={newAgencyCode} onChange={e=>setNewAgencyCode(e.target.value.toUpperCase())}/>
              <select value={newAgencyRate} onChange={e=>setNewAgencyRate(e.target.value)}>
                {Array.from({length:21},(_,i)=>i*5).map(rate=><option key={rate} value={rate}>{rate}%</option>)}
              </select>
              <button className="primary" onClick={addAgency}>＋ 추가</button>
            </div>

            <div className="agencySimpleList">
              {agencies.map(a=>{
                const memberCount=players.filter(p=>p.agencyId===a.id).length;
                const agencyRakeback=entries.filter(e=>e.agencyId===a.id).reduce((sum,e)=>sum+e.rakeback,0);
                return <button key={a.id} className="agencySimpleRow" onClick={()=>setEditingAgencyId(a.id)}>
                  <div>
                    <strong>{a.code}</strong>
                    <small>{memberCount}명 · {a.active?"사용 중":"사용 중지"}</small>
                  </div>
                  <div className="agencyRateDisplay">
                    <small>{vnd(agencyRakeback)}</small>
                    <b>{a.rate}%</b>
                    <span>›</span>
                  </div>
                </button>
              })}
            </div>
          </section> : (()=> {
            const agency=agencies.find(a=>a.id===editingAgencyId);
            if(!agency)return null;
            const agencyPlayers=players.filter(p=>p.agencyId===agency.id);
            const agencyEntries=entries.filter(e=>e.agencyId===agency.id);
            const agencyTotalRakeback=agencyEntries.reduce((sum,e)=>sum+e.rakeback,0);
            const agencyTotalBuyIn=agencyEntries.reduce((sum,e)=>sum+e.buyIn,0);
            return <section className="panel agencyDetailPage">
              <div className="agencyDetailTop">
                <button className="agencyBackButton" onClick={()=>setEditingAgencyId(null)}>‹ 에이전트 목록</button>
                <div className="agencyDetailTitle">
                  <div><span>에이전트</span><h2>{agency.code}</h2></div>
                  <button
                    className={`agencyStatusToggle ${agency.active?"active":""}`}
                    onClick={()=>updateAgency(agency.id,{active:!agency.active})}
                  >{agency.active?"사용 중":"사용 중지"}</button>
                </div>
              </div>

              <div className="agencyDetailKpis">
                <div><span>정산 요율</span><b>{agency.rate}%</b></div>
                <div><span>소속 플레이어</span><b>{agencyPlayers.length}명</b></div>
                <div><span>누적 BUY-IN</span><b>{agencyTotalBuyIn}</b></div>
                <div><span>누적 레이크백</span><b>{vnd(agencyTotalRakeback)}</b></div>
              </div>

              <div className="agencyDetailSettings">
                <label><span>에이전트 코드</span><input value={agency.code} onChange={e=>updateAgency(agency.id,{code:e.target.value.toUpperCase()})}/></label>
                <label><span>정산 요율</span><select value={agency.rate} onChange={e=>updateAgency(agency.id,{rate:Number(e.target.value)})}>
                  {Array.from({length:21},(_,i)=>i*5).map(rate=><option key={rate} value={rate}>{rate}%</option>)}
                </select></label>
              </div>

              <section className="agencyMembersPanel">
                <div className="agencyPlayerSectionTitle">
                  <div><strong>소속 플레이어</strong><small>등록된 플레이어와 최근 플레이 기록</small></div>
                  <span>{agencyPlayers.length}명</span>
                </div>
                {agencyPlayers.length===0
                  ? <div className="agencyPlayerEmpty">등록된 플레이어가 없습니다.</div>
                  : <div className="agencyMembersTable">
                      <div className="agencyMembersHead"><span>플레이어</span><span>등록일</span><span>최근 플레이</span><span>BUY-IN</span><span>레이크백</span></div>
                      {agencyPlayers.map(p=>{
                        const pEntries=entries.filter(e=>e.playerId===p.id && e.agencyId===agency.id);
                        const last=pEntries.slice().sort((a,b)=>b.date.localeCompare(a.date))[0];
                        const buyins=pEntries.reduce((sum,e)=>sum+e.buyIn,0);
                        const rb=pEntries.reduce((sum,e)=>sum+e.rakeback,0);
                        return <button className="agencyMemberRow" key={p.id} onClick={()=>{openPlayerDetail(p.id);navigateTab("players")}}>
                          <span><strong>{p.name}</strong><small>{p.koreanName || p.cardNo || ""}</small></span>
                          <span>{p.createdAt?p.createdAt.slice(0,10):"-"}</span>
                          <span>{last?.date || "-"}</span>
                          <span>{buyins}</span>
                          <b>{vnd(rb)}</b>
                        </button>
                      })}
                    </div>}
              </section>

              <div className="agencyDetailDanger">
                <button className="agencyDeleteButton" onClick={()=>deleteAgency(agency.id)}>에이전트 삭제</button>
              </div>
            </section>
          })()}
        </section>}

        {tab==="players" && <section className="panel">
          <div className="mobileSectionSwitcher playerAccessSwitcher">
            <button className="active">플레이어 명단</button>
            <button onClick={()=>navigateTab("agencies")}>에이전트 코드</button>
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
                  <p>{selectedPlayer.koreanName ? `${selectedPlayer.koreanName} · ` : ""}회원번호 {selectedPlayer.cardNo || "-"} · {agencies.find(a=>a.id===selectedPlayer.agencyId)?.code || "-"}</p>
                </div>
                <button className="modalClose" onClick={()=>setSelectedPlayerId(null)} aria-label="닫기">×</button>
              </div>

              <div className="playerStatsGrid">
                <div className="playerStatCard"><span>참여 게임</span><b>{selectedPlayerEntries.length}회</b></div>
                <div className="playerStatCard"><span>총 바이인</span><b>{vnd(selectedPlayerBuyIns)}</b></div>
                {!isStaff && <div className="playerStatCard"><span>총 엔트리피</span><b>{vnd(selectedPlayerRake)}</b></div>}
              </div>

              <div className="playerAgencyEditor">
                <div>
                  <span>에이전트</span>
                  <small>{isStaff?"소속 에이전트 코드":`현재 정산 요율 ${agencies.find(a=>a.id===selectedPlayer.agencyId)?.rate ?? 0}%`}</small>
                </div>
                <div className="playerAgencyControls">
                  <select value={detailAgencyId || selectedPlayer.agencyId} onChange={e=>setDetailAgencyId(e.target.value)}>
                    {agencies.map(a=><option key={a.id} value={a.id}>{isStaff?a.code:`${a.code} · ${a.rate}%`}</option>)}
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
                  <thead><tr><th>게임</th><th>참여</th><th>바이인</th>{!isStaff && <th>엔트리피</th>}</tr></thead>
                  <tbody>{selectedPlayerGameBreakdown.length===0
                    ? <tr><td colSpan={isStaff?3:4} className="empty">아직 게임 기록이 없습니다.</td></tr>
                    : selectedPlayerGameBreakdown.map(r=><tr key={r.game}><td><strong>{r.game}</strong></td><td>{r.games}회</td><td>{r.buyIns}</td>{!isStaff && <td>{vnd(r.rake)}</td>}</tr>)}
                  </tbody>
                </table></div>
              </div>

              <div className="playerDetailSection">
                <div className="playerDetailTitle"><h4>게임 내역</h4><span>최근 기록순</span></div>
                <div className="tableWrap playerDetailTable"><table>
                  <thead><tr><th>날짜</th><th>게임</th><th>바이인</th>{!isStaff && <><th>엔트리피</th><th>레이크백</th></>}</tr></thead>
                  <tbody>{selectedPlayerEntries.length===0
                    ? <tr><td colSpan={isStaff?3:5} className="empty">아직 게임 기록이 없습니다.</td></tr>
                    : [...selectedPlayerEntries].sort((a,b)=>b.date.localeCompare(a.date)).map(e=><tr key={e.id}><td>{e.date}</td><td>{e.game}</td><td>{e.buyIn}</td>{!isStaff && <><td>{vnd(e.rake)}</td><td>{vnd(e.rakeback)}</td></>}</tr>)}
                  </tbody>
                </table></div>
              </div>
            </div>
          </div>}
        </section>}

        {tab==="games" && <section className={isStaff?"buyinPage floorBuyinPage staffMobileBuyinPage":"buyinPage floorBuyinPage"}>
          <div className="mobileSectionSwitcher buyinModeSwitcher">
            <button className={gamesView==="live"?"active":""} onClick={()=>setGamesView("live")}>진행 중</button>
            <button className={gamesView==="logs"?"active":""} onClick={()=>setGamesView("logs")}>게임 로그</button>
          </div>

          {gamesView==="live" && <>
          <section className="panel floorSelectorPanel">
            <div className="floorSelectorHeader">
              <div><h2>테이블 선택</h2></div>
              <div className="floorSelectorActions">
                <span className="liveTableCount">{activeGameSessions.length} TABLE LIVE</span>
                <div className="tableAddControl">
                  <span>Table</span>
                  <input
                    inputMode="numeric"
                    value={newTableNo}
                    onChange={e=>setNewTableNo(e.target.value.replace(/\D/g,""))}
                    onKeyDown={e=>{if(e.key==="Enter")addAvailableTable();}}
                    placeholder="No."
                    aria-label="추가할 테이블 번호"
                  />
                  <button onClick={addAvailableTable}>추가</button>
                  <button
                    className="tableDeleteButton"
                    onClick={deleteSelectedTable}
                    disabled={!selectedTableNo || activeGameSessions.some(s=>s.tableNo===selectedTableNo)}
                    title={activeGameSessions.some(s=>s.tableNo===selectedTableNo)?"진행 중인 테이블은 삭제할 수 없습니다.":"현재 선택한 테이블 삭제"}
                  >삭제</button>
                </div>
              </div>
            </div>

            <div className="pokerFloorMap">
              {availableTableNos.map(no=>{
                const liveSession=activeGameSessions.find(s=>s.tableNo===no);
                const liveEntries=liveSession ? entries.filter(e=>e.sessionId===liveSession.id) : [];
                return <button
                  key={no}
                  className={`floorTableButton table${no} ${selectedTableNo===no?"selected":""} ${liveSession?"live":""}`}
                  onClick={()=>setSelectedTableNo(no)}
                >
                  <strong>{no}</strong>
                  <small>{liveSession?`${liveEntries.length}명 · LIVE`:"대기"}</small>
                </button>
              })}
            </div>

          </section>

          <section className="panel selectedTablePanel">
            <div className="selectedTableTop simpleSessionTop">
              <div className="selectedTableHeadline simpleSessionHeader">
                {selectedGameSession
                  ? editingSessionId===selectedGameSession.id
                    ? <div className="sessionEditInline">
                        <label>
                          <span>Table</span>
                          <input
                            autoFocus
                            inputMode="numeric"
                            value={editSessionTableNo}
                            onChange={e=>setEditSessionTableNo(e.target.value.replace(/\D/g,""))}
                          />
                        </label>
                        <select value={editSessionGame} onChange={e=>setEditSessionGame(e.target.value)}>
                          <option value="3M">3M</option>
                          <option value="5M">5M</option>
                          <option value="10M">10M</option>
                          <option value="15M">15M</option>
                        </select>
                        <label className="sessionNoEdit">
                          <span>No.</span>
                          <input
                            inputMode="numeric"
                            value={editSessionGameNo}
                            onChange={e=>setEditSessionGameNo(e.target.value.replace(/\D/g,""))}
                            placeholder="-"
                          />
                        </label>
                      </div>
                    : <div className="sessionTitlePlain">
                        <strong>Table {selectedGameSession.tableNo}</strong>
                        <b>{selectedGameSession.game}</b>
                        <span>{selectedGameSession.gameNo ? `No.${selectedGameSession.gameNo}` : "No.-"}</span>
                      </div>
                  : <div className="sessionEditInline preStartSessionEdit">
                      <label>
                        <span>Table</span>
                        <input value={selectedTableNo} readOnly aria-label="선택된 테이블 번호"/>
                      </label>
                      <select value={newSessionGame} onChange={e=>setNewSessionGame(e.target.value)}>
                        <option value="3M">3M</option>
                        <option value="5M">5M</option>
                        <option value="10M">10M</option>
                        <option value="15M">15M</option>
                      </select>
                      <label className="sessionNoEdit">
                        <span>No.</span>
                        <input
                          inputMode="numeric"
                          value={newGameNo}
                          onChange={e=>setNewGameNo(e.target.value.replace(/\D/g,""))}
                          placeholder="-"
                        />
                      </label>
                    </div>}
              </div>

              {!selectedGameSession
                ? <div className="sessionTopActions">
                    <button className="sessionSaveButton startTableButton unifiedStartButton" onClick={startGameSession}>게임 시작</button>
                  </div>
                : <div className="sessionTopActions">
                    {editingSessionId===selectedGameSession.id
                      ? <>
                          <button className="sessionCancelButton" onClick={()=>setEditingSessionId(null)}>취소</button>
                          <button
                            className="sessionSaveButton"
                            onClick={async()=>{
                              if(!editSessionTableNo.trim())return;
                              await updateActiveGameSession(selectedGameSession,{tableNo:editSessionTableNo,game:editSessionGame,gameNo:editSessionGameNo});
                              setEditingSessionId(null);
                            }}
                          >저장</button>
                        </>
                      : <button
                          className="sessionEditButton"
                          onClick={()=>{
                            setEditSessionTableNo(selectedGameSession.tableNo);
                            setEditSessionGame(selectedGameSession.game);
                            setEditSessionGameNo(selectedGameSession.gameNo);
                            setEditingSessionId(selectedGameSession.id);
                          }}
                        >수정</button>}
                    <button className="closeTableButton selectedCloseButton" onClick={()=>closeGameSession(selectedGameSession.id)}>경기 종료</button>
                  </div>}
            </div>

            <div className={isStaff?"selectedTableStats compactSelectedStats staffSelectedStats":"selectedTableStats compactSelectedStats fourStats"}>
              <div><span>플레이어</span><b>{selectedGameSession?selectedTableEntries.length:0}명</b></div>
              <div><span>총 바이인</span><b>{selectedGameSession?selectedTableBuyIns:0}회</b></div>
              {!isStaff && <div><span>전체 매출</span><b>{vnd(selectedGameSession?selectedTableRevenue:0)}</b></div>}
              {!isStaff && <div><span>레이크백</span><b>{vnd(selectedGameSession?selectedTableRakeback:0)}</b></div>}
            </div>

            {selectedGameSession && <>
                  <div className="selectedPlayerSection">
                    <div className="selectedPlayerSearch topPlayerSearch">
                      <div className="selectedSearchLabel">
                        <strong>플레이어 추가</strong>
                        <small>검색 후 선택 즉시 1 BUY-IN</small>
                      </div>
                      <div className="tableSearchInput selectedSearchInput">
                        <span>⌕</span>
                        <input
                          value={selectedTableSearch}
                          onChange={e=>{
                            setSessionSearch(prev=>({...prev,[selectedGameSession.id]:e.target.value}));
                            setSelectedSearchIndex(0);
                          }}
                          onKeyDown={e=>{
                            if(e.key==="ArrowDown"){
                              e.preventDefault();
                              setSelectedSearchIndex(i=>selectedTableMatches.length?Math.min(i+1,selectedTableMatches.length-1):0);
                            }else if(e.key==="ArrowUp"){
                              e.preventDefault();
                              setSelectedSearchIndex(i=>Math.max(i-1,0));
                            }else if(e.key==="Enter" && selectedTableMatches.length){
                              e.preventDefault();
                              const target=selectedTableMatches[Math.min(selectedSearchIndex,selectedTableMatches.length-1)];
                              if(target)addPlayerToSession(selectedGameSession,target.id);
                            }else if(e.key==="Escape"){
                              setSessionSearch(prev=>({...prev,[selectedGameSession.id]:""}));
                              setSelectedSearchIndex(0);
                            }
                          }}
                          placeholder="이름 · 한글명 · 회원번호 검색"
                          autoComplete="off"
                        />
                      </div>
                      {selectedTableMatches.length>0 && <div className="selectedSearchResults">
                        {selectedTableMatches.map((p,index)=>{
                          const already=selectedTableEntries.find(e=>e.playerId===p.id);
                          const agency=agencies.find(a=>a.id===p.agencyId);
                          return <button
                            key={p.id}
                            className={index===selectedSearchIndex?"active":""}
                            onMouseEnter={()=>setSelectedSearchIndex(index)}
                            onClick={()=>addPlayerToSession(selectedGameSession,p.id)}
                          >
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

                    {!isStaff && <div className="playerValueToolbar">
                      <span>플레이어 {selectedTableEntries.length}명</span>
                    </div>}

                    {selectedTableEntries.length===0
                      ? <div className="selectedTableEmpty playerEmpty">
                          <div className="emptyPlayersIcon">♙</div>
                          <strong>등록된 플레이어가 없습니다.</strong>
                          <span>위 검색창에서 플레이어를 추가하세요.</span>
                        </div>
                      : <div className="selectedPlayerList">
                          {[...selectedTableEntries].sort((a,b)=>b.buyIn-a.buyIn).map(entry=>{
                            const player=players.find(p=>p.id===entry.playerId);
                            const perEntryRevenue=revenuePerBuyIn(entry.game);
                            return <div className={isStaff?"selectedPlayerRow compactPlayerRow quickBuyinRow staffPlayerRow":"selectedPlayerRow compactPlayerRow quickBuyinRow"} key={entry.id}>
                              <button className="selectedPlayerIdentity playerOpenManage inlinePlayerIdentity" onClick={()=>setManageEntryId(entry.id)}>
                                <strong>{player?.name || "알 수 없음"}</strong>
                                <span className="inlineAgencyCode">{entry.agencyCodeSnapshot}</span>
                                {player?.koreanName && <small>{player.koreanName}</small>}
                              </button>

                              <div className="quickBuyinControl" aria-label="바이인 빠른 수정">
                                <button onClick={()=>changeSessionBuyIn(entry,-1)} disabled={entry.buyIn<=1}>−</button>
                                <b>{entry.buyIn}</b>
                                <button onClick={()=>changeSessionBuyIn(entry,1)}>＋</button>
                              </div>

                              {!isStaff && <div className="playerSingleValue dualPlayerValues">
                                <span>
                                  <small>금액</small>
                                  <b>{vnd(perEntryRevenue*entry.buyIn)}</b>
                                </span>
                                <span>
                                  <small>레이크백</small>
                                  <b>{vnd(entry.rakeback)}</b>
                                </span>
                              </div>}

                              <button className="manageChevron playerManageButton" onClick={()=>setManageEntryId(entry.id)} aria-label="플레이어 관리">›</button>
                            </div>
                          })}
                        </div>}
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
                      {!isStaff && <em>{vnd(revenue)}</em>}
                    </div>
                  </summary>
                  <div className="gameLogSummary">
                    <span>플레이어 {logEntries.length}명</span>
                    {!isStaff && <span>레이크백 {vnd(rakeback)}</span>}
                    {!isStaff && <span>바이인 금액 {vnd(revenue)}</span>}
                  </div>
                  <div className="gameLogPlayers">
                    {logEntries.length===0
                      ? <div className="gameLogEmpty">바이인 기록이 없습니다.</div>
                      : logEntries.map(e=><div key={e.id}>
                          <span><strong>{getPlayerName(e.playerId)}</strong><small>{e.agencyCodeSnapshot}</small></span>
                          <span>{e.buyIn}회</span>
                          {!isStaff && <b>{vnd(revenuePerBuyIn(e.game)*e.buyIn)}</b>}
                        </div>)}
                  </div>
                </details>
              })}
              {gameSessions.length===0 && <div className="dashboardEmpty">아직 게임 로그가 없습니다.</div>}
            </div>
          </section>}
        </section>}

        {!isStaff && tab==="daily" && <section className="compactDailyPage">
          <div className="mobileSectionSwitcher settlementSwitcher">
            <button className="active">일일정산</button>
            <button onClick={()=>navigateTab("weekly")}>주간정산</button>
          </div>

          <section className="panel compactDailyPanel redesignedDailyPanel">
            <div className="dailyTopBar">
              <div className="dailyTitleBlock">
                <strong>일일 정산</strong>
                <input className="datePicker compactDailyDate" type="date" value={summaryDate} onChange={e=>setSummaryDate(e.target.value)}/>
              </div>

              <div className="dailyTopActions compactExportActions">
                <button
                  className="dailyIconDownload"
                  onClick={()=>exportSettlementPng(summaryDate,summaryDate)}
                  title="일일 정산서 PNG 다운로드"
                  aria-label="일일 정산서 PNG 다운로드"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 3v11"/>
                    <path d="m7.5 10 4.5 4.5 4.5-4.5"/>
                    <path d="M5 20h14"/>
                  </svg>
                </button>
              </div>
            </div>

            <div className="dailySummaryGrid dailySummaryGridCompact restoredDailySummary">
              <div className="dailySummaryCard">
                <span>총 엔트리피</span>
                <b>{vnd(dailyGrossAmount)}</b>
                <small>{dailyEntries.reduce((sum,e)=>sum+e.buyIn,0)} BUY-IN</small>
              </div>
              <div className="dailySummaryCard expense">
                <span>레이크백</span>
                <b>− {vnd(dailyAgentTotal)}</b>
                <small>{dailyAgentRows.length}개 에이전트</small>
              </div>
              <button className="dailySummaryCard expense" onClick={()=>setFnbDetailOpen(true)}>
                <span>F&B</span>
                <b>− {vnd(dailyFnbTotal)}</b>
                <small>비용 상세 ›</small>
              </button>
              <div className="dailySummaryCard profit">
                <span>오늘 수익</span>
                <b>{vnd(dailyProfit)}</b>
                <small>총 비용 {vnd(dailyExpenseTotal)}</small>
              </div>
            </div>

            <div className="dailyWorkspaceGrid">
              <section className="dailyGameLog dailyMainDetail">
                <div className="dailyGameLogHeader">
                  <div>
                    <h3>게임별 정산</h3>
                  </div>
                  <span className="dailyLogCount">{dailyGameGroups.length} GAME · {dailyEntries.length}명</span>
                </div>

                <div className="dailyLogSearch">
                  <span>⌕</span>
                  <input
                    value={dailyLogSearch}
                    onChange={e=>setDailyLogSearch(e.target.value)}
                    placeholder="플레이어 · 게임 · 에이전트 검색"
                  />
                  {dailyLogSearch && <button onClick={()=>setDailyLogSearch("")}>×</button>}
                </div>

                {dailyGameGroups.length===0
                  ? <div className="dailyGameGroupsEmpty">{dailyEntries.length===0?"해당 날짜의 게임 기록이 없습니다.":"검색 결과가 없습니다."}</div>
                  : <div className="dailyGameGroups">
                      {dailyGameGroups.map(group=>{
                        const groupBuyIns=group.entries.reduce((sum,e)=>sum+e.buyIn,0);
                        const groupRake=group.entries.reduce((sum,e)=>sum+e.rake,0);
                        const groupRakeback=group.entries.reduce((sum,e)=>sum+e.rakeback,0);
                        return <section className="dailyGameGroup" key={group.key}>
                          <header className="dailyGameGroupHeader">
                            <div className="dailyGameGroupIdentity">
                              <strong>{group.tableNo?`Table ${group.tableNo}`:"Game"}</strong>
                              <span>{group.gameNo?`No.${group.gameNo}`:"No.-"}</span>
                              <b>{group.game}</b>
                            </div>
                            <div className="dailyGameGroupSummary">
                              <strong>{groupBuyIns} BUY-IN</strong>
                            </div>
                          </header>

                          <div className="dailyGameRows">
                            <div className="dailyGameRow dailyGameRowHead">
                              <span>플레이어</span>
                              <span>에이전트</span>
                              <span>바이인</span>
                              <span>엔트리피</span>
                              <span>레이크백</span>
                            </div>

                            {group.entries.length===0 && <div className="dailyGameEmptyRow">플레이어 기록이 없는 게임입니다.</div>}
                            {group.entries.map(e=><div className="dailyGameRow cleanDailyRow" key={e.id}>
                              <div className="dailyGamePlayerCell">
                                <button className="dailyInlineValue playerValue" onClick={()=>setManageEntryId(e.id)}>
                                  <strong>{getPlayerName(e.playerId)}</strong>
                                  <span>수정 ›</span>
                                </button>
                              </div>

                              <div>
                                {dailyEditingCell?.entryId===e.id && dailyEditingCell.field==="agency"
                                  ? <select
                                      className="dailyInlineSelect"
                                      autoFocus
                                      value={e.agencyId}
                                      onChange={ev=>updateDailyEntryAgency(e,ev.target.value)}
                                      onBlur={()=>setDailyEditingCell(null)}
                                    >
                                      {agencies.map(a=><option key={a.id} value={a.id}>{a.code} · {a.rate}%</option>)}
                                    </select>
                                  : <button className="dailyInlineValue" onClick={()=>setDailyEditingCell({entryId:e.id,field:"agency"})}>
                                      {e.agencyCodeSnapshot}
                                    </button>}
                              </div>

                              <div>
                                {dailyEditingCell?.entryId===e.id && dailyEditingCell.field==="buyin"
                                  ? <input
                                      className="dailyInlineBuyIn"
                                      autoFocus
                                      type="number"
                                      min="1"
                                      value={dailyEditBuyInValue}
                                      onChange={ev=>setDailyEditBuyInValue(ev.target.value)}
                                      onBlur={async ev=>{
                                        await setSessionBuyInCount(e,Number(ev.target.value));
                                        setDailyEditingCell(null);
                                      }}
                                      onKeyDown={ev=>{
                                        if(ev.key==="Enter")(ev.currentTarget as HTMLInputElement).blur();
                                        if(ev.key==="Escape")setDailyEditingCell(null);
                                      }}
                                    />
                                  : <button className="dailyInlineValue buyinValue" onClick={()=>{
                                      setDailyEditBuyInValue(String(e.buyIn));
                                      setDailyEditingCell({entryId:e.id,field:"buyin"});
                                    }}>{e.buyIn}회</button>}
                              </div>

                              <div className="dailyMoneyCell">{vnd(e.rake)}</div>
                              <div className="dailyMoneyCell strong">{vnd(e.rakeback)}</div>
                            </div>)}
                          </div>
                        </section>;
                      })}
                    </div>}
              </section>

              <aside className="dailySideSummary">
                <section className="dailyAccountingCard">
                  <div className="dailyAccountingHeader">
                    <strong>오늘 정산</strong>
                    <span>{summaryDate}</span>
                  </div>
                  <div className="dailyAccountingRows">
                    <div>
                      <span>총 엔트리피</span>
                      <b>{vnd(dailyGrossAmount)}</b>
                    </div>
                    <div className="expense">
                      <span>레이크백</span>
                      <b>− {vnd(dailyAgentTotal)}</b>
                    </div>
                    <button className="expense" onClick={()=>setFnbDetailOpen(true)}>
                      <span>F&B</span>
                      <b>− {vnd(dailyFnbTotal)}</b>
                    </button>
                    <div className="profit">
                      <span>오늘 수익</span>
                      <b>{vnd(dailyProfit)}</b>
                    </div>
                  </div>
                </section>
              </aside>
            </div>
          </section>
        </section>}

        {!isStaff && tab==="weekly" && <section className="weeklyReportPage">
          <div className="mobileSectionSwitcher settlementSwitcher">
            <button onClick={()=>navigateTab("daily")}>일일정산</button>
            <button className="active">주간정산</button>
          </div>

          <section className="panel weeklyReportPanel">
            <div className="weeklyReportTop compactWeeklyTop">
              <div className="weeklyTitleOnly">
                <h2>주간 정산</h2>
              </div>

              <div className="weeklyTopControls">
                <div className="weeklyQuickWeeks">
                  {[0,-1].map((offset,index)=>{
                    const base=monday(today());
                    const start=plusDays(base,offset*7);
                    const end=plusDays(start,6);
                    const labels=["이번 주","지난 주"];
                    const active=weekStart===start && weekEnd===end;
                    return <button
                      key={offset}
                      className={active?"active":""}
                      onClick={()=>{setWeekStart(start);setWeekEnd(end);}}
                    >{labels[index]}</button>
                  })}
                </div>

                <div className="weeklyPeriodControl compact">
                  <button aria-label="이전 주" onClick={()=>{
                    const start=plusDays(weekStart,-7);
                    setWeekStart(start); setWeekEnd(plusDays(start,6));
                  }}>‹</button>
                  <strong>{weekStart} ~ {weekEnd}</strong>
                  <button
                    aria-label="다음 주"
                    disabled={weekStart>=monday(today())}
                    onClick={()=>{
                      const current=monday(today());
                      if(weekStart>=current)return;
                      const start=plusDays(weekStart,7);
                      const next=start>current?current:start;
                      setWeekStart(next);
                      setWeekEnd(plusDays(next,6));
                    }}
                  >›</button>
                </div>

                <button
                  className="weeklyIconDownload"
                  onClick={exportWeeklyPng}
                  title="주간 정산서 PNG 다운로드"
                  aria-label="주간 정산서 PNG 다운로드"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 3v11"/>
                    <path d="m7.5 10 4.5 4.5 4.5-4.5"/>
                    <path d="M5 20h14"/>
                  </svg>
                </button>
              </div>
            </div>

            <div className="weeklyKpiGrid">
              <div><span>총 엔트리피</span><b>{vnd(weeklyEntryFee)}</b><small>{weeklyEntries.reduce((sum,e)=>sum+e.buyIn,0)} BUY-IN</small></div>
              <div className="expense"><span>레이크백</span><b>− {vnd(weeklyRakeback)}</b><small>{weeklyAgentRows.length}개 에이전트</small></div>
              <div className="expense"><span>F&B 경비</span><b>− {vnd(weeklyFnbTotal)}</b><small>2FLOOR 반영 · 전체 {vnd(weeklyFnbAllTotal)}</small></div>
              <div className="profit"><span>상계 전 잉여금</span><b>{vnd(weeklyProfit)}</b><small>이 금액으로 미처리 경비를 먼저 상계</small></div>
            </div>

            {profile?.role==="admin" && <section className="weeklyDistributionFlow">
              <div className="weeklyDistributionHead">
                <div>
                  <h3>지출 처리 → 지분 배당</h3>
                  <p>주간 수익에서 미처리 경비를 먼저 상계한 뒤 남은 금액만 지분율로 배당합니다.</p>
                </div>
                <button className="expenseLinkButton" onClick={()=>navigateTab("expenses")}>지출 내역서 ›</button>
              </div>

              <div className="distributionFlowGrid">
                <div>
                  <span>상계 전 잉여금</span>
                  <b>{vnd(weeklyProfit)}</b>
                  <small>아직 실제 수익으로 확정되지 않은 금액</small>
                </div>
                <i>→</i>
                <div className="expenseStep">
                  <span>경비 우선 처리</span>
                  <b>− {vnd(previewExpenseApplied)}</b>
                  <small>미처리 경비 {vnd(pendingExpenseTotal)}</small>
                </div>
                <i>→</i>
                <div className="profitStep">
                  <span>상계 후 실제 수익</span>
                  <b>{vnd(previewDistributableProfit)}</b>
                  <small>{selectedWeekDistribution?"확정 완료":"확정 전 예상"}</small>
                </div>
              </div>

              {profile?.role==="admin" && <div className="distributionActionRow">
                <div>
                  {selectedWeekDistribution
                    ? <><strong>이 주차는 확정되었습니다.</strong><span>경비 {vnd(selectedWeekDistribution.expenseApplied)} 처리 · 배당기준 {vnd(selectedWeekDistribution.distributableProfit)}</span></>
                    : <><strong>주간 마감 시 한 번 확정하세요.</strong><span>오래된 미처리 경비부터 FIFO로 자동 처리됩니다.</span></>}
                </div>
                {!selectedWeekDistribution && <button className="primary" onClick={finalizeSelectedWeek} disabled={finalizingDistribution}>
                  {finalizingDistribution?"처리 중...":"주간 지출·배당 확정"}
                </button>}
              </div>}

              <div className="sharePreviewRows">
                {(selectedWeekDistribution
                  ? selectedWeekPayouts.map(x=>({id:x.id,name:x.name,rate:x.rate,amount:x.amount,status:x.status}))
                  : shareholders.filter(x=>x.active).map(x=>({id:x.id,name:x.name,rate:x.rate,amount:Math.round(previewDistributableProfit*x.rate/100),status:"preview" as const}))
                ).map(row=><div key={row.id}>
                  <span><strong>{row.name}</strong><small>{row.rate}%</small></span>
                  <b>{vnd(row.amount)}</b>
                  {row.status!=="preview" && <em className={row.status==="paid"?"paid":""}>{row.status==="paid"?"지급완료":"지급대기"}</em>}
                </div>)}
              </div>
            </section>}

            <div className="weeklyReportGrid">
              <section className="weeklyAgentSection">
                <div className="weeklySectionHeader">
                  <div><h3>에이전트별 레이크백</h3><p>이번 주 실제 지급 예정 금액</p></div>
                  <span>{weeklyAgentRows.length} AGENT</span>
                </div>
                {weeklyAgentRows.length===0
                  ? <div className="weeklyEmpty">이번 주 레이크백 지급 내역이 없습니다.</div>
                  : <div className="weeklyAgentReportRows">
                      {weeklyAgentRows.map(a=><div key={a.id}>
                        <span><strong>{a.code}</strong><small>{a.rate}%</small></span>
                        <b>{vnd(a.amount)}</b>
                      </div>)}
                    </div>}
              </section>

              <aside className="weeklyAccountingAside">
                <div><span>총 엔트리피</span><b>{vnd(weeklyEntryFee)}</b></div>
                <div><span>레이크백</span><b>− {vnd(weeklyRakeback)}</b></div>
                <div><span>F&B 경비 (2FLOOR)</span><b>− {vnd(weeklyFnbTotal)}</b></div>
                <div className="profit"><span>상계 전 잉여금</span><b>{vnd(weeklyProfit)}</b></div>
              </aside>
            </div>

            <section className="weeklyFnbBreakdown">
              <div className="weeklySectionHeader">
                <div>
                  <h3>F&B 구분별 내역</h3>
                  <p>2FLOOR만 운영 경비로 반영하고, 다른 구분은 기록만 집계합니다.</p>
                </div>
                <span>전체 {vnd(weeklyFnbAllTotal)}</span>
              </div>
              {weeklyFnbGroups.length===0
                ? <div className="weeklyEmpty">이번 주 F&B 내역이 없습니다.</div>
                : <div className="weeklyFnbRows">
                    {weeklyFnbGroups.map(group=><div key={group.group}>
                      <span><strong>{group.group}</strong><small>{group.count}건 · {group.operating?"비용 반영":"기록만"}</small></span>
                      <b className={group.operating?"operating":""}>{vnd(group.amount)}</b>
                    </div>)}
                  </div>}
            </section>

            <section className="weeklyPlayersSection">
              <div className="weeklySectionHeader">
                <div>
                  <h3>레이크백 지급 플레이어</h3>
                  <p>레이크백이 발생한 플레이어만 에이전트 코드별로 표시합니다.</p>
                </div>
                <span>{weeklyPlayerRows.length}명</span>
              </div>

              {weeklyPlayerGroups.length===0
                ? <div className="weeklyEmpty">이번 주 레이크백 지급 대상 플레이어가 없습니다.</div>
                : <div className="weeklyPlayerGroups">
                    {weeklyPlayerGroups.map(group=><section className="weeklyPlayerGroup" key={group.agency}>
                      <header>
                        <div><strong>{group.agency}</strong><span>{group.rows.length}명</span></div>
                        <div className="weeklyAgentGroupActions">
                          <b>{vnd(group.totalRakeback)}</b>
                          <button
                            className="weeklyAgentIconDownload"
                            onClick={()=>exportWeeklyAgentPng(group.agency)}
                            title={`${group.agency} 정산서 PNG 다운로드`}
                            aria-label={`${group.agency} 정산서 PNG 다운로드`}
                          >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M12 3v11"/>
                              <path d="m7.5 10 4.5 4.5 4.5-4.5"/>
                              <path d="M5 20h14"/>
                            </svg>
                          </button>
                        </div>
                      </header>
                      <div className="weeklyPlayerHead">
                        <span>플레이어</span><span>바이인</span><span>엔트리피</span><span>레이크백</span>
                      </div>
                      {group.rows.map(row=><div className="weeklyPlayerRow" key={`${row.playerId}-${row.agency}`}>
                        <strong>{row.playerName}</strong>
                        <span>{row.buyIn}회</span>
                        <span>{vnd(row.rake)}</span>
                        <b>{vnd(row.rakeback)}</b>
                      </div>)}
                    </section>)}
                  </div>}
            </section>
          </section>
        </section>}

        {tab==="expenses" && profile?.role==="admin" && <section className="expenseWorkflowPage compactExpensePage">
          <section className="expenseCompactTop">
            <div className="expenseCompactTitle">
              <span>운영 경비 장부</span>
              <h2>지출 내역서</h2>
            </div>
            <div className="expenseCompactSummary">
              <div className={ledgerBalance<0?"primary negative":"primary positive"}><span>현재 장부 잔액</span><strong>{ledgerBalance>0?"+":""}{vnd(ledgerBalance)}</strong></div>
              <div><span>Deposit</span><b>+ {vnd(totalDepositAmount)}</b></div>
              <div><span>전체 경비</span><b>− {vnd(totalExpenseAmount)}</b></div>
              <div><span>미처리 경비</span><b>{vnd(pendingExpenseTotal)}</b></div>
            </div>
          </section>

          <section className="panel expenseLedgerPanel">
            <div className="expenseLedgerHeader">
              <div>
                <h2>입출금 장부</h2>
                <p>Deposit은 주간 정산금(+), Expense는 경비(−)로 누적되어 장부 잔액이 계산됩니다.</p>
              </div>
              <div className="expenseFilterTabs">
                <button className={expenseFilter==="pending"?"active":""} onClick={()=>setExpenseFilter("pending")}>미처리 {pendingExpenseRows.length}</button>
                <button className={expenseFilter==="all"?"active":""} onClick={()=>setExpenseFilter("all")}>전체 {expenseItems.length+expenseDeposits.length}</button>
                <button className={expenseFilter==="processed"?"active":""} onClick={()=>setExpenseFilter("processed")}>처리완료 {processedExpenseRows.length}</button>
              </div>
            </div>

            <div className={expenseEntryType==="deposit"?"expenseQuickAdd depositMode":"expenseQuickAdd"}>
              <select className="ledgerTypeSelect" value={expenseEntryType} onChange={e=>setExpenseEntryType(e.target.value as "expense"|"deposit")} aria-label="장부 유형">
                <option value="expense">Expense</option>
                <option value="deposit">Deposit</option>
              </select>
              <input type="date" value={expenseDate} onChange={e=>setExpenseDate(e.target.value)} aria-label="날짜"/>
              {expenseEntryType==="expense"
                ? <select value={expenseCategory} onChange={e=>setExpenseCategory(e.target.value)} aria-label="지출 구분">
                    <option value="OTHER">기타</option>
                    <option value="HOUSING">숙소 / 임대</option>
                    <option value="LODGING">호텔</option>
                    <option value="MEAL">식대</option>
                    <option value="ENTERTAINMENT">접대비</option>
                    <option value="SUPPLIES">비품</option>
                    <option value="INCIDENT">사고비</option>
                    <option value="SALARY">급여</option>
                    <option value="TRANSPORT">교통</option>
                  </select>
                : <div className="depositAutoLabel">주간 정산금</div>}
              <input value={expenseDescription} onChange={e=>setExpenseDescription(e.target.value)} placeholder={expenseEntryType==="deposit"?"예: 9/28~10/4 정산금":"경비 항목"} aria-label="항목"/>
              {expenseEntryType==="expense"
                ? <input value={expensePrepaidBy} onChange={e=>setExpensePrepaidBy(e.target.value)} placeholder="선지급자" aria-label="선지급자"/>
                : <div className="depositAutoLabel">＋ 입금</div>}
              <input inputMode="numeric" value={expenseAmount} onChange={e=>setExpenseAmount(e.target.value.replace(/[^0-9]/g,""))} placeholder="금액(VND)" aria-label="금액"/>
              <input value={expenseNote} onChange={e=>setExpenseNote(e.target.value)} placeholder="메모" aria-label="메모"/>
              <button className="primary" onClick={addLedgerItem}>＋ 추가</button>
            </div>

            <div className="expenseLedgerScroll">
              <div className="expenseLedgerTable">
                <div className="expenseLedgerHead">
                  <span>날짜</span>
                  <span>유형 / 항목</span>
                  <span>선지급자</span>
                  <span>Deposit</span>
                  <span>원래 금액</span>
                  <span>처리된 금액</span>
                  <span>미처리 잔액</span>
                  <span>Balance</span>
                  <span>상태</span>
                  <span>메모</span>
                  <span></span>
                </div>

                {visibleLedgerRows.length===0
                  ? <div className="expenseLedgerEmpty">표시할 장부 항목이 없습니다.</div>
                  : visibleLedgerRows.map(row=>{
                      if(row.kind==="deposit"){
                        return <div className="expenseLedgerRow depositLedgerRow" key={"deposit-"+row.id}>
                          <span>{row.date}</span>
                          <span className="expenseItemName"><strong>{row.description}</strong><small>DEPOSIT · {row.sourceRef || "직접 입력"}</small></span>
                          <span>-</span>
                          <b className="depositValue">+ {vnd(row.amount)}</b>
                          <span>-</span>
                          <span>-</span>
                          <span>-</span>
                          <b className={row.balance<0?"ledgerBalance negative":"ledgerBalance positive"}>{row.balance>0?"+":""}{vnd(row.balance)}</b>
                          <em className="deposit">입금</em>
                          <span className="expenseNoteCell">{row.note || "-"}</span>
                          <span></span>
                        </div>;
                      }
                      const item=row.expense!;
                      const remaining=Math.max(0,item.amount-item.processedAmount);
                      const state=item.processedAmount>=item.amount?"processed":item.processedAmount>0?"partial":"pending";
                      return <div className="expenseLedgerRow editableExpenseRow" key={"expense-"+item.id} onClick={()=>openExpenseEditor(item)} role="button" tabIndex={0} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openExpenseEditor(item);}}}>
                        <span>{item.date}</span>
                        <span className="expenseItemName"><strong>{item.description}</strong><small>EXPENSE · {item.category} · {item.sourceRef || "직접 입력"}</small></span>
                        <span>
                          <input
                            className="expensePayerInput"
                            defaultValue={item.prepaidBy}
                            placeholder="미입력"
                            onClick={e=>e.stopPropagation()}
                            onKeyDown={e=>e.stopPropagation()}
                            onBlur={e=>updateExpensePrepaidBy(item,e.target.value)}
                          />
                        </span>
                        <span>-</span>
                        <span>{vnd(item.amount)}</span>
                        <span>{vnd(item.processedAmount)}</span>
                        <b>{vnd(remaining)}</b>
                        <b className={row.balance<0?"ledgerBalance negative":"ledgerBalance positive"}>{row.balance>0?"+":""}{vnd(row.balance)}</b>
                        <em className={state}>{state==="processed"?"처리완료":state==="partial"?"일부처리":"미처리"}</em>
                        <span className="expenseNoteCell">{item.note || "-"}</span>
                        <button onClick={e=>{e.stopPropagation();deleteExpenseItem(item);}} disabled={item.processedAmount>0} aria-label="지출 삭제">×</button>
                      </div>;
                    })}
              </div>
            </div>
          </section>
        </section>}

        {tab==="fnb" && <section className="fnbPage">
          <div className="fnbSummary">
            <div>
              <span>오늘 F&B</span>
              <b>{vnd(fnbTodayAllTotal)}</b>
              <small>운영 경비 반영 {vnd(fnbTodayTotal)} · 2FLOOR만 차감</small>
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
                <small>{money.format(item.price)}</small>
              </button>)}
            </div>

            <div className="fnbFormGrid">
              <label>메뉴
                <select value={fnbMenuName} onChange={e=>setFnbMenuName(e.target.value)}>
                  {FNB_MENU.map(item=><option key={item.name} value={item.name}>{item.label} · {money.format(item.price)}</option>)}
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
              <div className="fnbDayTotals"><strong className="fnbDayTotal">{vnd(fnbDayTotal)}</strong><small>경비 반영 {vnd(fnbDayOperatingTotal)}</small></div>
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

        {!isStaff && tab==="reports" && <section className="reportAnalyticsPage">
          <section className="panel reportAnalyticsPanel">
            <div className="reportAnalyticsTop">
              <div><h2>리포트</h2><p>기간별 운영 통계와 수익 추이를 확인합니다.</p></div>
              <div className="reportPresetButtons">
                <button className={reportPreset==="today"?"active":""} onClick={()=>applyReportPreset("today")}>오늘</button>
                <button className={reportPreset==="week"?"active":""} onClick={()=>applyReportPreset("week")}>이번 주</button>
                <button className={reportPreset==="custom"?"active":""} onClick={()=>setReportPreset("custom")}>기간 선택</button>
              </div>
            </div>
            {reportPreset==="custom" && <div className="reportDateRange analyticsRange">
              <input type="date" value={reportStart} onChange={e=>setReportStart(e.target.value)}/>
              <span>~</span>
              <input type="date" value={reportEnd} onChange={e=>setReportEnd(e.target.value)}/>
            </div>}

            <div className="reportKpiGrid">
              <div><span>총 엔트리피</span><b>{vnd(reportRevenue)}</b><small>{reportBuyInCount} BUY-IN</small></div>
              <div><span>레이크백</span><b>{vnd(reportRakeback)}</b><small>{reportAgencyRanking.length}개 지급 코드</small></div>
              <div><span>플레이어</span><b>{reportPlayerCount}명</b><small>{reportStart} ~ {reportEnd}</small></div>
              <div className="profit"><span>순수익</span><b>{vnd(reportNet)}</b><small>2FLOOR F&B 반영</small></div>
            </div>

            <div className="reportAnalyticsGrid">
              <section className="reportTrendCard">
                <div className="reportSectionHead"><div><h3>수익 추이</h3><p>엔트리피와 순수익 비교</p></div></div>
                <div className="reportTrendChart">
                  {reportTrendData.map(item=><div className="reportTrendCol" key={item.date}>
                    <div className="reportTrendBars">
                      <i className="entry" style={{height:`${Math.max(item.entryFee>0?6:2,item.entryFee/reportTrendMax*100)}%`}}/>
                      <i className="profit" style={{height:`${Math.max(item.profit>0?6:2,Math.max(0,item.profit)/reportTrendMax*100)}%`}}/>
                    </div>
                    <span>{item.date.slice(5).replace("-","/")}</span>
                  </div>)}
                </div>
                <div className="reportLegend"><span><i className="entry"/>엔트리피</span><span><i className="profit"/>순수익</span></div>
              </section>

              <section className="reportAgencyRank">
                <div className="reportSectionHead"><div><h3>에이전트 레이크백</h3><p>선택 기간 지급액 순</p></div></div>
                {reportAgencyRanking.length===0
                  ? <div className="weeklyEmpty">레이크백 지급 내역이 없습니다.</div>
                  : reportAgencyRanking.map((a,index)=><div className="reportAgencyRankRow" key={a.id}>
                      <span><em>{index+1}</em><strong>{a.code}</strong></span>
                      <b>{vnd(a.amount)}</b>
                    </div>)}
              </section>
            </div>
          </section>
        </section>}
        {tab==="settings" && profile?.role==="admin" && <section className="accountManagementPage">
          <section className="panel ownLoginPanel">
            <div className="sectionTitle">
              <div><h2>내 로그인 정보</h2><p>관리자 로그인 아이디와 비밀번호를 변경합니다.</p></div>
            </div>
            <div className="ownLoginGrid">
              <label>로그인 아이디
                <input value={ownUsername} onChange={e=>setOwnUsername(e.target.value.toLowerCase())} placeholder="예: admin"/>
              </label>
              <label>새 비밀번호
                <input type="password" value={ownPassword} onChange={e=>setOwnPassword(e.target.value)} placeholder="변경할 때만 입력 · 6자 이상"/>
              </label>
              <button className="primary ownLoginSaveButton" onClick={updateOwnLogin} disabled={updatingOwnLogin}>
                {updatingOwnLogin?"변경 중...":"로그인 정보 저장"}
              </button>
            </div>
          </section>

          <section className="panel shareholderSettingsPanel">
            <div className="sectionTitle">
              <div><h2>사업 지분 설정</h2><p>주간 경비 상계 후 발생한 실제 수익을 이 지분율로 배당합니다.</p></div>
              <strong className={Math.abs(shareholderRateTotal-100)<0.001?"shareTotal ok":"shareTotal"}>{shareholderRateTotal}%</strong>
            </div>
            <div className="shareholderRows">
              {shareholders.map(holder=><div key={holder.id}>
                <span><strong>{holder.name}</strong><small>{holder.active?"배당 대상":"비활성"}</small></span>
                <div>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={holder.rate}
                    onChange={e=>setShareholders(prev=>prev.map(x=>x.id===holder.id?{...x,rate:Number(e.target.value)}:x))}
                    onBlur={e=>updateShareholderRate(holder,Number(e.target.value))}
                  />
                  <em>%</em>
                </div>
              </div>)}
            </div>
          </section>

          <section className="panel accountCreatePanel">
            <div className="sectionTitle">
              <div><h2>직원·에이전트 계정 생성</h2><p>아이디와 임시 비밀번호를 입력해 새 로그인 계정을 만듭니다.</p></div>
            </div>

            <div className="accountCreateGrid">
              <label>이름<input value={newAccountName} onChange={e=>setNewAccountName(e.target.value)} placeholder="예: Dream Staff 1"/></label>
              <label>아이디<input value={newAccountUsername} onChange={e=>setNewAccountUsername(e.target.value.toLowerCase())} placeholder="예: staff01"/></label>
              <label>임시 비밀번호<input type="password" value={newAccountPassword} onChange={e=>setNewAccountPassword(e.target.value)} placeholder="6자 이상"/></label>
              <label>계정 유형
                <select value={newAccountRole} onChange={e=>setNewAccountRole(e.target.value as UserRole)}>
                  <option value="staff">직원 계정</option>
                  <option value="agent">에이전트 계정</option>
                  <option value="admin">관리자 계정</option>
                </select>
              </label>
              {newAccountRole==="agent" && <label>연결 Agency
                <select value={newAccountAgencyId} onChange={e=>setNewAccountAgencyId(e.target.value)}>
                  <option value="">Agency 선택</option>
                  {agencies.map(a=><option key={a.id} value={a.id}>{a.code} · {a.rate}%</option>)}
                </select>
              </label>}
              <button className="primary accountCreateButton" onClick={createManagedAccount} disabled={creatingAccount}>
                {creatingAccount?"계정 생성 중...":"＋ 계정 생성"}
              </button>
            </div>
          </section>

          <section className="panel accountListPanel">
            <div className="sectionTitle">
              <div><h2>등록 계정</h2><p>{accountProfiles.length}개 계정</p></div>
            </div>
            <div className="accountList">
              {accountProfiles.map(u=><div className="accountRow" key={u.userId}>
                <div className="accountIdentity">
                  <span className="accountAvatar">{(u.displayName||u.email||"?").slice(0,1).toUpperCase()}</span>
                  <div><strong>{u.displayName||"이름 없음"}</strong><small>@{u.username || "아이디 없음"}</small></div>
                </div>
                <select value={u.role} onChange={e=>updateManagedAccount(u.userId,{role:e.target.value as UserRole})} disabled={u.userId===profile.userId}>
                  <option value="admin">관리자</option>
                  <option value="staff">직원</option>
                  <option value="agent">에이전트</option>
                  <option value="pending">승인 대기</option>
                </select>
                <select
                  value={u.agencyId}
                  onChange={e=>updateManagedAccount(u.userId,{agencyId:e.target.value})}
                  disabled={u.role!=="agent"}
                >
                  <option value="">Agency 없음</option>
                  {agencies.map(a=><option key={a.id} value={a.id}>{a.code}</option>)}
                </select>
                <button
                  className={u.active?"accountStatus active":"accountStatus"}
                  onClick={()=>updateManagedAccount(u.userId,{active:!u.active})}
                  disabled={u.userId===profile.userId}
                >{u.active?"활성":"정지"}</button>
              </div>)}
            </div>
          </section>
        </section>}
      </div>
    </section>

    {editingExpenseId && (()=> {
      const item=expenseItems.find(x=>x.id===editingExpenseId);
      if(!item)return null;
      const originalAmount=Number(expenseEditAmount.replace(/,/g,"")) || 0;
      const processedAmount=Number(expenseEditProcessedAmount.replace(/,/g,"")) || 0;
      const remaining=Math.max(0,originalAmount-processedAmount);
      const editState=processedAmount>=originalAmount && originalAmount>0?"processed":processedAmount>0?"partial":"pending";
      return <div className="playerManageOverlay expenseEditOverlay" onClick={closeExpenseEditor}>
        <section className="expenseEditModal" onClick={e=>e.stopPropagation()}>
          <div className="expenseEditHeader">
            <div>
              <span>지출 항목 수정</span>
              <strong>{item.description}</strong>
              <small>{item.date} · {item.prepaidBy || "선지급자 미입력"}</small>
            </div>
            <button onClick={closeExpenseEditor} aria-label="닫기">×</button>
          </div>

          <div className="expenseEditSummary">
            <div><span>원래 금액</span><b>{vnd(originalAmount)}</b></div>
            <div><span>처리된 금액</span><b>{vnd(processedAmount)}</b></div>
            <div className="remaining"><span>미처리 잔액</span><b>{vnd(remaining)}</b></div>
            <em className={editState}>{editState==="processed"?"처리완료":editState==="partial"?"일부처리":"미처리"}</em>
          </div>

          <div className="expenseEditGrid">
            <label>날짜<input type="date" value={expenseEditDate} onChange={e=>setExpenseEditDate(e.target.value)}/></label>
            <label>구분
              <select value={expenseEditCategory} onChange={e=>setExpenseEditCategory(e.target.value)}>
                <option value="OTHER">기타</option>
                <option value="HOUSING">숙소 / 임대</option>
                <option value="LODGING">호텔</option>
                <option value="MEAL">식대</option>
                <option value="ENTERTAINMENT">접대비</option>
                <option value="SUPPLIES">비품</option>
                <option value="INCIDENT">사고비</option>
                <option value="SALARY">급여</option>
                <option value="TRANSPORT">교통</option>
              </select>
            </label>
            <label className="wide">경비 항목<input value={expenseEditDescription} onChange={e=>setExpenseEditDescription(e.target.value)}/></label>
            <label>선지급자<input value={expenseEditPrepaidBy} onChange={e=>setExpenseEditPrepaidBy(e.target.value)} placeholder="예: 김지원"/></label>
            <label>원래 금액<input inputMode="numeric" value={expenseEditAmount} onChange={e=>setExpenseEditAmount(e.target.value.replace(/[^0-9]/g,""))}/></label>
            <label>처리된 일부 금액<input inputMode="numeric" value={expenseEditProcessedAmount} onChange={e=>setExpenseEditProcessedAmount(e.target.value.replace(/[^0-9]/g,""))}/></label>
            <label className="wide">메모<input value={expenseEditNote} onChange={e=>setExpenseEditNote(e.target.value)}/></label>
          </div>

          <div className="expenseEditFooter">
            <button className="secondary" onClick={closeExpenseEditor}>취소</button>
            <button className="primary" onClick={saveExpenseEditor} disabled={savingExpenseEdit}>{savingExpenseEdit?"저장 중...":"수정 저장"}</button>
          </div>
        </section>
      </div>;
    })()}

    {lastDeletedEntry && <div className="undoToast">
      <span><strong>{getPlayerName(lastDeletedEntry.playerId)}</strong> 기록을 삭제했습니다.</span>
      <button onClick={undoLastDeletedEntry}>실행 취소</button>
      <button className="undoDismiss" onClick={()=>setLastDeletedEntry(null)} aria-label="닫기">×</button>
    </div>}

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
          {!isStaff && <div className="manageFinancialSummary">
            <div><small>금액</small><b>{vnd(revenuePerBuyIn(managedEntry.game)*managedEntry.buyIn)}</b></div>
            <div><small>레이크백</small><b>{vnd(managedEntry.rakeback)}</b></div>
          </div>}
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
      {mobileNavItems.filter(item=>!isStaff || item.key!=="settlement").map(item=>{
        const isActive =
          item.key==="settlement" ? (tab==="daily" || tab==="weekly") :
          item.key==="players" ? (tab==="players" || tab==="agencies") :
          tab===item.key;
        return <button
          key={item.key}
          className={`${isActive?"active":""} ${item.key==="games"?"buyinNavItem":""}`}
          onClick={()=>{
            if(item.key==="settlement") navigateTab("daily");
            else navigateTab(item.key as TabKey);
          }}
        >
          <span className="mobileNavIcon"><MobileBottomIcon type={item.key}/></span>
          <span>{item.label}</span>
        </button>
      })}
    </nav>
  </main>;
}
