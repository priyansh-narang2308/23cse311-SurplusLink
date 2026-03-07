/** API service for donation-related operations */
import api from '@/lib/api';
import { Donation, DonationStats, NgoStats } from '@/types';

interface BackendDonation {
    _id?: string;
    id?: string;
    expiryDate?: string;
    expiryTime?: string;
    pickupWindow?: string | { start: string; end: string };
    pickupAddress?: string;
    location?: { address: string };
    donorName?: string;
    donorId?: string;
    donor?: {
        _id?: string;
        id?: string;
        name?: string;
        organization?: string;
        email?: string;
        coordinates?: { lat: number; lng: number } | { type: 'Point', coordinates: [number, number] };
        location?: { type: 'Point', coordinates: [number, number] };
        stats?: { trustScore?: number };
    };
    photos?: string[];
    image?: string;
    title?: string;
    foodType?: string;
    quantity?: string;
    createdAt?: string;
    status: Donation['status'];
    foodCategory?: Donation['foodCategory'];
    storageReq?: Donation['storageReq'];
    claimedBy?: {
        _id?: string;
        id?: string;
        name?: string;
        organization?: string;
        address?: string;
        email?: string;
        coordinates?: { lat: number; lng: number } | { type: 'Point', coordinates: [number, number] };
        location?: { type: 'Point', coordinates: [number, number] };
    };
    volunteer?: { _id?: string; id?: string; name?: string };
    pickupPhoto?: string;
    deliveryPhoto?: string;
    pickupNotes?: string;
    deliveryNotes?: string;
    deliveryStatus?: Donation['deliveryStatus'];
    rejectionReason?: string;
    coordinates?: {
        type?: 'Point';
        coordinates?: [number, number];
    };
    matchPercentage?: number;
    urgencyLevel?: Donation['urgencyLevel'];
    distance?: number;
    azureAiDetection?: Donation['azureAiDetection'];
}

