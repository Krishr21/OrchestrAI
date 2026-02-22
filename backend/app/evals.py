from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class EvalResult:
    provider: str
    scores: dict[str, Any]
    notes: str | None = None


def offline_basic_eval(input_prompt: str, final_output: str | None) -> EvalResult:
    """Free/offline evaluation.

    This intentionally avoids any LLM/API calls.

    Metrics (simple heuristics):
    - non_empty_output
    - output_length
    - mentions_prompt_keywords (naive)
    """

    text = (final_output or "").strip()
    non_empty = bool(text)
    output_length = len(text)

    # Very naive keyword overlap: split prompt into words and see overlap.
    prompt_words = {w.lower().strip(".,:;!?()[]{}\"'") for w in input_prompt.split() if len(w) > 3}
    out_words = {w.lower().strip(".,:;!?()[]{}\"'") for w in text.split()}
    overlap = len(prompt_words.intersection(out_words))

    return EvalResult(
        provider="offline_basic",
        scores={
            "non_empty_output": non_empty,
            "output_length": output_length,
            "keyword_overlap": overlap,
        },
        notes="Offline heuristic eval (no external calls).",
    )
