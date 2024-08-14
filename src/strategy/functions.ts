import { fixPrecision } from "../utils/fixPrecision";
import { OrderBookResponse } from "interfaces";

// 최적 스프레드 계산 함수
export async function calculateOptimalSpread(stdDev: number, T: number, t: number, gamma: number, k: number): Promise<number> {
    return gamma * Math.pow(stdDev, 2) * (T - t) + (2 / gamma) * Math.log(1 + (gamma / k));
}

// 중립 평균 가격 조정 함수
export async function adjustMidPrice(lastPrice: number, Q: number, stdDev: number, T: number, t: number, gamma: number): Promise<number> {
    return lastPrice - Q * gamma * Math.pow(stdDev, 2) * (T - t);
}

// 비드 및 애스크 가격 설정 함수
export function setBidAskPrices(neutralPrice: number, priceOffset: number, precision: number): { bidPrice: number, askPrice: number } {
    const bidPrice = fixPrecision(neutralPrice - priceOffset, precision);
    const askPrice = fixPrecision(neutralPrice + priceOffset, precision);
    return { bidPrice, askPrice };
}

// 동적 주문 간격 조정 함수 
export async function adjustOrderSpacing(baseSpacing: number, stdDev: number, stdDevThreshold: number): Promise<number> {
    if (stdDev > stdDevThreshold) {
        // 변동성이 높으면 주문 간격을 넓힘
        return baseSpacing * 1.3;
    } else {
        return baseSpacing;
    }
}

// 동적 주문 크기 조정 함수 (보류)
export async function adjustPositionSize(baseSize: number, stdDev: number, stdDevThreshold: number): Promise<number> {
    if (stdDev > stdDevThreshold) {
        // 변동성이 높으면 포지션 크기를 줄임
        return baseSize * 0.8;
    } else {
        return baseSize;
    }
}

// 지수 감소 기반 주문 크기 계산 함수 (보류)
export async function calculateOrderQuantity(baseQuantity: number, level: number): Promise<number> {
    const decayFactor = 0.9; // 감소 비율
    const quantity = baseQuantity * Math.pow(decayFactor, level - 1);
    return Math.round(quantity * 10) / 10; // 첫째 자리까지 반올림
}

export function predictPriceMovement(orderBook: OrderBookResponse['data'], threshold: number): number {
    const totalBidQuantity = orderBook.bids.reduce((total, bid) => total + bid.quantity, 0);
    const totalAskQuantity = orderBook.asks.reduce((total, ask) => total + ask.quantity, 0);
  
    const totalQuantity = totalBidQuantity + totalAskQuantity;
    const bidPercentage = (totalBidQuantity / totalQuantity) * 100;
    const askPercentage = (totalAskQuantity / totalQuantity) * 100;
    
    console.log(bidPercentage, askPercentage);
    //const threshold = 55;  // N% 이상 차이가 나면 높은 가능성으로 판단
  
    if (bidPercentage > threshold) {
      return 1;  // 확실한 가격 상승 가능성
    } else if (askPercentage > threshold) {
      return -1;  // 확실한 가격 하락 가능성
    } else {
      return 0;  // 변동 없음 또는 예측 불확실
    }
  }


// 지연 시간을 주기 위한 함수
export function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}