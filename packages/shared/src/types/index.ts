export type ShipmentStatus = "pending" | "picked_up" | "in_transit" | "delivered" | "failed";
export type VehicleStatus = "operational" | "on_route" | "in_maintenance" | "non_operational";
export type DriverStatus = "available" | "on_duty" | "offline";

export interface Location {
  lat: number;
  lng: number;
  address?: string;
}

export interface Driver {
  id: number;
  name: string;
  email: string;
  phone: string;
  status: DriverStatus;
  vehicleId: number | null;
  createdAt: string;
}

export interface Vehicle {
  id: number;
  licensePlate: string;
  type: "van" | "truck" | "bike";
  status: VehicleStatus;
  brand: string | null;
  model: string | null;
  fuelType: "gas" | "diesel" | "electric" | null;
  capacityLiters: number | null;
  leaseStartDate: string | null;
  archived: boolean;
  driverId: number | null;
  location: Location | null;
  updatedAt: string;
}

export interface MaintenanceLog {
  id: number;
  vehicleId: number;
  serviceType: string;
  notes: string | null;
  performedAt: string;
  createdAt: string;
}

export interface Shipment {
  id: number;
  trackingNumber: string;
  status: ShipmentStatus;
  origin: Location;
  destination: Location;
  driverId: number | null;
  vehicleId: number | null;
  estimatedDelivery: string | null;
  createdAt: string;
  updatedAt: string;
}
