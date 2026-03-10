import React, { useMemo, useState, useEffect } from 'react';
import { GoogleMap, Marker, useJsApiLoader, DirectionsRenderer } from '@react-google-maps/api';
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_LIBRARIES, GOOGLE_MAPS_ID } from '@/lib/maps-config';
import { Loader2 } from 'lucide-react';

interface RouteMapProps {
    donorCoords?: { lat: number; lng: number };
    ngoCoords?: { lat: number; lng: number };
    volunteerCoords?: { lat: number; lng: number };
    diversionCoords?: { lat: number; lng: number };
    stops?: Array<{ coordinates: [number, number]; type: string; isDiversion?: boolean }>;
}

const mapContainerStyle = {
    width: '100%',
    height: '100%',
};

const mapStyles = [
    { "elementType": "geometry", "stylers": [{ "color": "#1f2937" }] },
    { "elementType": "labels.text.fill", "stylers": [{ "color": "#9ca3af" }] },
    { "elementType": "labels.text.stroke", "stylers": [{ "color": "#111827" }] },
    { "featureType": "administrative", "elementType": "geometry", "stylers": [{ "color": "#374151" }] },
    { "featureType": "landscape", "elementType": "geometry", "stylers": [{ "color": "#111827" }] },
    { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#6b7280" }] },
    { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#374151" }] },
    { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#4b5563" }] },
    { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#0f172a" }] }
];

export function RouteMap({ donorCoords, ngoCoords, volunteerCoords, diversionCoords, stops }: RouteMapProps) {
    const { isLoaded } = useJsApiLoader({
        id: GOOGLE_MAPS_ID,
        googleMapsApiKey: GOOGLE_MAPS_API_KEY,
        libraries: GOOGLE_MAPS_LIBRARIES
    });

    const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);

    const center = useMemo(() => {
        if (volunteerCoords) return volunteerCoords;
        if (donorCoords) return donorCoords;
        return { lat: 28.6139, lng: 77.2090 };
    }, [volunteerCoords, donorCoords]);

    useEffect(() => {
        if (!isLoaded) return;

        // Determine the start point: Volunteer if available, otherwise Donor fallback
        let origin: { lat: number; lng: number } | null = volunteerCoords || (donorCoords ? donorCoords : null);
        let destination: { lat: number; lng: number } | null = null;
        let waypoints: google.maps.DirectionsWaypoint[] = [];

        if (!origin) return;

        if (stops && stops.length > 0) {
            // Using optimized stops sequence from backend
            const stopPoints = stops.map(s => ({ lat: s.coordinates[1], lng: s.coordinates[0] }));
            
            if (!volunteerCoords) {
                // If volunteer position is unknown, start from first stop and go to last
                origin = stopPoints[0];
                destination = stopPoints[stopPoints.length - 1];
                waypoints = stopPoints.slice(1, -1).map(p => ({ location: p, stopover: true }));
            } else {
                destination = stopPoints[stopPoints.length - 1];
                waypoints = stopPoints.slice(0, -1).map(p => ({ location: p, stopover: true }));
            }
        } else if (ngoCoords && donorCoords) {
            // Basic Mission Logic: Volunteer -> Donor -> NGO
            if (!volunteerCoords) {
                origin = donorCoords;
                destination = ngoCoords;
                waypoints = diversionCoords ? [{ location: diversionCoords, stopover: true }] : [];
            } else {
                destination = ngoCoords;
                waypoints = [{ location: donorCoords, stopover: true }];
                if (diversionCoords) waypoints.push({ location: diversionCoords, stopover: true });
            }
        } else if (donorCoords && volunteerCoords) {
            // Single Pickup phase
            destination = donorCoords;
        }

        // Final check: Don't request if origin and destination are identical
        if (!destination || (origin.lat === destination.lat && origin.lng === destination.lng)) {
            setDirections(null);
            return;
        }

        const directionsService = new google.maps.DirectionsService();
        directionsService.route(
            {
                origin,
                destination,
                waypoints,
                travelMode: google.maps.TravelMode.DRIVING,
                optimizeWaypoints: false,
            },
            (result, status) => {
                if (status === google.maps.DirectionsStatus.OK) {
                    setDirections(result);
                } else {
                    console.warn(`Directions request failed: ${status}`);
                    setDirections(null);
                }
            }
        );
    }, [isLoaded, volunteerCoords, donorCoords, ngoCoords, diversionCoords, stops]);

    if (!isLoaded) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-[#0f172a]">
                <Loader2 className="animate-spin text-primary size-10" />
            </div>
        );
    }

    return (
        <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={center}
            zoom={13}
            options={{
                disableDefaultUI: true,
                styles: mapStyles,
                zoomControl: false,
            }}
        >
            {directions && (
                <DirectionsRenderer
                    directions={directions}
                    options={{
                        suppressMarkers: true,
                        preserveViewport: true,
                        polylineOptions: {
                            strokeColor: "#22c55e",
                            strokeOpacity: 0.8,
                            strokeWeight: 6,
                        },
                    }}
                />
            )}

            {volunteerCoords && (
                <Marker
                    position={volunteerCoords}
                    icon={{
                        path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                        scale: 6,
                        fillColor: "#3b82f6",
                        fillOpacity: 1,
                        strokeWeight: 2,
                        strokeColor: "#ffffff",
                    }}
                    title="You"
                />
            )}

            {donorCoords && (
                <Marker
                    position={donorCoords}
                    icon={{
                        url: "https://maps.google.com/mapfiles/ms/icons/red-pushpin.png",
                        scaledSize: new google.maps.Size(40, 40)
                    }}
                    label={{ text: "PICKUP", className: "font-black text-[10px] bg-background/80 px-2 py-1 rounded text-red-500 translate-y-8" }}
                />
            )}

            {ngoCoords && (
                <Marker
                    position={ngoCoords}
                    icon={{
                        url: "https://maps.google.com/mapfiles/ms/icons/green-pushpin.png",
                        scaledSize: new google.maps.Size(40, 40)
                    }}
                    label={{ text: "NGO", className: "font-black text-[10px] bg-background/80 px-2 py-1 rounded text-emerald-500 translate-y-8" }}
                />
            )}

            {diversionCoords && (
                <Marker
                    position={diversionCoords}
                    icon={{
                        url: "https://maps.google.com/mapfiles/ms/icons/orange-pushpin.png",
                        scaledSize: new google.maps.Size(40, 40)
                    }}
                    label={{ text: "DIVERSION", className: "font-black text-[10px] bg-background/80 px-2 py-1 rounded text-orange-500 translate-y-8" }}
                />
            )}
        </GoogleMap>
    );
}
