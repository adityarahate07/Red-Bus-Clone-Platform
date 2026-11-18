import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { url } from '../config';
import { Booking } from '../model/booking.model';

const LOCAL_BOOKINGS_KEY = 'tedbus_local_bookings';

const MOCK_ROUTE_CATALOG: Record<string, { route: any; matchedBuses: any[] }> = {
  'delhi-jaipur': {
    route: {
      _id: '66385c2c5a63e8cbd6abb0aa',
      departureLocation: {
        name: 'Delhi',
        subLocations: ['Connaught Place', 'Chandni Chowk', 'Lajpat Nagar']
      },
      arrivalLocation: {
        name: 'Jaipur',
        subLocations: ['Hawa Mahal', 'Amer Fort', 'Jantar Mantar']
      },
      duration: 5
    },
    matchedBuses: [
      {
        _id: 'bus-del-jai-1',
        operatorName: 'TravelXpress',
        busType: 'sleeper',
        departureTime: '08',
        rating: [4, 4.5, 4.2],
        totalSeats: 40,
        routes: '66385c2c5a63e8cbd6abb0aa',
        liveTracking: 1,
        reschedulable: 1
      },
      {
        _id: 'bus-del-jai-2',
        operatorName: 'MetroBus',
        busType: 'standard',
        departureTime: '11',
        rating: [3.9, 3.8, 4.0],
        totalSeats: 40,
        routes: '66385c2c5a63e8cbd6abb0aa',
        liveTracking: 0,
        reschedulable: 1
      }
    ]
  },
  'mumbai-goa': {
    route: {
      _id: '66385c3a5a63e8cbd6abba12',
      departureLocation: {
        name: 'Mumbai',
        subLocations: ['Gateway of India', 'Marine Drive', 'Bandra']
      },
      arrivalLocation: {
        name: 'Goa',
        subLocations: ['Calangute Beach', 'Baga Beach', 'Old Goa']
      },
      duration: 10
    },
    matchedBuses: [
      {
        _id: 'bus-mum-goa-1',
        operatorName: 'FastTransit',
        busType: 'A/C Seater',
        departureTime: '21',
        rating: [4.5, 4.4, 4.6],
        totalSeats: 40,
        routes: '66385c3a5a63e8cbd6abba12',
        liveTracking: 1,
        reschedulable: 1
      },
      {
        _id: 'bus-mum-goa-2',
        operatorName: 'CityLink',
        busType: 'sleeper',
        departureTime: '22',
        rating: [4.2, 4.3, 4.1],
        totalSeats: 40,
        routes: '66385c3a5a63e8cbd6abba12',
        liveTracking: 1,
        reschedulable: 0
      }
    ]
  },
  'bangalore-mysore': {
    route: {
      _id: '66385c5a5a63e8cbd6abcbe8',
      departureLocation: {
        name: 'Bangalore',
        subLocations: ['MG Road', 'Indiranagar', 'Koramangala']
      },
      arrivalLocation: {
        name: 'Mysore',
        subLocations: ['Mysore Palace', 'Chamundi Hill', 'Brindavan Gardens']
      },
      duration: 3
    },
    matchedBuses: [
      {
        _id: 'bus-blr-mys-1',
        operatorName: 'EliteTravels',
        busType: 'sleeper',
        departureTime: '06',
        rating: [4.3, 4.4, 4.5],
        totalSeats: 40,
        routes: '66385c5a5a63e8cbd6abcbe8',
        liveTracking: 1,
        reschedulable: 1
      },
      {
        _id: 'bus-blr-mys-2',
        operatorName: 'TransitHub',
        busType: 'standard',
        departureTime: '09',
        rating: [4.6, 4.7, 4.8],
        totalSeats: 40,
        routes: '66385c5a5a63e8cbd6abcbe8',
        liveTracking: 0,
        reschedulable: 1
      }
    ]
  },
  'kolkata-darjeeling': {
    route: {
      _id: '66385c4c5a63e8cbd6abc47c',
      departureLocation: {
        name: 'Kolkata',
        subLocations: ['Victoria Memorial', 'Howrah Bridge', 'Park Street']
      },
      arrivalLocation: {
        name: 'Darjeeling',
        subLocations: ['Tiger Hill', 'Darjeeling Himalayan Railway', 'Batasia Loop']
      },
      duration: 8
    },
    matchedBuses: [
      {
        _id: 'bus-kol-dar-1',
        operatorName: 'SwiftTrans',
        busType: 'A/C Seater',
        departureTime: '20',
        rating: [4.8, 4.9, 4.7],
        totalSeats: 40,
        routes: '66385c4c5a63e8cbd6abc47c',
        liveTracking: 1,
        reschedulable: 1
      }
    ]
  },
  'chennai-pondicherry': {
    route: {
      _id: '66385c895a63e8cbd6abe697',
      departureLocation: {
        name: 'Chennai',
        subLocations: ['Marina Beach', 'Kapaleeshwarar Temple', 'Elliots Beach']
      },
      arrivalLocation: {
        name: 'Pondicherry',
        subLocations: ['Auroville', 'Paradise Beach', 'French Colony']
      },
      duration: 6
    },
    matchedBuses: [
      {
        _id: 'bus-chn-pon-1',
        operatorName: 'TravelMax',
        busType: 'A/C Seater',
        departureTime: '08',
        rating: [4.5, 4.6, 4.7],
        totalSeats: 40,
        routes: '66385c895a63e8cbd6abe697',
        liveTracking: 1,
        reschedulable: 1
      }
    ]
  }
};

