export type TrafficLevel = 'Low' | 'Moderate' | 'Heavy';

export interface CityLocation {
  name: string;
  lat: number;
  lng: number;
}

export interface PlannedRouteOption {
  id: 'express' | 'bypass' | 'corridor';
  nameKey: string;
  distanceKm: number;
  baseMinutes: number;
  trafficLevel: TrafficLevel;
  delayMinutes: number;
  etaMinutes: number;
  etaClockTime: string;
  coordinates: [number, number][];
  isRecommended: boolean;
}

export interface SavedRoute {
  _id: string;
  userId: string;
  name: string;
  startCity: string;
  destinationCity: string;
  waypoints: string[];
  preferredRouteId?: string;
  distanceKm: number;
  estimatedMinutes: number;
  trafficLevel: TrafficLevel;
  createdAt: string;
}
