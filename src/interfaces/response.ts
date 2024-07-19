//Order Client Interfaces
export interface OrderResponse {
  success: boolean;
  id: string;
  [key: string]: any;
}

//Account Client Interfaces
export interface BalanceResponse {
  success: boolean;
  data: {
    holding: {
      updated_time: number;
      token: string;
      holding: number;
      frozen: number;
      pending_short: number;
    }[];
  };
  timestamp: number;
}

export interface PositionResponse {
  success: boolean;
  timestamp: number;
  data: {
      symbol: string;
      position_qty: number;
      cost_position: number;
      last_sum_unitary_funding: number;
      pending_long_qty: number;
      pending_short_qty: number;
      settle_price: number;
      average_open_price: number;
      unsettled_pnl: number;
      mark_price: number;
      est_liq_price: number;
      timestamp: number;
      mmr: number;
      imr: number;
      IMR_withdraw_orders: number;
      MMR_with_orders: number;
      pnl_24_h: number;
      fee_24_h: number;
  };
}

export interface PositionsResponse {
  success: boolean;
  timestamp: number;
  data: {
    current_margin_ratio_with_orders: number;
    free_collateral: number;
    initial_margin_ratio: number;
    initial_margin_ratio_with_orders: number;
    maintenance_margin_ratio: number;
    maintenance_margin_ratio_with_orders: number;
    margin_ratio: number;
    open_margin_ratio: number;
    total_collateral_value: number;
    total_pnl_24_h: number;
    rows: {
      IMR_withdraw_orders: number;
      MMR_with_orders: number;
      average_open_price: number;
      cost_position: number;
      est_liq_price: number;
      fee_24_h: number;
      imr: number;
      last_sum_unitary_funding: number;
      mark_price: number;
      mmr: number;
      pending_long_qty: number;
      pending_short_qty: number;
      pnl_24_h: number;
      position_qty: number;
      settle_price: number;
      symbol: string;
      timestamp: number;
      unsettled_pnl: number;
    }[];
  };
}

export interface TradeHistoryResponse {
  success: boolean;
  timestamp: number;
  data: {
    meta: {
      total: number;
      records_per_page: number;
      current_page: number;
    };
    rows: {
      id: number;
      symbol: string;
      fee: number;
      fee_asset: string;
      side: string;
      order_id: number;
      executed_price: number;
      executed_quantity: number;
      executed_timestamp: number;
      is_maker: number;
      realized_pnl: number;
    }[];
  };
}

//Market Clinet Interfaces
export interface MarketInfoResponse {
  success: boolean;
  timestamp: number;
  data: {
    rows: {
      symbol: string;
      index_price: number;
      mark_price: number;
      sum_unitary_funding: number;
      est_funding_rate: number;
      last_funding_rate: number;
      next_funding_time: number;
      open_interest: string | null;
      "24h_open": number;
      "24h_close": number;
      "24h_high": number;
      "24h_low": number;
      "24h_amount": number;
      "24h_volume": number;
    }[];
  };
}

export interface MarketTradeResponse {
  success: boolean;
  timestamp: number;
  data: {
    rows: {
      symbol: string;
      side: string;
      executed_price: number;
      executed_quantity: number;
      executed_timestamp: number;
    }[];
  };
}

export interface OrderBookResponse {
  success: boolean;
  timestamp: number;
  data: {
    asks: {
      price: number;
      quantity: number;
    }[];
    bids: {
      price: number;
      quantity: number;
    }[];
    timestamp: number;
  };
}