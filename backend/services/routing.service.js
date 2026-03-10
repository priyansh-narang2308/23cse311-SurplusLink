import { Client } from '@googlemaps/google-maps-services-js';

const client = new Client({});
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

/**
 * Routing Service
 * Implements Dijkstra's algorithm and path optimization based on travel cost.
 */


/**
 * Calculates the cost between two points using Distance Matrix API.
 * Cost = (Distance * Road_Factor) + (Traffic_Delay * 1.5)
 */
export const getTravelCost = async (origin, destination) => {
    const calculateFallback = () => {
        const dist = Math.sqrt(
            Math.pow(origin[0] - destination[0], 2) +
            Math.pow(origin[1] - destination[1], 2)
        ) * 111320; // km to meters approx
        return { distance: dist, duration: dist / 13, cost: dist }; // assume 13m/s (~47km/h)
    };

    if (!GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_API_KEY === 'test_key' || GOOGLE_MAPS_API_KEY === 'test') {
        return calculateFallback();
    }

    try {
        const response = await client.distancematrix({
            params: {
                origins: [{ lat: origin[1], lng: origin[0] }],
                destinations: [{ lat: destination[1], lng: destination[0] }],
                key: GOOGLE_MAPS_API_KEY,
                departure_time: 'now',
                traffic_model: 'best_guess'
            },
            timeout: 5000
        });

        const element = response.data.rows[0].elements[0];
        if (element.status !== 'OK') {
            throw new Error(`Distance Matrix Error: ${element.status}`);
        }

        const distance = element.distance.value; // meters
        const duration = element.duration_in_traffic ? element.duration_in_traffic.value : element.duration.value; // seconds
        const baseDuration = element.duration.value;
        const trafficDelay = Math.max(0, duration - baseDuration);

        // Cost = (Distance * 1.0) + (Traffic_Delay * 1.5)
        const cost = distance + (trafficDelay * 1.5);

        return { distance, duration, cost };
    } catch (error) {
        console.error('Routing Error:', error.message);
        return calculateFallback();
    }
};

/**
 * Dijkstra's Algorithm implementation for optimal multi-stop sequence.
 * Finds the shortest path visiting all required stops (Hamiltonian path approximation).
 * Since we usually have few stops (Volunteer -> Pickup -> Drop-off), we can use Permutations or Greedy.
 * For true multi-donation routing, we implement a Dijkstra-based greedy approach.
 */
export const getOptimalPath = async (volunteerCoords, stops) => {
    // stops = Array of { id, type: 'pickup'|'dropoff', coordinates: [lng, lat], priority: 1-10 }

    let currentPos = volunteerCoords;
    let remainingStops = [...stops];
    const orderedPath = [];
    let totalScore = 0;
    let totalDuration = 0;

    while (remainingStops.length > 0) {
        let bestNext = null;
        let minCost = Infinity;
        let bestStats = null;

        // Fetch costs to all remaining points parallelly
        const costPromises = remainingStops.map(stop => getTravelCost(currentPos, stop.coordinates));
        const results = await Promise.allSettled(costPromises);

        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                const stop = remainingStops[index];
                const stats = result.value;

                // Adjust cost based on mission priority (higher priority = lower cost to encourage selection)
                const priorityWeight = stop.priority ? (11 - stop.priority) * 0.1 : 1.0;
                const weightedCost = stats.cost * priorityWeight;

                if (weightedCost < minCost) {
                    minCost = weightedCost;
                    bestNext = index;
                    bestStats = stats;
                }
            }
        });

        if (bestNext !== null) {
            const winner = remainingStops.splice(bestNext, 1)[0];
            winner.eta = Math.round(bestStats.duration / 60); // minutes
            winner.distance = bestStats.distance;

            orderedPath.push(winner);
            currentPos = winner.coordinates;
            totalDuration += bestStats.duration;
        } else {
            break; // Should not happen if API works
        }
    }

    return {
        path: orderedPath,
        estimatedTotalTime: Math.round(totalDuration / 60), // total minutes
        waypoints: orderedPath.map(p => ({ lat: p.coordinates[1], lng: p.coordinates[0] }))
    };
};
