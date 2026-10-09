"""Dream Poker LAN scoreboard collector (Playwright).
Run on a machine on the same LAN as 192.168.1.9.
pip install playwright supabase
python -m playwright install chromium
export SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...
python tools/live_monitor_bridge.py

The collector clicks event rows on the same URL, rather than assuming event-specific URLs.
It deliberately NEVER guesses a physical table number from a tournament name.
"""
import os,re,time,logging,datetime
from playwright.sync_api import sync_playwright
from supabase import create_client

logging.basicConfig(level=logging.INFO,format="%(asctime)s %(levelname)s %(message)s")
URL=os.getenv("MONITOR_URL","http://192.168.1.9:5855/MEDIA")
INTERVAL=max(15,int(os.getenv("MONITOR_INTERVAL_SECONDS","30")))
db=create_client(os.environ["SUPABASE_URL"],os.environ["SUPABASE_SERVICE_ROLE_KEY"])

def extract(text,pattern):
    match=re.search(pattern,text,re.I|re.M)
    return match.group(1).strip() if match else None

def integer(value):
    if not value:return None
    match=re.search(r"\d[\d,]*",value)
    return int(match.group().replace(",","")) if match else None

def read_scoreboard(page,name):
    # Reading document.body text avoids coupling to unverified CSS class names.
    text=page.locator("body").inner_text(timeout=5000)
    level=integer(extract(text,r"LEVEL\s*(\d+)"))
    entries=extract(text,r"ENTRIES\s*(\d[\d,]*(?:\s*/\s*\d[\d,]*)?)")
    blinds=extract(text,r"BLINDS\s*:?\s*([\d,]+\s*/\s*[\d,]+)")
    rebuy=extract(text,r"REBUYS\s*/\s*ADDONS\s*(\d+\s*/\s*\d+)")
    if level is None or entries is None:
        logging.warning("Missing level/entries for %s; skipping",name)
        return None
    current=integer(entries.split("/")[0])
    return {"event_name":name,"table_no":None,"game":name,"level":level,
            "entries":current,"entries_display":entries,"blinds":blinds,
            "rebuys_addons":rebuy}

def event_names(page):
    # The event menu shown in the provided screenshot is headed Events / Description.
    # Clicking its header or menu trigger may vary between installations.
    if not page.get_by_text("Description",exact=True).first.is_visible():
        menu=page.get_by_text("Events",exact=True)
        if menu.count(): menu.first.click(timeout=2000)
        else:
            for selector in ['button:has-text("Events")','[title="Events"]','[aria-label="Events"]']:
                if page.locator(selector).count():
                    page.locator(selector).first.click(timeout=2000);break
    page.get_by_text("Description",exact=True).first.wait_for(timeout=5000)
    # Locate distinct visible event names rather than scraping unrelated labels.
    texts=page.locator("body").inner_text().splitlines()
    description_index=next((i for i,x in enumerate(texts) if x.strip()=="Description"),-1)
    if description_index<0:raise RuntimeError("Events list not found")
    names=[]
    for line in texts[description_index+1:]:
        item=line.strip()
        if not item:continue
        if item in ("×","X","Close"):break
        if re.fullmatch(r"(?:CLASH\s+\d+\s+No\.\s*\d+|FREAKY FRIDAY|SATURDAY MILLION|SUPER SUNDAY|[A-Za-z][A-Za-z0-9 .-]{4,75})",item,re.I):
            if item not in names:names.append(item)
        if len(names)>=70:break
    if not names:raise RuntimeError("No event titles found; inspect Events DOM")
    return names

def collect(page):
    page.goto(URL,wait_until="domcontentloaded",timeout=15000)
    page.wait_for_timeout(1000)
    names=event_names(page)
    result=[]
    for name in names:
        try:
            # Menu can disappear after selection. Open it on every iteration.
            if not page.get_by_text("Description",exact=True).first.is_visible():event_names(page)
            candidate=page.get_by_text(name,exact=True)
            if not candidate.count():
                logging.warning("Event %s not in current list",name);continue
            candidate.first.click(timeout=3000)
            page.wait_for_timeout(450)
            row=read_scoreboard(page,name)
            if row:result.append(row)
        except Exception:
            logging.exception("Could not read %s",name)
    return result

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    page=browser.new_page(viewport={"width":1600,"height":900})
    while True:
        try:
            rows=collect(page)
            if rows:
                db.table("live_monitor_snapshot").upsert({
                  "id":1,
                  "observed_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),
                  "tables":rows
                }).execute()
                logging.info("Published %d verified events",len(rows))
            else:
                logging.warning("No verified events, leaving previous snapshot untouched")
        except Exception:
            logging.exception("Collection failed; previous snapshot remains")
        time.sleep(INTERVAL)
