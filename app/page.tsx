"use client";

import { useEffect, useMemo, useState } from "react";

type Agency = {
  id: string;
  code: string;
  rate: number;
  active: boolean;
};

type Player = {
  id: string;
  name: string;
  cardNo: string;
  agencyId: string;
};

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

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function Home() {
  const [tab, setTab] = useState<"agencies" | "players" | "games" | "daily">("agencies");
  const [agencies, setAgencies] = useState<Agency[]>(DEFAULT_AGENCIES);
  const [players, setPlayers] = useState<Player[]>([]);
  const [entries, setEntries] = useState<GameEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [newAgencyCode, setNewAgencyCode] = useState("");
  const [newAgencyRate, setNewAgencyRate] = useState("25");

  const [playerName, setPlayerName] = useState("");
  const [playerCard, setPlayerCard] = useState("");
  const [playerAgencyId, setPlayerAgencyId] = useState("agency-korea2");

  const [gameDate, setGameDate] = useState(new Date().toISOString().slice(0, 10));
  const [gameName, setGameName] = useState("5M");
  const [gamePlayerId, setGamePlayerId] = useState("");
  const [gameBuyIn, setGameBuyIn] = useState("1");
  const [gameRake, setGameRake] = useState("500000");
  const [summaryDate, setSummaryDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(
      "poker-agent-solution-v1",
      JSON.stringify({ agencies, players, entries })
    );
  }, [agencies, players, entries, loaded]);

  const activeAgencies = agencies.filter((a) => a.active);

  const dailyEntries = useMemo(
    () => entries.filter((e) => e.date === summaryDate),
    [entries, summaryDate]
  );

  const dailyTotalRake = dailyEntries.reduce((sum, e) => sum + e.rake, 0);
  const dailyTotalRakeback = dailyEntries.reduce((sum, e) => sum + e.rakeback, 0);

  const agencyTotals = activeAgencies.map((agency) => ({
    ...agency,
    amount: dailyEntries
      .filter((e) => e.agencyId === agency.id)
      .reduce((sum, e) => sum + e.rakeback, 0),
  }));

  function addAgency() {
    const code = newAgencyCode.trim().toUpperCase();
    const rate = Number(newAgencyRate);
    if (!code || Number.isNaN(rate) || rate < 0 || rate > 100) return;
    if (agencies.some((a) => a.code.toUpperCase() === code)) return;
    setAgencies((prev) => [
      ...prev,
      { id: uid("agency"), code, rate, active: true },
    ]);
    setNewAgencyCode("");
  }

  function updateAgency(id: string, patch: Partial<Agency>) {
    setAgencies((prev) =>
      prev.map((agency) => (agency.id === id ? { ...agency, ...patch } : agency))
    );
  }

  function addPlayer() {
    const name = playerName.trim().toUpperCase();
    if (!name || !playerAgencyId) return;
    const newPlayer: Player = {
      id: uid("player"),
      name,
      cardNo: playerCard.trim(),
      agencyId: playerAgencyId,
    };
    setPlayers((prev) => [...prev, newPlayer]);
    setGamePlayerId(newPlayer.id);
    setPlayerName("");
    setPlayerCard("");
  }

  function addGameEntry() {
    const player = players.find((p) => p.id === gamePlayerId);
    if (!player) return;
    const agency = agencies.find((a) => a.id === player.agencyId);
    if (!agency) return;

    const buyIn = Number(gameBuyIn);
    const rake = Number(gameRake);
    if (!gameDate || Number.isNaN(buyIn) || Number.isNaN(rake) || rake < 0) return;

    const rateSnapshot = agency.rate;
    const rakeback = Math.round(rake * (rateSnapshot / 100));

    setEntries((prev) => [
      ...prev,
      {
        id: uid("entry"),
        date: gameDate,
        game: gameName,
        playerId: player.id,
        buyIn,
        rake,
        agencyId: agency.id,
        agencyCodeSnapshot: agency.code,
        rateSnapshot,
        rakeback,
      },
    ]);
  }

  function getPlayerName(playerId: string) {
    return players.find((p) => p.id === playerId)?.name ?? "Unknown";
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">DREAM / AGENT OPERATIONS</p>
          <h1>Poker Agent Settlement</h1>
          <p className="sub">
            Agency code를 자유롭게 만들고 수정해도 내부 ID는 유지됩니다.
          </p>
        </div>
        <div className="status">MVP · Local Mode</div>
      </header>

      <nav className="tabs">
        <button className={tab === "agencies" ? "active" : ""} onClick={() => setTab("agencies")}>Agency Codes</button>
        <button className={tab === "players" ? "active" : ""} onClick={() => setTab("players")}>Players</button>
        <button className={tab === "games" ? "active" : ""} onClick={() => setTab("games")}>Game Input</button>
        <button className={tab === "daily" ? "active" : ""} onClick={() => setTab("daily")}>Daily Settlement</button>
      </nav>

      {tab === "agencies" && (
        <section className="panel">
          <div className="sectionTitle">
            <div>
              <h2>Agency Code Management</h2>
              <p>코드명과 요율은 언제든 변경할 수 있습니다.</p>
            </div>
          </div>

          <div className="inlineForm">
            <input placeholder="NEW CODE" value={newAgencyCode} onChange={(e) => setNewAgencyCode(e.target.value)} />
            <input type="number" min="0" max="100" value={newAgencyRate} onChange={(e) => setNewAgencyRate(e.target.value)} />
            <span className="suffix">%</span>
            <button className="primary" onClick={addAgency}>+ Add Code</button>
          </div>

          <div className="tableWrap">
            <table>
              <thead>
                <tr><th>INTERNAL ID</th><th>CODE</th><th>RAKEBACK RATE</th><th>STATUS</th></tr>
              </thead>
              <tbody>
                {agencies.map((agency) => (
                  <tr key={agency.id}>
                    <td className="muted mono">{agency.id}</td>
                    <td><input className="cellInput" value={agency.code} onChange={(e) => updateAgency(agency.id, { code: e.target.value.toUpperCase() })} /></td>
                    <td><div className="rateCell"><input className="cellInput rate" type="number" min="0" max="100" value={agency.rate} onChange={(e) => updateAgency(agency.id, { rate: Number(e.target.value) })} /><span>%</span></div></td>
                    <td><button className={agency.active ? "pill on" : "pill"} onClick={() => updateAgency(agency.id, { active: !agency.active })}>{agency.active ? "ACTIVE" : "INACTIVE"}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="note">
            이름을 KOREA2 → HOUSE2로 바꿔도 내부 ID는 유지되므로 기존 플레이어 연결이 깨지지 않습니다.
          </div>
        </section>
      )}

      {tab === "players" && (
        <section className="panel">
          <div className="sectionTitle"><div><h2>Player Registration</h2><p>플레이어마다 Agency Code를 지정합니다.</p></div></div>
          <div className="formGrid">
            <label>PLAYER<input value={playerName} onChange={(e) => setPlayerName(e.target.value)} placeholder="PLAYER NAME" /></label>
            <label>CARD NO.<input value={playerCard} onChange={(e) => setPlayerCard(e.target.value)} placeholder="OPTIONAL" /></label>
            <label>AGENCY<select value={playerAgencyId} onChange={(e) => setPlayerAgencyId(e.target.value)}>{activeAgencies.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.rate}%</option>)}</select></label>
            <button className="primary formButton" onClick={addPlayer}>Register Player</button>
          </div>
          <div className="tableWrap">
            <table><thead><tr><th>PLAYER</th><th>CARD NO.</th><th>AGENCY</th><th>CURRENT RATE</th></tr></thead>
              <tbody>{players.length === 0 ? <tr><td colSpan={4} className="empty">No players yet.</td></tr> : players.map((p) => {
                const a = agencies.find((x) => x.id === p.agencyId);
                return <tr key={p.id}><td>{p.name}</td><td>{p.cardNo || "-"}</td><td>{a?.code ?? "-"}</td><td>{a?.rate ?? 0}%</td></tr>;
              })}</tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "games" && (
        <section className="panel">
          <div className="sectionTitle"><div><h2>Game Input</h2><p>입력 시점의 코드명과 요율을 스냅샷으로 저장합니다.</p></div></div>
          <div className="formGrid">
            <label>DATE<input type="date" value={gameDate} onChange={(e) => setGameDate(e.target.value)} /></label>
            <label>GAME<input value={gameName} onChange={(e) => setGameName(e.target.value)} /></label>
            <label>PLAYER<select value={gamePlayerId} onChange={(e) => setGamePlayerId(e.target.value)}><option value="">Select player</option>{players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
            <label>BUY IN<input type="number" value={gameBuyIn} onChange={(e) => setGameBuyIn(e.target.value)} /></label>
            <label>RAKE<input type="number" value={gameRake} onChange={(e) => setGameRake(e.target.value)} /></label>
            <button className="primary formButton" onClick={addGameEntry}>Add Entry</button>
          </div>
          <div className="tableWrap">
            <table><thead><tr><th>DATE</th><th>GAME</th><th>PLAYER</th><th>AGENCY</th><th>RATE</th><th>RAKE</th><th>RAKEBACK</th></tr></thead>
              <tbody>{entries.length === 0 ? <tr><td colSpan={7} className="empty">No game entries yet.</td></tr> : [...entries].reverse().map((e) => <tr key={e.id}><td>{e.date}</td><td>{e.game}</td><td>{getPlayerName(e.playerId)}</td><td>{e.agencyCodeSnapshot}</td><td>{e.rateSnapshot}%</td><td>{money.format(e.rake)}</td><td className="strong">{money.format(e.rakeback)}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "daily" && (
        <section className="panel">
          <div className="sectionTitle"><div><h2>Daily Settlement</h2><p>날짜별 에이전시 지급액과 플레이어 내역을 확인합니다.</p></div><input className="datePicker" type="date" value={summaryDate} onChange={(e) => setSummaryDate(e.target.value)} /></div>
          <div className="cards">
            <div className="metric"><span>TOTAL RAKE</span><b>{money.format(dailyTotalRake)}</b></div>
            <div className="metric"><span>TOTAL AGENT PAYOUT</span><b>{money.format(dailyTotalRakeback)}</b></div>
            <div className="metric"><span>NET AFTER PAYOUT</span><b>{money.format(dailyTotalRake - dailyTotalRakeback)}</b></div>
          </div>
          <div className="agencyGrid">
            {agencyTotals.map((a) => <div className="agencyCard" key={a.id}><span>{a.code}</span><small>{a.rate}%</small><b>{money.format(a.amount)}</b></div>)}
          </div>
          <div className="tableWrap">
            <table><thead><tr><th>PLAYER</th><th>AGENCY</th><th>RATE SNAPSHOT</th><th>RAKE</th><th>RAKEBACK</th></tr></thead>
              <tbody>{dailyEntries.length === 0 ? <tr><td colSpan={5} className="empty">No records for this date.</td></tr> : dailyEntries.map((e) => <tr key={e.id}><td>{getPlayerName(e.playerId)}</td><td>{e.agencyCodeSnapshot}</td><td>{e.rateSnapshot}%</td><td>{money.format(e.rake)}</td><td className="strong">{money.format(e.rakeback)}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
