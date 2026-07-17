export type ShipmentStatus = "pending" | "picked_up" | "in_transit" | "delivered" | "failed";
export type VehicleStatus = "operational" | "in_maintenance" | "non_operational";
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
  type: "van" | "car";
  status: VehicleStatus;
  brand: string | null;
  model: string | null;
  fuelType: "gas" | "diesel" | "electric" | null;
  capacityLiters: number | null;
  leaseStartDate: string | null;
  leaseCompany: string | null;
  hub: string | null;
  archived: boolean;
  hasActiveReplacement: boolean;
  driverId: number | null;
  location: Location | null;
  nonOperationalBy: string | null;
  nonOperationalReason: string | null;
  updatedAt: string;
}

export interface ReplacementVehicle {
  id: number;
  vehicleId: number;
  licensePlate: string;
  brand: string | null;
  model: string | null;
  type: string | null;
  fuelType: "gas" | "diesel" | "electric" | null;
  capacityLiters: number | null;
  leaseCompany: string | null;
  startDate: string;
  endDate: string | null;
  notes: string | null;
  createdAt: string;
}

export interface MaintenancePeriod {
  id: number;
  vehicleId: number;
  startDate: string;
  endDate: string | null;
  createdAt: string;
}

export interface MaintenanceLog {
  id: number;
  vehicleId: number;
  serviceType: string;
  notes: string | null;
  performedAt: string;
  returnedAt: string | null;
  workshop: string | null;
  kmAtService: number | null;
  createdAt: string;
}

export type AppointmentStatus = "scheduled" | "completed" | "cancelled";

export interface Appointment {
  id: number;
  vehicleId: number;
  licensePlate: string; // joined from vehicles for display
  scheduledAt: string; // ISO timestamp
  workshop: string | null;
  reason: string;
  notes: string | null;
  status: AppointmentStatus;
  createdAt: string;
}

export interface FleetNotification {
  id: string;
  type: "no_replacement" | "long_repair" | "non_operational";
  severity: "high" | "medium" | "low";
  vehicleId: number;
  licensePlate: string;
  title: string;
  body: string;
  hub: string | null;
  daysIn?: number;
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
