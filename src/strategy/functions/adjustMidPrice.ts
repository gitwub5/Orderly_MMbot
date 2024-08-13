
// 중립 평균 가격 조정 함수
export async function adjustMidPrice(lastPrice: number, Q: number, stdDev: number, T: number, t: number, gamma: number): Promise<number> {
    return lastPrice - Q * gamma * Math.pow(stdDev, 2) * (T - t);
}