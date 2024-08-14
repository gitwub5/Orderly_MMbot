// 전략 설정을 위한 인터페이스
export interface StrategyConfig {
    symbol: string; // 거래할 암호화폐 페어 (예: 'BTC-USD')
    precision: number; // 가격 소수점 자리 수
    orderQuantity: number; // 각 주문의 수량
    tradePeriodMs: number; // 거래 주기, 밀리초 단위 (예: 1분 = 60000 밀리초)
    stdDevPeriod: number; // 표준 편차를 계산할 최근 거래 수 (예: 최근 50번의 거래)
    orderLevels: number; // 주문 레벨 수
    orderSpacing: number; // 주문 간격 비율
    takeProfitRatio: number; // 이익 실현 비율
    stopLossRatio: number; // 손절매 비율
    gamma: number; // 리스크 회피 계수
    k: number; // 시장 조건 관련 상수
    threshold: number; // 표준 편차 임계값 (백테스팅 필요)
}
