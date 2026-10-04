import transactionsData from '../mock/transactions.json';

export interface HistoricalTransaction {
  id: string;
  date: string;
  type: string;
  typeIcon: string;
  initiator: string;
  initColor: string;
  initBg: string;
  initIcon?: string;
  initInitials?: string;
  initIsBot: boolean;
  amount: string;
  revenue: string;
  revColor: string;
  status: string;
  statusBg: string;
  statusColor: string;
  bg: string;
  historical: boolean;
}

/**
 * Service function to retrieve historical transaction records.
 */
export function getHistoricalTransactions(): HistoricalTransaction[] {
  return transactionsData.historicalTransactions as HistoricalTransaction[];
}
