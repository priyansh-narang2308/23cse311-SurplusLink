export type UserRole = 'donor' | 'ngo' | 'admin' | 'volunteer';

export interface VolunteerProfile {
  tier: 'rookie' | 'hero' | 'champion';
  vehicleType?: 'bicycle' | 'scooter' | 'car' | 'van';
  maxWeight?: number;
  currentLocation?: {
    type: 'Point';
    coordinates: [number, number];
  };
}

export interface UserStats {
  completedDonations: number;
  cancelledDonations: number;
  mealsSaved?: number;
  co2Saved?: number;
  sustainabilityCredits?: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: 'active' | 'pending' | 'deactivated' | 'rejected';
  organization?: string;
  createdAt: string;
  avatar?: string;
  taxId?: string;
  permitNumber?: string;
  documentUrl?: string;
  address?: string;
  coordinates?: { lat: number; lng: number };
  isOnline?: boolean;
  violationCount?: number;
  volunteerProfile?: VolunteerProfile;
  stats?: UserStats;
  notificationPreferences?: {
    enabled: boolean;
    channels: {
      email: boolean;
      push: boolean;
    };
    types: {
      donations: boolean;
      missions: boolean;
      reminders: boolean;
    };
  };
}

export interface Donation {
  id: string;
  donorId: string;
  donorName: string;
  title: string;
  foodType: string;
  quantity: string;
  expiryTime: string;
  pickupWindow: string;
  location: string;
  address: string;
  status: 'active' | 'assigned' | 'accepted' | 'at_pickup' | 'picked_up' | 'at_delivery' | 'delivered' | 'completed' | 'cancelled' | 'expired' | 'rejected';
  assignedNgo?: string;
  assignedVolunteer?: string;
  createdAt: string;
  ngoName?: string;
  ngoAddress?: string;
  image?: string;
  photos?: string[];
  pickupPhoto?: string;
  deliveryPhoto?: string;
  pickupNotes?: string;
  deliveryNotes?: string;
  expiryDate?: string;
  pickupAddress?: string;
  coordinates?: { lat: number; lng: number };
  foodCategory?: 'cooked' | 'raw' | 'packaged';
  storageReq?: 'cold' | 'dry' | 'frozen';
  deliveryStatus?: 'idle' | 'pending_pickup' | 'heading_to_pickup' | 'at_pickup' | 'picked_up' | 'in_transit' | 'arrived_at_delivery' | 'delivered';
  donorEmail?: string;
  ngoEmail?: string;
  ngoCoordinates?: { lat: number; lng: number };
  claimedBy?: {
    id: string;
    organization: string;
    name?: string;
    email?: string;
    coordinates?: { lat: number; lng: number };
  };
  matchPercentage?: number;
  suitabilityScore?: number;
  urgencyLevel?: 'Critical' | 'Urgent' | 'Standard';
  distance?: number;
  donorTrustScore?: number;
  rejectionReason?: string;
  donor?: {
    id: string;
    name: string;
    email: string;
    organization?: string;
    coordinates?: { lat: number; lng: number };
  };
  volunteer?: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    avatar?: string;
    volunteerProfile?: VolunteerProfile;
  };
  statusHistory?: {
    status: string;
    deliveryStatus?: string;
    timestamp: string;
    updatedBy?: {
      id: string;
      name: string;
      role: string;
      organization?: string;
    };
    note?: string;
  }[];
  azureAiDetection?: {
    foodName: string;
    tags: string[];
    confidence: number;
  };
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'pickup' | 'delivery' | 'hygiene' | 'system' | 'match' | 'priority_dispatch' | 'donation_created' | 'donation_assigned' | 'donation_picked_up' | 'donation_delivered' | 'donation_cancelled' | 'donation_rejected' | 'volunteer_accepted' | 'mission_reassigned' | 'level_up' | 'general';
  read: boolean;
  createdAt: string;
}

export interface Volunteer {
  id: string;
  name: string;
  phone: string;
  status: 'available' | 'on_route' | 'busy';
  currentLocation?: { lat: number; lng: number };
  assignedDonation?: string;
}

export interface Feedback {
  id: string;
  donationId: string;
  ngoId: string;
  rating: number;
  hygieneCompliance: boolean;
  comments: string;
  createdAt: string;
}

export interface Metrics {
  mealsSaved: number;
  co2Reduced: number;
  activeDonors: number;
  activeNgos: number;
  avgDeliveryTime: number;
  foodRescueRate: number;
  monthlyData: {
    month: string;
    donations: number;
    meals: number;
    co2: number;
  }[];
}

export interface DonationStats {
  totalDonations: number;
  completedDonations: number;
  acceptanceRate: number;
  mealsSaved?: number;
  co2Reduced?: number;
  sustainabilityCredits?: number;
  monthlyBreakdown?: {
    month: string;
    meals: number;
    co2: number;
  }[];
}

export interface NgoStats {
  mealsReceived: number;
  avgDeliveryTime: number;
  totalDistributions: number;
  monthlyData: {
    month: string;
    meals: number;
    co2: number;
    distributions: number;
  }[];
  trend: number;
  sustainabilityCredits?: number;
}

export interface UtilizationRecord {
  ngoId?: string;
  ngoName?: string;
  summary: {
    totalClaims: number;
    completed: number;
    rejected: number;
    utilizationRate: number;
    urgentRescues: number;
  };
  rejectionBreakdown: {
    reason: string;
    count: number;
  }[];
  dailyUtilization: {
    date: string;
    units: number;
    capacity: number;
  }[];
}
export interface VolunteerPerformanceReport {
  overview: {
    fleetDeliveryRate: number;
    avgResponseTime: number; // in minutes
    complianceScore: number;
    activeHeroes: number;
  };
  leaderboard: {
    id: string;
    name: string;
    avatar?: string;
    tier: 'rookie' | 'hero' | 'champion';
    status: 'online' | 'offline' | 'on-delivery';
    isOnline: boolean;
    missionsCompleted: number;
    missionsFailed: number;
    avgEta: number; // in seconds
    hasProofCompliance: boolean;
    vehicleType: 'bicycle' | 'car' | 'scooter' | 'van';
    history: {
      id: string;
      status: 'completed' | 'failed';
      timestamp: string;
      photoUrl?: string;
    }[];
  }[];
  efficiencyByTier: {
    tier: string;
    avgTime: number;
  }[];
  recentProof: {
    id: string;
    photoUrl: string;
    timestamp: string;
    volunteerName: string;
  }[];
}
export interface SystemConfig {
  emergencyMode: {
    enabled: boolean;
    reason?: string;
    priorityRadius: number;
  };
}

export interface SystemHealth {
  status: 'Healthy' | 'Degraded' | 'Critical';
  timestamp: string;
  uptime: number;
  system: {
    cpuUsage: string;
    freeMem: string;
    totalMem: string;
  };
  database: {
    status: string;
  };
}

export interface ImpactSummary {
  summary: {
    totalMeals: number;
    totalCo2: number;
    totalWeightKg: number;
    donationsCompleted: number;
    uniqueDonors: number;
    uniqueNgos: number;
  };
  timeline: {
    date: string;
    totalMeals: number;
    totalCo2: number;
    donationsCompleted: number;
    totalWeightKg: number;
  }[];
  rules: {
    ruleName: string;
    factor: number;
    unit: string;
    description?: string;
  }[];
}

