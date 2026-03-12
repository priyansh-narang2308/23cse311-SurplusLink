import { Donation } from '@/types';

export const donations: Donation[] = [
  {
    id: 'don-1',
    donorId: 'donor-1',
    donorName: 'Fresh Bites Restaurant',
    title: 'Prepared Meal Pack',
    foodType: 'Prepared Meals',
    quantity: '25 portions',
    expiryTime: '2024-12-28T20:00:00',
    pickupWindow: '4:00 PM - 6:00 PM',
    location: 'Downtown',
    address: '123 Main Street, Downtown',
    status: 'active',
    createdAt: '2024-12-28T10:00:00',
    coordinates: { lat: 40.7128, lng: -74.0060 }
  },
  {
    id: 'don-2',
    donorId: 'donor-1',
    donorName: 'Fresh Bites Restaurant',
    title: 'Bakery Assortment',
    foodType: 'Bakery Items',
    quantity: '40 pieces',
    expiryTime: '2024-12-28T22:00:00',
    pickupWindow: '5:00 PM - 7:00 PM',
    location: 'Downtown',
    address: '123 Main Street, Downtown',
    status: 'assigned',
    assignedNgo: 'Food For All',
    assignedVolunteer: 'John D.',
    createdAt: '2024-12-28T11:00:00',
    coordinates: { lat: 40.7148, lng: -74.0070 }
  },
  {
    id: 'don-3',
    donorId: 'donor-2',
    donorName: 'Golden Catering',
    title: 'Event Leftover Buffet',
    foodType: 'Event Leftovers',
    quantity: '100 portions',
    expiryTime: '2024-12-28T23:00:00',
    pickupWindow: '8:00 PM - 10:00 PM',
    location: 'Midtown',
    address: '456 Park Avenue, Midtown',
    status: 'picked_up',
    assignedNgo: 'Community Kitchen',
    assignedVolunteer: 'Maria S.',
    createdAt: '2024-12-28T14:00:00',
    coordinates: { lat: 40.7549, lng: -73.9840 }
  },
  {
    id: 'don-4',
    donorId: 'donor-2',
    donorName: 'Golden Catering',
    title: 'Fresh Produce Bundle',
    foodType: 'Fresh Produce',
    quantity: '15 kg',
    expiryTime: '2024-12-29T12:00:00',
    pickupWindow: '10:00 AM - 12:00 PM',
    location: 'Midtown',
    address: '456 Park Avenue, Midtown',
    status: 'delivered',
    assignedNgo: 'Food For All',
    assignedVolunteer: 'Alex R.',
    createdAt: '2024-12-27T09:00:00',
    coordinates: { lat: 40.7560, lng: -73.9850 }
  },
  {
    id: 'don-5',
    donorId: 'donor-1',
    donorName: 'Fresh Bites Restaurant',
    title: 'Dairy Products Pack',
    foodType: 'Dairy Products',
    quantity: '20 units',
    expiryTime: '2024-12-27T18:00:00',
    pickupWindow: '2:00 PM - 4:00 PM',
    location: 'Downtown',
    address: '123 Main Street, Downtown',
    status: 'expired',
    createdAt: '2024-12-26T08:00:00',
    coordinates: { lat: 40.7138, lng: -74.0065 }
  },
  {
    id: 'don-6',
    donorId: 'donor-3',
    donorName: 'The Grand Hotel',
    title: 'Buffet Spread',
    foodType: 'Buffet Items',
    quantity: '50 portions',
    expiryTime: '2024-12-28T21:00:00',
    pickupWindow: '6:00 PM - 8:00 PM',
    location: 'Uptown',
    address: '789 Broadway, Uptown',
    status: 'active',
    createdAt: '2024-12-28T15:00:00',
    coordinates: { lat: 40.7831, lng: -73.9712 }
  },
  {
    id: 'don-7',
    donorId: 'donor-1',
    donorName: 'Fresh Bites Restaurant',
    title: 'Sandwich Platter',
    foodType: 'Sandwiches',
    quantity: '30 pieces',
    expiryTime: '2024-12-28T19:00:00',
    pickupWindow: '3:00 PM - 5:00 PM',
    location: 'Downtown',
    address: '123 Main Street, Downtown',
    status: 'active',
    createdAt: '2024-12-28T12:00:00',
    coordinates: { lat: 40.7135, lng: -74.0055 }
  },
  // ── Open / Direct Community Pickup ──
  {
    id: 'don-8',
    donorId: 'donor-1',
    donorName: 'Fresh Bites Restaurant',
    title: '2 Masala Vadas — Take it now!',
    foodType: 'Prepared Meals',
    quantity: '2 pieces',
    expiryTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
    pickupWindow: 'Now - Next 2 Hours',
    location: 'Downtown',
    address: '123 Main Street, Downtown',
    status: 'active',
    createdAt: new Date().toISOString(),
    coordinates: { lat: 40.7128, lng: -74.0060 },
    distributionMode: 'open',
    foodCategory: 'cooked',
    storageReq: 'dry',
  },
  {
    id: 'don-9',
    donorId: 'donor-3',
    donorName: 'Local Dhaba',
    title: '5 Leftover Rotis — Free to Take',
    foodType: 'Prepared Meals',
    quantity: '5 rotis',
    expiryTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    pickupWindow: 'Now - Next 2 Hours',
    location: 'South Market',
    address: '22 Market Lane, South Block',
    status: 'active',
    createdAt: new Date().toISOString(),
    coordinates: { lat: 40.7100, lng: -74.0080 },
    distributionMode: 'open',
    foodCategory: 'cooked',
    storageReq: 'dry',
  }
];

export const getDonationsByDonor = (donorId: string): Donation[] => {
  return donations.filter(d => d.donorId === donorId);
};

export const getPendingDonations = (): Donation[] => {
  return donations.filter(d => d.status === 'active');
};

export const getAcceptedDonations = (ngoName: string): Donation[] => {
  return donations.filter(d => d.assignedNgo === ngoName && ['assigned', 'picked_up'].includes(d.status));
};
