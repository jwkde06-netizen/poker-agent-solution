"""
Dream Poker on-premise monitor bridge.
Run on a PC connected to the 192.168.1.9 LAN.
Install: pip install playwright requests supabase
         python -m playwright install chromium
Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (NEVER NEXT_PUBLIC_).
Configure selectors after inspecting the actual MEDIA page.
Example: MONITOR_ROW_SELECTOR=".game-row" MONITOR_TABLE_SELECTOR=".table"
MONITOR_GAME_SELECTOR=".game" MONITOR_LEVEL_SELECTOR=".level"
MONITOR_ENTRIES_SELECTOR=".entries"
No rows / missing required selectors => nothing is published.
"""
import os,time,re,datetime,logging
from playwright.sync_api import sync_playwright
from supabase import create_client
logging.basicConfig(level=logging.INFO,format="%(asctime)s %(levelname)s %(message)s")
URL=os.getenv("MONITOR_URL","http://192.168.1.9:5855/MEDIA")
KEYS={"row":"MONITOR_ROW_SELECTOR","table":"MONITOR_TABLE_SELECTOR","game":"MONITOR_GAME_SELECTOR","level":"MONITOR_LEVEL_SELECTOR","entries":"MONITOR_ENTRIES_SELECTOR"}
selectors={k:os.getenv(env,"").strip() for k,env in KEYS.items()}
if not all(selectors.values()):
    raise SystemExit("Configure all MONITOR_*_SELECTOR environment variables after inspecting the real page DOM.")
url=os.environ["SUPABASE_URL"];key=os.environ["SUPABASE_SERVICE_ROLE_KEY"]
db=create_client(url,key)
def number(value):
    match=re.search(r"\d[\d,]*",value)
    return int(match.group().replace(",","")) if match else None
with sync_playwright() as playwright:
    browser=playwright.chromium.launch(headless=True)
    page=browser.new_page()
    while True:
        try:
            page.goto(URL,wait_until="domcontentloaded",timeout=12000)
            page.wait_for_timeout(1500)
            rows=page.locator(selectors["row"])
            result=[]
            for i in range(min(rows.count(),80)):
                row=rows.nth(i)
                def get(field):
                    el=row.locator(selectors[field]).first
                    return el.inner_text(timeout=900).strip() if el.count() else ""
                table=get("table");game=get("game");level=get("level");entries=get("entries")
                if not table or not game:continue
                table_match=re.search(r"\d+",table)
                if not table_match:continue
                result.append({"table_no":table_match.group(),"game":game[:100],"level":number(level),"entries":number(entries)})
            if result:
                db.table("live_monitor_snapshot").upsert({"id":1,"observed_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),"tables":result}).execute()
                logging.info("Synced %s monitor rows",len(result))
            else:logging.warning("No verified rows. Keeping previous snapshot; UI will mark it stale.")
        except Exception:logging.exception("Monitor fetch failed; keeping last valid snapshot")
        time.sleep(30)
