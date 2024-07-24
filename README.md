# Orderly Market Making Strategy

이 프로젝트는 암호화폐 거래소에서 자동으로 매수 및 매도 주문을 배치하여 시장 조성 역할을 하는 간단한 시장 조성 전략을 구현합니다. 이 전략은 특정 간격으로 현재 시장 상황을 분석하고, 주문을 배치하고 조정하는 작업을 반복합니다.

## 주요 목적

- 오더북 채우기
- 손실 최소화
- 스프레드 안에서 거래량 많이 내기

## 주요 구성 요소

### StrategyConfig 인터페이스

- `symbol`: 거래할 암호화폐 페어 (예: 'BTC-USD').
- `orderQuantity`: 각 주문의 수량.
- `tradePeriodMs`: 거래 주기, 밀리초 단위 (예: 1분 = 60000 밀리초).
- `stdDevPeriod`: 표준 편차를 계산할 최근 거래 수 (예: 최근 50번의 거래).
- `orderLevels`: 주문 레벨 수.
- `orderSpacing`: 주문 간격 비율.
- `takeProfitRatio`: 이익 실현 비율.
- `stopLossRatio`: 손절매 비율.
- `gamma`: 리스크 회피 계수.
- `k`: 시장 조건 관련 상수.

### MarketMakingStrategy 클래스

이 클래스는 시장 조성 전략을 실행합니다. 주요 메서드는 다음과 같습니다:

- `executeStrategy()`: 전략을 실행합니다. 초기 주문을 배치하고, 일정한 주기로 주문을 모니터링 및 조정합니다.
- `spreadOrder()`: 최신 시세 데이터와 표준 편차를 바탕으로 중립 평균 가격을 계산하고, 여러 레벨의 매수 및 매도 주문을 배치합니다.
- `fillOrderBook()`: 여러 레벨의 매수 및 매도 주문을 배치하여 오더북을 채웁니다.
- `calculateOptimalSpread()`: 자산 가격의 분산과 시장 메이커의 리스크 회피 계수를 기반으로 스프레드를 동적으로 조정합니다.
- `adjustMidPrice()`: 중립 평균 가격을 조정하여 시장 메이커의 인벤토리를 반영합니다.
- `setBidAskPrices()`: 비드 및 애스크 가격을 중립 가격을 기준으로 설정합니다.

### 함수 설명

#### 1. Optimal Spread Formula
스프레드를 동적으로 조정하는 함수입니다. 자산 가격의 분산과 시장 메이커의 리스크 회피 계수를 기반으로 스프레드를 계산합니다.
```typescript
function calculateOptimalSpread(stdDev: number, T: number, t: number, gamma: number, k: number): number {
    return gamma * Math.pow(stdDev, 2) * (T - t) + (gamma / k) * Math.log(1 + (gamma / k));
}
```

#### 2. Mid Price Adjustment
중립 평균 가격을 조정하여 시장 메이커의 인벤토리를 반영합니다.
```typescript
function adjustMidPrice(lastPrice: number, Q: number, stdDev: number, T: number, t: number, gamma: number): number {
    return lastPrice - Q * gamma * Math.pow(stdDev, 2) * (T - t);
}
```

#### 3.Price Setting
비드 및 애스크 가격을 중립 가격을 기준으로 설정합니다.
```typescript
function setBidAskPrices(neutralPrice: number, priceOffset: number, A: number, B: number): { bidPrice: number, askPrice: number } {
    const askPrice = Math.max(A, neutralPrice + priceOffset);
    const bidPrice = Math.min(B, neutralPrice - priceOffset);
    return { bidPrice, askPrice };
}
```

#### 4.Spread Order
최신 시세 데이터와 표준 편차를 바탕으로 중립 평균 가격을 계산하고, 여러 레벨의 매수 및 매도 주문을 배치합니다.
```typescript
async function spreadOrder(client: MainClient, config: StrategyConfig) {
    const { symbol, orderQuantity, stdDevPeriod, orderLevels, orderSpacing, takeProfitRatio, stopLossRatio, gamma, k } = config;

    // 최신 시세 데이터 및 현재 포지션, 표준 편차 가져오기
    const tickerData = await client.getTicker(symbol);
    const openPosition = (await client.getOnePosition(config.symbol)).data.average_open_price;
    const lastPrice = parseFloat(tickerData.ticker.last);
    const stdDev = await client.getStandardDeviation(symbol, stdDevPeriod);

    // 최적 스프레드 계산
    const T = 1; // 총 거래 시간 (예: 하루를 1로 설정)
    const t = 0; // 현재 시간 (예: 거래 시작 시점은 0으로 설정)
    const optimalSpread = calculateOptimalSpread(stdDev, T, t, gamma, k);

    // 중립 평균 가격 계산 및 조정
    const neutralPrice = adjustMidPrice(lastPrice, openPosition, stdDev, T, t, gamma);

    // 기존 주문 취소
    const openOrders = await client.getOpenOrders();
    for (const order of openOrders.orders) {
        await client.cancelOrder(symbol, order.id);
    }

    // 여러 레벨의 매수 및 매도 주문 배치
    for (let level = 1; level <= orderLevels; level++) {
        const priceOffset = orderSpacing * level * stdDev;
        const { bidPrice, askPrice } = setBidAskPrices(neutralPrice, priceOffset, lastPrice * 0.95, lastPrice * 1.05);

        // 매수 주문 배치
        if (bidPrice > lastPrice * (1 - stopLossRatio) && bidPrice < lastPrice * (1 + takeProfitRatio)) {
            await client.placeOrder(symbol, 'LIMIT', 'BUY', parseFloat(bidPrice.toFixed(4)), orderQuantity);
        }

        // 매도 주문 배치
        if (askPrice < lastPrice * (1 + takeProfitRatio) && askPrice > lastPrice * (1 - stopLossRatio)) {
            await client.placeOrder(symbol, 'LIMIT', 'SELL', parseFloat(askPrice.toFixed(4)), orderQuantity);
        }
    }
}
```