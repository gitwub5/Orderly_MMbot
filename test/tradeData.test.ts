import { MainClient } from "../src/client/main.client";
import { collectTradeData, calculateStandardDeviation } from "../src/strategy/tradeData"; // 경로에 맞게 수정
import { MarketTradeResponse } from "../src/interfaces";
import { accountInfo } from "../src/utils/account";
import { RestAPIUrl } from "../src/enums";

// Mocking the MainClient class
jest.mock("../client/main.client");

describe("collectTradeData", () => {
    let client: MainClient;
    let mockGetMarketTrades: jest.Mock;

    beforeEach(() => {
        client = new MainClient(accountInfo, RestAPIUrl.testnet);
        mockGetMarketTrades = jest.fn();
        client.getMarketTrades = mockGetMarketTrades;
    });

    it("should collect trade data without duplicates", async () => {
        const mockResponse: MarketTradeResponse = {
            success: true,
            timestamp: Date.now(),
            data: {
                rows: [
                    { symbol: "BTC_USDT", side: "buy", executed_price: 50000, executed_quantity: 0.1, executed_timestamp: 1 },
                    { symbol: "BTC_USDT", side: "sell", executed_price: 50010, executed_quantity: 0.2, executed_timestamp: 2 },
                    { symbol: "BTC_USDT", side: "buy", executed_price: 50020, executed_quantity: 0.3, executed_timestamp: 3 },
                ],
            },
        };

        mockGetMarketTrades.mockResolvedValue(mockResponse);

        const duration = 3000; // 3 seconds
        const interval = 1000; // 1 second
        const tradeSnapshots = await collectTradeData(client, "BTC_USDT", duration, interval);

        expect(tradeSnapshots.length).toBeGreaterThan(0);
        expect(tradeSnapshots[0].prices).toEqual([50000, 50010, 50020]);
    });
});

describe("calculateStandardDeviation", () => {
    it("should calculate the standard deviation correctly", () => {
        const tradeSnapshots = [
            { timestamp: 1, prices: [100, 200, 300] },
            { timestamp: 2, prices: [400, 500, 600] },
        ];

        const stdDev = calculateStandardDeviation(tradeSnapshots);
        expect(stdDev).toBeCloseTo(170.78, 2); // 표준편차가 170.78에 가까워야 함
    });

    it("should throw an error if no valid prices are available", () => {
        expect(() => calculateStandardDeviation([])).toThrow("No valid prices available to calculate standard deviation.");
    });
});