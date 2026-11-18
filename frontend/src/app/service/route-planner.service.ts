import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { url } from '../config';
import {
  CityLocation,
  PlannedRouteOption,
  SavedRoute,
  TrafficLevel
} from '../model/route-planner.model';

const SAVED_ROUTES_KEY = 'tedbus_saved_routes';

export const INDIA_CITY_CATALOG: CityLocation[] = [
  { name: 'Delhi', lat: 28.6139, lng: 77.209 },
  { name: 'Jaipur', lat: 26.9124, lng: 75.7873 },
  { name: 'Agra', lat: 27.1767, lng: 78.0081 },
  { name: 'Mumbai', lat: 19.076, lng: 72.8777 },
  { name: 'Pune', lat: 18.5204, lng: 73.8567 },
  { name: 'Kolhapur', lat: 16.705, lng: 74.2433 },
  { name: 'Goa', lat: 15.2993, lng: 74.124 },
  { name: 'Bangalore', lat: 12.9716, lng: 77.5946 },
  { name: 'Mandya', lat: 12.5218, lng: 76.8951 },
  { name: 'Mysore', lat: 12.2958, lng: 76.6394 },
  { name: 'Chennai', lat: 13.0827, lng: 80.2707 },
  { name: 'Mahabalipuram', lat: 12.6269, lng: 80.1927 },
  { name: 'Pondicherry', lat: 11.9416, lng: 79.8083 },
  { name: 'Kolkata', lat: 22.5726, lng: 88.3639 },
  { name: 'Siliguri', lat: 26.7271, lng: 88.3953 },
  { name: 'Darjeeling', lat: 27.041, lng: 88.2663 },
  { name: 'Hyderabad', lat: 17.385, lng: 78.4867 },
  { name: 'Ahmedabad', lat: 23.0225, lng: 72.5714 },
  { name: 'Surat', lat: 21.1702, lng: 72.8311 },
  { name: 'Nagpur', lat: 21.1458, lng: 79.0882 }
];

@Injectable({
  providedIn: 'root'
})
export class RoutePlannerService {
  private readonly apiBase = `${url}saved-routes`;
  readonly cities: CityLocation[] = INDIA_CITY_CATALOG;

  constructor(private http: HttpClient) {
    this.ensureSeedSavedRoutes();
  }

  getCity(name: string): CityLocation | undefined {
    return this.cities.find((c) => c.name.toLowerCase() === (name || '').toLowerCase());
  }

  generateRoutes(
    startName: string,
    destinationName: string,
    waypointNames: string[],
    forceHeavyOnExpress = false
  ): PlannedRouteOption[] {
    const stops: CityLocation[] = [];
    const start = this.getCity(startName);
    const dest = this.getCity(destinationName);
    if (!start || !dest) {
      return [];
    }
    stops.push(start);
    waypointNames.forEach((wp) => {
      const city = this.getCity(wp);
      if (city && city.name !== start.name && city.name !== dest.name) {
        stops.push(city);
      }
    });
    stops.push(dest);

    let totalRoadKm = 0;
    for (let i = 0; i < stops.length - 1; i++) {
      totalRoadKm += this.haversineKm(stops[i], stops[i + 1]) * 1.22;
    }
    totalRoadKm = Math.max(25, Math.round(totalRoadKm));

    const expressTraffic: TrafficLevel = forceHeavyOnExpress
      ? 'Heavy'
      : this.pickTraffic(['Moderate', 'Heavy', 'Low']);
    const bypassTraffic: TrafficLevel =
      expressTraffic === 'Heavy' ? 'Low' : this.pickTraffic(['Low', 'Moderate']);
    const corridorTraffic: TrafficLevel =
      expressTraffic === 'Heavy' ? 'Moderate' : this.pickTraffic(['Low', 'Moderate']);

    const specs: Array<{
      id: 'express' | 'bypass' | 'corridor';
      nameKey: string;
      distFactor: number;
      curveOffset: number;
      avgKmh: number;
      traffic: TrafficLevel;
    }> = [
      {
        id: 'express',
        nameKey: 'routePlanner.routeNames.express',
        distFactor: 1.0,
        curveOffset: 0.0,
        avgKmh: 58,
        traffic: expressTraffic
      },
      {
        id: 'bypass',
        nameKey: 'routePlanner.routeNames.bypass',
        distFactor: 1.11,
        curveOffset: 0.28,
        avgKmh: 55,
        traffic: bypassTraffic
      },
      {
        id: 'corridor',
        nameKey: 'routePlanner.routeNames.corridor',
        distFactor: 1.06,
        curveOffset: -0.24,
        avgKmh: 56,
        traffic: corridorTraffic
      }
    ];

    const built: PlannedRouteOption[] = specs.map((spec) => {
      const distanceKm = Math.round(totalRoadKm * spec.distFactor);
      const baseMinutes = Math.max(30, Math.round((distanceKm / spec.avgKmh) * 60));
      const delayMinutes = this.computeDelayMinutes(baseMinutes, spec.traffic);
      const etaMinutes = baseMinutes + delayMinutes;

      return {
        id: spec.id,
        nameKey: spec.nameKey,
        distanceKm,
        baseMinutes,
        trafficLevel: spec.traffic,
        delayMinutes,
        etaMinutes,
        etaClockTime: this.formatEtaClock(etaMinutes),
        coordinates: this.buildCurvedPolyline(stops, spec.curveOffset),
        isRecommended: false
      };
    });

    // Mark fastest ETA route as recommended
    let bestIdx = 0;
    built.forEach((r, idx) => {
      if (r.etaMinutes < built[bestIdx].etaMinutes) {
        bestIdx = idx;
      }
    });
    built[bestIdx].isRecommended = true;

    return built;
  }

