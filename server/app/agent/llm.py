"""BOB's model: Azure OpenAI through Chat Completions with a manual tool loop.

Chat Completions, not the Responses API: the deployment answers 500 to every Responses call, and
on Chat Completions function tools require reasoning_effort "none". Each turn streams, writes
one agent_call row, and raises Unavailable on any failure so the caller falls back to rules."""

import json
import logging
import re
import time
from collections.abc import Callable, Iterator
from dataclasses import dataclass
from functools import cache

from openai import OpenAI, pydantic_function_tool
from pydantic import BaseModel, ValidationError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.run import AgentCall


@dataclass
class Tool:
    args: type[BaseModel]  # its docstring is the description the model sees
    run: Callable[[BaseModel], dict]


class Unavailable(Exception):
    pass


def ready() -> bool:
    return bool(settings.bob_enabled and settings.microsoft_azure_openai_endpoint
                and settings.microsoft_azure_openai_key and settings.microsoft_azure_openai_deployment_name)


@cache
def _client() -> OpenAI:
    # A Foundry project URL may end in /responses; the SDK wants the /openai/v1/ base.
    base = re.sub(r"responses/?$", "", settings.microsoft_azure_openai_endpoint).rstrip("/") + "/"
    return OpenAI(base_url=base, api_key=settings.microsoft_azure_openai_key, max_retries=1)


def turn(db: Session, purpose: str, messages: list[dict], tools: dict[str, Tool], *, run_id: int,
         cycle_id: int | None = None, budget_s: float, done: Callable[[], bool] = lambda: False,
         ) -> Iterator[tuple[str, str]]:
    """Call the model and its tools until it answers in text or `done()`, streaming as it goes:
    yields ("delta", text) for model output and ("tool", name) as each tool starts. `messages`
    is extended in place with every assistant and tool message."""
    if not ready():
        raise Unavailable("BOB is switched off or not configured")
    specs = [pydantic_function_tool(t.args, name=name) for name, t in tools.items()]
    log = AgentCall(run_id=run_id, cycle_id=cycle_id, purpose=purpose,
                    deployment=settings.microsoft_azure_openai_deployment_name, input_tokens=0, output_tokens=0,
                    cached_tokens=0, tool_calls=0, outcome="ok")
    started = time.monotonic()

    def remaining() -> float:
        left = budget_s - (time.monotonic() - started)
        if left <= 0:
            raise Unavailable("time budget exceeded")
        return left

    try:
        while True:
            text, calls = "", {}
            with _client().chat.completions.create(
                model=settings.microsoft_azure_openai_deployment_name, messages=messages, tools=specs,
                tool_choice="auto", reasoning_effort="none", stream=True, stream_options={"include_usage": True},
                timeout=remaining()) as stream:
                for chunk in stream:
                    remaining()  # the client timeout bounds each read, not the whole answer
                    if chunk.usage:
                        log.input_tokens += chunk.usage.prompt_tokens
                        log.output_tokens += chunk.usage.completion_tokens
                        details = chunk.usage.prompt_tokens_details
                        log.cached_tokens += (details.cached_tokens or 0) if details else 0
                    for choice in chunk.choices:
                        if choice.delta.content:
                            text += choice.delta.content
                            yield "delta", choice.delta.content
                        for part in choice.delta.tool_calls or []:  # tool calls arrive in pieces, by index
                            call = calls.setdefault(part.index, {"id": "", "type": "function",
                                                                 "function": {"name": "", "arguments": ""}})
                            call["id"] = part.id or call["id"]
                            if part.function:
                                call["function"]["name"] += part.function.name or ""
                                call["function"]["arguments"] += part.function.arguments or ""
            message = {"role": "assistant", "content": text or None,
                       **({"tool_calls": list(calls.values())} if calls else {})}
            messages.append({k: v for k, v in message.items() if v is not None})
            if not calls:
                return
            for call in calls.values():
                log.tool_calls += 1
                if log.tool_calls > settings.bob_max_tool_calls:
                    raise Unavailable("tool call budget exceeded")
                yield "tool", call["function"]["name"]
                messages.append({"role": "tool", "tool_call_id": call["id"],
                                 "content": json.dumps(_call(tools, call["function"]), default=str)})
            if done():
                return
    except GeneratorExit:  # the operator closed the stream
        log.outcome, log.error = "fallback", "client disconnected"
        raise
    except Exception as error:
        if not isinstance(error, Unavailable):
            logging.exception("BOB turn failed")
        log.outcome, log.error = "fallback", f"{type(error).__name__}: {error}"[:300]
        raise Unavailable(log.error) from error
    finally:
        log.latency_ms = round((time.monotonic() - started) * 1000)
        db.add(log)


def _call(tools: dict[str, Tool], function: dict) -> dict:
    tool = tools.get(function["name"])
    if tool is None:
        return {"error": f"Unknown tool {function['name']}"}
    try:
        args = tool.args.model_validate_json(function["arguments"])
    except ValidationError as error:
        return {"error": str(error)}
    try:
        return tool.run(args)
    except ValueError as error:  # a domain rule said no; the model may correct and retry
        return {"error": str(error)}
