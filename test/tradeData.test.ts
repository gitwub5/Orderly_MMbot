import { MainClient } from "../src/client/main.client";
import { collectTradeData, calculateStandardDeviation, predictMarketDirection } from "../src/strategy/data/trade.data"; // 경로는 실제 파일 경로에 맞게 수정
import { MarketTradeResponse } from "../src/interfaces";
import { accountInfo } from "../src/utils/account";
import { RestAPIUrl } from "../src/enums";

// Mocking the MainClient class
jest.mock("../client/main.client");

describe("Trade Data Analysis Functions", () => {
    let client: MainClient;
    let mockGetMarketTrades: jest.Mock;

    beforeEach(() => {
        client = new MainClient(accountInfo, RestAPIUrl.testnet);
        mockGetMarketTrades = jest.fn();
        client.getMarketTrades = mockGetMarketTrades;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test("collectTradeData should collect and organize trade data correctly", async () => {
        const duration = 5000; // 5 seconds
        const interval = 1000; // 1 second
        const symbol = "BTC_USDT";

        const tradeData = await collectTradeData(client, symbol, duration, interval);

        expect(tradeData.length).toBe(3);
        expect(tradeData[0].timestamp).toBe(1620000000000);
        expect(tradeData[0].buyOrders.length).toBe(1);
        expect(tradeData[0].sellOrders.length).toBe(0);
    });

    test("calculateStandardDeviation should calculate correct standard deviation of trade prices", () => {
        const tradeData = [
            { timestamp: 1620000000000, buyOrders: [{ price: 100, quantity: 1 }], sellOrders: [] },
            { timestamp: 1620000005000, buyOrders: [], sellOrders: [{ price: 102, quantity: 2 }] },
            { timestamp: 1620000010000, buyOrders: [{ price: 101, quantity: 1.5 }], sellOrders: [] },
        ];

        const stdDev = calculateStandardDeviation(tradeData);
        expect(stdDev).toBeCloseTo(0.816, 3);
    });

    test("predictMarketDirection should return correct market direction", () => {
        const tradeData = [
            { timestamp: 1620000000000, buyOrders: [{ price: 100, quantity: 1 }], sellOrders: [] },
            { timestamp: 1620000005000, buyOrders: [], sellOrders: [{ price: 102, quantity: 2 }] },
            { timestamp: 1620000010000, buyOrders: [{ price: 101, quantity: 1.5 }], sellOrders: [] },
        ];

        const direction = predictMarketDirection(tradeData);
        expect(direction).toBe(-1); // 매도 주문이 더 강한 상황
    });
});