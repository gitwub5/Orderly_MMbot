// 최적 스프레드 계산 함수
export async function calculateOptimalSpread(stdDev: number, T: number, t: number, gamma: number, k: number): Promise<number> {
    return gamma * Math.pow(stdDev, 2) * (T - t) + (2 / gamma) * Math.log(1 + (gamma / k));
}
