import type { OperationState } from "./Operations"
import { getHistoricalTransactions } from "./services/transactionService"

export const HISTORICAL_TRANSACTIONS = getHistoricalTransactions()

export function transactions(state: OperationState) {
  const request = state.approval
  if (!request) return HISTORICAL_TRANSACTIONS
  const status =
    request.decision === "pending"
      ? "Awaiting approval"
      : request.decision === "approved"
        ? request.executable
          ? "Executing"
          : "Failed"
        : request.decision === "rejected"
          ? "Rejected"
          : "Expired"
  return [
    {
      id: "grid-request",
      historical: false,
      date: "01 Oct, 14:50",
      type: "Grid Import",
      typeIcon: "/assets/c3b94.svg",
      initiator: request.decision === "pending" ? "BOB Agent" : "Administrator",
      initColor: "#525252",
      initBg: "#f4f4f4",
      initInitials: "AD",
      initIcon: "/assets/0d037.svg",
      initIsBot: request.decision === "pending",
      amount: "0 kWh",
      revenue: "₹0",
      revColor: "#525252",
      status,
      statusBg: "#edf5ff",
      statusColor: "#0f62fe",
      bg: "bg-white",
    },
    ...HISTORICAL_TRANSACTIONS,
  ]
}
