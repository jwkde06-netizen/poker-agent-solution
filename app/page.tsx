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

function toDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getMonday(dateString: string) {
  const date = new Date(`${dateString}T00:00:00`);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return toDateString(date);
}

function addDays(dateString: string, days: number) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toDateString(date);
}

export default function Home() {
  const today = toDateString(new Date());

  const [tab, setTab] = useState<
    "agencies" | "players" | "games" | "daily" | "weekly"
  >("agencies");
  const [agencies, setAgencies] = useState<Agency[]>(DEFAULT_AGENCIES);
  const [players, setPlayers] = useState<Player[]>([]);
  const [entries, setEntries] = useState<GameEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [newAgencyCode, setNewAgencyCode] = useState("");
  const [newAgencyRate, setNewAgencyRate] = useState("25");

  const [playerName, setPlayerName] = useState("");
  const [playerCard, setPlayerCard] = useState("");
  const [playerAgencyId, setPlayerAgencyId] = useState("agency-korea2");

  const [gameDate, setGameDate] = useState(today);
  const [gameName, setGameName] = useState("5M");
  const [gamePlayerId, setGamePlayerId] = useState("");
  const [gameBuyIn, setGameBuyIn] = useState("1");
  const [gameRake, setGameRake] = useState("500000");

  const [summaryDate, setSummaryDate] = useState(today);
  const defaultWeekStart = getMonday(today);
  const [weekStart, setWeekStart] = useState(defaultWeekStart);
  const [weekEnd, setWeekEnd] = useState(addDays(defaultWeekStart, 6));

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

  const weeklyEntries = useMemo(
    () => entries.filter((e) => e.date >= weekStart && e.date <= weekEnd),
    [entries, weekStart, weekEnd]
  );

  const dailyTotalRake = dailyEntries.reduce((sum, e) => sum + e.rake, 0);
  const dailyTotalRakeback = dailyEntries.reduce((sum, e) => sum + e.rakeback, 0);

  const dailyAgencyTotals = agencies.map((agency) => ({
    ...agency,
    amount: dailyEntries
      .filter((e) => e.agencyId === agency.id)
      .reduce((sum, e) => sum + e.rakeback, 0),
  }));

  const weeklyTotalRake = weeklyEntries.reduce((sum, e) => sum + e.rake, 0);
  const weeklyTotalRakeback = weeklyEntries.reduce((sum, e) => sum + e.rakeback, 0);

  const weeklyAgencyTotals = agencies.map((agency) => ({
    ...agency,
    amount: weeklyEntries
      .filter((e) => e.agencyId === agency.id)
      .reduce((sum, e) => sum + e.rakeback, 0),
  }));

  const weeklyPlayerRows = useMemo(() => {
    const map = new Map<
      string,
      {
        playerId: string;
        playerName: string;
        agency: string;
        buyIn: number;
        rake: number;
        rakeback: number;
      }
    >();

    weeklyEntries.forEach((entry) => {
      const key = `${entry.playerId}::${entry.agencyId}`;
      const current = map.get(key);
      if (current) {
        current.buyIn += entry.buyIn;
        current.rake += entry.rake;
        current.rakeback += entry.rakeback;
      } else {
        map.set(key, {
          playerId: entry.playerId,
          playerName: getPlayerName(entry.playerId),
          agency: entry.agencyCodeSnapshot,
          buyIn: entry.buyIn,
          rake: entry.rake,
          rakeback: entry.rakeback,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) =>
      a.agency.localeCompare(b.agency) || a.playerName.localeCompare(b.playerName)
    );
  }, [weeklyEntries, players]);

  function addAgency() {
    const code = newAgencyCode.trim().toUpperCase();
    const rate = Number(newAgencyRate);
    if (!code || Number.isNaN(rate) || rate < 0 || rate > 100) return;
    if (agencies.some((a) => a.code.toUpperCase() === code)) {
      alert("이미 존재하는 코드입니다.");
      return;
    }

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

  function updatePlayerAgency(playerId: string, agencyId: string) {
    setPlayers((prev) =>
      prev.map((player) =>
        player.id === playerId ? { ...player, agencyId } : player
      )
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
    if (!player) {
      alert("플레이어를 선택해주세요.");
      return;
    }

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
    return players.find((p) => p.id === playerId)?.name ?? "알 수 없음";
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">DREAM · 에이전트 운영</p>
          <h1>포커 에이전트 통합 정산</h1>
          <p className="sub">
            플레이어 등록부터 코드별 레이크백, 일일·주간 정산까지 한 곳에서 관리합니다.
          </p>
        </div>
        <div className="status">MVP · 브라우저 저장 모드</div>
      </header>

      <nav className="tabs">
        <button className={tab === "agencies" ? "active" : ""} onClick={() => setTab("agencies")}>에이전트 코드</button>
        <button className={tab === "players" ? "active" : ""} onClick={() => setTab("players")}>플레이어 명단</button>
        <button className={tab === "games" ? "active" : ""} onClick={() => setTab("games")}>게임 입력</button>
        <button className={tab === "daily" ? "active" : ""} onClick={() => setTab("daily")}>일일 정산</button>
        <button className={tab === "weekly" ? "active" : ""} onClick={() => setTab("weekly")}>주간 정산</button>
      </nav>

      {tab === "agencies" && (
        <section className="panel">
          <div className="sectionTitle">
            <div>
              <h2>에이전트 코드 관리</h2>
              <p>코드명과 레이크백 요율은 언제든 변경할 수 있습니다.</p>
            </div>
          </div>

          <div className="inlineForm">
            <input
              placeholder="새 코드명"
              value={newAgencyCode}
              onChange={(e) => setNewAgencyCode(e.target.value)}
            />
            <input
              type="number"
              min="0"
              max="100"
              value={newAgencyRate}
              onChange={(e) => setNewAgencyRate(e.target.value)}
            />
            <span className="suffix">%</span>
            <button className="primary" onClick={addAgency}>+ 코드 추가</button>
          </div>

          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>내부 ID</th>
                  <th>코드명</th>
                  <th>레이크백 요율</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody>
                {agencies.map((agency) => (
                  <tr key={agency.id}>
                    <td className="muted mono">{agency.id}</td>
                    <td>
                      <input
                        className="cellInput"
                        value={agency.code}
                        onChange={(e) =>
                          updateAgency(agency.id, {
                            code: e.target.value.toUpperCase(),
                          })
                        }
                      />
                    </td>
                    <td>
                      <div className="rateCell">
                        <input
                          className="cellInput rate"
                          type="number"
                          min="0"
                          max="100"
                          value={agency.rate}
                          onChange={(e) =>
                            updateAgency(agency.id, {
                              rate: Number(e.target.value),
                            })
                          }
                        />
                        <span>%</span>
                      </div>
                    </td>
                    <td>
                      <button
                        className={agency.active ? "pill on" : "pill"}
                        onClick={() =>
                          updateAgency(agency.id, { active: !agency.active })
                        }
                      >
                        {agency.active ? "사용 중" : "사용 중지"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="note">
            예: KOREA2를 HOUSE2로 바꿔도 내부 ID는 그대로 유지되므로 기존 플레이어 연결은 깨지지 않습니다. 요율을 변경해도 과거 게임은 당시 저장된 요율로 유지됩니다.
          </div>
        </section>
      )}

      {tab === "players" && (
        <section className="panel">
          <div className="sectionTitle">
            <div>
              <h2>플레이어 명단</h2>
              <p>플레이어를 등록하고 담당 에이전트 코드를 지정합니다.</p>
            </div>
          </div>

          <div className="formGrid">
            <label>
              플레이어
              <input
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="플레이어 이름"
              />
            </label>
            <label>
              카드 번호
              <input
                value={playerCard}
                onChange={(e) => setPlayerCard(e.target.value)}
                placeholder="선택 입력"
              />
            </label>
            <label>
              에이전트 코드
              <select
                value={playerAgencyId}
                onChange={(e) => setPlayerAgencyId(e.target.value)}
              >
                {activeAgencies.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} · {a.rate}%
                  </option>
                ))}
              </select>
            </label>
            <button className="primary formButton" onClick={addPlayer}>
              플레이어 등록
            </button>
          </div>

          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>플레이어</th>
                  <th>카드 번호</th>
                  <th>에이전트 코드</th>
                  <th>현재 요율</th>
                </tr>
              </thead>
              <tbody>
                {players.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="empty">등록된 플레이어가 없습니다.</td>
                  </tr>
                ) : (
                  players.map((player) => {
                    const agency = agencies.find((x) => x.id === player.agencyId);
                    return (
                      <tr key={player.id}>
                        <td>{player.name}</td>
                        <td>{player.cardNo || "-"}</td>
                        <td>
                          <select
                            className="cellInput"
                            value={player.agencyId}
                            onChange={(e) =>
                              updatePlayerAgency(player.id, e.target.value)
                            }
                          >
                            {agencies.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.code}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>{agency?.rate ?? 0}%</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "games" && (
        <section className="panel">
          <div className="sectionTitle">
            <div>
              <h2>게임 입력</h2>
              <p>게임 입력 시점의 코드명과 요율이 자동으로 저장됩니다.</p>
            </div>
          </div>

          <div className="formGrid">
            <label>
              날짜
              <input type="date" value={gameDate} onChange={(e) => setGameDate(e.target.value)} />
            </label>
            <label>
              게임
              <input value={gameName} onChange={(e) => setGameName(e.target.value)} />
            </label>
            <label>
              플레이어
              <select value={gamePlayerId} onChange={(e) => setGamePlayerId(e.target.value)}>
                <option value="">플레이어 선택</option>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
            <label>
              바이인
              <input type="number" value={gameBuyIn} onChange={(e) => setGameBuyIn(e.target.value)} />
            </label>
            <label>
              레이크
              <input type="number" value={gameRake} onChange={(e) => setGameRake(e.target.value)} />
            </label>
            <button className="primary formButton" onClick={addGameEntry}>
              게임 기록 추가
            </button>
          </div>

          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>날짜</th>
                  <th>게임</th>
                  <th>플레이어</th>
                  <th>에이전트</th>
                  <th>적용 요율</th>
                  <th>레이크</th>
                  <th>레이크백</th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="empty">입력된 게임 기록이 없습니다.</td>
                  </tr>
                ) : (
                  [...entries].reverse().map((entry) => (
                    <tr key={entry.id}>
                      <td>{entry.date}</td>
                      <td>{entry.game}</td>
                      <td>{getPlayerName(entry.playerId)}</td>
                      <td>{entry.agencyCodeSnapshot}</td>
                      <td>{entry.rateSnapshot}%</td>
                      <td>{money.format(entry.rake)}</td>
                      <td className="strong">{money.format(entry.rakeback)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "daily" && (
        <section className="panel">
          <div className="sectionTitle">
            <div>
              <h2>일일 정산</h2>
              <p>날짜별 에이전트 지급액과 플레이어 정산 내역입니다.</p>
            </div>
            <input
              className="datePicker"
              type="date"
              value={summaryDate}
              onChange={(e) => setSummaryDate(e.target.value)}
            />
          </div>

          <div className="cards">
            <div className="metric">
              <span>총 레이크</span>
              <b>{money.format(dailyTotalRake)}</b>
            </div>
            <div className="metric">
              <span>총 에이전트 지급액</span>
              <b>{money.format(dailyTotalRakeback)}</b>
            </div>
            <div className="metric">
              <span>지급 후 순액</span>
              <b>{money.format(dailyTotalRake - dailyTotalRakeback)}</b>
            </div>
          </div>

          <div className="agencyGrid">
            {dailyAgencyTotals.map((a) => (
              <div className="agencyCard" key={a.id}>
                <span>{a.code}</span>
                <small>{a.rate}%</small>
                <b>{money.format(a.amount)}</b>
              </div>
            ))}
          </div>

          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>플레이어</th>
                  <th>에이전트</th>
                  <th>적용 요율</th>
                  <th>레이크</th>
                  <th>레이크백</th>
                </tr>
              </thead>
              <tbody>
                {dailyEntries.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="empty">해당 날짜의 기록이 없습니다.</td>
                  </tr>
                ) : (
                  dailyEntries.map((entry) => (
                    <tr key={entry.id}>
                      <td>{getPlayerName(entry.playerId)}</td>
                      <td>{entry.agencyCodeSnapshot}</td>
                      <td>{entry.rateSnapshot}%</td>
                      <td>{money.format(entry.rake)}</td>
                      <td className="strong">{money.format(entry.rakeback)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "weekly" && (
        <section className="panel">
          <div className="sectionTitle">
            <div>
              <h2>주간 정산</h2>
              <p>기간을 지정해 에이전트별·플레이어별 정산을 확인합니다.</p>
            </div>
            <div className="dateRange">
              <input
                className="datePicker"
                type="date"
                value={weekStart}
                onChange={(e) => setWeekStart(e.target.value)}
              />
              <span>~</span>
              <input
                className="datePicker"
                type="date"
                value={weekEnd}
                onChange={(e) => setWeekEnd(e.target.value)}
              />
            </div>
          </div>

          <div className="cards">
            <div className="metric">
              <span>주간 총 레이크</span>
              <b>{money.format(weeklyTotalRake)}</b>
            </div>
            <div className="metric">
              <span>주간 총 에이전트 지급액</span>
              <b>{money.format(weeklyTotalRakeback)}</b>
            </div>
            <div className="metric">
              <span>주간 지급 후 순액</span>
              <b>{money.format(weeklyTotalRake - weeklyTotalRakeback)}</b>
            </div>
          </div>

          <div className="agencyGrid">
            {weeklyAgencyTotals.map((a) => (
              <div className="agencyCard" key={a.id}>
                <span>{a.code}</span>
                <small>현재 요율 {a.rate}%</small>
                <b>{money.format(a.amount)}</b>
              </div>
            ))}
          </div>

          <div className="sectionTitle compact">
            <div>
              <h2>플레이어별 주간 정산</h2>
              <p>실제 지급액은 각 게임 입력 당시 저장된 요율을 기준으로 계산됩니다.</p>
            </div>
          </div>

          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>플레이어</th>
                  <th>에이전트</th>
                  <th>바이인</th>
                  <th>총 레이크</th>
                  <th>레이크백</th>
                </tr>
              </thead>
              <tbody>
                {weeklyPlayerRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="empty">해당 기간의 정산 기록이 없습니다.</td>
                  </tr>
                ) : (
                  weeklyPlayerRows.map((row) => (
                    <tr key={`${row.playerId}-${row.agency}`}>
                      <td>{row.playerName}</td>
                      <td>{row.agency}</td>
                      <td>{money.format(row.buyIn)}</td>
                      <td>{money.format(row.rake)}</td>
                      <td className="strong">{money.format(row.rakeback)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
