"""Physical settlement of one block on the radial network. Leaf nodes export through their own
interconnection, then use their corridor to the hub; the hub balances through its interconnection.
Setpoints (battery power, generator caps, load changes) are applied first; what the network
cannot carry is curtailed, and load the hub cannot import is unserved."""

from dataclasses import dataclass, field

from app.sim.world import AssetSpec


@dataclass(frozen=True)
class LineSpec:
    code: str
    leaf: str
    hub: str


@dataclass
class Setpoints:
    battery_mw: dict[str, float] = field(default_factory=dict)  # + discharge, − charge
    gen_cap_mw: dict[str, float] = field(default_factory=dict)
    load_change_mw: dict[str, float] = field(default_factory=dict)  # added to a consumer's load


@dataclass
class Settlement:
    actual: dict[str, float] = field(default_factory=dict)  # MW; interconnection + import
    flow: dict[str, float] = field(default_factory=dict)  # MW towards the hub
    curtailed_mw: float = 0.0
    unserved_mw: float = 0.0


def _reduce(codes: list[str], actual: dict[str, float], amount: float) -> float:
    """Take up to `amount` off positive outputs pro rata; returns what could not be taken."""
    total = sum(max(actual[c], 0) for c in codes)
    cut = min(amount, total)
    for c in codes:
        if total > 0 and actual[c] > 0:
            actual[c] -= cut * actual[c] / total
    return amount - cut


def settle(assets: list[AssetSpec], lines: list[LineSpec], available: dict[str, float],
           line_limit: dict[str, float], setpoints: Setpoints) -> Settlement:
    s = Settlement()
    at = lambda node, kind: [a.code for a in assets if a.node == node and a.kind == kind]  # noqa: E731
    ic = {a.node: a for a in assets if a.kind == "interconnection"}
    for a in assets:
        if a.kind in ("solar", "wind"):
            s.actual[a.code] = min(available[a.code], setpoints.gen_cap_mw.get(a.code, available[a.code]))
        elif a.kind == "bess":
            s.actual[a.code] = setpoints.battery_mw.get(a.code, 0.0)
        elif a.kind == "consumer":
            s.actual[a.code] = max(available[a.code] + setpoints.load_change_mw.get(a.code, 0.0), 0.0)
    supply = lambda node: sum(s.actual[c] for kind in ("solar", "wind", "bess") for c in at(node, kind))  # noqa: E731

    hub_in = 0.0
    for line in lines:
        net = supply(line.leaf) - sum(s.actual[c] for c in at(line.leaf, "consumer"))
        link = ic.get(line.leaf)
        if net >= 0:
            export = min(net, link.params["export_max_mw"] if link else 0.0)
            flow = min(net - export, line_limit[line.code])
            excess = net - export - flow
            excess = _reduce(at(line.leaf, "solar") + at(line.leaf, "wind"), s.actual, excess)
            _reduce(at(line.leaf, "bess"), s.actual, excess)  # then less battery discharge
            exchange = -export
        else:
            flow = -min(-net, line_limit[line.code])
            imported = min(-net + flow, link.params["import_max_mw"] if link else 0.0)
            short = -net + flow - imported
            for c in at(line.leaf, "bess"):  # charge less when the leaf cannot draw enough
                take = min(short, max(-s.actual[c], 0))
                s.actual[c] += take
                short -= take
            exchange = imported
        if link:
            s.actual[link.code] = exchange
        s.flow[line.code] = flow
        hub_in += flow

    for hub in {line.hub for line in lines}:
        link = ic.get(hub)
        loads = at(hub, "consumer")
        net = supply(hub) + hub_in - sum(s.actual[c] for c in loads)
        if net >= 0:
            export = min(net, link.params["export_max_mw"] if link else 0.0)
            excess = _reduce(at(hub, "solar") + at(hub, "wind"), s.actual, net - export)
            if excess > 0:  # back off the corridors pro rata, curtailing their generators
                inflow = sum(max(f, 0) for f in s.flow.values())
                for line in lines:
                    share = excess * max(s.flow[line.code], 0) / inflow if inflow else 0
                    s.flow[line.code] -= share
                    left = _reduce(at(line.leaf, "solar") + at(line.leaf, "wind"), s.actual, share)
                    _reduce(at(line.leaf, "bess"), s.actual, left)
            exchange = -export
        else:
            exchange = min(-net, link.params["import_max_mw"] if link else 0.0)
            s.unserved_mw = -net - exchange
            _reduce(loads, s.actual, s.unserved_mw)
        if link:
            s.actual[link.code] = exchange

    s.curtailed_mw = sum(available[a.code] - s.actual[a.code] for a in assets if a.kind in ("solar", "wind"))
    return s
