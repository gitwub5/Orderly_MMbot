import { MainClient } from '../src/client/main.client.ts';
import { RestAPIUrl } from '../src/enums';
import { accountInfo } from '../src/utils/account';

// 테스트를 위한 설정
const symbol = 'PERP_TON_USDC';
const orderQuantity = 2;
const orderPrice = 6.1111; // 예시 가격, 실제 가격이 아닐 수 있음

// MainClient 인스턴스 생성
const client = new MainClient(accountInfo, RestAPIUrl.mainnet);

async function testMainClient() {
    try {
        // 잔고 확인
        console.log('Testing getBalances...');
        const balances = await client.getBalances();
        console.log('Balances:', balances);

        // 특정 포지션 확인
        console.log('Testing getOnePosition...');
        const position = await client.getOnePosition(symbol);
        console.log('Position:', position);

        // 거래 기록 확인
        console.log('Testing getTradeHistory...');
        const tradeHistory = await client.getTradeHistory(symbol, 10);
        console.log('Trade History:', tradeHistory);

        // 주문 배치
        console.log('Testing placeOrder...');
        const orderResponse = await client.placeOrder(symbol, 'LIMIT', 'BUY', orderPrice, orderQuantity);
        console.log('Order Response:', orderResponse);

        // 주문 취소
        if (orderResponse && orderResponse.data) {
            console.log('Testing cancelOrder...');
            const cancelResponse = await client.cancelOrder(symbol, orderResponse.data.order_id);
            console.log('Cancel Response:', cancelResponse);
        }

        // 표준 편차 계산
        console.log('Testing getStandardDeviation...');
        const stdDev = await client.getStandardDeviation(symbol, 10);
        console.log('Standard Deviation:', stdDev);

        // 오더북 스프레드 확인
        console.log('Testing getOrderBookSpread...');
        const spread = await client.getOrderBookSpread(symbol);
        console.log('Order Book Spread:', spread);

    } catch (error) {
        console.error('Test failed:', error);
    }
}

// 테스트 실행
testMainClient();