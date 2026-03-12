/** Multi-step form for posting new food donations — with Azure Document Intelligence receipt scanner */
import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import {
  Upload, MapPin, Clock, Package, Lock, AlertTriangle, X, Check,
  ScanLine, Sparkles, FileText, Loader2, ChevronDown, ChevronUp, Users2, Building2 as Building,
} from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { VerificationBanner } from '@/components/layout/verification-banner';
import { cn } from '@/lib/utils';
import DonationService from '@/services/donation.service';
import api from '@/lib/api';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { MapPicker } from '@/components/ui/map-picker';

const foodTypes = [
  'Prepared Meals',
  'Bakery Items',
  'Fresh Produce',
  'Dairy Products',
  'Packaged Food',
  'Beverages',
  'Event Leftovers'
];

const allergensList = ['Nuts', 'Dairy', 'Gluten', 'Soy', 'Shellfish', 'Eggs'];
const dietaryTagsList = ['Veg', 'Non-Veg', 'Vegan', 'Halal', 'Kosher'];

const donationSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters'),
  description: z.string().min(1, 'Description is required'),
  foodType: z.string().min(1, 'Please select a food type'),
  foodCategory: z.enum(['cooked', 'raw', 'packaged'], { required_error: 'Please select a category' }),
  storageReq: z.enum(['dry', 'cold', 'frozen'], { required_error: 'Please select storage requirement' }),
  quantity: z.string().min(1, 'Quantity is required'),
  perishability: z.enum(['high', 'medium', 'low'], {
    required_error: 'Please select perishability level',
  }),
  expiryDate: z.string().min(1, 'Expiry date is required'),
  expiryTime: z.string().min(1, 'Expiry time is required'),
  pickupWindowStart: z.string().min(1, 'Pickup start time is required'),
  pickupWindowEnd: z.string().min(1, 'Pickup end time is required'),
  pickupAddress: z.string().min(5, 'Pickup address is required'),
});

type DonationFormValues = z.infer<typeof donationSchema>;

// Fields that the scanner can fill — used for highlight animation
type ScannedFieldKey = keyof Omit<DonationFormValues, 'pickupWindowStart' | 'pickupWindowEnd'>;

// ─── Receipt Scanner Panel ────────────────────────────────────────────────────

interface ScannerPanelProps {
  onFieldsFilled: (fields: Partial<DonationFormValues>) => void;
  disabled: boolean;
}

