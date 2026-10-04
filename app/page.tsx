"use client";

import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

type Agency = { id: string; code: string; rate: number; active: boolean };
type Player = { id: string; name: string; koreanName: string; cardNo: string; agencyId: string; note: string };
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
};

const DEFAULT_AGENCIES: Agency[] = [
  { id: "agency-korea", code: "KOREA", rate: 0, active: true },
  { id: "agency-mongol", code: "MONGOL", rate: 30, active: true },
  { id: "agency-japan", code: "JAPAN", rate: 35, active: true },
  { id: "agency-china-ak", code: "CHINA (AK)", rate: 40, active: true },
  { id: "agency-house", code: "HOUSE", rate: 50, active: true },
  { id: "agency-korea2", code: "KOREA2", rate: 25, active: true },
];

const money = new Intl.NumberFormat("ko-KR");
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

export default function Home() {
  const [tab, setTab] = useState<"dashboard"|"agencies"|"players"|"games"|"daily"|"weekly"|"reports"|"settings">("dashboard");
  const [agencies, setAgencies] = useState<Agency[]>(DEFAULT_AGENCIES);
  const [players, setPlayers] = useState<Player[]>([]);
  const [entries, setEntries] = useState<GameEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");
  const [theme, setTheme] = useState<"light"|"dark">("light");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [newAgencyCode, setNewAgencyCode] = useState("");
  const [newAgencyRate, setNewAgencyRate] = useState("25");
  const [playerName, setPlayerName] = useState("");
  const [playerKoreanName, setPlayerKoreanName] = useState("");
  const [playerSearch, setPlayerSearch] = useState("");
  const [playerView, setPlayerView] = useState<"list"|"add">("list");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [playerCard, setPlayerCard] = useState("");
  const [playerNote, setPlayerNote] = useState("");
  const [playerAgencyId, setPlayerAgencyId] = useState("agency-korea2");
  const [gameDate, setGameDate] = useState(today());
  const [gameName, setGameName] = useState("5M");
  const [gamePlayerId, setGamePlayerId] = useState("");
  const [gameBuyIn, setGameBuyIn] = useState("1");
  const [gameRake, setGameRake] = useState("500000");
  const [summaryDate, setSummaryDate] = useState(today());
  const start = monday(today());
  const [weekStart, setWeekStart] = useState(start);
  const [weekEnd, setWeekEnd] = useState(plusDays(start, 6));

  useEffect(() => {
    const saved = localStorage.getItem("dream-poker-theme");
    const nextTheme = saved === "dark" ? "dark" : "light";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
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

    const [a, p, g] = await Promise.all([
      supabase.from("agencies").select("*").order("created_at"),
      loadAllPlayers(),
      supabase.from("game_entries").select("*").order("played_on"),
    ]);

    if (a.error || p.error || g.error) {
      setMessage(a.error?.message || p.error?.message || g.error?.message || "데이터를 불러오지 못했습니다.");
      setSyncing(false);
      return;
    }

    setAgencies((a.data ?? []).map((x:any)=>({id:x.id,code:x.code,rate:Number(x.rate),active:x.active})));
    setPlayers((p.data ?? []).map((x:any)=>({id:x.id,name:x.name,koreanName:x.korean_name ?? "",cardNo:x.card_no ?? "",agencyId:x.agency_id,note:x.note ?? ""})));
    setEntries((g.data ?? []).map((x:any)=>({
      id:x.id,date:x.played_on,game:x.game_name,playerId:x.player_id,buyIn:Number(x.buy_in),
      rake:Number(x.rake),agencyId:x.agency_id,agencyCodeSnapshot:x.agency_code_snapshot,
      rateSnapshot:Number(x.rate_snapshot),rakeback:Number(x.rakeback)
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
    localStorage.setItem("poker-agent-solution-v1", JSON.stringify({ agencies, players, entries }));
  }, [agencies, players, entries, loaded]);

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

  async function addPlayer() {
    const name=playerName.trim().toUpperCase();
    if(!name || !playerAgencyId) return;
    if(isSupabaseConfigured && supabase && session){
      const { data,error }=await supabase.from("players").insert({name,korean_name:playerKoreanName.trim()||null,card_no:playerCard.trim()||null,agency_id:playerAgencyId,note:playerNote.trim()||null}).select().single();
      if(error){setMessage(error.message);return;}
      const p={id:data.id,name:data.name,koreanName:data.korean_name??"",cardNo:data.card_no??"",agencyId:data.agency_id,note:data.note??""};
      setPlayers(prev=>[...prev,p]); setGamePlayerId(p.id);
    } else {
      const p={id:uid("player"),name,koreanName:playerKoreanName.trim(),cardNo:playerCard.trim(),agencyId:playerAgencyId,note:playerNote.trim()};
      setPlayers(prev=>[...prev,p]); setGamePlayerId(p.id);
    }
    setPlayerName(""); setPlayerKoreanName(""); setPlayerCard(""); setPlayerNote("");
  }

  async function updatePlayerAgency(playerId:string, agencyId:string) {
    setPlayers(prev=>prev.map(p=>p.id===playerId?{...p,agencyId}:p));
    if(isSupabaseConfigured && supabase && session){
      const { error }=await supabase.from("players").update({agency_id:agencyId}).eq("id",playerId);
      if(error)setMessage(error.message);
    }
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
  const weekSettlement = total(thisWeekEntries,"rakeback");
  const recentEntries = [...entries].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,6);
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

  return <main className="appShell">
    <aside className="sidebar">
      <div className="brand">
        <img className="brandLogo" src="/dream-poker-logo.svg" alt="Dream Poker Da Nang"/>
        <div><strong>드림 포커</strong><span>에이전트 운영</span></div>
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
        <div className="searchBox">⌕ <input placeholder="에이전트 코드, 플레이어명, 이메일을 검색하세요..."/><kbd>⌘ K</kbd></div>
        <div className="accountArea">
          <button className="themeSwitch" onClick={()=>applyTheme(theme==="dark"?"light":"dark")} aria-label="라이트/다크 모드 전환">
            <span className="themeLabel">☀</span>
            <span className={`switchTrack ${theme==="dark"?"dark":""}`}><span className="switchKnob"/></span>
            <span className="themeLabel">☾</span>
            <strong>{theme==="dark"?"다크":"라이트"}</strong>
          </button>
          <button className="ghostButton">⇄ 에이전트 보기</button>
          <span className="roleBadge">관리자</span>
          <span className="avatar">{session?.user.email?.slice(0,1).toUpperCase() || "A"}</span>
          <span className="accountEmail">{session?.user.email}</span>
          <button className="ghostButton smallGhost" onClick={signOut}>로그아웃</button>
        </div>
      </header>

      <div className="contentArea">
        <div className="pageHeading">
          <div>
            <p className="eyebrow">드림 포커 · 에이전트 운영</p>
            <h1>{tab==="dashboard"?"포커 에이전트 통합 정산":
              tab==="agencies"?"에이전트 관리":
              tab==="players"?"플레이어 관리":
              tab==="games"?"게임 입력":
              tab==="daily"?"일일 정산":
              tab==="weekly"?"주간 정산":
              tab==="reports"?"리포트":"설정"}</h1>
            <p className="sub">플레이어 등록부터 코드별 레이크백, 일일·주간 정산까지 한 곳에서 관리합니다.</p>
          </div>
          <div className="headingActions"><span className="status">{modeText}</span><button className="outlineGold" onClick={loadFromDatabase}>↻ 데이터 새로고침</button></div>
        </div>

        {message && <div className="note globalNote">{message}</div>}

        {tab==="dashboard" && <>
          <div className="kpiGrid">
            <div className="kpiCard"><div className="kpiIcon">♟</div><div><span>전체 에이전트</span><b>{activeAgentCount}명</b><small>현재 사용 중인 코드</small></div></div>
            <div className="kpiCard"><div className="kpiIcon">♙</div><div><span>전체 플레이어</span><b>{players.length}명</b><small>등록 플레이어</small></div></div>
            <div className="kpiCard"><div className="kpiIcon">◎</div><div><span>오늘 정산 금액</span><b>₩ {money.format(todaySettlement)}</b><small>오늘 레이크백 합계</small></div></div>
            <div className="kpiCard"><div className="kpiIcon">▣</div><div><span>이번 주 지급액</span><b>₩ {money.format(weekSettlement)}</b><small>{weekStart} ~ {weekEnd}</small></div></div>
          </div>

          <div className="dashboardGrid">
            <section className="dashCard chartCard">
              <div className="cardHeader"><div><h2>주간 정산 추이</h2><p>최근 입력 기록 기준</p></div><span className="miniSelect">최근 4주⌄</span></div>
              <div className="fakeChart">
                {[42,58,47,66,75,54,82,69,91,64,78,88,61,95,73,86,99].map((h,i)=><div key={i} className="bar" style={{height:`${h}%`}}></div>)}
                <svg viewBox="0 0 600 160" preserveAspectRatio="none"><polyline points="0,120 75,110 150,88 225,82 300,77 375,74 450,60 525,47 600,28" fill="none" stroke="currentColor" strokeWidth="3"/></svg>
              </div>
              <div className="chartLegend"><span>● 정산 금액</span><span>● 플레이어 수</span></div>
            </section>

            <section className="dashCard agentSummaryCard">
              <div className="cardHeader"><div><h2>에이전트 요약</h2><p>코드별 현황</p></div><button className="linkButton" onClick={()=>setTab("agencies")}>전체보기 →</button></div>
              <div className="summaryTable">
                <div className="summaryHead"><span>코드명</span><span>정산 요율</span><span>플레이어</span><span>상태</span></div>
                {agencies.slice(0,7).map(a=><div className="summaryRow" key={a.id}>
                  <strong>{a.code}</strong><span>{a.rate}%</span><span>{players.filter(p=>p.agencyId===a.id).length}명</span><em className={a.active?"greenBadge":"grayBadge"}>{a.active?"사용 중":"중지"}</em>
                </div>)}
              </div>
            </section>
          </div>

          <section className="dashCard recentCard">
            <div className="cardHeader"><div><h2>최근 정산 내역</h2><p>최근 게임 입력 기준</p></div><button className="linkButton" onClick={()=>setTab("weekly")}>전체보기 →</button></div>
            <div className="tableWrap cleanTable"><table><thead><tr><th>정산일</th><th>에이전트 코드</th><th>플레이어</th><th>게임</th><th>레이크</th><th>정산 금액</th><th>상태</th></tr></thead>
              <tbody>{recentEntries.length===0?<tr><td colSpan={7} className="empty">최근 정산 내역이 없습니다.</td></tr>:recentEntries.map(e=><tr key={e.id}><td>{e.date}</td><td>{e.agencyCodeSnapshot}</td><td>{getPlayerName(e.playerId)}</td><td>{e.game}</td><td>₩ {money.format(e.rake)}</td><td className="strong">₩ {money.format(e.rakeback)}</td><td><span className="greenBadge">정산 완료</span></td></tr>)}</tbody>
            </table></div>
          </section>
        </>}

        {tab==="agencies" && <section className="panel">
          <div className="sectionTitle"><div><h2>에이전트 코드 관리</h2><p>코드명과 정산 요율은 언제든 변경할 수 있습니다.</p></div></div>
          <div className="inlineForm">
            <input placeholder="새 코드명" value={newAgencyCode} onChange={e=>setNewAgencyCode(e.target.value)}/>
            <input type="number" min="0" max="100" value={newAgencyRate} onChange={e=>setNewAgencyRate(e.target.value)}/>
            <span className="suffix">%</span><button className="primary" onClick={addAgency}>+ 코드 추가</button>
          </div>
          <div className="tableWrap"><table><thead><tr><th>내부 식별값</th><th>코드명</th><th>정산 요율</th><th>상태</th></tr></thead>
          <tbody>{agencies.map(a=><tr key={a.id}><td className="muted mono">{a.id}</td><td><input className="cellInput" value={a.code} onChange={e=>updateAgency(a.id,{code:e.target.value.toUpperCase()})}/></td><td><div className="rateCell"><input className="cellInput rate" type="number" min="0" max="100" value={a.rate} onChange={e=>updateAgency(a.id,{rate:Number(e.target.value)})}/><span>%</span></div></td><td><button className={a.active?"pill on":"pill"} onClick={()=>updateAgency(a.id,{active:!a.active})}>{a.active?"사용 중":"사용 중지"}</button></td></tr>)}</tbody></table></div>
          <div className="note">코드명을 바꿔도 내부 식별값은 유지되며, 과거 정산은 입력 당시 요율로 보존됩니다.</div>
        </section>}

        {tab==="players" && <section className="panel">
          <div className="sectionTitle playerSectionHeader">
            <div>
              <h2>플레이어 관리</h2>
              <p>플레이어를 검색하거나 새 플레이어를 등록합니다.</p>
            </div>
            <button className="primary addPlayerButton" onClick={()=>setPlayerView("add")}>＋ 플레이어 추가</button>
          </div>

          <div className="playerSearchSection">
            <div className="subSectionTitle">
              <h3>플레이어 검색</h3>
              <p>영문성함 또는 한글성함으로 등록된 플레이어를 찾습니다.</p>
            </div>
            <div className="playerSearchBar">
              <div className="playerSearchInput">⌕
                <input
                  value={playerSearch}
                  onChange={e=>setPlayerSearch(e.target.value)}
                  placeholder="영문성함 또는 한글성함을 입력하세요"
                />
                {playerSearch && <button onClick={()=>setPlayerSearch("")}>✕</button>}
              </div>
              <span className="searchCount">{filteredPlayers.length}명 / 전체 {players.length}명</span>
            </div>
          </div>



          <div className="tableWrap"><table><thead><tr><th>영문성함</th><th>한글성함</th><th>회원번호</th><th>에이전트 코드</th><th>현재 정산 요율</th></tr></thead><tbody>{filteredPlayers.length===0?<tr><td colSpan={5} className="empty">{playerSearch?"검색 결과가 없습니다.":"등록된 플레이어가 없습니다."}</td></tr>:filteredPlayers.map(p=>{const a=agencies.find(x=>x.id===p.agencyId);return <tr key={p.id}><td><button className="playerNameButton" onClick={()=>setSelectedPlayerId(p.id)}>{p.name}</button></td><td>{p.koreanName||"-"}</td><td>{p.cardNo||"-"}</td><td><select className="cellInput" value={p.agencyId} onChange={e=>updatePlayerAgency(p.id,e.target.value)}>{agencies.map(x=><option key={x.id} value={x.id}>{x.code}</option>)}</select></td><td>{a?.rate??0}%</td></tr>})}</tbody></table></div>




          {playerView==="add" && <div className="modalBackdrop" onClick={()=>setPlayerView("list")}>
            <div className="playerModal playerAddModal" onClick={e=>e.stopPropagation()}>
              <div className="modalHeader">
                <div>
                  <span className="modalEyebrow">NEW PLAYER</span>
                  <h3>플레이어 추가</h3>
                  <p>플레이어의 기본 정보와 담당 에이전트를 입력하세요.</p>
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
                <div className="playerStatCard"><span>총 바이인</span><b>{money.format(selectedPlayerBuyIns)}회</b></div>
                <div className="playerStatCard"><span>총 발생 레이크</span><b>{money.format(selectedPlayerRake)}</b></div>
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
                    : selectedPlayerGameBreakdown.map(r=><tr key={r.game}><td><strong>{r.game}</strong></td><td>{r.games}회</td><td>{money.format(r.buyIns)}회</td><td>{money.format(r.rake)}</td></tr>)}
                  </tbody>
                </table></div>
              </div>

              <div className="playerDetailSection">
                <div className="playerDetailTitle"><h4>게임 내역</h4><span>최근 기록순</span></div>
                <div className="tableWrap playerDetailTable"><table>
                  <thead><tr><th>날짜</th><th>게임</th><th>바이인</th><th>레이크</th><th>레이크백</th></tr></thead>
                  <tbody>{selectedPlayerEntries.length===0
                    ? <tr><td colSpan={5} className="empty">아직 게임 기록이 없습니다.</td></tr>
                    : [...selectedPlayerEntries].sort((a,b)=>b.date.localeCompare(a.date)).map(e=><tr key={e.id}><td>{e.date}</td><td>{e.game}</td><td>{money.format(e.buyIn)}회</td><td>{money.format(e.rake)}</td><td>{money.format(e.rakeback)}</td></tr>)}
                  </tbody>
                </table></div>
              </div>
            </div>
          </div>}
        </section>}

        {tab==="games" && <section className="panel">
          <div className="sectionTitle"><div><h2>게임 입력</h2><p>게임 입력 당시 코드명과 정산 요율이 자동 저장됩니다.</p></div></div>
          <div className="formGrid">
            <label>날짜<input type="date" value={gameDate} onChange={e=>setGameDate(e.target.value)}/></label><label>게임<input value={gameName} onChange={e=>setGameName(e.target.value)}/></label><label>플레이어<select value={gamePlayerId} onChange={e=>setGamePlayerId(e.target.value)}><option value="">플레이어 선택</option>{players.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>바이인<input type="number" value={gameBuyIn} onChange={e=>setGameBuyIn(e.target.value)}/></label><label>레이크<input type="number" value={gameRake} onChange={e=>setGameRake(e.target.value)}/></label><button className="primary formButton" onClick={addGameEntry}>게임 기록 추가</button>
          </div>
          <div className="tableWrap"><table><thead><tr><th>날짜</th><th>게임</th><th>플레이어</th><th>에이전트</th><th>적용 정산 요율</th><th>레이크</th><th>레이크백</th></tr></thead><tbody>{entries.length===0?<tr><td colSpan={7} className="empty">입력된 게임 기록이 없습니다.</td></tr>:[...entries].reverse().map(e=><tr key={e.id}><td>{e.date}</td><td>{e.game}</td><td>{getPlayerName(e.playerId)}</td><td>{e.agencyCodeSnapshot}</td><td>{e.rateSnapshot}%</td><td>{money.format(e.rake)}</td><td className="strong">{money.format(e.rakeback)}</td></tr>)}</tbody></table></div>
        </section>}

        {tab==="daily" && <section className="panel">
          <div className="sectionTitle"><div><h2>일일 정산</h2><p>날짜별 에이전트 정산액과 플레이어 내역을 확인합니다.</p></div><input className="datePicker" type="date" value={summaryDate} onChange={e=>setSummaryDate(e.target.value)}/></div>
          <div className="cards"><div className="metric"><span>총 레이크</span><b>{money.format(total(dailyEntries,"rake"))}</b></div><div className="metric"><span>총 에이전트 정산액</span><b>{money.format(total(dailyEntries,"rakeback"))}</b></div><div className="metric"><span>정산 후 순액</span><b>{money.format(total(dailyEntries,"rake")-total(dailyEntries,"rakeback"))}</b></div></div>
          <div className="agencyGrid">{agencyTotals(dailyEntries).map(a=><div className="agencyCard" key={a.id}><span>{a.code}</span><small>{a.rate}%</small><b>{money.format(a.amount)}</b></div>)}</div>
          <div className="tableWrap"><table><thead><tr><th>플레이어</th><th>에이전트</th><th>적용 정산 요율</th><th>레이크</th><th>레이크백</th></tr></thead><tbody>{dailyEntries.length===0?<tr><td colSpan={5} className="empty">해당 날짜의 기록이 없습니다.</td></tr>:dailyEntries.map(e=><tr key={e.id}><td>{getPlayerName(e.playerId)}</td><td>{e.agencyCodeSnapshot}</td><td>{e.rateSnapshot}%</td><td>{money.format(e.rake)}</td><td className="strong">{money.format(e.rakeback)}</td></tr>)}</tbody></table></div>
        </section>}

        {tab==="weekly" && <section className="panel">
          <div className="sectionTitle"><div><h2>주간 정산</h2><p>기간별 에이전트·플레이어 정산 결과를 확인합니다.</p></div><div className="dateRange"><input className="datePicker" type="date" value={weekStart} onChange={e=>setWeekStart(e.target.value)}/><span>~</span><input className="datePicker" type="date" value={weekEnd} onChange={e=>setWeekEnd(e.target.value)}/></div></div>
          <div className="cards"><div className="metric"><span>주간 총 레이크</span><b>{money.format(total(weeklyEntries,"rake"))}</b></div><div className="metric"><span>주간 총 에이전트 정산액</span><b>{money.format(total(weeklyEntries,"rakeback"))}</b></div><div className="metric"><span>주간 정산 후 순액</span><b>{money.format(total(weeklyEntries,"rake")-total(weeklyEntries,"rakeback"))}</b></div></div>
          <div className="agencyGrid">{agencyTotals(weeklyEntries).map(a=><div className="agencyCard" key={a.id}><span>{a.code}</span><small>현재 정산 요율 {a.rate}%</small><b>{money.format(a.amount)}</b></div>)}</div>
          <div className="sectionTitle compact"><div><h2>플레이어별 주간 정산</h2><p>각 게임 입력 당시 저장된 정산 요율을 기준으로 계산합니다.</p></div></div>
          <div className="tableWrap"><table><thead><tr><th>플레이어</th><th>에이전트</th><th>바이인</th><th>총 레이크</th><th>레이크백</th></tr></thead><tbody>{weeklyPlayerRows.length===0?<tr><td colSpan={5} className="empty">해당 기간의 정산 기록이 없습니다.</td></tr>:weeklyPlayerRows.map(r=><tr key={`${r.playerId}-${r.agency}`}><td>{r.playerName}</td><td>{r.agency}</td><td>{money.format(r.buyIn)}</td><td>{money.format(r.rake)}</td><td className="strong">{money.format(r.rakeback)}</td></tr>)}</tbody></table></div>
        </section>}

        {tab==="reports" && <section className="panel placeholderPanel"><h2>리포트</h2><p>에이전트별 정산 리포트와 다운로드 기능을 다음 단계에서 연결합니다.</p></section>}
        {tab==="settings" && <section className="panel placeholderPanel"><h2>설정</h2><p>권한, 에이전트 계정, 시스템 설정을 이곳에서 관리하게 됩니다.</p></section>}
      </div>
    </section>
  </main>;
}
