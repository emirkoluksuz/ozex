# tv_bridge/bridge.py
import os, sys, time, requests

try:
    from dotenv import load_dotenv
    load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))
except Exception:
    pass

from ticker import ticker

API_URL = os.getenv("API_URL", "http://localhost:4000/api/internal/tv/prices")
SYMS = os.getenv("SYMS", "BINANCE:BTCUSDT,FOREXCOM:EURUSD,TVC:GOLD").split(",")
SECRET = os.getenv("TV_BRIDGE_SHARED_SECRET", "")  # zorunlu
ADMIN_KEY = os.getenv("ADMIN_API_KEY", "")         # opsiyonel
ORIGIN = os.getenv("BRIDGE_ORIGIN", "http://localhost:3000")
POST_INTERVAL_SEC = float(os.getenv("POST_INTERVAL_SEC", "0.5"))

_warned = {"secret": False}

def norm(tv_sym: str) -> str:
    return tv_sym.split(":")[-1]

def start_ticker():
    while True:
        try:
            print(f"[bridge] starting ticker for {SYMS}")
            t = ticker(SYMS, save=False, verbose=False)
            t.start()
            print("[bridge] ticker started")
            return t
        except Exception as e:
            print(f"[bridge][ERROR] ticker start failed: {e}")
            time.sleep(2)

def post_rows(rows):
    if not SECRET:
        if not _warned["secret"]:
            print("[bridge][ERROR] TV_BRIDGE_SHARED_SECRET is not set")
            _warned["secret"] = True
        return

    headers = {
        "X-Bridge-Secret": SECRET,
        "Origin": ORIGIN,
        "Content-Type": "application/json",
    }
    if ADMIN_KEY:
        headers["X-Admin-Key"] = ADMIN_KEY  # varsa gönder, yoksa boş verme

    try:
        resp = requests.post(API_URL, json={"source": "tv-bridge-01", "symbols": rows}, headers=headers, timeout=5)
        if resp.status_code != 204:
            print(f"[bridge][WARN] server {resp.status_code}: {resp.text}")
    except Exception as e:
        print(f"[bridge][ERROR] post failed: {e}")

def main():
    t = start_ticker()
    last_log = 0.0
    while True:
        rows = []
        try:
            for tvsym, d in (t.states or {}).items():
                last = d.get("price")
                if last is None:
                    continue
                rows.append({
                    "symbol": norm(tvsym),
                    "last": d.get("price"),
                    "change24h": d.get("changePercentage"),
                })
        except Exception as e:
            print(f"[bridge][ERROR] read states: {e}")

        if rows:
            post_rows(rows)
        else:
            now = time.monotonic()
            if now - last_log > 3:
                print("[bridge] no data yet… waiting for first ticks")
                last_log = now

        time.sleep(POST_INTERVAL_SEC)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n[bridge] stopping by user")