function ReceiptScannerPanel({ onFieldsFilled, disabled }: ScannerPanelProps) {
  const { toast } = useToast();
  const [scanning, setScanning] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<{ totalFieldsExtracted: number; rawLines: string[] } | null>(null);
  const [showRawLines, setShowRawLines] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    if (!file) return;

    // Show preview
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setFileName(file.name);
    setScanResult(null);
    setScanning(true);

    try {
      const formData = new FormData();
      formData.append('receipt', file);

      const res = await api.post('/donations/scan-receipt', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const { extractedFields, rawLines, totalFieldsExtracted } = res.data;

      if (totalFieldsExtracted === 0) {
        toast({
          variant: 'destructive',
          title: 'Nothing extracted',
          description: 'Could not read donation fields from this document.',
        });
        return;
      }

      setScanResult({ totalFieldsExtracted, rawLines });
      onFieldsFilled(extractedFields);

      toast({
        title: `✨ ${totalFieldsExtracted} fields auto-filled!`,
      });
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast({
        variant: 'destructive',
        title: 'Scan failed',
        description: e.response?.data?.message || 'Could not scan the receipt.',
      });
    } finally {
      setScanning(false);
    }
  }, [onFieldsFilled, toast]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const clearScan = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setFileName(null);
    setScanResult(null);
  };

  return (
    <Card className={cn(
      'border overflow-hidden rounded-xl transition-all duration-300 shadow-sm',
      scanResult ? 'border-amber-400 bg-amber-50/30' : 'border-dashed border-primary/20'
    )}>
      <CardContent className="p-3">
        {!previewUrl ? (
          <label
            className={cn(
              'flex items-center justify-between gap-4 p-3 rounded-lg border border-dashed cursor-pointer transition-all duration-200',
              dragOver ? 'border-primary bg-primary/5' : 'border-border bg-muted/10 hover:border-primary/50',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-primary/10">
                <ScanLine className="h-5 w-5 text-primary" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold">Auto-fill with Receipt</p>
                <p className="text-[10px] text-muted-foreground uppercase opacity-70">Saves time by scanning details</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[9px] h-5 bg-primary/5 text-primary border-primary/20">
                <Sparkles className="h-3 w-3 mr-1" /> AI
              </Badge>
              <span className="text-xs text-primary font-bold underline px-2">Browse</span>
            </div>
            <input
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={handleInputChange}
              disabled={disabled}
            />
          </label>
        ) : (
          <div className="flex items-center gap-3 relative pr-10">
            <div className="h-12 w-12 shrink-0 rounded-lg overflow-hidden border border-border shadow-sm bg-muted flex items-center justify-center">
              {previewUrl.startsWith('blob:') && fileName?.match(/\.(jpg|jpeg|png|webp|bmp)$/i) ? (
                <img src={previewUrl} alt="Receipt" className="w-full h-full object-cover" />
              ) : (
                <FileText className="h-5 w-5 text-muted-foreground/50" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold truncate">{fileName}</p>
              {scanning ? (
                <div className="flex items-center gap-1.5 mt-1">
                  <Loader2 className="h-3 w-3 animate-spin text-primary" />
                  <span className="text-[10px] text-primary font-bold uppercase tracking-wider">Analyzing...</span>
                </div>
              ) : scanResult ? (
                <div className="flex items-center gap-3 mt-1">
                  <div className="flex items-center gap-1">
                    <Check className="h-3 w-3 text-emerald-500" />
                    <span className="text-[11px] font-bold text-emerald-600">
                      Found {scanResult.totalFieldsExtracted} fields
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowRawLines(!showRawLines)}
                    className="text-[9px] font-black uppercase tracking-tighter text-muted-foreground hover:text-foreground"
                  >
                    {showRawLines ? 'Hide logs' : 'View logs'}
                  </button>
                </div>
              ) : null}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={clearScan}
              className="absolute right-0 h-8 w-8 rounded-full hover:bg-destructive/10 hover:text-destructive"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {showRawLines && scanResult?.rawLines && (
          <div className="mt-3 rounded-lg bg-black/5 p-2 max-h-24 overflow-y-auto">
            {scanResult.rawLines.map((line, i) => (
              <p key={i} className="text-[9px] text-muted-foreground font-mono leading-tight">{line}</p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PostDonation() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [coords, setCoords] = useState<[number, number] | null>(null);
  const [selectedAllergens, setSelectedAllergens] = useState<string[]>([]);
  const [selectedDietary, setSelectedDietary] = useState<string[]>([]);
  const [expiryWarning, setExpiryWarning] = useState(false);
  const [pickupWarning, setPickupWarning] = useState(false);
  const [customAllergen, setCustomAllergen] = useState('');
  // Track which fields were auto-filled from the scan for highlight animation
  const [scannedFields, setScannedFields] = useState<Set<string>>(new Set());
  const [distributionMode, setDistributionMode] = useState<'ngo' | 'open'>('ngo');

  const isVerified = user?.status === 'active';

  const form = useForm<DonationFormValues>({
    resolver: zodResolver(donationSchema),
    defaultValues: {
      title: '',
      description: '',
      foodType: '',
      foodCategory: undefined,
      storageReq: undefined,
      quantity: '',
      perishability: 'medium',
      expiryDate: '',
      expiryTime: '',
      pickupWindowStart: '',
      pickupWindowEnd: '',
      pickupAddress: '',
    },
  });

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCoords([position.coords.longitude, position.coords.latitude]);
        },
        (error) => {
          console.error('Error getting location:', error);
          toast({
            variant: "destructive",
            title: "Location Error",
            description: "Could not get your current location. Please ensure location permissions are granted.",
          });
        }
      );
    }
  }, [toast]);

  const watchExpiryDate = form.watch('expiryDate');
  const watchExpiryTime = form.watch('expiryTime');
  const watchPickupEnd = form.watch('pickupWindowEnd');

  useEffect(() => {
    if (watchExpiryDate && watchExpiryTime) {
      try {
        const expiry = new Date(`${watchExpiryDate}T${watchExpiryTime}`);
        const now = new Date();
        const diffInHours = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60);
        setExpiryWarning(diffInHours > 0 && diffInHours < 2);

        if (watchPickupEnd) {
          const pickupEnd = new Date(`${watchExpiryDate}T${watchPickupEnd}`);
          setPickupWarning(pickupEnd >= expiry);
        }
      } catch (e) {
        setExpiryWarning(false);
        setPickupWarning(false);
      }
    }
  }, [watchExpiryDate, watchExpiryTime, watchPickupEnd, toast]);

  // Called when the scanner returns extracted fields
  const handleScannedFields = useCallback((fields: Partial<DonationFormValues>) => {
    const filled = new Set<string>();

    if (fields.title) { form.setValue('title', fields.title); filled.add('title'); }
    if (fields.description) { form.setValue('description', fields.description); filled.add('description'); }
    if (fields.quantity) { form.setValue('quantity', fields.quantity); filled.add('quantity'); }
    if (fields.expiryDate) { form.setValue('expiryDate', fields.expiryDate); filled.add('expiryDate'); }
    if (fields.expiryTime) { form.setValue('expiryTime', fields.expiryTime); filled.add('expiryTime'); }
    if (fields.pickupAddress) { form.setValue('pickupAddress', fields.pickupAddress); filled.add('pickupAddress'); }

    if (fields.foodType) {
      form.setValue('foodType', fields.foodType);
      filled.add('foodType');
    }
    if (fields.foodCategory && ['cooked', 'raw', 'packaged'].includes(fields.foodCategory)) {
      form.setValue('foodCategory', fields.foodCategory as 'cooked' | 'raw' | 'packaged');
      filled.add('foodCategory');
    }
    if (fields.storageReq && ['dry', 'cold', 'frozen'].includes(fields.storageReq)) {
      form.setValue('storageReq', fields.storageReq as 'dry' | 'cold' | 'frozen');
      filled.add('storageReq');
    }
    if (fields.perishability && ['high', 'medium', 'low'].includes(fields.perishability)) {
      form.setValue('perishability', fields.perishability as 'high' | 'medium' | 'low');
      filled.add('perishability');
    }

    setScannedFields(filled);

    // Clear highlight animation after 8 seconds
    setTimeout(() => setScannedFields(new Set()), 8000);
  }, [form]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + photos.length > 5) {
      toast({
        variant: "destructive",
        title: "Too many photos",
        description: "You can only upload up to 5 photos.",
      });
      return;
    }
    setPhotos([...photos, ...files]);
    const newPreviews = files.map(file => URL.createObjectURL(file));
    setPreviews([...previews, ...newPreviews]);
  };

  const removePhoto = (index: number) => {
    const newPhotos = [...photos];
    newPhotos.splice(index, 1);
    setPhotos(newPhotos);

    const newPreviews = [...previews];
    URL.revokeObjectURL(newPreviews[index]);
    newPreviews.splice(index, 1);
    setPreviews(newPreviews);
  };

  const onSubmit = async (values: DonationFormValues) => {
    if (!isVerified) return;
    if (!coords) {
      toast({
        variant: "destructive",
        title: "Location missing",
        description: "Please allow location access to post a donation.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('title', values.title);
      formData.append('description', values.description);
      formData.append('foodType', values.foodType);
      formData.append('foodCategory', values.foodCategory);
      formData.append('storageReq', values.storageReq);
      formData.append('quantity', values.quantity);
      formData.append('perishability', values.perishability);
      const combineDateTime = (d: string, t: string) => {
        const [year, month, day] = d.split('-').map(Number);
        const [hours, minutes] = t.split(':').map(Number);
        return new Date(year, month - 1, day, hours, minutes).toISOString();
      };

      formData.append('expiryDate', combineDateTime(values.expiryDate, values.expiryTime));

      const pickupWindow = {
        start: combineDateTime(values.expiryDate, values.pickupWindowStart),
        end: combineDateTime(values.expiryDate, values.pickupWindowEnd),
      };
      formData.append('pickupWindow', JSON.stringify(pickupWindow));

      formData.append('pickupAddress', values.pickupAddress);

      // Send coordinates as array string [lng, lat]
      formData.append('coordinates', JSON.stringify(coords));

      formData.append('allergens', JSON.stringify(selectedAllergens));
      formData.append('dietaryTags', JSON.stringify(selectedDietary));
      formData.append('distributionMode', distributionMode);

      photos.forEach((photo) => {
        formData.append('photos', photo);
      });

      await DonationService.createDonation(formData);

      toast({
        title: distributionMode === 'open' ? '🤝 Donation Listed for Open Pickup!' : 'Donation Posted!',
        description: distributionMode === 'open'
          ? 'Your surplus food is now available for direct community pickup.'
          : 'Your surplus food is now available for NGOs.',
      });
      navigate('/donor');
    } catch (error: unknown) {
      console.error('Submission error:', error);
      const apiError = error as { response?: { data?: { message?: string } } };
      toast({
        variant: "destructive",
        title: "Submission Failed",
        description: apiError.response?.data?.message || "Failed to post donation. Check all fields.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper: CSS class for fields highlighted after scan
  const getFieldHighlight = (fieldName: ScannedFieldKey) =>
    scannedFields.has(fieldName)
      ? 'ring-2 ring-amber-400 ring-offset-1 rounded-xl transition-all duration-700'
      : '';

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <VerificationBanner />
      <PageHeader
        title="Post a Donation"
        description="Share your surplus food. Choose who can receive it — NGOs or open community pickup."
      />

      {/* ── Distribution Mode Selector ── */}
      <div className="grid sm:grid-cols-2 gap-4">
        {/* NGO Mode */}
        <button
          type="button"
          id="mode-ngo"
          onClick={() => setDistributionMode('ngo')}
          className={cn(
            'relative flex flex-col items-start gap-3 p-5 rounded-2xl border-2 text-left transition-all duration-200 group',
            distributionMode === 'ngo'
              ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
              : 'border-border hover:border-primary/40 hover:bg-muted/40'
          )}
        >
          {distributionMode === 'ngo' && (
            <span className="absolute top-3 right-3 flex items-center justify-center h-5 w-5 rounded-full bg-primary">
              <Check className="h-3 w-3 text-white" />
            </span>
          )}
          <div className={cn(
            'h-12 w-12 rounded-xl flex items-center justify-center transition-colors',
            distributionMode === 'ngo' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'
          )}>
            <Building className="h-6 w-6" />
          </div>
          <div>
            <p className="font-black text-sm uppercase tracking-tight">NGO / Food Bank</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Routed to verified NGOs, shelters & food banks. Best for large or packaged quantities.
            </p>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">Recommended</span>
          </div>
        </button>

        {/* Open / Direct Pickup Mode */}
        <button
          type="button"
          id="mode-open"
          onClick={() => setDistributionMode('open')}
          className={cn(
            'relative flex flex-col items-start gap-3 p-5 rounded-2xl border-2 text-left transition-all duration-200 group',
            distributionMode === 'open'
              ? 'border-orange-400 bg-orange-50/40 dark:bg-orange-950/20 shadow-lg shadow-orange-500/10'
              : 'border-border hover:border-orange-300 hover:bg-orange-50/20 dark:hover:bg-orange-950/10'
          )}
        >
          {distributionMode === 'open' && (
            <span className="absolute top-3 right-3 flex items-center justify-center h-5 w-5 rounded-full bg-orange-500">
              <Check className="h-3 w-3 text-white" />
            </span>
          )}
          <div className={cn(
            'h-12 w-12 rounded-xl flex items-center justify-center transition-colors',
            distributionMode === 'open' ? 'bg-orange-500 text-white' : 'bg-muted text-muted-foreground group-hover:bg-orange-100 group-hover:text-orange-600 dark:group-hover:bg-orange-950'
          )}>
            <Users2 className="h-6 w-6" />
          </div>
          <div>
            <p className="font-black text-sm uppercase tracking-tight">Open Community Pickup</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Anyone nearby — homeless, passersby, or community members — can walk in and take the food directly.
            </p>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950/60 text-orange-600 border border-orange-200 dark:border-orange-800">Small Quantities</span>
          </div>
        </button>
      </div>



      {/* ── Receipt Scanner — shown prominently at top ── */}
      <ReceiptScannerPanel onFieldsFilled={handleScannedFields} disabled={!isVerified} />

      {expiryWarning && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-xl flex items-center gap-3 animate-pulse">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p className="text-sm font-bold">Safety Warning: This food expires in less than 2 hours. Please ensure prompt pickup.</p>
        </div>
      )}

      <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8 items-start">
        <div className="space-y-6">
          <Card className="border-border/50 shadow-sm overflow-hidden border-l-4 border-l-primary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Package className="h-5 w-5 text-primary" />
                Food Details
                {scannedFields.size > 0 && (
                  <Badge className="ml-auto text-[10px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-600 border-amber-400/20 animate-pulse">
                    <Sparkles className="h-3 w-3 mr-1" />
                    AI Filled
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className={cn("space-y-2", getFieldHighlight('title'))}>
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Title</Label>
                <Input
                  {...form.register('title')}
                  placeholder="e.g., 20 Packets of Vegetable Pasta"
                  className="h-11"
                  disabled={!isVerified}
                />
                {form.formState.errors.title && <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>}
              </div>

              <div className="grid sm:grid-cols-2 gap-6">
                <div className={cn("space-y-2", getFieldHighlight('foodType'))}>
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Food Type</Label>
                  <Select
                    onValueChange={(val) => form.setValue('foodType', val)}
                    value={form.watch('foodType') || undefined}
                    disabled={!isVerified}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {foodTypes.map(type => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.formState.errors.foodType && <p className="text-xs text-destructive">{form.formState.errors.foodType.message}</p>}
                </div>

                <div className={cn("space-y-2", getFieldHighlight('quantity'))}>
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Quantity</Label>
                  <Input
                    {...form.register('quantity')}
                    placeholder="e.g., 5kg or 20 portions"
                    className="h-11"
                    disabled={!isVerified}
                  />
                  {form.formState.errors.quantity && <p className="text-xs text-destructive">{form.formState.errors.quantity.message}</p>}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-6">
                <div className={cn("space-y-2", getFieldHighlight('foodCategory'))}>
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Category</Label>
                  <Select
                    onValueChange={(val) => form.setValue('foodCategory', val as "cooked" | "raw" | "packaged")}
                    value={form.watch('foodCategory') || undefined}
                    disabled={!isVerified}
                  >
                    <SelectTrigger className="h-11"><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cooked">Cooked Meal (Ready to eat)</SelectItem>
                      <SelectItem value="raw">Raw Ingredients (Needs cooking)</SelectItem>
                      <SelectItem value="packaged">Packaged / Canned</SelectItem>
                    </SelectContent>
                  </Select>
                  {form.formState.errors.foodCategory && <p className="text-xs text-destructive">{form.formState.errors.foodCategory.message}</p>}
                </div>
                <div className={cn("space-y-2", getFieldHighlight('storageReq'))}>
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Storage</Label>
                  <Select
                    onValueChange={(val) => form.setValue('storageReq', val as "dry" | "cold" | "frozen")}
                    value={form.watch('storageReq') || undefined}
                    disabled={!isVerified}
                  >
                    <SelectTrigger className="h-11"><SelectValue placeholder="Storage needs" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dry">Dry / Room Temp</SelectItem>
                      <SelectItem value="cold">Refrigerated (Cold)</SelectItem>
                      <SelectItem value="frozen">Frozen</SelectItem>
                    </SelectContent>
                  </Select>
                  {form.formState.errors.storageReq && <p className="text-xs text-destructive">{form.formState.errors.storageReq.message}</p>}
                </div>
              </div>

              <div className={cn("space-y-2", getFieldHighlight('description'))}>
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Description</Label>
                <Textarea
                  {...form.register('description')}
                  placeholder="Provide more details about the food..."
                  rows={3}
                  className="resize-none"
                  disabled={!isVerified}
                />
                {form.formState.errors.description && <p className="text-xs text-destructive">{form.formState.errors.description.message}</p>}
              </div>

              <div className={cn("space-y-2", getFieldHighlight('perishability'))}>
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Perishability</Label>
                <Select
                  onValueChange={(val: 'high' | 'medium' | 'low') => form.setValue('perishability', val)}
                  value={form.watch('perishability') || 'medium'}
                  disabled={!isVerified}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High (Expires very soon)</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low (Long shelf life)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Allergens</Label>
                <div className="flex flex-wrap gap-3">
                  {allergensList.map(allergen => (
                    <div key={allergen} className="flex items-center space-x-2 bg-muted/30 p-2 rounded-lg border border-border/50">
                      <Checkbox
                        id={`allergen-${allergen}`}
                        checked={selectedAllergens.includes(allergen)}
                        onCheckedChange={(checked) => {
                          if (checked) setSelectedAllergens([...selectedAllergens, allergen]);
                          else setSelectedAllergens(selectedAllergens.filter(a => a !== allergen));
                        }}
                        disabled={!isVerified}
                      />
                      <label htmlFor={`allergen-${allergen}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                        {allergen}
                      </label>
                    </div>
                  ))}

                  {selectedAllergens.filter(a => !allergensList.includes(a)).map(custom => (
                    <Badge key={custom} variant="secondary" className="h-9 px-3 flex gap-2 rounded-lg bg-primary/10 text-primary border-primary/20">
                      {custom}
                      <button
                        type="button"
                        onClick={() => setSelectedAllergens(selectedAllergens.filter(a => a !== custom))}
                        className="hover:text-destructive transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>

                <div className="flex gap-2 mt-4">
                  <Input
                    placeholder="Other allergen (e.g., Sesame)"
                    value={customAllergen}
                    onChange={(e) => setCustomAllergen(e.target.value)}
                    disabled={!isVerified}
                    className="h-10 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (customAllergen.trim()) {
                          if (!selectedAllergens.includes(customAllergen.trim())) {
                            setSelectedAllergens([...selectedAllergens, customAllergen.trim()]);
                          }
                          setCustomAllergen('');
                        }
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10"
                    onClick={() => {
                      if (customAllergen.trim()) {
                        if (!selectedAllergens.includes(customAllergen.trim())) {
                          setSelectedAllergens([...selectedAllergens, customAllergen.trim()]);
                        }
                        setCustomAllergen('');
                      }
                    }}
                    disabled={!isVerified || !customAllergen.trim()}
                  >
                    Add
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Dietary Tags</Label>
                <div className="flex flex-wrap gap-3">
                  {dietaryTagsList.map(tag => (
                    <div key={tag} className="flex items-center space-x-2 bg-muted/30 p-2 rounded-lg border border-border/50">
                      <Checkbox
                        id={`tag-${tag}`}
                        checked={selectedDietary.includes(tag)}
                        onCheckedChange={(checked) => {
                          if (checked) setSelectedDietary([...selectedDietary, tag]);
                          else setSelectedDietary(selectedDietary.filter(t => t !== tag));
                        }}
                        disabled={!isVerified}
                      />
                      <label htmlFor={`tag-${tag}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                        {tag}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm overflow-hidden border-l-4 border-l-primary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Upload className="h-5 w-5 text-primary" />
                Photos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-4">
                {previews.map((preview, index) => (
                  <div key={index} className="relative aspect-square rounded-lg overflow-hidden border border-border shadow-sm group">
                    <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(index)}
                      className="absolute top-1 right-1 p-1 bg-destructive text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {photos.length < 5 && (
                  <label className={cn(
                    "aspect-square rounded-lg border-2 border-dashed border-primary/20 bg-primary/5 flex flex-col items-center justify-center cursor-pointer hover:bg-primary/10 transition-colors",
                    !isVerified && "opacity-50 cursor-not-allowed"
                  )}>
                    <Upload className="h-6 w-6 text-primary/60" />
                    <span className="text-[10px] font-bold uppercase mt-1">Add</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoChange}
                      disabled={!isVerified}
                    />
                  </label>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest text-center">Add up to 5 photos for transparency</p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-border/50 shadow-sm overflow-hidden border-l-4 border-l-primary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Clock className="h-5 w-5 text-primary" />
                Timing & Expiry
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid sm:grid-cols-2 gap-6">
                <div className={cn("space-y-2", getFieldHighlight('expiryDate'))}>
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Expiry Date</Label>
                  <Input
                    type="date"
                    {...form.register('expiryDate')}
                    className="h-11"
                    disabled={!isVerified}
                  />
                  {form.formState.errors.expiryDate && <p className="text-xs text-destructive">{form.formState.errors.expiryDate.message}</p>}
                </div>

                <div className={cn("space-y-2", getFieldHighlight('expiryTime'))}>
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Expiry Time</Label>
                  <Input
                    type="time"
                    {...form.register('expiryTime')}
                    className="h-11"
                    disabled={!isVerified}
                  />
                  {form.formState.errors.expiryTime && <p className="text-xs text-destructive">{form.formState.errors.expiryTime.message}</p>}
                </div>
              </div>

              <div className="space-y-4">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Pickup Window</Label>
                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] text-muted-foreground uppercase">Start Time</Label>
                    <Input
                      type="time"
                      {...form.register('pickupWindowStart')}
                      className="h-11"
                      disabled={!isVerified}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] text-muted-foreground uppercase">End Time</Label>
                    <Input
                      type="time"
                      {...form.register('pickupWindowEnd')}
                      className="h-11"
                      disabled={!isVerified}
                    />
                  </div>
                </div>
                {pickupWarning ? (
                  <div className="mt-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-start gap-2 animate-in fade-in zoom-in-95 duration-300">
                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-[11px] font-bold text-amber-600 leading-relaxed">
                      Critical Logic Error: The pickup window ends after the food expires. Please ensure food is collected and delivered before its expiry time.
                    </p>
                  </div>
                ) : (
                  <div className="mt-2 flex items-center gap-2 px-1">
                    <Clock className="h-3 w-3 text-amber-500" />
                    <p className="text-[15px] font-medium text-amber-600/80 italic">
                      Pro Tip: Set the pickup window to end at least 1 hour before expiry for safe redistribution.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm overflow-hidden border-l-4 border-l-primary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <MapPin className="h-5 w-5 text-primary" />
                Pickup Location
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Select Precise Location</Label>
                <div className="h-64 w-full relative rounded-xl overflow-hidden border border-border/50 mb-4">
                  <MapPicker
                    initialCenter={coords ? { lat: coords[1], lng: coords[0] } : undefined}
                    onLocationSelect={async (newLocation) => {
                      setCoords([newLocation.lng, newLocation.lat]);
                      try {
                        const geocoder = new google.maps.Geocoder();
                        const response = await geocoder.geocode({ location: newLocation });
                        if (response.results[0]) {
                          form.setValue('pickupAddress', response.results[0].formatted_address);
                        }
                      } catch (error) {
                        console.error("Reverse geocoding failed:", error);
                      }
                    }}
                  />
                </div>
              </div>

              <div className={cn("space-y-2", getFieldHighlight('pickupAddress'))}>
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Pickup Address</Label>
                <div className="relative">
                  <Input
                    {...form.register('pickupAddress')}
                    placeholder="Search or enter pickup address"
                    className="h-11"
                    disabled={!isVerified}
                  />
                  <MapPin className="absolute right-3 top-3 h-5 w-5 text-muted-foreground" />
                </div>
                {form.formState.errors.pickupAddress && <p className="text-xs text-destructive">{form.formState.errors.pickupAddress.message}</p>}
              </div>

              <div className="p-4 rounded-xl bg-muted/30 border border-border/50 flex items-center gap-4">
                <div className={cn(
                  "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
                  coords ? "bg-emerald-500/10 text-emerald-500" : "bg-destructive/10 text-destructive"
                )}>
                  {coords ? <Check className="h-5 w-5" /> : <MapPin className="h-5 w-5" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold">{coords ? "Precise Location Secured" : "Location Access Required"}</p>
                  <p className="text-xs text-muted-foreground">{coords ? `Coordinates: ${coords[1].toFixed(4)}, ${coords[0].toFixed(4)}` : "Please allow location access or select on map"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-4 pt-4">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="flex-1 h-14 rounded-2xl font-bold "
              onClick={() => navigate(-1)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant={isVerified ? "hero" : "secondary"}
              size="lg"
              className="flex-[2] h-14 rounded-2xl text-lg font-black  shadow-2xl shadow-primary/20"
              disabled={isSubmitting || !isVerified}
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing...
                </div>
              ) : isVerified ? (
                'Publish Donation'
              ) : (
                <div className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Verify Account
                </div>
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
