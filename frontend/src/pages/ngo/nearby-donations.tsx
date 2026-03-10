/** Discovery feed for donations within the NGO's operating radius */
import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import DonationService from '@/services/donation.service';
import { Donation } from '@/types';
import { PageHeader } from '@/components/common/page-header';
import { DonationCard } from '@/components/common/donation-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious,
} from "@/components/ui/carousel";
import { Loader2, MapPin, Filter, AlertCircle, Search, Calendar, Clock, Package, User, Image as ImageIcon, Zap } from 'lucide-react';
import { getTimeUntil, formatTime } from '@/utils/formatters';
import { Badge } from '@/components/ui/badge';

export function NearbyDonationsPage() {
    const { toast } = useToast();
    const [donations, setDonations] = useState<Donation[]>([]);
    const [loading, setLoading] = useState(true);
    const [foodType, setFoodType] = useState('all');
    const [onlyExpiring, setOnlyExpiring] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [capacityWarning, setCapacityWarning] = useState(false);
    const [unmetNeed, setUnmetNeed] = useState(0);

    const [rejectId, setRejectId] = useState<string | null>(null);
    const [rejectCategory, setRejectCategory] = useState<string>('');
    const [rejectReason, setRejectReason] = useState('');
    const [isRejecting, setIsRejecting] = useState(false);
    const [viewDonation, setViewDonation] = useState<Donation | null>(null);



    const loadFeed = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const data = await DonationService.getSmartFeed();
            setDonations(data.donations);
            setCapacityWarning(data.capacityWarning);
            setUnmetNeed(data.unmetNeed);
        } catch (error) {
            console.error(error);
            if (!silent) {
                toast({
                    title: "Failed to load feed",
                    description: "Could not fetch nearby donations. Please try again.",
                    variant: 'destructive'
                });
            }
        } finally {
            if (!silent) setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        loadFeed();
        const interval = setInterval(() => loadFeed(true), 60000); // 60s Live Feed
        return () => clearInterval(interval);
    }, [loadFeed]);

    const handleClaim = async (id: string) => {
        try {
            await DonationService.claimDonation(id);
            toast({
                title: "Donation Secured Successfully 🍎",
                description: "This item is now in your 'Accepted' list. Please arrange pickup soon.",
                className: "bg-emerald-600 dark:bg-emerald-600 text-white border-none shadow-xl",
                duration: 4000
            });
            loadFeed();
        } catch (error) {
            console.error(error);
            toast({
                title: "Claim Failed",
                description: "Could not claim this donation. It might have been taken.",
                variant: 'destructive'
            });
        }
    };

    const handleConfirmReject = async () => {
        if (!rejectId || !rejectCategory) {
            toast({ title: "Reason Required", description: "Please select a safety category.", variant: "destructive" });
            return;
        }
        setIsRejecting(true);
        try {
            const finalReason = `[${rejectCategory}] ${rejectReason}`;
            await DonationService.rejectDonation(rejectId, finalReason);
            toast({
                title: "Donation Flagged",
                description: "Thank you for helping keep the platform safe.",
            });
            setRejectId(null);
            setRejectCategory('');
            setRejectReason('');
            loadFeed();
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to reject donation.",
                variant: 'destructive'
            });
        } finally {
            setIsRejecting(false);
        }
    };

    const filteredDonations = donations.filter(d => {
        // Search
        if (searchQuery && !(d.title || d.foodType).toLowerCase().includes(searchQuery.toLowerCase())) return false;
        // Food Category
        if (foodType !== 'all' && d.foodCategory?.toLowerCase() !== foodType.toLowerCase()) return false;
        // Expiry (<24h)
        if (onlyExpiring) {
            const timeLeft = getTimeUntil(d.expiryTime);
            if (timeLeft.includes('d')) return false;
        }
        return true;
    });

    return (
        <div className="flex flex-col md:flex-row gap-0 md:gap-6 animate-fade-in -mx-4 md:mx-0 md:h-[calc(100vh-4rem)]">
            <div className="flex-1 flex flex-col h-full overflow-hidden md:rounded-xl md:border bg-background">
                <div className="p-4 border-b space-y-4 bg-muted/10">
                    <PageHeader
                        title={
                            <div className="flex items-center gap-2">
                                Smart Feed
                                {!loading && donations.length > 0 && (
                                    <span className="flex h-3 w-3">
                                        <span className="animate-blink absolute inline-flex h-3 w-3 rounded-full bg-primary opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                                    </span>
                                )}
                            </div>
                        }
                        description="Intelligently prioritized donations based on your needs and capacity."
                    />

                    {capacityWarning && (
                        <div className="bg-rose-50 border border-rose-200 p-3 rounded-lg flex items-center gap-3 text-rose-800 animate-in fade-in slide-in-from-top-2">
                            <AlertCircle className="h-5 w-5 shrink-0" />
                            <div className="flex-1">
                                <p className="text-sm font-bold">Capacity Warning</p>
                                <p className="text-xs">Your organization is currently at or near max capacity. Consider completing active claims before taking more.</p>
                            </div>
                        </div>
                    )}

                    {!capacityWarning && unmetNeed > 0 && unmetNeed < 100 && (
                        <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg flex items-center gap-3 text-amber-800 animate-in fade-in slide-in-from-top-2">
                            <Zap className="h-5 w-5 shrink-0" />
                            <div className="flex-1">
                                <p className="text-sm font-bold">Medium Capacity Remaining</p>
                                <p className="text-xs">You can still accommodate approximately {unmetNeed} more meals today.</p>
                            </div>
                        </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Input
                                placeholder="Search food items..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9"
                            />
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        </div>
                        <Select value={foodType} onValueChange={setFoodType}>
                            <SelectTrigger className="w-full sm:w-[150px]">
                                <SelectValue placeholder="Category" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Types</SelectItem>
                                <SelectItem value="cooked">Cooked</SelectItem>
                                <SelectItem value="raw">Raw</SelectItem>
                                <SelectItem value="packaged">Packaged</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex items-center gap-2">
                        <Checkbox
                            id="expiring"
                            checked={onlyExpiring}
                            onCheckedChange={(c) => setOnlyExpiring(c as boolean)}
                        />
                        <Label htmlFor="expiring" className="text-sm cursor-pointer">
                            Expiring Soon (within 24h)
                        </Label>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {loading ? (
                        <div className="flex items-center justify-center h-40">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : filteredDonations.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-[50vh] text-center p-8 animate-in fade-in duration-500">
                            <div className="relative mb-6">
                                <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
                                <div className="bg-background relative p-4 rounded-full border shadow-sm">
                                    <AlertCircle className="h-8 w-8 text-muted-foreground" />
                                </div>
                            </div>
                            <h3 className="font-bold text-lg text-foreground mb-2">No donations found</h3>
                            <p className="text-sm text-muted-foreground max-w-[280px] mx-auto leading-relaxed">
                                We couldn't find any donations matching your current filters. Try expanding your search radius or clearing filters.
                            </p>
                            <Button variant="outline" onClick={() => { setSearchQuery(''); setFoodType('all'); setOnlyExpiring(false); }} className="rounded-full px-6">
                                Clear Filters
                            </Button>
                        </div>
                    ) : (
                        filteredDonations.map(donation => (
                            <DonationCard
                                key={donation.id}
                                donation={donation}
                                showActions
                                onAccept={handleClaim}
                                onReject={(id) => setRejectId(id)}
                                onView={() => setViewDonation(donation)}
                                disabled={donation.status !== 'active'}
                            />
                        ))
                    )}
                </div>
            </div>

            <Dialog open={!!rejectId} onOpenChange={(o) => {
                if (!o) {
                    setRejectId(null);
                    setRejectCategory('');
                    setRejectReason('');
                }
            }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Report Safety Concern</DialogTitle>
                        <DialogDescription>
                            Flagging this donation helps protect the community. The donor will be notified.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>Primary Concern</Label>
                            <Select onValueChange={setRejectCategory} value={rejectCategory}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a safety category" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Safety: Hygiene">Hygiene / Safety Risk</SelectItem>
                                    <SelectItem value="Safety: Expired">Expired / Spoiled Food</SelectItem>
                                    <SelectItem value="Safety: Storage">Improper Storage</SelectItem>
                                    <SelectItem value="Logistics: Distance">Logistics / Too Far</SelectItem>
                                    <SelectItem value="Other">Other Reason</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Additional Details (Optional)</Label>
                            <Textarea
                                placeholder="Describe the issue (e.g., 'Uncovered food', 'Visible mold')..."
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                className="resize-none"
                            />
                        </div>

                        {rejectCategory?.startsWith('Safety') && (
                            <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg flex gap-2 text-sm text-amber-800 animate-in fade-in slide-in-from-top-2">
                                <AlertCircle className="h-5 w-5 shrink-0" />
                                <p>This will flag the donation and notify the donor immediately.</p>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => {
                            setRejectId(null);
                            setRejectCategory('');
                            setRejectReason('');
                        }}>Cancel</Button>
                        <Button variant="destructive" onClick={handleConfirmReject} disabled={isRejecting || !rejectCategory}>
                            {isRejecting ? 'Submitting...' : 'Flag & Reject'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>


            <Dialog open={!!viewDonation} onOpenChange={(o) => !o && setViewDonation(null)}>
                <DialogContent className="max-w-2xl overflow-hidden p-0 gap-0">
                    <div className="relative w-full bg-slate-100 aspect-video group">
                        {(() => {

                            const photos = viewDonation?.photos || (viewDonation?.image ? [viewDonation.image] : []);

                            if (photos.length > 1) {
                                return (
                                    <Carousel className="w-full h-full">
                                        <CarouselContent>
                                            {photos.map((url: string, index: number) => (
                                                <CarouselItem key={index} className="h-full">
                                                    <div className="h-full w-full flex items-center justify-center bg-black">
                                                        <img src={url} alt={`Photo ${index + 1}`} className="object-contain w-full h-full max-h-[400px]" />
                                                    </div>
                                                </CarouselItem>
                                            ))}
                                        </CarouselContent>
                                        <CarouselPrevious className="left-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        <CarouselNext className="right-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </Carousel>
                                );
                            } else if (photos.length === 1) {
                                return <img src={photos[0]} alt={viewDonation?.title} className="object-cover w-full h-full" />;
                            } else {
                                return (
                                    <div className="flex flex-col items-center justify-center w-full h-full text-muted-foreground p-6">
                                        <ImageIcon className="h-16 w-16 opacity-20 mb-2" />
                                        <span className="text-sm">No image provided</span>
                                    </div>
                                );
                            }
                        })()}

                        <div className="absolute top-4 left-4 z-10">
                            <Badge className="bg-black/50 text-white backdrop-blur-md border-transparent hover:bg-black/60 capitalize">
                                {viewDonation?.foodType}
                            </Badge>
                        </div>
                    </div>

                    <div className="p-6">
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-bold">{viewDonation?.title}</DialogTitle>
                            <DialogDescription className="text-base">
                                Posted by {viewDonation?.donorName}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid grid-cols-2 gap-6 mt-6">
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <Label className="text-muted-foreground text-xs uppercase tracking-wider">Quantity</Label>
                                    <div className="flex items-center gap-2 font-medium">
                                        <Package className="h-4 w-4 text-primary" />
                                        {viewDonation?.quantity}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-muted-foreground text-xs uppercase tracking-wider">Expiry</Label>
                                    <div className="flex items-center gap-2 font-medium">
                                        <Clock className="h-4 w-4 text-primary" />
                                        {viewDonation?.expiryTime ? formatTime(viewDonation.expiryTime) : 'N/A'}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <Label className="text-muted-foreground text-xs uppercase tracking-wider">Location</Label>
                                    <div className="flex items-start gap-2 font-medium">
                                        <MapPin className="h-4 w-4 text-primary mt-0.5" />
                                        <span>{viewDonation?.address || viewDonation?.location}</span>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-muted-foreground text-xs uppercase tracking-wider">Pickup Window</Label>
                                    <div className="flex items-center gap-2 font-medium">
                                        <Calendar className="h-4 w-4 text-primary" />
                                        {viewDonation?.pickupWindow}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {viewDonation?.azureAiDetection && (
                            <div className="mt-6 p-4 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100/50 space-y-3">
                                <div className="flex items-center gap-2">
                                    <Zap className="h-4 w-4 text-indigo-600 fill-indigo-600" />
                                    <span className="text-sm font-bold text-indigo-900 tracking-tight">AI Food Analysis</span>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm text-indigo-800">
                                        Detected: <span className="font-semibold">{viewDonation.azureAiDetection.foodName}</span>
                                    </p>
                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                        {viewDonation.azureAiDetection.tags.map((tag, idx) => (
                                            <Badge key={idx} variant="secondary" className="bg-white/70 text-indigo-700 border-indigo-100 text-[10px] py-0 px-2">
                                                #{tag}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="mt-8 flex justify-end gap-3 pt-6 border-t">
                            <Button variant="outline" onClick={() => setViewDonation(null)}>Close</Button>
                            {viewDonation && (viewDonation.status === 'active' || !viewDonation.status) && (
                                <Button
                                    variant="hero"
                                    onClick={() => {
                                        handleClaim(viewDonation.id);
                                        setViewDonation(null);
                                    }}
                                >
                                    Claim Donation
                                </Button>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
