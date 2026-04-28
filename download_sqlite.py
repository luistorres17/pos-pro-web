import urllib.request
import os

os.makedirs('lib', exist_ok=True)
base_url = "https://unpkg.com/@sqlite.org/sqlite-wasm@3.45.1/sqlite-wasm/jswasm/"
files = ['sqlite3.mjs', 'sqlite3.wasm', 'sqlite3-opfs-async-proxy.js', 'sqlite3-worker1.js', 'sqlite3-worker1-promiser.js']

for f in files:
    print(f"Downloading {f}...")
    try:
        urllib.request.urlretrieve(base_url + f, 'lib/' + f)
        print(f"Success: {f}")
    except Exception as e:
        print(f"Error downloading {f}: {e}")
