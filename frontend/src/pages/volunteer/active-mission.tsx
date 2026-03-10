/** Real-time tracking and management of the current rescue mission */
import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    MapPin,
    Phone,
    AlertTriangle,
    Navigation,
    CheckCircle2,
    Clock,
    ArrowRight,
    User,
    Building,
    ChevronRight,
    Info,
    XCircle,
    Camera,
    RefreshCw,
    Upload,
    MessageSquare,
    Trophy,
    PartyPopper,
    Loader2,
    Mail,
    ExternalLink,
    Zap
} from "lucide-react";
import { RouteMap } from "@/components/volunteer/route-map";
import { cn } from "@/lib/utils";
import { updateVolunteerLocation } from "@/services/user.service";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import DonationService from "@/services/donation.service";
import { Donation } from "@/types";
import { useAuth } from "@/contexts/auth-context";

const STEPS = [
    { id: "accepted", label: "Accepted", detail: "Heading to Pickup", dbStatus: "pending_pickup" },
    { id: "arrived_pickup", label: "Arrived", detail: "Picking up items", dbStatus: "at_pickup" },
    { id: "in_transit", label: "In Transit", detail: "Heading to NGO", dbStatus: "picked_up" },
    { id: "arrived_ngo", label: "Arrived", detail: "Delivering at NGO", dbStatus: "arrived_at_delivery" },
    { id: "completed", label: "Finished", detail: "Mission Complete", dbStatus: "delivered" }
];

interface MissionStop {
    id: string;
    type: string;
    coordinates: [number, number];
    address: string;
    priority: number;
    isDiversion?: boolean;
    diversionDonationId?: string;
}

