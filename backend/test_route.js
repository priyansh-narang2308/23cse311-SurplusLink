import { getOptimalPath, getTravelCost } from './services/routing.service.js';

async function run() {
    const origin = [100.0, 20.0];
    const stops = [
        {
            id: 'pickup',
            type: 'pickup',
            coordinates: [100.05, 20.05],
            priority: 5
        },
        {
            id: 'dropoff',
            type: 'dropoff',
            coordinates: [100.1, 20.1],
            priority: 5
        }
    ];
    console.log(await getOptimalPath(origin, stops));
}
run();
