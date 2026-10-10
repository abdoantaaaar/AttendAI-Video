import os
from collections import defaultdict

CONFIRM_HITS = int(os.getenv("FACE_CONFIRM_HITS", "3"))
_session_hits: dict[int, dict[int, list[float]]] = defaultdict(lambda: defaultdict(list))


def register_hit(session_id: int, user_id: int, score: float):
    scores = _session_hits[session_id][user_id]
    scores.append(score)
    if len(scores) > CONFIRM_HITS:
        del scores[:-CONFIRM_HITS]
    return len(scores), sum(scores) / len(scores)


def clear_session(session_id: int):
    _session_hits.pop(session_id, None)
