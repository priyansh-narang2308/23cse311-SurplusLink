/** Reusable card component for displaying donation details */
import { Donation } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { MapPin, Clock, Package, Calendar, CheckCircle, Zap, ShieldAlert, Navigation, Users2 } from 'lucide-react';
import { getTimeUntil, formatTime } from '@/utils/formatters';
import { cn } from '@/lib/utils';

interface DonationCardProps {
  donation: Donation;
  showActions?: boolean;
  onAccept?: (id: string) => void;
  onReject?: (id: string) => void;
  onView?: (id: string) => void;
  onCancel?: (id: string) => void;
  onEdit?: (id: string) => void;
  disabled?: boolean;
}

const statusColors: Record<Donation['status'], string> = {
  active: 'bg-warning/10 text-warning border-warning/30',
  assigned: 'bg-info/10 text-info border-info/30',
  accepted: 'bg-info/20 text-info border-info/40',
  at_pickup: 'bg-info/20 text-info border-info/40 font-bold animate-pulse',
  picked_up: 'bg-primary/10 text-primary border-primary/30',
  at_delivery: 'bg-primary/20 text-primary border-primary/40 font-bold animate-pulse',
  delivered: 'bg-primary/30 text-primary border-primary/50',
  completed: 'bg-success/10 text-success border-success/30',
  expired: 'bg-destructive/10 text-destructive border-destructive/30',
  cancelled: 'bg-muted text-muted-foreground border-muted',
  rejected: 'bg-destructive/20 text-destructive border-destructive/40',
};

const statusLabels: Record<Donation['status'], string> = {
  active: 'Pending',
  assigned: 'Claimed',
  accepted: 'Volunteer En Route',
  at_pickup: 'Volunteer at Pickup',
  picked_up: 'Food Picked Up',
  at_delivery: 'Volunteer at Delivery',
  delivered: 'Arrived at Destination',
  completed: 'Completed',
  expired: 'Expired',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
};

