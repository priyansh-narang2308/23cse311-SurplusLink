import React, { useState, useCallback, useEffect } from 'react';
import { GoogleMap, Marker, useJsApiLoader, Autocomplete } from '@react-google-maps/api';
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_LIBRARIES, GOOGLE_MAPS_ID } from '@/lib/maps-config';
import { Loader2, Crosshair, MapPin, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface MapPickerProps {
    initialCenter?: { lat: number; lng: number };
    onLocationSelect: (location: { lat: number; lng: number; address?: string }) => void;
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

const defaultCenter = { lat: 28.6139, lng: 77.2090 }; // Delhi

export function MapPicker({ initialCenter, onLocationSelect }: MapPickerProps) {
    const { isLoaded } = useJsApiLoader({
        id: GOOGLE_MAPS_ID,
        googleMapsApiKey: GOOGLE_MAPS_API_KEY,
        libraries: GOOGLE_MAPS_LIBRARIES
    });

    const [map, setMap] = useState<google.maps.Map | null>(null);
    const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);
    const [markerPos, setMarkerPos] = useState<{ lat: number; lng: number }>(initialCenter || defaultCenter);
    const [isLocating, setIsLocating] = useState(false);

    const fetchCurrentLocation = useCallback(() => {
        setIsLocating(true);
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const newPos = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                    };
                    setMarkerPos(newPos);
                    map?.panTo(newPos);
                    onLocationSelect(newPos);
                    setIsLocating(false);
                },
                (error) => {
                    console.error("Error fetching location:", error);
                    setIsLocating(false);
                },
                { enableHighAccuracy: true }
            );
        } else {
            setIsLocating(false);
        }
    }, [map, onLocationSelect]);

    const hasFetchedRef = React.useRef(false);

    useEffect(() => {
        if (initialCenter) {
            setMarkerPos(initialCenter);
        } else if (navigator.geolocation && !hasFetchedRef.current) {
            // Auto-locate only once on mount — ref prevents re-triggering
            hasFetchedRef.current = true;
            setIsLocating(true);
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const newPos = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                    };
                    setMarkerPos(newPos);
                    map?.panTo(newPos);
                    setIsLocating(false);
                },
                (error) => {
                    console.error("Error fetching location:", error);
                    setIsLocating(false);
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
            );
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialCenter, map]);

    const onAutocompleteLoad = useCallback((autocompleteInstance: google.maps.places.Autocomplete) => {
        setAutocomplete(autocompleteInstance);
    }, []);

    const onPlaceChanged = useCallback(() => {
        if (autocomplete !== null) {
            const place = autocomplete.getPlace();
            if (place.geometry && place.geometry.location) {
                const newPos = {
                    lat: place.geometry.location.lat(),
                    lng: place.geometry.location.lng(),
                };
                setMarkerPos(newPos);
                map?.panTo(newPos);
                onLocationSelect({ ...newPos, address: place.formatted_address });
            }
        }
    }, [autocomplete, map, onLocationSelect]);

    const onLoad = useCallback(function callback(m: google.maps.Map) {
        setMap(m);
    }, []);

    const onUnmount = useCallback(function callback() {
        setMap(null);
    }, []);

    const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
        if (e.latLng) {
            const newPos = { lat: e.latLng.lat(), lng: e.latLng.lng() };
            setMarkerPos(newPos);
            onLocationSelect(newPos);
        }
    }, [onLocationSelect]);

    const handleMarkerDragEnd = useCallback((e: google.maps.MapMouseEvent) => {
        if (e.latLng) {
            const newPos = { lat: e.latLng.lat(), lng: e.latLng.lng() };
            setMarkerPos(newPos);
            onLocationSelect(newPos);
        }
    }, [onLocationSelect]);

    if (!isLoaded) {
        return (
            <div className="w-full h-64 flex items-center justify-center bg-muted rounded-3xl">
                <Loader2 className="animate-spin text-primary size-8" />
            </div>
        );
    }

    return (
        <div className="relative w-full h-80 rounded-3xl overflow-hidden border border-border/40 shadow-inner">
            <GoogleMap
                mapContainerStyle={mapContainerStyle}
                center={markerPos}
                zoom={15}
                onLoad={onLoad}
                onUnmount={onUnmount}
                onClick={handleMapClick}
                options={{
                    disableDefaultUI: true,
                    styles: mapStyles,
                    zoomControl: true,
                }}
            >
                <Marker
                    position={markerPos}
                    draggable={true}
                    onDragEnd={handleMarkerDragEnd}
                    icon={{
                        url: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png",
                        scaledSize: new google.maps.Size(40, 40)
                    }}
                />
            </GoogleMap>

            <div className="absolute top-4 left-4 right-4 z-20 flex gap-2">
                <div className="flex-1 relative group">
                    <Autocomplete
                        onLoad={onAutocompleteLoad}
                        onPlaceChanged={onPlaceChanged}
                    >
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            <Input
                                type="text"
                                placeholder="Search for your location..."
                                className="h-11 w-full pl-10 pr-4 rounded-xl border-none bg-background/90 backdrop-blur-md shadow-2xl font-bold text-sm focus-visible:ring-primary/50"
                                onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                            />
                        </div>
                    </Autocomplete>
                </div>
                <Button
                    size="icon"
                    variant="secondary"
                    className="size-11 rounded-xl shadow-xl backdrop-blur-md bg-background/90 border-none hover:bg-background text-primary shrink-0"
                    onClick={fetchCurrentLocation}
                    disabled={isLocating}
                    type="button"
                    title="Detect My Location"
                >
                    {isLocating ? <Loader2 className="size-5 animate-spin" /> : <Crosshair className="size-5" />}
                </Button>
            </div>

            <div className="absolute bottom-4 left-4 right-4">
                <div className="bg-background/90 backdrop-blur-md px-4 py-2 rounded-2xl border border-border/40 shadow-lg flex items-center gap-2">
                    <MapPin className="size-4 text-primary shrink-0" />
                    <p className="text-[10px] font-bold text-muted-foreground truncate uppercase tracking-widest">
                        Drag pin or tap map to set base location
                    </p>
                </div>
            </div>
        </div>
    );
}