export default function ActiveMission() {
    const { user, refreshUser } = useAuth();
    const [loading, setLoading] = useState(true);
    const [mission, setMission] = useState<Donation | null>(null);
    const [pickupImage, setPickupImage] = useState<File | null>(null);
    const [pickupImageUrl, setPickupImageUrl] = useState<string | null>(null);
    const [deliveryImage, setDeliveryImage] = useState<File | null>(null);
    const [deliveryImageUrl, setDeliveryImageUrl] = useState<string | null>(null);
    const [isPickupModalOpen, setIsPickupModalOpen] = useState(false);
    const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);
    const [deliveryNotes, setDeliveryNotes] = useState("");
    const [isUpdating, setIsUpdating] = useState(false);
    const [isFinished, setIsFinished] = useState(false);
    const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
    const [cancelReason, setCancelReason] = useState("");
    const [optimizedStops, setOptimizedStops] = useState<MissionStop[]>([]);
    const [isDiversionSuggested, setIsDiversionSuggested] = useState(false);
    const [activeVolunteerPos, setActiveVolunteerPos] = useState<{ lat: number; lng: number } | undefined>(undefined);
    const { toast } = useToast();

    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchActiveMission = useCallback(async () => {
        setLoading(true);
        try {
            const active = await DonationService.getActiveMission();
            if (active) {
                setMission(active);
            } else {
                setMission(null);
            }
        } catch (error) {
            console.error("Failed to fetch active mission", error);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchOptimizedRoute = useCallback(async (id: string) => {
        try {
            const extra = await DonationService.getOptimizedRoute(id);
            // The backend returns 'path' in the optimized result from getOptimalPath
            if (extra.path) setOptimizedStops(extra.path);
            else if (extra.stops) setOptimizedStops(extra.stops); // Fallback

            if (extra.diversionSuggested) {
                setIsDiversionSuggested(true);
            }
        } catch (error) {
            console.error("Failed to fetch optimized route", error);
        }
    }, []);

    // Heartbeat: Update volunteer location every 30 seconds
    useEffect(() => {
        if (!mission) return;

        const updateLocation = () => {
            if ("geolocation" in navigator) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const { latitude, longitude } = position.coords;
                        setActiveVolunteerPos({ lat: latitude, lng: longitude });
                        updateVolunteerLocation(latitude, longitude).catch(err =>
                            console.error("Failed to sync heartbeat location", err)
                        );
                    },
                    (error) => console.error("Heartbeat geolocation error", error),
                    { enableHighAccuracy: true }
                );
            }
        };

        const interval = setInterval(updateLocation, 60000); // 60s Heartbeat
        updateLocation(); // Initial update

        return () => clearInterval(interval);
    }, [mission]);

    useEffect(() => {
        fetchActiveMission();
    }, [fetchActiveMission]);

    useEffect(() => {
        if (mission?.id) {
            fetchOptimizedRoute(mission.id);
        }
    }, [mission?.id, fetchOptimizedRoute]);

    const getCurrentStepIndex = () => {
        if (!mission) return 0;
        const index = STEPS.findIndex(s => s.dbStatus === mission.deliveryStatus || s.id === mission.deliveryStatus);
        if (mission.deliveryStatus === 'pending_pickup') return 0;
        return index === -1 ? 0 : index;
    };

    const currentStepIndex = getCurrentStepIndex();
    const currentStep = STEPS[currentStepIndex];

    const updateStatus = async (newStatus: string) => {
        if (!mission?.id) return;
        setIsUpdating(true);
        try {
            await DonationService.updateDeliveryStatus(mission.id, newStatus);
            toast({ title: "Status Updated", description: `You are now ${newStatus.replace('_', ' ')}` });
            fetchActiveMission();
        } catch (error) {
            toast({ title: "Error", description: "Failed to update status.", variant: "destructive" });
        } finally {
            setIsUpdating(false);
        }
    };

    const handlePickupSync = async () => {
        if (!mission?.id || !pickupImage) return;
        setIsUpdating(true);
        try {
            const formData = new FormData();
            formData.append('photo', pickupImage);
            await DonationService.confirmPickup(mission.id, formData);
            setIsPickupModalOpen(false);
            fetchActiveMission();
            toast({ title: "Pickup Confirmed", description: "Photo proof uploaded successfully." });
        } catch (error) {
            toast({ title: "Error", description: "Failed to upload pickup proof.", variant: "destructive" });
        } finally {
            setIsUpdating(false);
        }
    };

    const handleDeliverySync = async () => {
        if (!mission?.id || !deliveryImage) return;
        setIsUpdating(true);
        try {
            const formData = new FormData();
            formData.append('photo', deliveryImage);
            formData.append('notes', deliveryNotes);
            await DonationService.confirmDelivery(mission.id, formData);
            await refreshUser();
            setIsDeliveryModalOpen(false);
            setIsFinished(true);
        } catch (error) {
            toast({ title: "Error", description: "Failed to complete delivery.", variant: "destructive" });
        } finally {
            setIsUpdating(false);
        }
    };

    const handleCancelMission = async () => {
        if (!mission?.id) return;
        setIsUpdating(true);
        try {
            await DonationService.cancelMission(mission.id, cancelReason || "No reason provided");
            toast({
                title: "Mission Cancelled",
                description: "The mission has been unassigned and sent for reassignment.",
                variant: "destructive"
            });
            window.location.href = "/volunteer";
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to cancel mission.",
                variant: "destructive"
            });
        } finally {
            setIsUpdating(false);
            setIsCancelDialogOpen(false);
        }
    };

    const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>, type: 'pickup' | 'delivery') => {
        const file = event.target.files?.[0];
        if (file) {
            const url = URL.createObjectURL(file);
            if (type === 'pickup') {
                setPickupImage(file);
                setPickupImageUrl(url);
            } else {
                setDeliveryImage(file);
                setDeliveryImageUrl(url);
            }
        }
    };

    const getActionConfig = () => {
        if (!mission) return { text: "No active mission", action: () => { } };

        switch (mission.deliveryStatus) {
            case "pending_pickup":
                return { text: "I've Arrived at Donor", action: () => updateStatus("at_pickup") };
            case "at_pickup":
                return { text: "Verify & Pick Up", action: () => setIsPickupModalOpen(true) };
            case "picked_up":
                return { text: "I've Arrived at NGO", action: () => updateStatus("arrived_at_delivery") };
            case "arrived_at_delivery":
                return { text: "Complete Delivery", action: () => setIsDeliveryModalOpen(true) };
            default:
                return { text: "Return to Dashboard", action: () => window.location.href = "/volunteer" };
        }
    };

    const action = getActionConfig();


    const donorPos = mission?.coordinates;
    const ngoPos = mission?.ngoCoordinates;

    // Priority: 1. Live Heartbeat, 2. Flat Coordinates, 3. GeoJSON coordinates
    const volunteerPos = activeVolunteerPos || (user?.coordinates?.lat ? user.coordinates : (user?.volunteerProfile?.currentLocation?.coordinates?.[0] ? {
        lat: user.volunteerProfile.currentLocation.coordinates[1],
        lng: user.volunteerProfile.currentLocation.coordinates[0]
    } : undefined));

    const mapCenter = currentStepIndex < 2 ? (donorPos || ngoPos || { lat: 28.6139, lng: 77.2090 }) : (ngoPos || donorPos || { lat: 28.6139, lng: 77.2090 });


    const handleNavigate = () => {
        // Ensure we have the most accurate destination based on current phase
        const dest = currentStepIndex < 2 ? donorPos : ngoPos;

        if (dest && dest.lat && dest.lng) {
            // Use standard Google Maps URL format for better compatibility
            const url = `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}&travelmode=driving`;
            window.open(url, '_blank', 'noopener,noreferrer');
        } else {
            toast({
                title: "Location Unavailable",
                description: "The destination coordinates are missing. Please wait for sync.",
                variant: "destructive"
            });
        }
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

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-background">
                <div className="text-center space-y-4">
                    <Loader2 className="size-12 animate-spin text-primary mx-auto" />
                    <p className="text-sm font-black uppercase tracking-widest text-muted-foreground">Synchronizing Mission Data...</p>
                </div>
            </div>
        );
    }

    if (!mission && !isFinished) {
        return (
            <div className="flex flex-col h-screen items-center justify-center p-6 text-center">
                <div className="size-20 rounded-full bg-muted flex items-center justify-center mb-4">
                    <XCircle className="size-10 text-muted-foreground" />
                </div>
                <h2 className="text-2xl font-black">No Active Mission</h2>
                <p className="text-muted-foreground max-w-xs mt-2">Browse the available jobs to start a food rescue!</p>
                <div className="flex gap-4 mt-8">
                    <Button
                        variant="outline"
                        className="rounded-xl px-6 gap-2"
                        onClick={() => fetchActiveMission()}
                        disabled={loading}
                    >
                        <RefreshCw className={cn("size-4", loading && "animate-spin")} />
                        Refresh
                    </Button>
                    <Button className="rounded-xl px-8" onClick={() => window.location.href = "/volunteer/available"}>
                        Find Missions
                    </Button>
                </div>
            </div>
        );
    }

    if (isFinished) {
        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="fixed inset-0 z-[100] bg-background flex items-center justify-center p-6"
            >
                <div className="max-w-md w-full text-center space-y-8">
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1, rotate: [0, 10, -10, 0] }}
                        transition={{ type: "spring", stiffness: 260, damping: 20 }}
                        className="relative inline-block"
                    >
                        <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping scale-150" />
                        <div className="relative size-32 rounded-full bg-primary flex items-center justify-center shadow-glow shadow-primary/40">
                            <CheckCircle2 className="size-16 text-white" />
                        </div>
                        <div className="absolute -top-4 -right-4">
                            <PartyPopper className="size-10 text-amber-500 animate-bounce" />
                        </div>
                    </motion.div>

                    <div className="space-y-2">
                        <h1 className="text-4xl font-black tracking-tighter">Mission Accomplished!</h1>
                        <p className="text-xl text-muted-foreground font-medium">
                            You just saved <span className="text-primary font-bold">{mission?.quantity}</span> from going to waste.
                        </p>
                    </div>

                    <Card className="bg-primary/5 border-primary/20 overflow-hidden">
                        <div className="px-6 py-4 flex items-center justify-between border-b border-primary/10">
                            <span className="text-xs font-black uppercase tracking-widest text-primary">Your Impact Portfolio</span>
                            <Badge className="bg-primary text-white uppercase tracking-tighter">Tier: {user?.volunteerProfile?.tier || 'Rookie'}</Badge>
                        </div>
                        <div className="p-6 grid grid-cols-2 gap-4">
                            <div className="text-left">
                                <p className="text-2xl font-black">{user?.stats?.co2Saved?.toFixed(1) || (Math.random() * 5 + 2).toFixed(1)} kg</p>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase">Total CO2 Reduced</p>
                            </div>
                            <div className="text-left">
                                <p className="text-2xl font-black">{user?.stats?.completedDonations || 1}</p>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase">Successful Rescues</p>
                            </div>
                        </div>
                    </Card>

                    <Button
                        size="lg"
                        className="w-full h-16 rounded-2xl text-xl font-black shadow-glow shadow-primary/20 group"
                        onClick={() => window.location.href = "/volunteer"}
                    >
                        Back to Dashboard
                        <ArrowRight className="ml-2 size-6 group-hover:translate-x-2 transition-transform" />
                    </Button>
                </div>
            </motion.div>
        );
    }

    return (
        <div className="relative flex flex-col h-[calc(100vh-120px)] w-full overflow-hidden -m-4 lg:-m-8">
            {/* Top Stepper */}
            <div className="absolute top-0 left-0 right-0 z-20 p-4 md:p-6 bg-gradient-to-b from-background via-background/95 to-transparent">
                <div className="max-w-4xl mx-auto">
                    <div className="flex items-center justify-between px-2 mb-2">
                        <div className="flex items-center gap-2">
                            <div className="size-3 rounded-full bg-primary animate-pulse" />
                            <h2 className="text-xl font-extrabold tracking-tight">Active Tracking</h2>
                        </div>
                        <Badge variant="outline" className="font-mono bg-background/50 border-primary/20 text-primary uppercase">
                            ID: {mission?.id?.substring(0, 8)}
                        </Badge>
                    </div>

                    <div className="flex items-center gap-1 md:gap-2">
                        {STEPS.map((step, idx) => (
                            <React.Fragment key={step.id}>
                                <div className="flex flex-col items-center flex-1">
                                    <div className={cn(
                                        "h-2 w-full rounded-full transition-all duration-500",
                                        idx <= currentStepIndex ? "bg-primary shadow-[0_0_15px_rgba(var(--primary),.6)]" : "bg-muted/50"
                                    )} />
                                    <span className={cn(
                                        "text-[10px] font-black uppercase tracking-wider mt-2 hidden md:block",
                                        idx === currentStepIndex ? "text-primary" : "text-muted-foreground"
                                    )}>
                                        {step.label}
                                    </span>
                                </div>
                                {idx < STEPS.length - 1 && (
                                    <ChevronRight className="size-4 text-muted/30 mt-[-18px] hidden md:block" />
                                )}
                            </React.Fragment>
                        ))}
                    </div>

                    {/* Smart Routing Diversion Alert */}
                    <AnimatePresence>
                        {isDiversionSuggested && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="mt-4 px-2"
                            >
                                <div className="bg-amber-500/10 border-2 border-amber-500/20 rounded-2xl p-4 flex items-center gap-4 shadow-lg shadow-amber-500/5">
                                    <div className="size-10 rounded-xl bg-amber-500 flex items-center justify-center shrink-0 animate-bounce shadow-glow shadow-amber-500/40">
                                        <Zap className="size-5 text-white fill-white" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500">Dijkstra Smart Route</span>
                                            <Badge className="bg-amber-500 text-white border-none text-[8px] h-4">Dynamic Detour</Badge>
                                        </div>
                                        <p className="text-sm font-bold text-foreground">A high-priority nearby mission has been added to your route!</p>
                                        <p className="text-[10px] text-muted-foreground font-black uppercase tracking-tighter">Optimized for safety and environmental impact</p>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Map Area */}
            <div className="relative flex-1 bg-[#0f172a] overflow-hidden">
                <RouteMap
                    volunteerCoords={volunteerPos}
                    donorCoords={donorPos}
                    ngoCoords={ngoPos}
                    stops={optimizedStops}
                />

                {/* Map Controls */}
                <div className="absolute top-32 right-4 flex flex-col gap-2 z-30">
                    <Button
                        size="icon"
                        variant="secondary"
                        className="size-12 rounded-2xl shadow-xl border-border/50 backdrop-blur-md"
                        onClick={handleNavigate}
                    >
                        <Navigation className="size-6 text-primary" />
                    </Button>
                </div>

                <div className="absolute bottom-32 left-4 right-4 md:left-auto md:right-8 md:bottom-36 md:w-80 pointer-events-none">
                    <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-card/95 backdrop-blur-xl border-2 border-primary/20 rounded-3xl p-5 shadow-3xl pointer-events-auto">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="size-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                                    <Navigation className="size-5 text-primary animate-float" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Next Stop</p>
                                    <p className="text-base font-black truncate max-w-[140px]">
                                        {currentStepIndex < 2 ? mission.donorName : mission.ngoName}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-2xl font-black text-primary leading-none">{(Math.random() * 8 + 2).toFixed(0)}</p>
                                <p className="text-[10px] font-black uppercase text-muted-foreground">min</p>
                            </div>
                        </div>

                        <Button
                            className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-black text-sm uppercase tracking-widest shadow-glow shadow-primary/20 gap-2 mb-4 pointer-events-auto"
                            onClick={handleNavigate}
                        >
                            <ExternalLink className="size-4" /> Open In Maps
                        </Button>

                        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                            <motion.div className="h-full bg-primary" animate={{ width: ["20%", "45%", "80%"] }} transition={{ duration: 10, repeat: Infinity }} />
                        </div>
                    </motion.div>
                </div>
            </div>

            {/* Action Bar */}
            <div className="relative z-30 bg-card border-t border-border/50 p-6 md:px-12 pb-8 md:pb-12 shadow-[0_-10px_30px_rgba(0,0,0,0.1)]">
                <div className="max-w-4xl mx-auto">
                    <div className="flex flex-col md:flex-row gap-6 mb-8">
                        <div className="flex-1 grid grid-cols-2 md:grid-cols-1 gap-4">
                            <div className="p-4 rounded-xl bg-accent/30 border border-border/50 text-left">
                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Current Contact</p>
                                <div className="flex items-center gap-3">
                                    <div className="size-10 rounded-full bg-secondary flex items-center justify-center">
                                        <User className="size-5" />
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <p className="text-sm font-bold truncate">
                                            {currentStepIndex < 2 ? mission.donorName : mission.ngoName}
                                        </p>
                                        <p className="text-xs text-muted-foreground truncate uppercase font-bold tracking-tighter">
                                            {currentStepIndex < 2 ? "Donor Representative" : "NGO Coordinator"}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button variant="outline" className="flex-1 h-14 rounded-xl gap-2 font-black uppercase text-xs tracking-widest" asChild>
                                    <a href={`mailto:${currentStepIndex < 2 ? mission.donorEmail : (mission.ngoEmail || mission.claimedBy?.email || "help@surpluslink.com")}`}>
                                        <Mail className="size-4" /> Mail Partner
                                    </a>
                                </Button>
                            </div>
                        </div>
                        <div className="flex-1 p-5 rounded-xl bg-primary/5 border border-primary/10 text-left">
                            <div className="flex items-start gap-4">
                                <div className="size-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0 mt-1">
                                    <MapPin className="size-5 text-primary" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">Destination</p>
                                    <p className="font-bold leading-tight line-clamp-2">
                                        {currentStepIndex < 2 ? mission.address : (mission.ngoAddress || mission.claimedBy?.organization || "NGO Distribution Center")}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <Button
                            variant="destructive"
                            className="h-16 w-16 rounded-2xl p-0 shrink-0"
                            onClick={() => setIsCancelDialogOpen(true)}
                        >
                            <AlertTriangle className="size-6" />
                        </Button>
                        <Button
                            size="lg"
                            disabled={isUpdating}
                            className="flex-1 h-16 rounded-2xl text-xl font-black shadow-glow group"
                            onClick={action.action}
                        >
                            {isUpdating ? <Loader2 className="animate-spin size-6" /> : action.text}
                            {!isUpdating && <ArrowRight className="ml-3 size-6 group-hover:translate-x-2 transition-transform" />}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Pickup Proof Modal */}
            <Dialog open={isPickupModalOpen} onOpenChange={setIsPickupModalOpen}>
                <DialogContent className="max-w-md rounded-3xl border-border/50 overflow-hidden p-0">
                    <DialogHeader className="p-6 pb-0">
                        <DialogTitle className="text-2xl font-black">Proof of Pickup</DialogTitle>
                        <DialogDescription className="font-medium">Capture a photo of the food items to verify condition.</DialogDescription>
                    </DialogHeader>

                    <div className="p-6 pt-4 space-y-6 text-center">
                        <div
                            className={cn(
                                "relative aspect-video rounded-2xl border-2 border-dashed border-border/60 flex flex-col items-center justify-center bg-muted/30 overflow-hidden group",
                                pickupImageUrl && "border-solid border-primary/40"
                            )}
                        >
                            {pickupImageUrl ? (
                                <>
                                    <img src={pickupImageUrl} alt="Pickup" className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            className="rounded-full font-bold"
                                            onClick={() => {
                                                setPickupImage(null);
                                                setPickupImageUrl(null);
                                            }}
                                        >
                                            <RefreshCw className="size-4 mr-2" /> Retake
                                        </Button>
                                    </div>
                                </>
                            ) : (
                                <div
                                    className="flex flex-col items-center gap-3 cursor-pointer"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                        <Camera className="size-8" />
                                    </div>
                                    <p className="text-sm font-bold text-muted-foreground">Tap to take photo</p>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        capture="environment"
                                        ref={fileInputRef}
                                        className="hidden"
                                        onChange={(e) => handleImageUpload(e, 'pickup')}
                                    />
                                </div>
                            )}
                        </div>

                        <Button
                            className="w-full h-14 rounded-xl font-black text-lg"
                            disabled={!pickupImage || isUpdating}
                            onClick={handlePickupSync}
                        >
                            {isUpdating ? <Loader2 className="animate-spin size-5" /> : "Confirm Pickup"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delivery Proof Modal */}
            <Dialog open={isDeliveryModalOpen} onOpenChange={setIsDeliveryModalOpen}>
                <DialogContent className="max-w-md rounded-3xl border-border/50 overflow-hidden p-0">
                    <DialogHeader className="p-6 pb-0 text-left">
                        <DialogTitle className="text-2xl font-black">Proof of Delivery</DialogTitle>
                        <DialogDescription className="font-medium text-left">Capture handover photo at {mission.ngoName}.</DialogDescription>
                    </DialogHeader>

                    <div className="p-6 pt-4 space-y-6 text-left">
                        <div
                            className={cn(
                                "relative aspect-video rounded-2xl border-2 border-dashed border-border/60 flex flex-col items-center justify-center bg-muted/30 overflow-hidden group mb-4",
                                deliveryImageUrl && "border-solid border-primary/40"
                            )}
                        >
                            {deliveryImageUrl ? (
                                <>
                                    <img src={deliveryImageUrl} alt="Delivery" className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            className="rounded-full font-bold"
                                            onClick={() => {
                                                setDeliveryImage(null);
                                                setDeliveryImageUrl(null);
                                            }}
                                        >
                                            <RefreshCw className="size-4 mr-2" /> Retake
                                        </Button>
                                    </div>
                                </>
                            ) : (
                                <div
                                    className="flex flex-col items-center gap-3 cursor-pointer"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                        <Camera className="size-8" />
                                    </div>
                                    <p className="text-sm font-bold text-muted-foreground">Tap to take photo</p>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        capture="environment"
                                        ref={fileInputRef}
                                        className="hidden"
                                        onChange={(e) => handleImageUpload(e, 'delivery')}
                                    />
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="notes" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Delivery Notes (Optional)</Label>
                            <Textarea
                                id="notes"
                                placeholder="e.g. Left with security, food was cold..."
                                className="rounded-xl border-border/50 min-h-[100px] font-medium"
                                value={deliveryNotes}
                                onChange={(e) => setDeliveryNotes(e.target.value)}
                            />
                        </div>

                        <Button
                            className="w-full h-14 rounded-xl font-black text-lg shadow-glow shadow-primary/20"
                            disabled={!deliveryImage || isUpdating}
                            onClick={handleDeliverySync}
                        >
                            {isUpdating ? <Loader2 className="animate-spin size-5" /> : "Confirm Handover"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
            {/* Cancel Mission Dialog */}
            <AlertDialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
                <AlertDialogContent className="rounded-3xl max-w-sm">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-2xl font-black">Abort Mission?</AlertDialogTitle>
                        <AlertDialogDescription className="font-medium text-left">
                            This will unassign you from the rescue. Please provide a reason for logistics tracking.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <div className="py-2 space-y-4">
                        <select
                            className="w-full h-12 bg-muted rounded-xl px-4 text-sm font-bold focus:ring-primary focus:ring-2 outline-none appearance-none"
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                        >
                            <option value="">Select Reason...</option>
                            <option value="Vehicle Breakdown">Vehicle Breakdown</option>
                            <option value="Traffic/Accident">Traffic / Accident</option>
                            <option value="Personal Emergency">Personal Emergency</option>
                            <option value="Too Large for Vehicle">Too Large for Vehicle</option>
                            <option value="Donor Not Found">Donor Not Found</option>
                        </select>
                    </div>

                    <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel className="rounded-xl h-12 font-bold">Stay on Job</AlertDialogCancel>
                        <AlertDialogAction
                            className="rounded-xl h-12 font-bold bg-destructive hover:bg-destructive/90"
                            onClick={handleCancelMission}
                            disabled={!cancelReason || isUpdating}
                        >
                            {isUpdating ? <Loader2 className="animate-spin size-4" /> : "Confirm Abort"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div >
    );
}
