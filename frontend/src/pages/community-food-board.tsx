/**
 * Community Food Board — Public page, no login required.
 * Shows all active "open pickup" donations that anyone can walk in and take.
 * Mini consumers can use "I'm Taking This" to signal they're on their way.
 */
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  MapPin, Clock, Package, RefreshCw,
  Users2, Timer, AlertCircle, Leaf,
  Search, ChevronRight, CheckCircle2,
  X, Phone, User, ArrowRight, Loader2, ShieldCheck
} from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

interface OpenDonation {
  id: string;
  title: string;
  description?: string;
  foodType: string;
  foodCategory?: 'cooked' | 'raw' | 'packaged';
  quantity: string;
  pickupAddress: string;
  pickupWindow?: { start: string; end: string };
  expiryDate: string;
  photos?: string[];
  allergens?: string[];
  dietaryTags?: string[];
  createdAt: string;
  reservationCount?: number;
}

function getTimeLeft(expiryDate: string): { label: string; urgent: boolean; critical: boolean } {
  const diff = new Date(expiryDate).getTime() - Date.now();
  if (diff <= 0) return { label: 'Expired', urgent: true, critical: true };
  const mins = Math.floor(diff / 60000);
  if (mins < 30) return { label: `${mins}m left`, urgent: true, critical: true };
  if (mins < 90) return { label: `${mins}m left`, urgent: true, critical: false };
  const hrs = Math.floor(mins / 60);
  return { label: `${hrs}h ${mins % 60}m left`, urgent: false, critical: false };
}

const foodEmoji: Record<string, string> = {
  cooked: '🍲', raw: '🥬', packaged: '📦',
};

interface ReserveModalProps {
  donation: OpenDonation;
  onClose: () => void;
  onSuccess: (id: string, count: number) => void;
}

