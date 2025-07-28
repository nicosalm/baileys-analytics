// Shared TypeScript types for Baileys Analytics

export interface User {
  id: string;
  email: string;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Property {
  id: string;
  tenantId: string;
  ownerRezId: string;
  name: string;
  address: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Booking {
  id: string;
  tenantId: string;
  propertyId: string;
  ownerRezBookingId: string;
  checkIn: Date;
  checkOut: Date;
  totalAmount: number;
  guestName: string;
  guestEmail?: string;
  status: 'confirmed' | 'cancelled' | 'pending';
  createdAt: Date;
  updatedAt: Date;
}