const mapDonation = (d: BackendDonation): Donation => ({
    title: d.title || "",
    foodType: d.foodType || "",
    quantity: d.quantity || "",
    createdAt: d.createdAt || new Date().toISOString(),
    id: d._id || d.id || "",
    donorId: d.donorId || d.donor?._id || d.donor?.id || "",
    expiryTime: d.expiryDate || d.expiryTime || "",
    pickupWindow: typeof d.pickupWindow === 'object'
        ? `${new Date(d.pickupWindow.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(d.pickupWindow.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
        : d.pickupWindow || "",
    location: d.location?.address || d.pickupAddress || "Unknown Location",
    address: d.location?.address || d.pickupAddress || "",
    donorName: d.donor?.name || d.donor?.organization || d.donorName || "Unknown Donor",
    ngoName: d.claimedBy?.organization || d.claimedBy?.name || "",
    ngoAddress: d.claimedBy?.address || "",
    image: d.photos?.[0] || d.image || "",
    photos: d.photos || [],
    pickupPhoto: d.pickupPhoto,
    deliveryPhoto: d.deliveryPhoto,
    pickupNotes: d.pickupNotes,
    deliveryNotes: d.deliveryNotes,
    status: (function () {
        if (d.status === 'assigned' || d.status === 'picked_up') {
            if (d.deliveryStatus === 'pending_pickup' || d.deliveryStatus === 'heading_to_pickup') return 'accepted';
            if (d.deliveryStatus === 'at_pickup') return 'at_pickup';
            if (d.deliveryStatus === 'picked_up' || d.deliveryStatus === 'in_transit') return 'picked_up';
            if (d.deliveryStatus === 'arrived_at_delivery') return 'at_delivery';
            if (d.deliveryStatus === 'delivered') return 'delivered';
        }
        return d.status;
    })(),
    foodCategory: d.foodCategory,
    deliveryStatus: d.deliveryStatus,
    assignedVolunteer: typeof d.volunteer === 'object' ? d.volunteer?.name || d.volunteer?.id || d.volunteer?._id : d.volunteer,
    donorEmail: d.donor?.email,
    ngoEmail: d.claimedBy?.email,
    ngoCoordinates: (function () {
        const coords = d.claimedBy?.coordinates;
        const loc = d.claimedBy?.location;

        if (coords) {
            if ('coordinates' in coords && Array.isArray(coords.coordinates)) {
                return { lat: coords.coordinates[1], lng: coords.coordinates[0] };
            }
            if ('lat' in coords && 'lng' in coords) {
                return { lat: coords.lat, lng: coords.lng };
            }
        }

        if (loc && loc.type === 'Point' && Array.isArray(loc.coordinates)) {
            return { lat: loc.coordinates[1], lng: loc.coordinates[0] };
        }

        return undefined;
    })(),
    claimedBy: d.claimedBy ? {
        id: d.claimedBy._id || d.claimedBy.id || "",
        organization: d.claimedBy.organization || d.claimedBy.name || "",
        email: d.claimedBy.email,
        coordinates: (function () {
            const coords = d.claimedBy?.coordinates;
            const loc = d.claimedBy?.location;
            if (coords) {
                if ('coordinates' in coords && Array.isArray(coords.coordinates)) {
                    return { lat: coords.coordinates[1], lng: coords.coordinates[0] };
                }
                if ('lat' in coords && 'lng' in coords) {
                    return { lat: coords.lat, lng: coords.lng };
                }
            }
            if (loc && loc.type === 'Point' && Array.isArray(loc.coordinates)) {
                return { lat: loc.coordinates[1], lng: loc.coordinates[0] };
            }
            return undefined;
        })()
    } : undefined,
    coordinates: d.coordinates?.coordinates ? {
        lat: d.coordinates.coordinates[1],
        lng: d.coordinates.coordinates[0]
    } : undefined,
    rejectionReason: d.rejectionReason,
    expiryDate: d.expiryDate || d.expiryTime,
    pickupAddress: d.pickupAddress,
    storageReq: d.storageReq,
    matchPercentage: d.matchPercentage,
    urgencyLevel: d.urgencyLevel,
    distance: d.distance,
    donorTrustScore: d.donor?.stats?.trustScore,
    azureAiDetection: d.azureAiDetection,
});

const DonationService = {
    getActiveMission: async (): Promise<Donation | null> => {
        const response = await api.get('/donations/active-mission');
        return response.data ? mapDonation(response.data) : null;
    },
    createDonation: async (formData: FormData) => {
        const response = await api.post('/donations', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    },

    getMyDonations: async (): Promise<Donation[]> => {
        const response = await api.get('/donations/my-donations');
        return Array.isArray(response.data) ? response.data.map(mapDonation) : [];
    },

    getStats: async (): Promise<DonationStats> => {
        const response = await api.get('/donations/stats');
        return response.data;
    },

    cancelDonation: async (id: string) => {
        const response = await api.patch(`/donations/${id}/cancel`);
        return response.data;
    },

    // Epic 5: Smart Feed
    getSmartFeed: async (): Promise<{ donations: Donation[], capacityWarning: boolean, unmetNeed: number, count: number }> => {
        const response = await api.get('/donations/feed');
        return {
            ...response.data,
            donations: Array.isArray(response.data.donations) ? response.data.donations.map(mapDonation) : []
        };
    },

    getClaimedDonations: async (): Promise<Donation[]> => {
        const response = await api.get('/donations/claimed');
        return Array.isArray(response.data) ? response.data.map(mapDonation) : [];
    },

    getNgoStats: async (): Promise<NgoStats> => {
        const response = await api.get('/donations/ngo/stats');
        return response.data;
    },

    claimDonation: async (id: string) => {
        const response = await api.patch(`/donations/${id}/claim`);
        return response.data;
    },

    rejectDonation: async (id: string, reason: string) => {
        const response = await api.patch(`/donations/${id}/reject`, { rejectionReason: reason });
        return response.data;
    },

    completeDonation: async (id: string, rating: number, comment: string) => {
        const response = await api.patch(`/donations/${id}/complete`, { rating, comment });
        return response.data;
    },

    // Epic 4: Volunteer Methods
    getAvailableMissions: async (): Promise<Donation[]> => {
        const response = await api.get('/donations/available-missions');
        return Array.isArray(response.data) ? response.data.map(mapDonation) : [];
    },

    acceptMission: async (id: string) => {
        const response = await api.patch(`/donations/${id}/accept-mission`);
        return response.data;
    },

    updateDeliveryStatus: async (id: string, status: string) => {
        const response = await api.patch(`/donations/${id}/delivery-status`, { status });
        return response.data;
    },

    confirmPickup: async (id: string, formData: FormData) => {
        const response = await api.patch(`/donations/${id}/pickup`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    },

    confirmDelivery: async (id: string, formData: FormData) => {
        const response = await api.patch(`/donations/${id}/deliver`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    },

    getVolunteerHistory: async (): Promise<Donation[]> => {
        const response = await api.get('/donations/volunteer/history');
        return Array.isArray(response.data) ? response.data.map(mapDonation) : [];
    },

    cancelMission: async (id: string, reason: string) => {
        const response = await api.patch(`/donations/${id}/cancel-mission`, { reason });
        return response.data;
    },

    getOptimizedRoute: async (id: string) => {
        const response = await api.get(`/donations/${id}/optimized-route`);
        return response.data;
    },

    getAdminStats: async () => {
        const response = await api.get('/donations/admin/stats');
        return response.data;
    }
};

export default DonationService;
