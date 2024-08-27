import { MainClient } from "../../client/main.client";

// 모든 주문 취소 및 포지션 청산 함수
export async function cancelAllOrdersAndClosePositions(client: MainClient, symbol: string) {
    try {
        console.log('Canceling all orders...');
        await client.cancelAllOrders(symbol); // 모든 주문 취소

        console.log('Closing all positions...');
        const position = (await client.getOnePosition(symbol)).data; // 포지션 개수 들고와서 시장가 주문으로 포지션 정리
        if (position.position_qty !== 0) {
            const side = position.position_qty > 0 ? 'SELL' : 'BUY'; 
            console.log(`Closing position - Side: ${side}, Quantity: ${Math.abs(position.position_qty)}`);
            await client.placeOrder(symbol, 'MARKET', side, null, Math.abs(position.position_qty));
        }

        console.log('All orders cancelled and positions closed.');
    } catch (error) {
        console.error('Failed to cancel orders and close positions:', error);
    }
}
