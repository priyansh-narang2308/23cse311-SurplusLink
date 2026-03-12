import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
    CardFooter
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    MapPin,
    Truck,
    Clock,
    Beef,
    Package,
    Utensils,
    Info,
    Search,
    Filter,
    ArrowRight,
    TrendingUp,
    Map as MapIcon,
    List as ListIcon,
    CheckCircle2,
    AlertCircle,
    Bike,
    Navigation,
    Box,
    Loader2,
    Sparkles,
    Users2,
    Timer,
    Phone
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { MissionCard } from "@/components/volunteer/mission-card";
import { MissionsMap } from "@/components/volunteer/missions-map";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription
} from "@/components/ui/sheet";
import {
    Tabs,
    TabsList,
    TabsTrigger
} from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import DonationService from "@/services/donation.service";
import { Donation } from "@/types";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import api from "@/lib/api";

interface DeliveryRequest {
    id: string;
    title: string;
    description?: string;
    foodType: string;
    foodCategory?: string;
    quantity: string;
    pickupAddress: string;
    expiryDate: string;
    photos?: string[];
    deliveryRequestCount: number;
    deliveryRequesters: { name: string; reservedAt: string }[];
}

function getTimeLeft(expiryDate: string): { label: string; urgent: boolean } {
    const diff = new Date(expiryDate).getTime() - Date.now();
    if (diff <= 0) return { label: 'Expired', urgent: true };
    const mins = Math.floor(diff / 60000);
    if (mins < 90) return { label: `${mins}m left`, urgent: true };
    const hrs = Math.floor(mins / 60);
    return { label: `${hrs}h ${mins % 60}m left`, urgent: false };
}

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.1 }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
};

