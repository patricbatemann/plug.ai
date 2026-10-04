"""A small vectorised builder over HiGHS: variables are numpy index arrays and constraint
families are added as whole matrices, which is ~1000x faster than per-term expressions."""

from dataclasses import dataclass

import highspy
import numpy as np

INF = highspy.kHighsInf


@dataclass
class Solution:
    status: str
    x: np.ndarray
    objective: float
    gap: float

    def __getitem__(self, idx: np.ndarray) -> np.ndarray:
        return self.x[idx]


class Model:
    def __init__(self) -> None:
        self.lb: list[np.ndarray] = []
        self.ub: list[np.ndarray] = []
        self.binary: list[np.ndarray] = []
        self.n = 0
        self.rows: list[tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray]] = []
        self.m = 0

    def var(self, shape: int | tuple[int, ...], lb: float | np.ndarray = 0.0, ub: float | np.ndarray = INF,
            binary: bool = False) -> np.ndarray:
        size = int(np.prod(shape))
        idx = np.arange(self.n, self.n + size).reshape(shape)
        self.lb.append(np.broadcast_to(np.asarray(lb, float), shape).ravel())
        self.ub.append(np.broadcast_to(np.asarray(ub, float), shape).ravel())
        self.binary.append(np.full(size, binary))
        self.n += size
        return idx

    def add(self, terms: list[tuple[np.ndarray, float | np.ndarray]], lb: float | np.ndarray = -INF,
            ub: float | np.ndarray = INF) -> None:
        """Add one row per entry of the leading axis: lb <= sum(coef * x[idx]) <= ub.
        Each term's idx is (m,) or (m, k); k columns are summed into the same row.
        coef is a scalar, one value per row (m,), or one per entry (m, k)."""
        m = len(terms[0][0])
        if m == 0:  # e.g. inter-block constraints on a one-block horizon
            return
        cols, vals, rows = [], [], []
        for idx, coef in terms:
            idx = np.asarray(idx).reshape(m, -1)
            cols.append(idx.ravel())
            vals.append(np.broadcast_to(np.asarray(coef, float).reshape(-1, 1) if np.ndim(coef) == 1
                                        else np.asarray(coef, float), idx.shape).ravel())
            rows.append(np.repeat(np.arange(m), idx.shape[1]))
        self.rows.append((
            np.concatenate(rows) + self.m, np.concatenate(cols), np.concatenate(vals),
            np.broadcast_to(np.asarray(lb, float), (m,)).ravel(), np.broadcast_to(np.asarray(ub, float), (m,)).ravel(),
        ))
        self.m += m

    def solve(self, cost: np.ndarray, time_limit: float, mip_gap: float) -> Solution:
        h = highspy.Highs()
        h.setOptionValue("output_flag", False)
        h.setOptionValue("time_limit", time_limit)
        h.setOptionValue("mip_rel_gap", mip_gap)
        lb, ub = np.concatenate(self.lb), np.concatenate(self.ub)
        h.addVars(self.n, lb, ub)
        h.changeColsCost(self.n, np.arange(self.n, dtype=np.int32), cost)
        binary = np.flatnonzero(np.concatenate(self.binary)).astype(np.int32)
        if len(binary):
            h.changeColsIntegrality(len(binary), binary, np.full(len(binary), highspy.HighsVarType.kInteger))
        row, col, val = (np.concatenate([r[i] for r in self.rows]) for i in range(3))
        order = np.lexsort((col, row))
        row, col, val = row[order], col[order], val[order]
        starts = np.searchsorted(row, np.arange(self.m)).astype(np.int32)
        h.addRows(self.m, np.concatenate([r[3] for r in self.rows]), np.concatenate([r[4] for r in self.rows]),
                  len(val), starts, col.astype(np.int32), val)
        h.run()
        status = h.getModelStatus()
        info = h.getInfo()
        has_solution = info.primal_solution_status == 2  # feasible
        x = np.array(h.getSolution().col_value) if has_solution else np.zeros(self.n)
        return Solution(
            status=h.modelStatusToString(status), x=x,
            objective=info.objective_function_value if has_solution else float("nan"),
            gap=info.mip_gap if len(binary) else 0.0,
        )