function ReserveModal({ donation, onClose, onSuccess }: ReserveModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [needsDelivery, setNeedsDelivery] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; phone?: string }>({});

  const validate = () => {
    const errs: { name?: string; phone?: string } = {};
    if (!name.trim()) errs.name = 'Your name is required.';
    if (!phone.trim()) errs.phone = 'Your phone number is required.';
    else if (!/^[+\d\s\-()]{6,15}$/.test(phone.trim())) errs.phone = 'Enter a valid phone number.';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post(`/public/reserve/${donation.id}`, {
        name: name.trim(),
        phone: phone.trim(),
        needsDelivery,
      });
      setDone(true);
      onSuccess(donation.id, data.reservationCount);
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { message?: string } } };
      setError(apiErr.response?.data?.message || 'Could not complete reservation. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Sheet */}
      <div
        className="relative w-full max-w-md bg-background rounded-t-3xl sm:rounded-3xl border border-border shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Orange accent top bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-orange-400 to-amber-400" />

        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>

        <div className="p-6">
          {!done ? (
            <>
              {/* Header */}
              <div className="flex items-start gap-4 mb-5">
                <div className="h-14 w-14 rounded-2xl bg-orange-100 dark:bg-orange-950/50 flex items-center justify-center text-3xl shrink-0 overflow-hidden">
                  {donation.photos?.[0] ? (
                    <img src={donation.photos[0]} alt={donation.title} className="w-full h-full object-cover" />
                  ) : (
                    <span>{donation.foodCategory ? foodEmoji[donation.foodCategory] : '🍱'}</span>
                  )}
                </div>
                <div>
                  <h2 className="font-black text-lg leading-tight">{donation.title}</h2>
                  <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-orange-500" />
                    {donation.pickupAddress}
                  </p>
                </div>
              </div>

              {/* Pickup vs Delivery toggle */}
              <div className="mb-5">
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2">How will you get the food?</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    id="pickup-self-btn"
                    onClick={() => setNeedsDelivery(false)}
                    className={cn(
                      'flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-sm font-bold transition-all',
                      !needsDelivery
                        ? 'border-orange-400 bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400'
                        : 'border-border text-muted-foreground hover:border-orange-200'
                    )}
                  >
                    <span className="text-xl">🚶</span>
                    I'll pick it up
                    <span className="text-[10px] font-normal opacity-70">Walk to location</span>
                  </button>
                  <button
                    type="button"
                    id="needs-delivery-btn"
                    onClick={() => setNeedsDelivery(true)}
                    className={cn(
                      'flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-sm font-bold transition-all',
                      needsDelivery
                        ? 'border-orange-400 bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400'
                        : 'border-border text-muted-foreground hover:border-orange-200'
                    )}
                  >
                    <span className="text-xl">🛵</span>
                    I need delivery
                    <span className="text-[10px] font-normal opacity-70">Volunteer will bring it</span>
                  </button>
                </div>
                {needsDelivery && (
                  <p className="mt-2 text-[11px] text-orange-600 dark:text-orange-400 font-medium leading-relaxed bg-orange-50 dark:bg-orange-950/30 p-2.5 rounded-lg border border-orange-200 dark:border-orange-800">
                    🛵 A volunteer will see your request and deliver the food to you. Please be reachable on the phone number you provide.
                  </p>
                )}
              </div>

              <form id="reserve-form" onSubmit={handleSubmit} className="space-y-3">
                {/* Name field */}
                <div className="space-y-1">
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      id="reserve-name"
                      type="text"
                      placeholder="Your full name *"
                      value={name}
                      onChange={e => { setName(e.target.value); setFieldErrors(f => ({ ...f, name: undefined })); }}
                      className={cn(
                        'w-full pl-10 pr-4 h-12 rounded-xl border bg-background text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 transition-all',
                        fieldErrors.name ? 'border-destructive' : 'border-border'
                      )}
                      maxLength={60}
                    />
                  </div>
                  {fieldErrors.name && <p className="text-xs text-destructive font-medium pl-1">{fieldErrors.name}</p>}
                </div>

                {/* Phone field */}
                <div className="space-y-1">
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      id="reserve-phone"
                      type="tel"
                      placeholder="Phone number *"
                      value={phone}
                      onChange={e => { setPhone(e.target.value); setFieldErrors(f => ({ ...f, phone: undefined })); }}
                      className={cn(
                        'w-full pl-10 pr-4 h-12 rounded-xl border bg-background text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 transition-all',
                        fieldErrors.phone ? 'border-destructive' : 'border-border'
                      )}
                      maxLength={15}
                    />
                  </div>
                  {fieldErrors.phone && <p className="text-xs text-destructive font-medium pl-1">{fieldErrors.phone}</p>}
                </div>

                <p className="text-[10px] text-muted-foreground px-1">
                  * Required. Your details are shared only with the donor{needsDelivery ? ' and the volunteer delivering your food' : ''} — never shown publicly.
                </p>

                {error && (
                  <p className="flex items-center gap-2 text-sm text-destructive font-medium">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {error}
                  </p>
                )}

                <button
                  id="confirm-reservation-btn"
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-black uppercase tracking-wide transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 disabled:opacity-60"
                >
                  {loading ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Confirming...</>
                  ) : needsDelivery ? (
                    <>Request Delivery <ArrowRight className="h-4 w-4" /></>
                  ) : (
                    <>I'm On My Way! <ArrowRight className="h-4 w-4" /></>
                  )}
                </button>
              </form>
            </>
          ) : (
            /* ── Success State ── */
            <div className="flex flex-col items-center text-center py-4 gap-5">
              <div className="h-20 w-20 rounded-full bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              </div>
              <div>
                <h3 className="text-2xl font-black mb-2">
                  {needsDelivery ? 'Delivery Requested! 🛵' : "You're all set! 🎉"}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {needsDelivery
                    ? 'A volunteer will see your request and deliver the food to you. Stay reachable on your phone!'
                    : 'The restaurant has been notified. Head to the pickup address and collect your food.'}
                </p>
              </div>
              {!needsDelivery && (
                <div className="w-full p-4 rounded-xl bg-muted/40 border border-border/60 text-left space-y-2">
                  <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Pickup Address</p>
                  <p className="font-bold text-sm">{donation.pickupAddress}</p>
                </div>
              )}
              {!needsDelivery && (
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(donation.pickupAddress)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full h-12 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black uppercase tracking-wide flex items-center justify-center gap-2 transition-colors"
                >
                  <MapPin className="h-4 w-4" /> Open in Maps
                </a>
              )}
              <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


// ── Main Component ─────────────────────────────────────────────────────────────

export default function CommunityFoodBoard() {
  const [donations, setDonations] = useState<OpenDonation[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [search, setSearch] = useState('');
  const [error, setError] = useState(false);
  const [selectedDonation, setSelectedDonation] = useState<OpenDonation | null>(null);

  const fetchDonations = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const { data } = await api.get('/public/open-donations');
      setDonations(data.donations || []);
      setLastRefresh(new Date());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDonations();
    const interval = setInterval(fetchDonations, 120000);
    return () => clearInterval(interval);
  }, [fetchDonations]);

  // Update reservation count locally after a successful reserve
  const handleReserveSuccess = (id: string, count: number) => {
    setDonations(prev => prev.map(d => d.id === id ? { ...d, reservationCount: count } : d));
  };

  const filtered = donations.filter(d =>
    search.trim() === '' ||
    d.title.toLowerCase().includes(search.toLowerCase()) ||
    d.pickupAddress.toLowerCase().includes(search.toLowerCase()) ||
    d.foodType.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Modal */}
      {selectedDonation && (
        <ReserveModal
          donation={selectedDonation}
          onClose={() => setSelectedDonation(null)}
          onSuccess={(id, count) => {
            handleReserveSuccess(id, count);
            // keep modal open to show success state
          }}
        />
      )}

      {/* ── Top Bar ── */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/60 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Link to="/"><Logo size="sm" showText /></Link>
          <div className="flex-1" />
          <Link to="/login" className="text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors">
            Donor Login
          </Link>
        </div>
      </header>

      {/* ── Hero Banner ── */}
      <div className="relative overflow-hidden bg-gradient-to-b from-orange-500/10 via-orange-500/5 to-transparent pt-12 pb-10 px-4">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-4xl mx-auto relative">
          <div className="flex items-center gap-2 mb-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-400 text-xs font-black uppercase tracking-widest border border-orange-200 dark:border-orange-800">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" />
              Live — No Signup Needed
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-3">
            Free Food,{' '}
            <span className="text-orange-500 italic">Right Now</span>
          </h1>
          <p className="text-muted-foreground font-medium max-w-lg text-sm sm:text-base leading-relaxed">
            Local restaurants and vendors have surplus food available for{' '}
            <strong className="text-foreground">direct pickup</strong> — no registration,
            no waiting. Just walk in and take it. 🤝
          </p>

          {/* How it works */}
          <div className="flex flex-wrap gap-3 mt-5">
            {[
              { step: '1', text: 'Browse listings below' },
              { step: '2', text: 'Tap "I\'m Taking This"' },
              { step: '3', text: 'Walk in & collect food' },
            ].map(({ step, text }) => (
              <div key={step} className="flex items-center gap-2 text-xs font-semibold text-muted-foreground bg-muted/60 px-3 py-1.5 rounded-full">
                <span className="h-5 w-5 rounded-full bg-orange-500/20 text-orange-600 font-black text-[10px] flex items-center justify-center">{step}</span>
                {text}
              </div>
            ))}
          </div>

          {/* Search */}
          <div className="relative mt-6 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              id="community-search"
              type="text"
              placeholder="Search by name or area..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-background/80 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 transition-all"
            />
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <main className="max-w-4xl mx-auto px-4 pb-16">
        {/* Refresh bar */}
        <div className="flex items-center justify-between py-4 border-b border-border/50 mb-6">
          <p className="text-xs text-muted-foreground font-medium">
            {loading ? 'Refreshing...' : `${filtered.length} item${filtered.length !== 1 ? 's' : ''} available · Updated ${lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
          </p>
          <button
            id="refresh-btn"
            onClick={fetchDonations}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs font-bold text-orange-600 hover:text-orange-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20 mb-6">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <p className="text-sm font-medium text-destructive">Could not load listings. Please check your internet and try again.</p>
            <button onClick={fetchDonations} className="ml-auto text-xs font-bold text-destructive underline">Retry</button>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && donations.length === 0 && (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-52 rounded-2xl border border-border/50 bg-muted/30 animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-6xl mb-6">🍽️</div>
            <h3 className="text-xl font-bold mb-2">
              {donations.length === 0 ? 'No open listings right now' : 'No results found'}
            </h3>
            <p className="text-muted-foreground text-sm max-w-xs">
              {donations.length === 0
                ? 'Check back soon — restaurants post new items throughout the day.'
                : 'Try a different search term or clear the filter.'}
            </p>
            {search && (
              <button onClick={() => setSearch('')} className="mt-4 text-sm font-bold text-orange-500 hover:underline">
                Clear search
              </button>
            )}
          </div>
        )}

        {/* Donation cards */}
        {!loading && filtered.length > 0 && (
          <div className="space-y-4">
            {filtered.map(donation => {
              const { label: timeLabel, urgent, critical } = getTimeLeft(donation.expiryDate);
              const emoji = donation.foodCategory ? foodEmoji[donation.foodCategory] : '🍱';

              return (
                <div
                  key={donation.id}
                  id={`donation-${donation.id}`}
                  className={cn(
                    'relative rounded-2xl border-2 overflow-hidden transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5',
                    critical
                      ? 'border-red-300 dark:border-red-800 bg-red-50/30 dark:bg-red-950/10'
                      : urgent
                        ? 'border-orange-300 dark:border-orange-700 bg-orange-50/40 dark:bg-orange-950/20'
                        : 'border-border hover:border-orange-200 dark:hover:border-orange-800'
                  )}
                >
                  {/* Urgency strip */}
                  {(urgent || critical) && (
                    <div className={cn(
                      'h-1 w-full',
                      critical ? 'bg-gradient-to-r from-red-500 to-orange-500 animate-pulse' : 'bg-gradient-to-r from-orange-400 to-amber-400'
                    )} />
                  )}

                  <div className="flex gap-4 p-5">
                    {/* Photo / emoji */}
                    <div className={cn(
                      'shrink-0 h-20 w-20 sm:h-24 sm:w-24 rounded-xl overflow-hidden flex items-center justify-center text-4xl',
                      critical ? 'bg-red-100 dark:bg-red-950/40' : urgent ? 'bg-orange-100 dark:bg-orange-950/40' : 'bg-muted/60'
                    )}>
                      {donation.photos && donation.photos.length > 0 ? (
                        <img src={donation.photos[0]} alt={donation.title} className="w-full h-full object-cover" />
                      ) : (
                        <span>{emoji}</span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <h2 className="font-black text-base sm:text-lg leading-tight">{donation.title}</h2>
                        <span className={cn(
                          'flex items-center gap-1 text-[11px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full shrink-0',
                          critical ? 'bg-red-500 text-white animate-pulse'
                            : urgent ? 'bg-orange-500 text-white'
                              : 'bg-muted text-muted-foreground'
                        )}>
                          <Timer className="h-3 w-3" />
                          {timeLabel}
                        </span>
                      </div>

                      {donation.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{donation.description}</p>
                      )}

                      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
                        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Package className="h-3.5 w-3.5 shrink-0" />
                          <span className="font-semibold text-foreground">{donation.quantity}</span>
                        </span>
                        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-orange-500" />
                          <span className="font-medium truncate max-w-[180px]">{donation.pickupAddress}</span>
                        </span>
                        {donation.pickupWindow && (
                          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Clock className="h-3.5 w-3.5 shrink-0" />
                            <span className="font-medium">
                              {new Date(donation.pickupWindow.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              {' – '}
                              {new Date(donation.pickupWindow.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </span>
                        )}
                      </div>

                      {/* Tags */}
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {donation.dietaryTags?.map(tag => (
                          <span key={tag} className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                            <Leaf className="h-2.5 w-2.5" />
                            {tag}
                          </span>
                        ))}
                        {donation.allergens?.map(a => (
                          <span key={a} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900">
                            ⚠️ {a}
                          </span>
                        ))}
                      </div>

                      {/* Reservation count */}
                      {(donation.reservationCount ?? 0) > 0 && (
                        <div className="flex items-center gap-1.5 mt-3 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                          <Users2 className="h-3.5 w-3.5" />
                          {donation.reservationCount} {donation.reservationCount === 1 ? 'person is' : 'people are'} already on their way
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Footer CTA */}
                  <div className={cn(
                    'px-5 py-3 flex items-center justify-between gap-3 border-t',
                    critical ? 'border-red-200 dark:border-red-800/50 bg-red-50/40 dark:bg-red-950/10'
                      : urgent ? 'border-orange-200 dark:border-orange-800/50 bg-orange-50/50 dark:bg-orange-950/10'
                        : 'border-border/50 bg-muted/20'
                  )}>
                    <a
                      href={`https://maps.google.com/?q=${encodeURIComponent(donation.pickupAddress)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <MapPin className="h-3.5 w-3.5" />
                      Directions
                      <ChevronRight className="h-3.5 w-3.5" />
                    </a>

                    <button
                      id={`reserve-btn-${donation.id}`}
                      onClick={() => setSelectedDonation(donation)}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wide text-white transition-all active:scale-95 shadow-md',
                        critical ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20'
                          : 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/20'
                      )}
                    >
                      <Users2 className="h-3.5 w-3.5" />
                      I'm Taking This
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer / Share box */}
        <div className="mt-12 p-6 rounded-2xl bg-muted/30 border border-border/50 text-center space-y-3">
          <p className="text-sm font-bold">Know someone who needs this?</p>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto">
            Share this page link with anyone who needs free food in the area — no app download required.
          </p>
          <code
            className="block text-xs font-mono bg-muted px-4 py-2 rounded-lg text-primary select-all cursor-pointer"
            onClick={() => navigator.clipboard.writeText(window.location.href)}
            title="Click to copy"
          >
            {window.location.origin}/community
          </code>
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            No account. No tracking. Name and phone are optional and never shown publicly.
          </div>
          <div className="pt-1">
            <Link to="/login" className="inline-flex items-center gap-2 text-xs font-bold text-primary hover:underline">
              Are you a restaurant? Post food to help your community
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
