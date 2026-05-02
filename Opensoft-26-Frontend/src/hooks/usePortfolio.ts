import { useCallback, useEffect, useState } from 'react';
import { useLiveMarket } from './useLiveMarket'; // Assuming useLiveMarket is in the same directory
import * as api from '../services/api';

export type PositionView = {
  symbol: string;
  quantity: number;
  avg_entry: number;
  mark_price: number;
  pnl: number;
};

export type PortfolioSnapshot = {
  user_id: string;
  total_cash: number;
  available_cash: number;
  blocked_cash: number;
  positions: PositionView[];
  total_pnl: number;
  equity: number;
  updated_at: string;
};

const EMPTY_SNAPSHOT: PortfolioSnapshot = {
  user_id: '',
  total_cash: 100_000,
  available_cash: 100_000,
  blocked_cash: 0,
  positions: [],
  total_pnl: 0,
  equity: 100_000,
  updated_at: new Date().toISOString(),
};

export function usePortfolio() {
  const feed = useLiveMarket();
  const [snapshot, setSnapshot] = useState<PortfolioSnapshot>(EMPTY_SNAPSHOT);
  const [loaded, setLoaded] = useState(false);

  const loadSnapshot = useCallback(async () => {
    const res = await api.getPortfolio();
    if (res.success && res.data) {
      setSnapshot(res.data as PortfolioSnapshot);
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    const handleUpdate = (newSnapshot: PortfolioSnapshot) => {
      // Recalculate equity locally in case the server-sent equity is stale
      const holdingsValue = (newSnapshot.positions || []).reduce(
        (s, p) => s + p.mark_price * Math.abs(p.quantity),
        0
      );
      setSnapshot({
        ...newSnapshot,
        equity: (newSnapshot.available_cash || 0) + (newSnapshot.blocked_cash || 0) + holdingsValue,
      });
      setLoaded(true);
    };

    const handleMarketTick = (marketSnap: any) => {
      setSnapshot((prev) => {
        if (!prev.positions || prev.positions.length === 0) return prev;
        let changed = false;

        const newPositions = prev.positions.map(p => {
          let currentPrice = p.mark_price;
          const mktPos = marketSnap.positions?.find((mp: any) => mp.asset === p.symbol);
          if (mktPos && mktPos.markPrice > 0) {
            currentPrice = mktPos.markPrice;
          } else {
            const trend = marketSnap.trendingStocks?.find((ts: any) => ts.symbol === p.symbol);
            if (trend && trend.price > 0) {
              currentPrice = trend.price;
            }
          }

          if (Math.abs(currentPrice - p.mark_price) > 0.00001) {
            changed = true;
            return {
              ...p,
              mark_price: currentPrice,
              pnl: (currentPrice - p.avg_entry) * Math.abs(p.quantity),
            };
          }
          return p;
        });

        if (!changed) return prev;

        const totalPnl = newPositions.reduce((acc, p) => acc + p.pnl, 0);
        const holdingsValue = newPositions.reduce((s, p) => s + p.mark_price * Math.abs(p.quantity), 0);

        return {
          ...prev,
          positions: newPositions,
          total_pnl: totalPnl,
          equity: (prev.available_cash || 0) + (prev.blocked_cash || 0) + holdingsValue,
          updated_at: new Date().toISOString(),
        };
      });
    };

    // Subscribe to portfolio updates from the live market feed
    const unsubscribePort = feed.onPortfolioUpdate(handleUpdate);
    const unsubscribeMarket = feed.subscribe(handleMarketTick);

    // Initial fetch
    loadSnapshot();

    return () => {
      unsubscribePort();
      unsubscribeMarket();
    };
  }, [feed, loadSnapshot]);

  const refresh = useCallback(async () => {
    return loadSnapshot()
  }, [loadSnapshot]);

  return { snapshot, refresh, feed, loaded };
}
