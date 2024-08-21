import winston from 'winston';

// 지연 시간을 주기 위한 함수
export function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function delayWithCountdown(ms: number, logger: winston.Logger) {
    const interval = 5000; // 1초 간격
    let remainingTime = ms;

    while (remainingTime > 0) {
        logger.info(`Remaining Time: ${remainingTime / 1000} seconds`);
        await delay(interval);
        remainingTime -= interval;
    }
}