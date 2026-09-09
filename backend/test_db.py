from supabase import create_client
import os
import uuid
import datetime
import json

url = os.environ.get("SUPABASE_URL", "https://qmsfckgohzofmmsxyytr.supabase.co")
key = os.environ.get("SUPABASE_KEY")
with open(".env") as f:
    for line in f:
        if line.startswith("SUPABASE_URL="): url = line.strip().split('=', 1)[1]
        if line.startswith("SUPABASE_KEY="): key = line.strip().split('=', 1)[1]

supabase = create_client(url, key)

tr_record = {
    "id": str(uuid.uuid4()),
    "country": "Test",
    "city": "Test",
    "language": "Test",
    "input_json": {"test": "val"},
    "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
}

try:
    print("Inserting test_run...")
    res = supabase.table("test_runs").insert(tr_record).execute()
    print("Success:", res)
except Exception as e:
    print("Error:", repr(e))
    if hasattr(e, 'details'): print("Details:", e.details)
    if hasattr(e, 'message'): print("Message:", e.message)