@Injectable({
  providedIn: 'root'
})
export class BusService {
  private busbookapi: string = url + 'booking/';
  private apiurl: string = url + 'routes/';

  constructor(private http: HttpClient) {}

  GETBUSDETAILS(depart: string, arrival: string, date: string): Observable<any> {
    const endpoint = `${this.apiurl}${depart}/${arrival}/${date}`;
    return this.http.get<any>(endpoint).pipe(
      map((res) => (res?.matchedBuses?.length ? res : this.buildMockRouteResponse(depart, arrival, date))),
      catchError(() => of(this.buildMockRouteResponse(depart, arrival, date)))
    );
  }

  addbusmongo(myBooking: any): Observable<any> {
    const busbook: Booking = {
      customerId: myBooking.customerId,
      passengerDetails: myBooking.passengerDetails,
      email: myBooking.email,
      phoneNumber: myBooking.phoneNumber,
      fare: myBooking.fare,
      status: myBooking.status,
      bookingDate: myBooking.bookingDate,
      busId: myBooking.busId,
      seats: myBooking.seats,
      departureDetails: myBooking.departureDetails,
      arrivalDetails: myBooking.arrivalDetails,
      duration: myBooking.duration,
      isBusinessTravel: myBooking.isBusinessTravel,
      isInsurance: myBooking.isInsurance,
      isCovidDonated: myBooking.isCovidDonated
    };

    return this.http.post<any>(this.busbookapi, busbook).pipe(
      tap((saved) => this.saveLocalBooking({ ...saved, operatorName: myBooking.operatorName })),
      catchError(() => {
        const localSaved = {
          ...busbook,
          _id: `local-bk-${Date.now()}`,
          operatorName: myBooking.operatorName || 'Tedbus Express'
        };
        this.saveLocalBooking(localSaved);
        return of(localSaved);
      })
    );
  }

  getbusmongo(id: string): Observable<any[]> {
    const endpoint = `${this.busbookapi}${id}`;
    return this.http.get<any[]>(endpoint).pipe(
      map((serverList) => this.mergeWithLocalBookings(id, Array.isArray(serverList) ? serverList : [])),
      catchError(() => of(this.getLocalBookingsForUser(id)))
    );
  }

  markBookingCompleted(bookingId: string): Observable<any> {
    this.updateLocalBookingStatus(bookingId, 'completed');
    return this.http
      .patch<any>(`${this.busbookapi}${bookingId}/status`, { status: 'completed' })
      .pipe(catchError(() => of({ _id: bookingId, status: 'completed' })));
  }

  cancelBooking(bookingId: string): Observable<any> {
    this.updateLocalBookingStatus(bookingId, 'cancelled');
    return this.http
      .patch<any>(`${this.busbookapi}${bookingId}/status`, { status: 'cancelled' })
      .pipe(catchError(() => of({ _id: bookingId, status: 'cancelled' })));
  }

  private buildMockRouteResponse(depart: string, arrival: string, date: string): any {
    const key = `${(depart || '').trim().toLowerCase()}-${(arrival || '').trim().toLowerCase()}`;
    const entry = MOCK_ROUTE_CATALOG[key];
    if (!entry) {
      return { route: null, matchedBuses: [], busidwithseatobj: {} };
    }
    const localBookings = this.readLocalBookings();
    const busidwithseatobj: { [key: string]: number[] } = {};
    entry.matchedBuses.forEach((bus) => {
      const bookedSeats: number[] = [2, 5, 14];
      localBookings
        .filter((b) => b.busId === bus._id && b.departureDetails?.date === date)
        .forEach((b) => {
          if (Array.isArray(b.seats)) {
            bookedSeats.push(...b.seats.map((s: any) => Number(s)));
          }
        });
      busidwithseatobj[bus._id] = Array.from(new Set(bookedSeats));
    });
    return {
      route: entry.route,
      matchedBuses: entry.matchedBuses,
      busidwithseatobj
    };
  }

  private readLocalBookings(): any[] {
    try {
      const raw = localStorage.getItem(LOCAL_BOOKINGS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private writeLocalBookings(list: any[]): void {
    try {
      localStorage.setItem(LOCAL_BOOKINGS_KEY, JSON.stringify(list));
    } catch {
      // Ignore storage errors
    }
  }

  private saveLocalBooking(booking: any): void {
    const list = this.readLocalBookings();
    const id = booking._id || booking.id;
    const idx = list.findIndex((b) => (b._id || b.id) === id);
    if (idx >= 0) {
      list[idx] = booking;
    } else {
      list.unshift(booking);
    }
    this.writeLocalBookings(list);
  }

  private updateLocalBookingStatus(bookingId: string, status: string): void {
    const list = this.readLocalBookings();
    const target = list.find((b) => (b._id || b.id) === bookingId);
    if (target) {
      target.status = status;
      this.writeLocalBookings(list);
    }
  }

  private getLocalBookingsForUser(userId: string): any[] {
    return this.readLocalBookings().filter((b) => String(b.customerId) === String(userId));
  }

  private mergeWithLocalBookings(userId: string, serverList: any[]): any[] {
    const localList = this.getLocalBookingsForUser(userId);
    const mapById = new Map<string, any>();
    localList.forEach((b) => mapById.set(String(b._id || b.id), b));
    serverList.forEach((b) => mapById.set(String(b._id || b.id), b));
    return Array.from(mapById.values());
  }
}
