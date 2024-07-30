import { fixPrecision } from "../utils/fixPrecision";

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

// 동적 주문 크기 조정 함수
export async function adjustPositionSize(baseSize: number, stdDev: number, stdDevThreshold: number): Promise<number> {
    if (stdDev > stdDevThreshold) {
        // 변동성이 높으면 포지션 크기를 줄임
        return baseSize * 0.8;
    } else {
        return baseSize;
    }
}

// 동적 주문 간격 조정 함수
export async function adjustOrderSpacing(baseSpacing: number, stdDev: number, stdDevThreshold: number): Promise<number> {
    if (stdDev > stdDevThreshold) {
        // 변동성이 높으면 주문 간격을 넓힘
        return baseSpacing * 1.2;
    } else {
        return baseSpacing;
    }
}

// 지수 감소 기반 주문 크기 계산 함수
export async function calculateOrderQuantity(baseQuantity: number, level: number): Promise<number> {
    const decayFactor = 0.9; // 감소 비율
    const quantity = baseQuantity * Math.pow(decayFactor, level - 1);
    return Math.round(quantity * 10) / 10; // 첫째 자리까지 반올림
}