export function DonationCard({
  donation,
  showActions = false,
  onAccept,
  onReject,
  onView,
  onCancel,
  onEdit,
  disabled = false
}: DonationCardProps) {
  const timeLeft = getTimeUntil(donation.expiryTime);
  const isUrgent = timeLeft.includes('min') || (timeLeft.includes('h') && parseInt(timeLeft) < 3);

  return (
    <Card className="overflow-hidden transition-all duration-300 hover:shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-semibold text-lg">{donation.title}</h3>
            <p className="text-sm text-muted-foreground">{donation.donorName}</p>
          </div>
          <Badge className={cn("capitalize border", donation.status ? statusColors[donation.status] : statusColors.active)}>
            {donation.status ? statusLabels[donation.status] : "Pending"}
          </Badge>
        </div>

        {donation.matchPercentage !== undefined && (
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all duration-500",
                  donation.matchPercentage > 80 ? "bg-emerald-500" :
                    donation.matchPercentage > 50 ? "bg-amber-500" : "bg-slate-400"
                )}
                style={{ width: `${donation.matchPercentage}%` }}
              />
            </div>
            <span className="text-[10px] font-bold text-muted-foreground whitespace-nowrap">
              {donation.matchPercentage}% Match
            </span>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Package className="h-4 w-4 text-muted-foreground" />
            <span>{donation.quantity}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span>{donation.location}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>{donation.pickupWindow}</span>
          </div>
          <div className={cn(
            "flex items-center gap-2 text-sm",
            isUrgent && "text-warning font-medium"
          )}>
            <Clock className="h-4 w-4" />
            <span>{timeLeft}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-2">
          {donation.urgencyLevel && (
            <Badge className={cn("text-[10px] font-black uppercase tracking-tighter border",
              donation.urgencyLevel === 'Critical' && "bg-rose-500 text-white border-rose-600 animate-pulse",
              donation.urgencyLevel === 'Urgent' && "bg-amber-500 text-white border-amber-600",
              donation.urgencyLevel === 'Standard' && "bg-slate-100 text-slate-700 border-slate-200"
            )}>
              {donation.urgencyLevel === 'Critical' && <ShieldAlert className="h-3 w-3 mr-1" />}
              {donation.urgencyLevel === 'Urgent' && <Zap className="h-3 w-3 mr-1" />}
              {donation.urgencyLevel}
            </Badge>
          )}

          {donation.distance !== undefined && (
            <Badge variant="outline" className="text-[10px] font-bold bg-secondary/50">
              <Navigation className="h-3 w-3 mr-1" />
              {donation.distance < 1000 ? `${donation.distance}m` : `${(donation.distance / 1000).toFixed(1)}km`}
            </Badge>
          )}

          {donation.foodCategory && (
            <Badge className={cn("text-xs border capitalize",
              donation.foodCategory === 'cooked' && "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100",
              donation.foodCategory === 'raw' && "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100",
              donation.foodCategory === 'packaged' && "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
            )}>
              {donation.foodCategory === 'cooked' && '🍲 '}
              {donation.foodCategory === 'raw' && '🥬 '}
              {donation.foodCategory === 'packaged' && '📦 '}
              {donation.foodCategory}
            </Badge>
          )}
          {donation.storageReq && (
            <Badge variant="outline" className="text-xs border-slate-200 text-slate-600 bg-slate-50">
              {donation.storageReq.toLowerCase() === 'cold' && '❄️ '}
              {donation.storageReq.toLowerCase() === 'frozen' && '🧊 '}
              {donation.storageReq.toLowerCase() === 'dry' && '🍞 '}
              <span className="capitalize">{donation.storageReq}</span>
            </Badge>
          )}
          {donation.azureAiDetection && (
            <Badge className="text-xs bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 flex items-center gap-1">
              <Zap className="h-3 w-3 fill-indigo-700" />
              AI: {donation.azureAiDetection.foodName}
            </Badge>
          )}
          {donation.distributionMode === 'open' && (
            <Badge className="text-xs bg-orange-100 text-orange-700 border border-orange-200 font-bold flex items-center gap-1">
              <Users2 className="h-3 w-3" />
              Open Pickup
            </Badge>
          )}
        </div>

        {(donation.pickupPhoto || donation.deliveryPhoto) && (
          <div className="pt-3 border-t border-border space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-1">
              <CheckCircle className="h-3 w-3" /> Verification Proof
            </p>
            <div className="grid grid-cols-2 gap-2">
              {donation.pickupPhoto && (
                <div className="relative group/photo aspect-video rounded-lg overflow-hidden border bg-muted cursor-zoom-in" onClick={() => window.open(donation.pickupPhoto, '_blank')}>
                  <img src={donation.pickupPhoto} alt="Pickup proof" className="w-full h-full object-cover transition-transform group-hover/photo:scale-110" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/photo:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-[8px] font-bold text-white uppercase bg-emerald-600 px-2 py-1 rounded">At Pickup</span>
                  </div>
                </div>
              )}
              {donation.deliveryPhoto && (
                <div className="relative group/photo aspect-video rounded-lg overflow-hidden border bg-muted cursor-zoom-in" onClick={() => window.open(donation.deliveryPhoto, '_blank')}>
                  <img src={donation.deliveryPhoto} alt="Delivery proof" className="w-full h-full object-cover transition-transform group-hover/photo:scale-110" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/photo:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-[8px] font-bold text-white uppercase bg-primary px-2 py-1 rounded">At Delivery</span>
                  </div>
                </div>
              )}
            </div>
            {donation.deliveryNotes && (
              <p className="text-[10px] italic text-muted-foreground line-clamp-2 bg-muted/50 p-2 rounded">
                "{donation.deliveryNotes}"
              </p>
            )}
          </div>
        )}

        {donation.assignedNgo && (
          <div className="pt-2 border-t border-border">
            <p className="text-sm">
              <span className="text-muted-foreground">Assigned to: </span>
              <span className="font-medium">{donation.ngoName || donation.assignedNgo}</span>
            </p>
            {donation.assignedVolunteer && (
              <p className="text-sm">
                <span className="text-muted-foreground">Volunteer: </span>
                <span className="font-medium">{donation.assignedVolunteer}</span>
              </p>
            )}
          </div>
        )}
      </CardContent>

      {showActions && (
        <CardFooter className="gap-2 pt-0">
          {onAccept && (donation.status?.toLowerCase() === 'active' || !donation.status) && (
            <Button
              variant={disabled ? "secondary" : "hero"}
              size="sm"
              className="flex-1"
              onClick={() => onAccept(donation.id)}
              disabled={disabled}
            >
              Claim
            </Button>
          )}
          {onReject && (donation.status?.toLowerCase() === 'active' || !donation.status) && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => onReject(donation.id)}
              disabled={disabled}
            >
              Reject
            </Button>
          )}
          {onView && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onView(donation.id)}
              disabled={disabled}
            >
              View
            </Button>
          )}
          {onEdit && (donation.status?.toLowerCase() === 'active' || !donation.status) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(donation.id)}
              disabled={disabled}
            >
              Edit
            </Button>
          )}
          {onCancel && (donation.status?.toLowerCase() === 'active' || !donation.status) && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onCancel(donation.id)}
              disabled={disabled}
            >
              Cancel
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  );
}
