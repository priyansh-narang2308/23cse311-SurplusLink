import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    MapPin,
    Navigation,
    Phone,
    CheckCircle2,
    Clock,
    Building,
    User,
    Shield,
    Mail,
    Loader2,
    ExternalLink
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Donation } from "@/types";
import { GoogleMap, Marker, useJsApiLoader, Polyline } from "@react-google-maps/api";
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_LIBRARIES, GOOGLE_MAPS_ID } from '@/lib/maps-config';
import api from "@/lib/api";

interface VolunteerTrackerModalProps {
    isOpen: boolean;
    onClose: () => void;
    donation: Donation | null;
}

const mapContainerStyle = {
    width: '100%',
    height: '100%',
};

const mapStyles = [
    { "elementType": "geometry", "stylers": [{ "color": "#1f2937" }] },
    { "elementType": "labels.text.fill", "stylers": [{ "color": "#9ca3af" }] },
    { "elementType": "labels.text.stroke", "stylers": [{ "color": "#111827" }] },
    { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#374151" }] },
    { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#0f172a" }] }
];

export function VolunteerTrackerModal({ isOpen, onClose, donation: initialDonation }: VolunteerTrackerModalProps) {
    const [donation, setDonation] = useState<Donation | null>(initialDonation);
    const [eta, setEta] = useState<number | null>(null);

    const { isLoaded } = useJsApiLoader({
        id: GOOGLE_MAPS_ID,
        googleMapsApiKey: GOOGLE_MAPS_API_KEY,
        libraries: GOOGLE_MAPS_LIBRARIES,
    });

    const refreshData = useCallback(async () => {
        if (!initialDonation?.id) return;
        try {
            const { data } = await api.get(`/donations/${initialDonation.id}`);
            setDonation(data);
        } catch (error) {
            console.error("Failed to refresh tracking data", error);
        }
    }, [initialDonation?.id]);

    useEffect(() => {
        setDonation(initialDonation);
        if (isOpen && initialDonation) {
            refreshData();
            const interval = setInterval(refreshData, 60000); // Poll every 60s
            return () => clearInterval(interval);
        }
    }, [isOpen, initialDonation, refreshData]);

    const volunteerCoords = useMemo(() => {
        const coords = donation?.volunteer?.volunteerProfile?.currentLocation?.coordinates;
        if (coords && coords.length === 2) {
            return { lat: coords[1], lng: coords[0] };
        }
        return null;
    }, [donation]);

    const donorCoords = donation?.donor?.coordinates || donation?.coordinates;
    const ngoCoords = donation?.claimedBy?.coordinates || donation?.ngoCoordinates;

    useEffect(() => {
        if (volunteerCoords && (donation?.status === 'picked_up' ? ngoCoords : donorCoords)) {
            const target = donation?.status === 'picked_up' ? ngoCoords : donorCoords;
            if (target) {
                // Crude distance-based ETA (30km/h avg)
                const R = 6371; // km
                const dLat = (target.lat - volunteerCoords.lat) * Math.PI / 180;
                const dLon = (target.lng - volunteerCoords.lng) * Math.PI / 180;
                const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                    Math.cos(volunteerCoords.lat * Math.PI / 180) * Math.cos(target.lat * Math.PI / 180) *
                    Math.sin(dLon / 2) * Math.sin(dLon / 2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                const distance = R * c;
                setEta(Math.max(1, Math.round((distance / 30) * 60)));
            }
        }
    }, [volunteerCoords, donorCoords, ngoCoords, donation?.status]);

    if (!donation) return null;

    const mapCenter = volunteerCoords || donorCoords || { lat: 0, lng: 0 };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-xl p-0 overflow-hidden rounded-[2.5rem] border-border/50 bg-card shadow-2xl">
                <div className="relative h-80 bg-muted overflow-hidden">
                    {!isLoaded ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                            <Loader2 className="size-8 animate-spin text-primary" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Initializing Radar...</p>
                        </div>
                    ) : (
                        <GoogleMap
                            mapContainerStyle={mapContainerStyle}
                            center={mapCenter}
                            zoom={14}
                            options={{
                                disableDefaultUI: true,
                                styles: mapStyles,
                                gestureHandling: 'greedy'
                            }}
                        >
                            {donorCoords && (
                                <Marker
                                    position={donorCoords}
                                    icon={{
                                        url: "https://api.dicebear.com/7.x/icons/svg?seed=donor&icon=shop&backgroundColor=10b981",
                                        scaledSize: new google.maps.Size(32, 32)
                                    }}
                                    title="Donor Location"
                                />
                            )}
                            {ngoCoords && (
                                <Marker
                                    position={ngoCoords}
                                    icon={{
                                        url: "https://api.dicebear.com/7.x/icons/svg?seed=ngo&icon=building&backgroundColor=3b82f6",
                                        scaledSize: new google.maps.Size(32, 32)
                                    }}
                                    title="NGO Location"
                                />
                            )}
                            {volunteerCoords && (
                                <>
                                    <Marker
                                        position={volunteerCoords}
                                        icon={{
                                            url: "https://api.dicebear.com/7.x/icons/svg?seed=volunteer&icon=truck&backgroundColor=f59e0b",
                                            scaledSize: new google.maps.Size(40, 40)
                                        }}
                                        title="Volunteer Live Location"
                                    />
                                    {donation.status === 'picked_up' && ngoCoords && (
                                        <Polyline
                                            path={[volunteerCoords, ngoCoords]}
                                            options={{ strokeColor: "#f59e0b", strokeOpacity: 0.5, strokeWeight: 3, icons: [{ icon: { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW }, offset: "50%" }] }}
                                        />
                                    )}
                                    {donation.status !== 'picked_up' && donorCoords && (
                                        <Polyline
                                            path={[volunteerCoords, donorCoords]}
                                            options={{ strokeColor: "#f59e0b", strokeOpacity: 0.5, strokeWeight: 3, icons: [{ icon: { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW }, offset: "50%" }] }}
                                        />
                                    )}
                                </>
                            )}
                        </GoogleMap>
                    )}

                    <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
                        <Badge className="bg-background/80 backdrop-blur-md text-foreground border-border/50 py-1.5 px-3 rounded-xl shadow-lg ring-1 ring-black/5">
                            <div className="size-2 rounded-full bg-emerald-500 animate-pulse mr-2" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Live Tracking</span>
                        </Badge>
                        {eta && (
                            <div className="bg-primary px-3 py-1.5 rounded-xl shadow-xl text-primary-foreground font-black text-xs flex items-center gap-2">
                                <Clock className="size-3" />
                                {eta}m ETA
                            </div>
                        )}
                    </div>

                    <Button
                        variant="secondary"
                        size="icon"
                        className="absolute top-4 right-4 rounded-xl size-10 bg-background/80 backdrop-blur-md shadow-xl border-none hover:bg-background transition-all"
                        onClick={onClose}
                    >
                        <Shield className="size-4" />
                    </Button>
                </div>

                <div className="p-8 space-y-8">
                    <div className="flex items-start justify-between">
                        <div className="space-y-1">
                            <Badge className="bg-orange-500/10 text-orange-600 border-none uppercase text-[10px] font-black tracking-widest px-3 py-1 mb-2">
                                {donation.status.replace('_', ' ')}
                            </Badge>
                            <h2 className="text-3xl font-black tracking-tighter text-foreground">{donation.title}</h2>
                        </div>
                        <div className="text-right">
                            <div className="h-12 w-12 rounded-2xl bg-primary/5 flex items-center justify-center border border-primary/10 mb-1">
                                <Navigation className="size-6 text-primary" />
                            </div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">In Transit</p>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="p-5 rounded-[2rem] bg-muted/30 border border-border/50 relative overflow-hidden group">
                            <div className="absolute -right-4 -top-4 size-24 bg-primary/5 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
                            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-3 relative z-10">Hero Contact</p>
                            <div className="flex items-center gap-4 relative z-10">
                                <div className="size-14 rounded-2xl bg-secondary flex items-center justify-center overflow-hidden border border-border/50">
                                    {donation.volunteer?.avatar ? (
                                        <img src={donation.volunteer.avatar} className="w-full h-full object-cover" alt="Avatar" />
                                    ) : (
                                        <User className="size-6 text-muted-foreground" />
                                    )}
                                </div>
                                <div className="space-y-0.5">
                                    <p className="text-lg font-black tracking-tight">{donation.volunteer?.name || donation.assignedVolunteer || "Assigned Hero"}</p>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/5 text-emerald-600 font-black text-[9px] px-2 py-0">VERIFIED</Badge>
                                        <p className="text-[10px] font-bold text-muted-foreground">5.0 ★ Rating</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col gap-3">
                            <Button variant="outline" className="flex-1 rounded-2xl gap-3 font-bold h-14 border-primary/20 hover:bg-primary/5 hover:border-primary/50 transition-all group" asChild>
                                <a href={`mailto:${donation.volunteer?.email || '[EMAIL_ADDRESS]'}`}>
                                    <Mail className="size-5 text-primary group-hover:scale-110 transition-transform" />
                                    <span>Mail Volunteer</span>
                                </a>
                            </Button>
                            {donation.volunteer?.phone && (
                                <Button variant="outline" className="flex-1 rounded-2xl gap-3 font-bold h-14 border-primary/20 hover:bg-primary/5" asChild>
                                    <a href={`tel:${donation.volunteer.phone}`}>
                                        <Phone className="size-5 text-primary" />
                                        <span>Direct Call</span>
                                    </a>
                                </Button>
                            )}
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="flex items-start gap-4">
                            <div className={cn(
                                "size-5 rounded-full border-2 mt-1.5 shrink-0 transition-all duration-1000",
                                donation.status === 'picked_up' || donation.status === 'at_delivery' || donation.status === 'delivered'
                                    ? "bg-emerald-500 border-white shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                                    : "bg-background border-muted"
                            )} />
                            <div className="space-y-1">
                                <p className="text-base font-black tracking-tight">Pickup Location</p>
                                <p className="text-sm text-muted-foreground font-medium leading-relaxed">{donation.address}</p>
                            </div>
                        </div>
                        <div className={cn(
                            "flex items-start gap-4 transition-opacity duration-1000",
                            donation.status === 'picked_up' ? "opacity-100" : "opacity-30"
                        )}>
                            <div className={cn(
                                "size-5 rounded-full border-2 mt-1.5 shrink-0",
                                (donation.status === 'at_delivery' || donation.status === 'delivered')
                                    ? "bg-emerald-500 border-white shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                                    : "border-muted"
                            )} />
                            <div className="space-y-1">
                                <p className="text-base font-black tracking-tight">Destination Hub</p>
                                <p className="text-sm text-muted-foreground font-medium leading-relaxed">{donation.ngoAddress || "Your distribution center"}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
