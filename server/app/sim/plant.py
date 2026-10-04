"""Physical settlement of one block on the radial network: leaf nodes export through their
own interconnection, then feed the hub over their corridor; the hub balances through its interconnection.
Generation that cannot leave a node is curtailed; load the hub cannot import is unserved."""

from dataclasses import dataclass, field

from app.sim.world import AssetSpec


@dataclass(frozen=True)
class LineSpec:
    code: str
    leaf: str
    hub: str


@dataclass
class Settlement:
    actual: dict[str, float] = field(default_factory=dict)  # asset code -> MW (interconnection: + import)
    flow: dict[str, float] = field(default_factory=dict)  # line code -> MW towards the hub
    curtailed_mw: float = 0.0
    unserved_mw: float = 0.0


def _scale(codes: list[str], available: dict[str, float], keep: float, out: dict[str, float]) -> float:
    """Dispatch `codes` pro rata so they total `keep`; returns the amount cut."""
    total = sum(available[c] for c in codes)
    ratio = min(1.0, keep / total) if total > 0 else 0.0
    for c in codes:
        out[c] = available[c] * ratio
    return total - total * ratio


def settle(assets: list[AssetSpec], lines: list[LineSpec], available: dict[str, float],
           line_limit: dict[str, float]) -> Settlement:
    s = Settlement()
    at = lambda node, *kinds: [a for a in assets if a.node == node and a.kind in kinds]  # noqa: E731
    ic_of = lambda node: next(iter(at(node, "interconnection")), None)  # noqa: E731
    for a in assets:
        if a.kind == "bess":
            s.actual[a.code] = 0.0  # idle until the optimiser dispatches batteries

    hub_in = 0.0
    hubs = {line.hub for line in lines}
    for line in lines:
        gens = [a.code for a in at(line.leaf, "solar", "wind")]
        surplus = sum(available[c] for c in gens)
        ic = ic_of(line.leaf)
        export_room = ic.params["export_max_mw"] if ic else 0.0
        export = min(surplus, export_room)
        flow = min(surplus - export, line_limit[line.code])
        s.curtailed_mw += _scale(gens, available, flow + export, s.actual)
        s.flow[line.code] = flow
        if ic:
            s.actual[ic.code] = -export
        hub_in += flow

    for hub in hubs:
        gens = [a.code for a in at(hub, "solar", "wind")]
        loads = [a.code for a in at(hub, "consumer")]
        ic = ic_of(hub)
        gen = sum(available[c] for c in gens)
        demand = sum(available[c] for c in loads)
        net = gen + hub_in - demand
        if net >= 0:
            export = min(net, ic.params["export_max_mw"] if ic else 0.0)
            excess = net - export
            # Excess comes off local generation first, then off the corridors pro rata.
            cut_local = min(excess, gen)
            s.curtailed_mw += _scale(gens, available, gen - cut_local, s.actual)
            remaining = excess - cut_local
            if remaining > 0 and hub_in > 0:
                for line in lines:
                    share = remaining * s.flow[line.code] / hub_in
                    s.flow[line.code] -= share
                    leaf_gens = [a.code for a in at(line.leaf, "solar", "wind")]
                    leaf_total = sum(s.actual[c] for c in leaf_gens)
                    for c in leaf_gens:
                        s.actual[c] -= share * s.actual[c] / leaf_total if leaf_total else 0
                s.curtailed_mw += remaining
            for c in loads:
                s.actual[c] = available[c]
            if ic:
                s.actual[ic.code] = -export
        else:
            imported = min(-net, ic.params["import_max_mw"] if ic else 0.0)
            s.unserved_mw = -net - imported
            for c in gens:
                s.actual[c] = available[c]
            _scale(loads, available, demand - s.unserved_mw, s.actual)
            if ic:
                s.actual[ic.code] = imported
    return s