export default function AvailableMissions() {
    const { user } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [acceptingId, setAcceptingId] = useState<string | null>(null);
    const [view, setView] = useState<"list" | "map">("list");
    const [missions, setMissions] = useState<Donation[]>([]);
    const [selectedMission, setSelectedMission] = useState<Donation | null>(null);
    const [filter, setFilter] = useState("All");
    const [deliveryRequests, setDeliveryRequests] = useState<DeliveryRequest[]>([]);
    const [loadingDelivery, setLoadingDelivery] = useState(true);
    const [selectedDelivery, setSelectedDelivery] = useState<DeliveryRequest | null>(null);

    const fetchDeliveryRequests = useCallback(async () => {
        setLoadingDelivery(true);
        try {
            const { data } = await api.get('/public/open-delivery-requests');
            setDeliveryRequests(data.donations || []);
        } catch {
            // silently fail — this is supplementary
        } finally {
            setLoadingDelivery(false);
        }
    }, []);

    const fetchMissions = useCallback(async () => {
        setLoading(true);
        try {
            const data = await DonationService.getAvailableMissions();
            setMissions(data);
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to fetch available missions.",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchMissions();
        fetchDeliveryRequests();
    }, [fetchMissions, fetchDeliveryRequests]);

    const handleAccept = async (id: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        setAcceptingId(id);
        try {
            await DonationService.acceptMission(id);
            toast({
                title: "Mission Secured! 🚀",
                description: "Initializing your rescue route...",
                className: "bg-emerald-600 text-white border-none shadow-xl"
            });
            // Brief delay for the toast/experience
            setTimeout(() => {
                navigate("/volunteer/active");
            }, 1000);
        } catch (error: unknown) {
            const err = error as { response?: { data?: { message?: string } } };
            const message = err.response?.data?.message || "Failed to accept mission.";
            toast({
                title: "Mission Unavailable",
                description: message,
                variant: "destructive"
            });
            fetchMissions();
        } finally {
            setAcceptingId(null);
        }
    };

    const getUrgency = (expiry: string) => {
        const hours = (new Date(expiry).getTime() - new Date().getTime()) / (1000 * 60 * 60);
        if (hours < 2) return "High";
        if (hours < 6) return "Normal";
        return "Low";
    };

    const filteredMissions = missions.filter(m =>
        filter === "All" || m.foodCategory === filter.toLowerCase()
    );

    const isTooHeavy = (quantity: string) => {
        const kg = parseInt(quantity.match(/\d+/)?.[0] || "0");
        return user?.volunteerProfile?.maxWeight ? kg > user.volunteerProfile.maxWeight : false;
    };

    return (
        <div className="space-y-6">
            <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between sticky top-0 z-20 bg-background/95 backdrop-blur-md pb-4 pt-2 -mt-2">
                <div>
                    <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
                        Available Jobs
                        <Badge variant="secondary" className="bg-primary/10 text-primary border-none">
                            {filteredMissions.length} Near You
                        </Badge>
                    </h1>
                    <p className="text-muted-foreground text-sm font-medium">
                        {user?.volunteerProfile?.vehicleType
                            ? `Matching results for your ${user.volunteerProfile.vehicleType}.`
                            : "Configure your vehicle in settings for better matching."
                        }
                    </p>
                </div>
            </header>

            {/* ── Community Delivery Requests Section ── */}
            {(loadingDelivery || deliveryRequests.length > 0) && (
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-xl bg-orange-100 dark:bg-orange-950/50 flex items-center justify-center">
                            <Users2 className="h-4 w-4 text-orange-500" />
                        </div>
                        <div>
                            <h2 className="text-base font-black tracking-tight flex items-center gap-2">
                                Community Delivery Requests
                                {!loadingDelivery && (
                                    <Badge className="bg-orange-500/10 text-orange-600 border-orange-200 dark:border-orange-800 text-[10px] font-black">
                                        {deliveryRequests.length} need help
                                    </Badge>
                                )}
                            </h2>
                            <p className="text-xs text-muted-foreground font-medium">
                                Community members who can't pick up food themselves — help deliver to them.
                            </p>
                        </div>
                    </div>

                    {loadingDelivery ? (
                        <div className="grid sm:grid-cols-2 gap-3">
                            {[1, 2].map(i => (
                                <div key={i} className="h-28 rounded-2xl border border-border/50 bg-muted/30 animate-pulse" />
                            ))}
                        </div>
                    ) : (
                        <div className="grid sm:grid-cols-2 gap-3">
                            {deliveryRequests.map(req => {
                                const { label: timeLabel, urgent } = getTimeLeft(req.expiryDate);
                                return (
                                    <div
                                        key={req.id}
                                        className={cn(
                                            'relative rounded-2xl border-2 p-4 transition-all hover:shadow-lg hover:-translate-y-0.5 cursor-pointer',
                                            urgent
                                                ? 'border-orange-300 dark:border-orange-700 bg-orange-50/40 dark:bg-orange-950/20'
                                                : 'border-border hover:border-orange-200 dark:hover:border-orange-800'
                                        )}
                                        onClick={() => setSelectedDelivery(req)}
                                    >
                                        {/* Urgency strip */}
                                        {urgent && (
                                            <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-gradient-to-r from-orange-400 to-amber-400" />
                                        )}

                                        <div className="flex items-start gap-3">
                                            {/* Photo / emoji */}
                                            <div className="shrink-0 h-14 w-14 rounded-xl overflow-hidden flex items-center justify-center text-2xl bg-orange-100 dark:bg-orange-950/40">
                                                {req.photos && req.photos.length > 0 ? (
                                                    <img src={req.photos[0]} alt={req.title} className="w-full h-full object-cover" />
                                                ) : (
                                                    <span>{req.foodCategory === 'cooked' ? '🍲' : req.foodCategory === 'raw' ? '🥬' : '📦'}</span>
                                                )}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-1">
                                                    <h3 className="font-black text-sm leading-tight truncate">{req.title}</h3>
                                                    <span className={cn(
                                                        'flex items-center gap-0.5 text-[10px] font-black px-1.5 py-0.5 rounded-full shrink-0',
                                                        urgent ? 'bg-orange-500 text-white' : 'bg-muted text-muted-foreground'
                                                    )}>
                                                        <Timer className="h-2.5 w-2.5" />
                                                        {timeLabel}
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                                                    <MapPin className="h-3 w-3 shrink-0 text-orange-500" />
                                                    <span className="truncate font-medium">{req.pickupAddress}</span>
                                                </div>

                                                <div className="flex items-center gap-3 mt-2">
                                                    <span className="flex items-center gap-1 text-[11px] font-bold text-orange-600 dark:text-orange-400">
                                                        <Users2 className="h-3 w-3" />
                                                        {req.deliveryRequestCount} {req.deliveryRequestCount === 1 ? 'person' : 'people'} need delivery
                                                    </span>
                                                    <span className="text-[11px] font-medium text-muted-foreground">{req.quantity}</span>
                                                </div>

                                                {/* Requesters */}
                                                {req.deliveryRequesters.length > 0 && (
                                                    <div className="mt-2 flex flex-wrap gap-1">
                                                        {req.deliveryRequesters.slice(0, 3).map((r, i) => (
                                                            <span key={i} className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950/50 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800">
                                                                <Phone className="h-2.5 w-2.5" />
                                                                {r.name}
                                                            </span>
                                                        ))}
                                                        {req.deliveryRequesters.length > 3 && (
                                                            <span className="text-[10px] font-bold text-muted-foreground">+{req.deliveryRequesters.length - 3} more</span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between gap-2">
                                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Tap for details &amp; navigation →</span>
                                            <button
                                                id={`deliver-btn-${req.id}`}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wide text-white bg-orange-500 hover:bg-orange-600 active:scale-95 transition-all shadow-md shadow-orange-500/20"
                                                onClick={e => { e.stopPropagation(); setSelectedDelivery(req); }}
                                            >
                                                <Truck className="h-3 w-3" />
                                                I'll Deliver This
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    <div className="border-t border-border/50 mt-2" />
                </div>
            )}



            <AnimatePresence mode="wait">
                {loading ? (
                    <motion.div
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="grid gap-4"
                    >
                        {[1, 2, 3].map(i => (
                            <Card key={i} className="border-border/50 overflow-hidden">
                                <div className="flex flex-col md:flex-row h-full">
                                    <div className="w-full md:w-1/3 h-48 md:h-auto overflow-hidden">
                                        <Skeleton className="h-full w-full rounded-none" />
                                    </div>
                                    <div className="flex-1 p-6 space-y-4">
                                        <Skeleton className="h-6 w-3/4" />
                                        <Skeleton className="h-4 w-1/2" />
                                        <div className="flex gap-2">
                                            <Skeleton className="h-8 w-24 rounded-full" />
                                            <Skeleton className="h-8 w-24 rounded-full" />
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </motion.div>
                ) : !user?.isOnline ? (
                    <motion.div
                        key="offline"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="rounded-3xl border-2 border-dashed border-border/60 p-20 flex flex-col items-center justify-center text-center bg-muted/5 mt-10"
                    >
                        <div className="relative mb-6">
                            <div className="absolute inset-0 bg-amber-500/20 rounded-full animate-ping" />
                            <div className="relative size-20 rounded-full bg-amber-500/10 flex items-center justify-center">
                                <AlertCircle className="size-10 text-amber-500" />
                            </div>
                        </div>
                        <h2 className="text-2xl font-black mb-2">You're Currently Offline</h2>
                        <p className="text-muted-foreground max-w-sm mb-8 font-medium">
                            Go online in the sidebar to start receiving new mission alerts and see available jobs in your area.
                        </p>
                    </motion.div>
                ) : filteredMissions.length === 0 ? (
                    <motion.div
                        key="empty"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="rounded-3xl border-2 border-dashed border-border/60 p-20 flex flex-col items-center justify-center text-center bg-muted/5 mt-10"
                    >
                        <div className="relative mb-6">
                            <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
                            <div className="relative size-20 rounded-full bg-primary/10 flex items-center justify-center">
                                <Navigation className="size-10 mt-1 text-primary " />
                            </div>
                        </div>
                        <h2 className="text-2xl font-black mb-2">Scanning Your Area...</h2>
                        <p className="text-muted-foreground max-w-sm mb-8 font-medium">
                            No {filter !== "All" ? filter.toLowerCase() : ""} missions found within your delivery range. Try switching your vehicle or status!
                        </p>
                        <Button className="rounded-full font-bold px-8 shadow-glow shadow-primary/30 h-12 text-lg" onClick={fetchMissions}>
                            Refresh Map
                        </Button>
                    </motion.div>
                ) : view === "list" ? (
                    <motion.div
                        key="list"
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        className="grid gap-5"
                    >
                        {filteredMissions.map((mission) => (
                            <MissionCard
                                key={mission.id}
                                mission={mission}
                                onAccept={handleAccept}
                                onView={setSelectedMission}
                                isAccepting={acceptingId === mission.id}
                                isTooHeavy={isTooHeavy(mission.quantity)}
                            />
                        ))}
                    </motion.div>
                ) : (
                    <motion.div
                        key="map"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="rounded-3xl border border-border/50 aspect-[16/9] md:aspect-[21/9] w-full bg-muted overflow-hidden relative shadow-2xl"
                    >
                        <MissionsMap
                            missions={filteredMissions}
                            userCoords={user?.coordinates?.lat ? user.coordinates : (user?.volunteerProfile?.currentLocation?.coordinates?.[0] ? {
                                lat: user.volunteerProfile.currentLocation.coordinates[1],
                                lng: user.volunteerProfile.currentLocation.coordinates[0]
                            } : undefined)}
                            onSelectMission={setSelectedMission}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Mission Detail Sheet — NGO missions */}
            <Sheet open={!!selectedMission} onOpenChange={() => setSelectedMission(null)}>
                <SheetContent side="right" className="w-full sm:max-w-xl border-l-0 p-0 sm:rounded-l-3xl overflow-hidden bg-card">
                    {selectedMission && (
                        <div className="h-full flex flex-col">
                            <div className="h-64 bg-muted relative overflow-hidden">
                                {selectedMission.image || (selectedMission.photos && selectedMission.photos.length > 0) ? (
                                    <img
                                        src={selectedMission.photos?.[0] || selectedMission.image}
                                        alt={selectedMission.title}
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    <div className="absolute inset-0 bg-[url('https://api.placeholder.com/600/400')] bg-cover grayscale opacity-50" />
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent" />
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute top-4 left-4 size-10 rounded-full bg-background/50 backdrop-blur-md z-10"
                                    onClick={() => setSelectedMission(null)}
                                >
                                    <ArrowRight className="size-6 rotate-180" />
                                </Button>
                            </div>

                            <div className="flex-1 p-8 -mt-10 relative bg-card rounded-t-3xl border-t border-border/50 overflow-y-auto custom-scrollbar">
                                <div className="space-y-8">
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <Badge className="bg-primary/20 text-primary uppercase text-xs font-black tracking-widest">{selectedMission.foodCategory}</Badge>
                                            <span className="text-sm font-black text-muted-foreground">ID: {selectedMission.id?.substring(0, 8).toUpperCase()}</span>
                                        </div>
                                        <SheetTitle className="text-4xl font-black leading-tight tracking-tighter">
                                            {selectedMission.title}
                                        </SheetTitle>
                                        <SheetDescription className="text-base font-medium">
                                            Direct rescue from <span className="text-foreground font-bold">{selectedMission.donorName}</span> to <span className="text-foreground font-bold">{selectedMission.ngoName || "Assigned NGO Hub"}</span>.
                                        </SheetDescription>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-muted/50 p-4 rounded-2xl border border-border/30">
                                            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Quantity</p>
                                            <p className="text-lg font-black">{selectedMission.quantity}</p>
                                        </div>
                                        <div className="bg-muted/50 p-4 rounded-2xl border border-border/30">
                                            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Deadline</p>
                                            <p className="text-lg font-black text-destructive">
                                                {new Date(selectedMission.expiryTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        <h4 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Rescue Route</h4>

                                        <div className="relative space-y-10 pl-6 border-l-2 border-dashed border-border/80 ml-2">
                                            <div className="relative">
                                                <div className="absolute -left-[33px] top-1 size-4 rounded-full bg-emerald-500 border-4 border-card shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                                                <h5 className="font-black text-lg">Pickup</h5>
                                                <p className="text-muted-foreground font-medium">{selectedMission.address}</p>
                                                <p className="text-xs text-primary font-bold mt-1">Provider: {selectedMission.donorName}</p>
                                            </div>

                                            <div className="relative">
                                                <div className="absolute -left-[33px] top-1 size-4 rounded-full bg-primary border-4 border-card shadow-[0_0_10px_rgba(var(--primary),0.5)]" />
                                                <h5 className="font-black text-lg">Drop-off</h5>
                                                <p className="text-muted-foreground font-medium">{selectedMission.ngoAddress || "NGO Hub Location"}</p>
                                                <p className="text-xs text-primary font-bold mt-1">Recipient NGO: {selectedMission.ngoName || "TBD"}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-4">
                                        <div className={cn(
                                            "flex items-center gap-3 p-4 rounded-2xl border text-xs font-bold",
                                            isTooHeavy(selectedMission.quantity)
                                                ? "bg-destructive/10 border-destructive/20 text-destructive"
                                                : "bg-amber-500/10 border-amber-500/20 text-amber-500"
                                        )}>
                                            <AlertCircle className="size-5 shrink-0" />
                                            <p>
                                                {isTooHeavy(selectedMission.quantity)
                                                    ? `Action Required: This load (${selectedMission.quantity}) exceeds your vehicle limits.`
                                                    : `Safety First: Check food temperature and seals upon arrival.`
                                                }
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-8 border-t border-border/50 bg-background/50 backdrop-blur-md">
                                <Button
                                    disabled={isTooHeavy(selectedMission.quantity) || acceptingId === selectedMission.id}
                                    className="w-full h-16 rounded-2xl font-black text-xl shadow-glow shadow-primary/30 group"
                                    onClick={(e) => handleAccept(selectedMission.id!, e)}
                                >
                                    {acceptingId === selectedMission.id ? (
                                        <Loader2 className="animate-spin size-6" />
                                    ) : (
                                        <>
                                            Accept Mission
                                            <CheckCircle2 className="ml-2 size-6 group-active:scale-125 transition-transform" />
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}
                </SheetContent>
            </Sheet>

            {/* Community Delivery Request Detail Sheet */}
            <Sheet open={!!selectedDelivery} onOpenChange={() => setSelectedDelivery(null)}>
                <SheetContent side="right" className="w-full sm:max-w-xl border-l-0 p-0 sm:rounded-l-3xl overflow-hidden bg-card">
                    {selectedDelivery && (() => {
                        const { label: timeLabel, urgent } = getTimeLeft(selectedDelivery.expiryDate);
                        const emoji = selectedDelivery.foodCategory === 'cooked' ? '🍲' : selectedDelivery.foodCategory === 'raw' ? '🥬' : '📦';
                        return (
                            <div className="h-full flex flex-col">
                                {/* Hero image or gradient */}
                                <div className="h-64 bg-muted relative overflow-hidden">
                                    {selectedDelivery.photos && selectedDelivery.photos.length > 0 ? (
                                        <img
                                            src={selectedDelivery.photos[0]}
                                            alt={selectedDelivery.title}
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-950/40 dark:to-amber-950/40">
                                            <span className="text-8xl">{emoji}</span>
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent" />
                                    {/* Back button */}
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="absolute top-4 left-4 size-10 rounded-full bg-background/50 backdrop-blur-md z-10"
                                        onClick={() => setSelectedDelivery(null)}
                                    >
                                        <ArrowRight className="size-6 rotate-180" />
                                    </Button>
                                    {/* Community badge */}
                                    <div className="absolute top-4 right-4 z-10">
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-500 text-white text-[10px] font-black uppercase tracking-widest shadow-lg">
                                            <Users2 className="h-3 w-3" />
                                            Community Delivery
                                        </span>
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="flex-1 p-8 -mt-10 relative bg-card rounded-t-3xl border-t border-border/50 overflow-y-auto custom-scrollbar">
                                    <div className="space-y-8">
                                        {/* Title area */}
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <Badge className="bg-orange-500/20 text-orange-600 uppercase text-xs font-black tracking-widest border-orange-200 dark:border-orange-800">
                                                    {selectedDelivery.foodCategory || 'Food'}
                                                </Badge>
                                                <span className={cn(
                                                    'flex items-center gap-1 text-xs font-black px-2.5 py-1 rounded-full',
                                                    urgent ? 'bg-orange-500 text-white' : 'bg-muted text-muted-foreground'
                                                )}>
                                                    <Timer className="h-3 w-3" />
                                                    {timeLabel}
                                                </span>
                                            </div>
                                            <SheetTitle className="text-4xl font-black leading-tight tracking-tighter">
                                                {selectedDelivery.title}
                                            </SheetTitle>
                                            <SheetDescription className="text-base font-medium">
                                                Community pickup — {selectedDelivery.deliveryRequestCount} {selectedDelivery.deliveryRequestCount === 1 ? 'person needs' : 'people need'} this delivered to them.
                                            </SheetDescription>
                                        </div>

                                        {/* Stats grid */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-muted/50 p-4 rounded-2xl border border-border/30">
                                                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Quantity</p>
                                                <p className="text-lg font-black">{selectedDelivery.quantity}</p>
                                            </div>
                                            <div className="bg-muted/50 p-4 rounded-2xl border border-border/30">
                                                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Expires At</p>
                                                <p className="text-lg font-black text-destructive">
                                                    {new Date(selectedDelivery.expiryDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Route timeline */}
                                        <div className="space-y-4">
                                            <h4 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Delivery Route</h4>
                                            <div className="relative space-y-10 pl-6 border-l-2 border-dashed border-border/80 ml-2">
                                                {/* Step 1 — Pickup */}
                                                <div className="relative">
                                                    <div className="absolute -left-[33px] top-1 size-4 rounded-full bg-emerald-500 border-4 border-card shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                                                    <h5 className="font-black text-lg">1. Collect from Donor</h5>
                                                    <p className="text-muted-foreground font-medium">{selectedDelivery.pickupAddress}</p>
                                                    <a
                                                        href={`https://maps.google.com/?q=${encodeURIComponent(selectedDelivery.pickupAddress)}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline mt-1"
                                                    >
                                                        <Navigation className="h-3 w-3" />
                                                        Navigate to pickup
                                                    </a>
                                                </div>

                                                {/* Step 2 — Deliver to requesters */}
                                                <div className="relative">
                                                    <div className="absolute -left-[33px] top-1 size-4 rounded-full bg-orange-500 border-4 border-card shadow-[0_0_10px_rgba(249,115,22,0.5)]" />
                                                    <h5 className="font-black text-lg">2. Deliver to {selectedDelivery.deliveryRequestCount === 1 ? 'Requester' : 'Requesters'}</h5>
                                                    <p className="text-xs text-muted-foreground font-medium mb-2">Contact each person to get their delivery address.</p>
                                                    <div className="space-y-2">
                                                        {selectedDelivery.deliveryRequesters.map((r, i) => (
                                                            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800">
                                                                <div className="h-8 w-8 rounded-full bg-orange-200 dark:bg-orange-900 flex items-center justify-center text-sm font-black text-orange-700 dark:text-orange-400 shrink-0">
                                                                    {r.name.charAt(0).toUpperCase()}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-sm font-black text-orange-800 dark:text-orange-300">{r.name}</p>
                                                                    <p className="text-[10px] text-orange-600/70 dark:text-orange-400/70">
                                                                        Requested {new Date(r.reservedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                    </p>
                                                                </div>
                                                                <Truck className="h-4 w-4 text-orange-500 shrink-0" />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Safety note */}
                                        <div className="flex items-start gap-3 p-4 rounded-2xl border bg-amber-500/10 border-amber-500/20 text-amber-600 text-xs font-bold">
                                            <AlertCircle className="size-5 shrink-0 mt-0.5" />
                                            <p>Safety First: Check food temperature and packaging upon collection. Contact each requester ahead of time to confirm their delivery address.</p>
                                        </div>
                                    </div>
                                </div>

                                {/* CTA footer */}
                                <div className="p-8 border-t border-border/50 bg-background/50 backdrop-blur-md space-y-3">
                                    <a
                                        href={`https://maps.google.com/?q=${encodeURIComponent(selectedDelivery.pickupAddress)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-center gap-2 w-full h-16 rounded-2xl font-black text-xl bg-orange-500 hover:bg-orange-600 text-white shadow-glow shadow-orange-500/30 transition-colors group"
                                    >
                                        <Navigation className="size-6 group-hover:animate-pulse" />
                                        Navigate to Pickup
                                    </a>
                                    <p className="text-[10px] text-center text-muted-foreground">
                                        Opens Google Maps — collect food, then deliver to the requesters listed above.
                                    </p>
                                </div>
                            </div>
                        );
                    })()}
                </SheetContent>
            </Sheet>
        </div>
    );
}
