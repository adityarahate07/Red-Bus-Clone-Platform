import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ThemeService } from './theme.service';
import { TranslationService } from './translation.service';

export interface SessionUser {
  _id: string;
  id?: string;
  name: string;
  email: string;
  gender?: string;
  profilepicture?: string;
  isVerified?: boolean;
  isDemo?: boolean;
  preferredTheme?: 'light' | 'dark';
  preferredLanguage?: 'en' | 'hi' | 'mr';
}

const SESSION_KEY = 'Loggedinuser';
const LOCAL_BOOKINGS_KEY = 'tedbus_local_bookings';

@Injectable({
  providedIn: 'root'
})
export class UserSessionService {
  private readonly userSubject = new BehaviorSubject<SessionUser | null>(null);
  readonly currentUser$ = this.userSubject.asObservable();

  constructor(
    private themeService: ThemeService,
    private translationService: TranslationService
  ) {
    this.restoreSession();
  }

  get currentUser(): SessionUser | null {
    return this.userSubject.value;
  }

  get isLoggedIn(): boolean {
    return !!this.userSubject.value;
  }

  get isVerified(): boolean {
    const user = this.userSubject.value;
    return !!user && user.isVerified !== false;
  }

  restoreSession(): void {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && (parsed._id || parsed.email)) {
          const normalized: SessionUser = {
            ...parsed,
            _id: parsed._id || parsed.id || parsed.email,
            isVerified: parsed.isVerified !== false
          };
          this.userSubject.next(normalized);
          return;
        }
      }
    } catch {
      // Ignore malformed storage
    }
    this.userSubject.next(null);
  }

  setUser(user: any): void {
    if (!user) {
      this.clearUser();
      return;
    }
    const normalized: SessionUser = {
      ...user,
      _id: user._id || user.id || user.email,
      isVerified: true
    };
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(normalized));
    } catch {
      // Ignore storage errors
    }
    this.userSubject.next(normalized);
    this.themeService.syncFromUserProfile(normalized);
    this.translationService.syncFromUserProfile(normalized);
  }

  loginAsDemoTraveler(): SessionUser {
    const demoUser: SessionUser = {
      _id: 'demo-user-aarav',
      id: 'demo-user-aarav',
      name: 'Aarav Sharma',
      email: 'aarav.traveler@tedbus.in',
      gender: 'Male',
      isVerified: true,
      isDemo: true,
      preferredTheme: this.themeService.currentTheme,
      preferredLanguage: this.translationService.currentLang
    };
    this.seedDemoCompletedBookings(demoUser);
    this.setUser(demoUser);
    return demoUser;
  }

  clearUser(): void {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // Ignore
    }
    this.userSubject.next(null);
  }

  private seedDemoCompletedBookings(user: SessionUser): void {
    try {
      const existingRaw = localStorage.getItem(LOCAL_BOOKINGS_KEY);
      const existing: any[] = existingRaw ? JSON.parse(existingRaw) : [];
      const hasDemo = existing.some((b) => b.customerId === user._id);
      if (hasDemo) {
        return;
      }

      const demoBookings = [
        {
          _id: 'demo-booking-del-jai-1',
          customerId: user._id,
          passengerDetails: [{ name: user.name, gender: 'Male', age: 26 }],
          email: user.email,
          phoneNumber: '9876543210',
          fare: 625,
          status: 'completed',
          bookingDate: '2026-10-12',
          busId: 'bus-del-jai-1',
          operatorName: 'TravelXpress',
          seats: [12],
          departureDetails: { city: 'Delhi', time: 8, date: '2026-10-15' },
          arrivalDetails: { city: 'Jaipur', time: 13, date: '2026-10-15' },
          duration: '5'
        },
        {
          _id: 'demo-booking-mum-goa-1',
          customerId: user._id,
          passengerDetails: [{ name: user.name, gender: 'Male', age: 26 }],
          email: user.email,
          phoneNumber: '9876543210',
          fare: 950,
          status: 'completed',
          bookingDate: '2026-09-18',
          busId: 'bus-mum-goa-1',
          operatorName: 'FastTransit',
          seats: [7],
          departureDetails: { city: 'Mumbai', time: 21, date: '2026-09-20' },
          arrivalDetails: { city: 'Goa', time: 7, date: '2026-09-21' },
          duration: '10'
        },
        {
          _id: 'demo-booking-blr-mys-1',
          customerId: user._id,
          passengerDetails: [{ name: user.name, gender: 'Male', age: 26 }],
          email: user.email,
          phoneNumber: '9876543210',
          fare: 420,
          status: 'completed',
          bookingDate: '2026-10-25',
          busId: 'bus-blr-mys-1',
          operatorName: 'EliteTravels',
          seats: [4],
          departureDetails: { city: 'Bangalore', time: 6, date: '2026-10-28' },
          arrivalDetails: { city: 'Mysore', time: 9, date: '2026-10-28' },
          duration: '3'
        }
      ];

      localStorage.setItem(LOCAL_BOOKINGS_KEY, JSON.stringify([...demoBookings, ...existing]));
    } catch {
      // Ignore storage errors
    }
  }
}
