import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

token = os.getenv("WHATSAPP_TOKEN")
phone_id = os.getenv("WHATSAPP_PHONE_ID")
version = os.getenv("WHATSAPP_API_VERSION")
to = os.getenv("WHATSAPP_TEST_TO")

missing = [
    name for name, value in {
        "WHATSAPP_TOKEN": token,
        "WHATSAPP_PHONE_ID": phone_id,
        "WHATSAPP_API_VERSION": version,
        "WHATSAPP_TEST_TO": to,
    }.items() if not value
]
if missing:
    sys.exit("Missing in backend/.env: " + ", ".join(missing))

url = f"https://graph.facebook.com/{version}/{phone_id}/messages"
payload = {
    "messaging_product": "whatsapp",
    "to": to,
    "type": "template",
    "template": {"name": "hello_world", "language": {"code": "en_US"}},
}

request = urllib.request.Request(
    url,
    data=json.dumps(payload).encode(),
    headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    },
    method="POST",
)


try:
    with urllib.request.urlopen(request, timeout=20) as response:
        raw_body = response.read().decode()
        body = json.loads(raw_body)

        print("HTTP status:", response.status)
        print("Meta response:")
        print(json.dumps(body, indent=2))

        message_id = body.get("messages", [{}])[0].get("id")
        if message_id:
            print("\nMeta accepted the message request.")
            print("Message ID:", message_id)
            print("Note: Delivery is not yet confirmed.")
        else:
            print("\nNo message ID was returned. Check the response above.")

except urllib.error.HTTPError as err:
    raw_body = err.read().decode(errors="replace")

    print("HTTP status:", err.code)
    print("Meta error response:")

    try:
        detail = json.loads(raw_body).get("error", {})
        print(json.dumps(detail, indent=2))
    except json.JSONDecodeError:
        print(raw_body)

    sys.exit(1)

except urllib.error.URLError as err:
    sys.exit(f"Could not reach Meta: {err.reason}")

except (KeyError, IndexError, json.JSONDecodeError) as err:
    sys.exit(f"Unexpected response from Meta: {err}")
