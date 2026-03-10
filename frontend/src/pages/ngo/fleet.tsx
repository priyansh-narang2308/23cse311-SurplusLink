/** Real-time monitoring of active delivery volunteers (Fleet Management) */
import React, { useState, useEffect } from "react";
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
    Truck,
    User,
    Navigation,
    Clock,
    Search,
    Filter,
    ArrowRight,
    MapPin,
    AlertCircle,
    Phone,
    Mail,
    ChevronRight,
    Loader2
} from "lucide-react";
import { getNgoVolunteers } from "@/services/user.service";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface Volunteer {
    id: string;
    name: string;
    email: string;
    phone: string;
    status: 'on_route' | 'available' | 'busy' | 'offline' | 'at_pickup';
    currentTask: string | null;
    completedTasks: number;
    rating: number;
    avatar: string;
}

const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
};

export default function NgoFleetDashboard() {
    const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState("");

    const fetchVolunteers = React.useCallback(async () => {
        try {
            const data = await getNgoVolunteers();
            setVolunteers(data);
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to fetch fleet data.",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchVolunteers();
        const interval = setInterval(fetchVolunteers, 60000); // Poll every 60s
        return () => clearInterval(interval);
    }, [fetchVolunteers]);

    const filteredVolunteers = volunteers.filter(v =>
        v.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getStatusColor = (status: string) => {
        switch (status) {
            case "on_route": return "bg-cyan-500/10 text-cyan-500 border-cyan-500/20";
            case "at_pickup": return "bg-amber-500/10 text-amber-500 border-amber-500/20";
            case "available": return "bg-emerald-500/10 text-emerald-500 border-emerald-200/20";
            case "busy": return "bg-teal-500/10 text-teal-500 border-teal-500/20";
            default: return "bg-muted text-muted-foreground";
        }
    };

    return (
        <motion.div
            initial="hidden"
            animate="visible"
            variants={containerVariants}
            className="space-y-8 p-6"
        >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-4xl font-black tracking-tight">Volunteer <span className="text-primary">Activity</span></h1>
                    <p className="text-muted-foreground font-medium">Real-time logistics and volunteer deployment monitoring.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <input
                            type="text"
                            placeholder="Search volunteer..."
                            className="h-11 w-64 rounded-xl border border-border/50 bg-card pl-10 pr-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex h-64 items-center justify-center">
                    <Loader2 className="animate-spin text-primary size-10" />
                </div>
            ) : filteredVolunteers.length === 0 ? (
                <Card className="border-dashed border-2 p-12 text-center bg-card/50">
                    <div className="size-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                        <Truck className="size-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-xl font-black">No Active Volunteers</h3>
                    <p className="text-muted-foreground font-medium mt-1">There are no volunteers currently delivering to your NGO.</p>
                </Card>
            ) : (
                <div className="grid gap-6">
                    {filteredVolunteers.map((vol) => (
                        <motion.div key={vol.id} variants={itemVariants}>
                            <Card className="group relative overflow-hidden border-border/50 hover:border-primary/30 transition-all hover:shadow-xl hover:shadow-primary/5 bg-card/50 backdrop-blur-sm">
                                <div className="absolute top-0 left-0 w-1 h-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                                <CardContent className="p-6">
                                    <div className="flex flex-col md:flex-row items-center gap-8">
                                        <div className="flex items-center gap-4 min-w-[240px]">
                                            <div className="relative">
                                                <img src={vol.avatar} alt={vol.name} className="size-16 rounded-2xl object-cover group-hover:ring-primary/30 transition-all" />
                                                <div className={cn(
                                                    "absolute -bottom-1 -right-1 size-5 rounded-full border-4 border-card",
                                                    vol.status === 'offline' ? "bg-muted" : "bg-emerald-500 animate-pulse"
                                                )} />
                                            </div>
                                            <div className="space-y-1 text-left">
                                                <h3 className="text-lg font-black tracking-tight flex items-center gap-2">
                                                    {vol.name}
                                                    {vol.completedTasks > 10 && (
                                                        <Badge className="bg-teal-500/10 text-teal-600 border-none text-[9px] uppercase font-black tracking-widest">
                                                            High Load
                                                        </Badge>
                                                    )}
                                                </h3>
                                                <div className="flex items-center gap-3 text-xs text-muted-foreground font-bold uppercase tracking-tighter">

                                                    <span className="flex items-center gap-1">★ {vol.rating.toFixed(1)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex-1 flex items-center justify-start md:justify-center">
                                            <div className={cn("px-4 py-2 rounded-2xl border font-black text-xs uppercase tracking-widest flex items-center gap-2", getStatusColor(vol.status))}>
                                                <div className={cn("size-2 rounded-full", vol.status === 'on_route' ? "bg-cyan-500" : vol.status === 'at_pickup' ? "bg-amber-500" : "bg-emerald-500")} />
                                                {vol.status.replace('_', ' ')}
                                            </div>
                                        </div>

                                        <div className="flex-[2] text-left">
                                            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Current Activity</p>
                                            <div className="flex items-center gap-3">
                                                <Navigation className="size-4 text-primary" />
                                                <p className="text-sm font-bold text-foreground">
                                                    {vol.currentTask || "Idle / Waiting for Mission"}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">

                                            <Button variant="ghost" size="icon" className="rounded-xl hover:bg-primary/10 hover:text-primary" asChild>
                                                <a href={`mailto:${vol.email}`}><Mail className="size-5" /></a>
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </div>
            )}
        </motion.div>
    );
}
