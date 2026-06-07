"""
VDT Zero-Trust DMS — Diff Engine Microservice (Luồng 18).

Bọc thuật toán diff thành service luôn chạy nền (keep-alive) để NestJS gọi qua HTTP,
tránh cold-start nặng và cô lập tải CPU khỏi event-loop của Node.

POST /diff  { "v1_url": "<presigned>", "v2_url": "<presigned>" }
  -> tải 2 file text (raw_text đã bóc tách) qua presigned URL, chạy difflib,
     trả về { statistics: {additions, deletions}, diffDeltas: [...] }.
"""
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import difflib
import httpx

app = FastAPI(title="VDT DMS Diff Engine", version="0.1.0")


class DiffRequest(BaseModel):
    v1_url: str
    v2_url: str


@app.get("/health")
def health():
    return {"status": "ok"}


async def _fetch_text(url: str) -> str:
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        return resp.text


@app.post("/diff")
async def compute_diff(req: DiffRequest):
    try:
        text_v1 = await _fetch_text(req.v1_url)
        text_v2 = await _fetch_text(req.v2_url)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Không tải được file để so sánh: {exc}")

    lines_v1 = text_v1.splitlines()
    lines_v2 = text_v2.splitlines()

    sm = difflib.SequenceMatcher(a=lines_v1, b=lines_v2, autojunk=False)
    deltas = []
    additions = 0
    deletions = 0

    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal":
            count = i2 - i1
            sample = "\n".join(lines_v1[i1:i2])
            deltas.append({"type": "unchanged", "count": count, "value": sample})
        elif tag == "delete":
            value = "\n".join(lines_v1[i1:i2])
            deletions += i2 - i1
            deltas.append({"type": "removed", "value": value})
        elif tag == "insert":
            value = "\n".join(lines_v2[j1:j2])
            additions += j2 - j1
            deltas.append({"type": "added", "value": value})
        elif tag == "replace":
            removed = "\n".join(lines_v1[i1:i2])
            added = "\n".join(lines_v2[j1:j2])
            deletions += i2 - i1
            additions += j2 - j1
            deltas.append({"type": "removed", "value": removed})
            deltas.append({"type": "added", "value": added})

    return {
        "statistics": {"additions": additions, "deletions": deletions},
        "diffDeltas": deltas,
    }
