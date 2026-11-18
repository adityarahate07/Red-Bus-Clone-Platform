import { AfterViewInit, Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import * as L from 'leaflet';
import {
  CityLocation,
  PlannedRouteOption,
  SavedRoute,
  TrafficLevel
} from '../../model/route-planner.model';
import { RoutePlannerService } from '../../service/route-planner.service';
import { TranslationService } from '../../service/translation.service';
import { NotificationService } from '../../service/notification.service';
import { UserSessionService } from '../../service/user-session.service';

@Component({
  selector: 'app-route-planner-page',
  templateUrl: './route-planner-page.component.html',
  styleUrl: './route-planner-page.component.css'
})
export class RoutePlannerPageComponent implements OnInit, AfterViewInit, OnDestroy {
  startCity = 'Mumbai';
  destinationCity = 'Goa';
  waypoints: string[] = ['Pune'];
  waypointToAdd = '';

  routes: PlannedRouteOption[] = [];
  selectedRouteId: 'express' | 'bypass' | 'corridor' = 'express';

  liveTrafficEnabled = false;
  saveRouteName = '';
  savedRoutes: SavedRoute[] = [];

  private map?: L.Map;
  private routeLayerGroup?: L.LayerGroup;
  private markerLayerGroup?: L.LayerGroup;
  private trafficInterval?: ReturnType<typeof setInterval>;
  private langSub?: Subscription;

  constructor(
    public plannerService: RoutePlannerService,
    public translationService: TranslationService,
    private toastService: NotificationService,
    private userSession: UserSessionService
  ) {}

  get cities(): CityLocation[] {
    return this.plannerService.cities;
  }

  get availableWaypoints(): CityLocation[] {
    return this.cities.filter(
      (c) =>
        c.name !== this.startCity &&
        c.name !== this.destinationCity &&
        !this.waypoints.includes(c.name)
    );
  }

  get selectedRoute(): PlannedRouteOption | undefined {
    return this.routes.find((r) => r.id === this.selectedRouteId) || this.routes[0];
  }

  get alternativeRoute(): PlannedRouteOption | undefined {
    const current = this.selectedRoute;
    if (!current || current.trafficLevel !== 'Heavy') {
      return undefined;
    }
    return this.routes
      .filter((r) => r.id !== current.id)
      .slice()
      .sort((a, b) => a.etaMinutes - b.etaMinutes)[0];
  }

  get timeSavedByAlternative(): number {
    const cur = this.selectedRoute;
    const alt = this.alternativeRoute;
    if (!cur || !alt) {
      return 0;
    }
    return Math.max(5, cur.etaMinutes - alt.etaMinutes);
  }

  ngOnInit(): void {
    this.loadSavedRoutes();
    this.routes = this.plannerService.generateRoutes(
      this.startCity,
      this.destinationCity,
      this.waypoints,
      false
    );
    this.langSub = this.translationService.currentLang$.subscribe(() => {
      if (this.map && this.routes.length > 0) {
        this.renderMap();
      }
    });
  }

  ngAfterViewInit(): void {
    this.initLeafletMap();
    this.renderMap();
  }

  ngOnDestroy(): void {
    this.stopLiveTraffic();
    this.langSub?.unsubscribe();
    this.map?.remove();
  }

  private initLeafletMap(): void {
    // Ensure default Leaflet marker assets resolve cleanly in Angular production builds
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'assets/leaflet/marker-icon-2x.png',
      iconUrl: 'assets/leaflet/marker-icon.png',
      shadowUrl: 'assets/leaflet/marker-shadow.png'
    });

    this.map = L.map('route-planner-map', {
      center: [19.076, 74.5],
      zoom: 6
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(this.map);

    this.routeLayerGroup = L.layerGroup().addTo(this.map);
    this.markerLayerGroup = L.layerGroup().addTo(this.map);
  }

  addWaypoint(): void {
    if (!this.waypointToAdd || this.waypoints.includes(this.waypointToAdd)) {
      return;
    }
    this.waypoints = [...this.waypoints, this.waypointToAdd];
    this.waypointToAdd = '';
    this.planRoutes(false);
  }

  removeWaypoint(city: string): void {
    this.waypoints = this.waypoints.filter((w) => w !== city);
    this.planRoutes(false);
  }

  planRoutes(forceHeavy = false, showToast = false): void {
    if (this.startCity === this.destinationCity) {
      this.toastService.show('routePlanner.sameCityError', 'warning');
      return;
    }

    this.waypoints = this.waypoints.filter(
      (w) => w !== this.startCity && w !== this.destinationCity
    );

    this.routes = this.plannerService.generateRoutes(
      this.startCity,
      this.destinationCity,
      this.waypoints,
      forceHeavy
    );

    if (forceHeavy) {
      this.selectedRouteId = 'express';
    } else if (!this.routes.some((r) => r.id === this.selectedRouteId)) {
      this.selectedRouteId = this.routes[0]?.id || 'express';
    }

    this.renderMap();
    if (showToast) {
      this.toastService.show('routePlanner.trafficUpdated', 'info', undefined, 2200);
    }
  }

  selectRoute(routeId: 'express' | 'bypass' | 'corridor'): void {
    this.selectedRouteId = routeId;
    this.renderMap();
  }

  switchToAlternative(): void {
    const alt = this.alternativeRoute;
    if (!alt) {
      return;
    }
    this.selectedRouteId = alt.id;
    this.renderMap();
    const altName = this.translationService.instant(alt.nameKey);
    this.toastService.show('routePlanner.switchedAlternative', 'success', { name: altName });
  }

  toggleLiveTraffic(): void {
    this.liveTrafficEnabled = !this.liveTrafficEnabled;
    if (this.liveTrafficEnabled) {
      this.planRoutes(false, true);
      this.trafficInterval = setInterval(() => {
        this.planRoutes(false, false);
      }, 8000);
    } else {
      this.stopLiveTraffic();
    }
  }

  private stopLiveTraffic(): void {
    if (this.trafficInterval) {
      clearInterval(this.trafficInterval);
      this.trafficInterval = undefined;
    }
  }

  saveCurrentRoute(): void {
    const current = this.selectedRoute;
    if (!current) {
      return;
    }
    const label =
      this.saveRouteName.trim() ||
      `${this.startCity} → ${this.destinationCity}${this.waypoints.length ? ' (' + this.waypoints.join(', ') + ')' : ''}`;

    const userId = this.userSession.currentUser?._id || 'guest-traveler';
    this.plannerService
      .saveRoute({
        userId,
        name: label,
        startCity: this.startCity,
        destinationCity: this.destinationCity,
        waypoints: [...this.waypoints],
        preferredRouteId: current.id,
        distanceKm: current.distanceKm,
        estimatedMinutes: current.etaMinutes,
        trafficLevel: current.trafficLevel
      })
      .subscribe((saved) => {
        this.savedRoutes = [saved, ...this.savedRoutes.filter((r) => r._id !== saved._id)];
        this.saveRouteName = '';
        this.toastService.show('routePlanner.routeSaved', 'success');
      });
  }

  loadSavedRoute(route: SavedRoute): void {
    this.startCity = route.startCity;
    this.destinationCity = route.destinationCity;
    this.waypoints = [...(route.waypoints || [])];
    this.selectedRouteId =
      (route.preferredRouteId as 'express' | 'bypass' | 'corridor') || 'express';
    this.planRoutes(false);
    this.toastService.show('routePlanner.routeLoaded', 'info', { name: route.name }, 2400);
  }

  deleteSavedRoute(id: string): void {
    this.plannerService.deleteSavedRoute(id).subscribe((remaining) => {
      this.savedRoutes = remaining;
      this.toastService.show('routePlanner.routeDeleted', 'info', undefined, 2200);
    });
  }

  formatDuration(minutes: number): string {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const hUnit = this.translationService.instant('common.h');
    const mUnit = this.translationService.instant('routePlanner.mins');
    return hrs > 0 ? `${hrs}${hUnit} ${mins} ${mUnit}` : `${mins} ${mUnit}`;
  }

  private loadSavedRoutes(): void {
    const userId = this.userSession.currentUser?._id || 'guest-traveler';
    this.plannerService.getSavedRoutes(userId).subscribe((list) => {
      this.savedRoutes = list;
    });
  }

  private renderMap(): void {
    if (!this.map || !this.routeLayerGroup || !this.markerLayerGroup) {
      return;
    }

    this.routeLayerGroup.clearLayers();
    this.markerLayerGroup.clearLayers();

    const boundsPts: L.LatLngExpression[] = [];

    // Draw alternative routes first, selected route on top
    const ordered = this.routes
      .slice()
      .sort((a, b) => (a.id === this.selectedRouteId ? 1 : b.id === this.selectedRouteId ? -1 : 0));

    ordered.forEach((route) => {
      const isSelected = route.id === this.selectedRouteId;
      const color = this.trafficColor(route.trafficLevel);
      const poly = L.polyline(route.coordinates, {
        color,
        weight: isSelected ? 6 : 4,
        opacity: isSelected ? 0.95 : 0.55,
        dashArray: isSelected ? undefined : '8 8'
      });
      poly.on('click', () => this.selectRoute(route.id));
      poly.bindTooltip(
        `${this.translationService.instant(route.nameKey)} (${route.distanceKm} km • ${this.formatDuration(route.etaMinutes)})`
      );
      poly.addTo(this.routeLayerGroup!);
      route.coordinates.forEach((pt) => boundsPts.push(pt));
    });

    // Plot Start, Waypoints, and Destination markers with custom SVG pins
    const startObj = this.plannerService.getCity(this.startCity);
    const destObj = this.plannerService.getCity(this.destinationCity);

    if (startObj) {
      this.addPin(startObj, '#16a34a', 'A');
    }
    this.waypoints.forEach((wp, idx) => {
      const wpObj = this.plannerService.getCity(wp);
      if (wpObj) {
        this.addPin(wpObj, '#f59e0b', `${idx + 1}`);
      }
    });
    if (destObj) {
      this.addPin(destObj, '#dc2626', 'B');
    }

    if (boundsPts.length > 1) {
      this.map.fitBounds(L.latLngBounds(boundsPts), { padding: [36, 36] });
    }
  }

  private addPin(city: CityLocation, color: string, label: string): void {
    if (!this.markerLayerGroup) {
      return;
    }
    const icon = L.divIcon({
      className: 'custom-map-pin',
      html: `<div style="background:${color};color:#fff;width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4);"><span style="transform:rotate(45deg);font-size:12px;font-weight:700;">${label}</span></div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 28]
    });

    L.marker([city.lat, city.lng], { icon })
      .bindPopup(`<strong>${this.translationService.translateCity(city.name)}</strong>`)
      .addTo(this.markerLayerGroup);
  }

  private trafficColor(level: TrafficLevel): string {
    if (level === 'Heavy') return '#ef4444';
    if (level === 'Moderate') return '#f59e0b';
    return '#16a34a';
  }
}