  getSavedRoutes(userId: string): Observable<SavedRoute[]> {
    return this.http.get<SavedRoute[]>(`${this.apiBase}/user/${userId}`).pipe(
      map((serverRoutes) => {
        if (Array.isArray(serverRoutes) && serverRoutes.length > 0) {
          this.mergeSavedRoutes(serverRoutes);
        }
        return this.readLocalSavedRoutes();
      }),
      catchError(() => of(this.readLocalSavedRoutes()))
    );
  }

  saveRoute(payload: {
    userId: string;
    name: string;
    startCity: string;
    destinationCity: string;
    waypoints: string[];
    preferredRouteId: string;
    distanceKm: number;
    estimatedMinutes: number;
    trafficLevel: TrafficLevel;
  }): Observable<SavedRoute> {
    return this.http.post<SavedRoute>(this.apiBase, payload).pipe(
      tap((saved) => this.upsertLocalSavedRoute(saved)),
      catchError(() => {
        const local: SavedRoute = {
          ...payload,
          _id: `sr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          createdAt: new Date().toISOString()
        };
        this.upsertLocalSavedRoute(local);
        return of(local);
      })
    );
  }

  deleteSavedRoute(id: string): Observable<SavedRoute[]> {
    const remaining = this.readLocalSavedRoutes().filter((r) => r._id !== id);
    this.writeLocalSavedRoutes(remaining);
    return this.http.delete(`${this.apiBase}/${id}`).pipe(
      map(() => remaining),
      catchError(() => of(remaining))
    );
  }

  private haversineKm(a: CityLocation, b: CityLocation): number {
    const R = 6371;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const lat1 = (a.lat * Math.PI) / 180;
    const lat2 = (b.lat * Math.PI) / 180;
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  private buildCurvedPolyline(stops: CityLocation[], offsetFactor: number): [number, number][] {
    const pts: [number, number][] = [];
    for (let i = 0; i < stops.length - 1; i++) {
      const a = stops[i];
      const b = stops[i + 1];
      const dLat = b.lat - a.lat;
      const dLng = b.lng - a.lng;
      const midLat = (a.lat + b.lat) / 2 - dLng * offsetFactor * 0.35;
      const midLng = (a.lng + b.lng) / 2 + dLat * offsetFactor * 0.35;

      const steps = 16;
      for (let s = 0; s <= steps; s++) {
        if (i > 0 && s === 0) continue;
        const t = s / steps;
        const inv = 1 - t;
        const lat = inv * inv * a.lat + 2 * inv * t * midLat + t * t * b.lat;
        const lng = inv * inv * a.lng + 2 * inv * t * midLng + t * t * b.lng;
        pts.push([lat, lng]);
      }
    }
    return pts;
  }

  private pickTraffic(pool: TrafficLevel[]): TrafficLevel {
    return pool[Math.floor(Math.random() * pool.length)];
  }

  private computeDelayMinutes(baseMinutes: number, level: TrafficLevel): number {
    if (level === 'Low') return 0;
    if (level === 'Moderate') return Math.max(12, Math.round(baseMinutes * 0.14));
    return Math.max(35, Math.round(baseMinutes * 0.36));
  }

  private formatEtaClock(etaMinutes: number): string {
    const arrival = new Date(Date.now() + etaMinutes * 60 * 1000);
    return arrival.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  private readLocalSavedRoutes(): SavedRoute[] {
    try {
      const raw = localStorage.getItem(SAVED_ROUTES_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private writeLocalSavedRoutes(routes: SavedRoute[]): void {
    try {
      localStorage.setItem(SAVED_ROUTES_KEY, JSON.stringify(routes));
    } catch {
      // Ignore storage errors
    }
  }

  private upsertLocalSavedRoute(route: SavedRoute): void {
    const list = this.readLocalSavedRoutes();
    const idx = list.findIndex((r) => r._id === route._id);
    if (idx >= 0) {
      list[idx] = route;
    } else {
      list.unshift(route);
    }
    this.writeLocalSavedRoutes(list);
  }

  private mergeSavedRoutes(serverList: SavedRoute[]): void {
    const local = this.readLocalSavedRoutes();
    serverList.forEach((sr) => {
      if (!local.some((lr) => lr._id === sr._id)) {
        local.unshift(sr);
      }
    });
    this.writeLocalSavedRoutes(local);
  }

  private ensureSeedSavedRoutes(): void {
    if (this.readLocalSavedRoutes().length > 0) {
      return;
    }
    const seeds: SavedRoute[] = [
      {
        _id: 'seed-sr-1',
        userId: 'demo-user-aarav',
        name: 'Mumbai → Goa via Pune & Kolhapur',
        startCity: 'Mumbai',
        destinationCity: 'Goa',
        waypoints: ['Pune', 'Kolhapur'],
        preferredRouteId: 'express',
        distanceKm: 585,
        estimatedMinutes: 610,
        trafficLevel: 'Moderate',
        createdAt: new Date(Date.now() - 86400000).toISOString()
      },
      {
        _id: 'seed-sr-2',
        userId: 'demo-user-aarav',
        name: 'Delhi → Jaipur Express',
        startCity: 'Delhi',
        destinationCity: 'Jaipur',
        waypoints: [],
        preferredRouteId: 'express',
        distanceKm: 280,
        estimatedMinutes: 295,
        trafficLevel: 'Low',
        createdAt: new Date(Date.now() - 172800000).toISOString()
      }
    ];
    this.writeLocalSavedRoutes(seeds);
  }
}
