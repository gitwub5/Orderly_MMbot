import winston from 'winston';
import { format } from 'date-fns';

// Create a logger function
export function createLogger(symbol: string) {
    return winston.createLogger({
        level: 'info',
        format: winston.format.combine(
            winston.format.label({ label: symbol }),
            winston.format.timestamp(),
            winston.format.printf(({ timestamp, level, message, label }) => {
                const timeOnly = format(new Date(timestamp), 'HH:mm:ss');
                return `${timeOnly} [${label}] ${message}`;
                //return `${timeOnly} [${label}] ${level}: ${message}`; 
            })
        ),
        transports: [
            new winston.transports.Console()
        ]
    });
}