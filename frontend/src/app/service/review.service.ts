import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { url } from '../config';
import { CompletedJourneyOption, RouteReview, RouteReviewSummary } from '../model/review.model';

const REVIEWS_STORAGE_KEY = 'tedbus_route_reviews';
const LOCAL_BOOKINGS_KEY = 'tedbus_local_bookings';
export const REVIEW_EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

@Injectable({
  providedIn: 'root'
})
export class ReviewService {
  private readonly apiBase = `${url}reviews`;
  private readonly reviewsChangedSubject = new Subject<string>();
  readonly reviewsChanged$ = this.reviewsChangedSubject.asObservable();

  constructor(private http: HttpClient) {
    this.ensureSeedData();
  }

  buildRouteKey(departure: string, arrival: string): string {
    return `${(departure || '').trim().toLowerCase()}-${(arrival || '').trim().toLowerCase()}`;
  }

  getRouteReviews(departure: string, arrival: string): Observable<RouteReviewSummary> {
    const routeKey = this.buildRouteKey(departure, arrival);
    return this.http.get<RouteReviewSummary>(`${this.apiBase}/route/${routeKey}`).pipe(
      map((res) => {
        if (res && Array.isArray(res.reviews) && res.reviews.length > 0) {
          this.mergeServerReviewsIntoLocal(res.reviews);
          return res;
        }
        return this.getLocalRouteSummary(routeKey);
      }),
      catchError(() => of(this.getLocalRouteSummary(routeKey)))
    );
  }

  getUserReviews(userId: string): Observable<RouteReview[]> {
    return this.http.get<RouteReview[]>(`${this.apiBase}/user/${userId}`).pipe(
      map((res) => (Array.isArray(res) && res.length > 0 ? res : this.getLocalUserReviews(userId))),
      catchError(() => of(this.getLocalUserReviews(userId)))
    );
  }

  createReview(payload: {
    departureCity: string;
    arrivalCity: string;
    busId?: string;
    operatorName?: string;
    bookingId: string;
    userId: string;
    userName: string;
    rating: number;
    comment: string;
    journeyDate: string;
  }): Observable<RouteReviewSummary> {
    const routeKey = this.buildRouteKey(payload.departureCity, payload.arrivalCity);
    const body = { ...payload, routeKey };

    return this.http.post<any>(this.apiBase, body).pipe(
      map((res) => {
        if (res?.review) {
          this.saveLocalReview(res.review);
        }
        this.reviewsChangedSubject.next(routeKey);
        return this.getLocalRouteSummary(routeKey);
      }),
      catchError((err) => {
        // Re-throw explicit validation/conflict errors from server
        if (err?.status === 400 || err?.status === 403 || err?.status === 409) {
          throw err;
        }
        // Fallback to localStorage when backend is unavailable
        const localResult = this.createLocalReview(body);
        this.reviewsChangedSubject.next(routeKey);
        return of(localResult);
      })
    );
  }

  updateReview(
    reviewId: string,
    payload: { userId: string; rating: number; comment: string; routeKey: string }
  ): Observable<RouteReviewSummary> {
    return this.http.put<any>(`${this.apiBase}/${reviewId}`, payload).pipe(
      map((res) => {
        if (res?.review) {
          this.saveLocalReview(res.review);
        }
        this.reviewsChangedSubject.next(payload.routeKey);
        return this.getLocalRouteSummary(payload.routeKey);
      }),
      catchError((err) => {
        if (err?.status === 400 || err?.status === 403 || err?.status === 404) {
          throw err;
        }
        const localResult = this.updateLocalReview(reviewId, payload);
        this.reviewsChangedSubject.next(payload.routeKey);
        return of(localResult);
      })
    );
  }

  reportReview(
    reviewId: string,
    payload: { userId: string; reason: string; routeKey: string }
  ): Observable<RouteReviewSummary> {
    return this.http.post<any>(`${this.apiBase}/${reviewId}/report`, payload).pipe(
      tap(() => this.hideLocalReview(reviewId, payload.userId, payload.reason)),
      map(() => {
        this.reviewsChangedSubject.next(payload.routeKey);
        return this.getLocalRouteSummary(payload.routeKey);
      }),
      catchError(() => {
        this.hideLocalReview(reviewId, payload.userId, payload.reason);
        this.reviewsChangedSubject.next(payload.routeKey);
        return of(this.getLocalRouteSummary(payload.routeKey));
      })
    );
  }

  canEditReview(review: RouteReview, currentUserId: string | null | undefined): boolean {
    if (!currentUserId || review.userId !== currentUserId) {
      return false;
    }
    const elapsed = Date.now() - new Date(review.createdAt).getTime();
    return elapsed <= REVIEW_EDIT_WINDOW_MS;
  }

  getRemainingEditHours(review: RouteReview): number {
    const remainingMs = REVIEW_EDIT_WINDOW_MS - (Date.now() - new Date(review.createdAt).getTime());
    if (remainingMs <= 0) {
      return 0;
    }
    return Math.max(1, Math.ceil(remainingMs / (60 * 60 * 1000)));
  }

  getCompletedJourneysForRoute(
    userId: string,
    departure: string,
    arrival: string,
    existingReviews: RouteReview[]
  ): CompletedJourneyOption[] {
    const depNorm = (departure || '').trim().toLowerCase();
    const arrNorm = (arrival || '').trim().toLowerCase();
    const reviewedBookingIds = new Set(
      existingReviews
        .filter((r) => r.userId === userId)
        .map((r) => r.bookingId)
    );

    const allLocalReviews = this.readAllLocalReviews();
    allLocalReviews
      .filter((r) => r.userId === userId)
      .forEach((r) => reviewedBookingIds.add(r.bookingId));

    const bookings = this.readLocalBookings().filter((b) => {
      if (String(b.customerId) !== String(userId)) {
        return false;
      }
      const bDep = (b.departureDetails?.city || '').trim().toLowerCase();
      const bArr = (b.arrivalDetails?.city || '').trim().toLowerCase();
      if (bDep !== depNorm || bArr !== arrNorm) {
        return false;
      }
      const depDate = b.departureDetails?.date;
      const isPast = depDate ? new Date(depDate).getTime() < Date.now() : false;
      return b.status === 'completed' || isPast;
    });

    return bookings.map((b) => ({
      bookingId: b._id || b.id,
      journeyDate: b.departureDetails?.date || b.bookingDate || '',
      operatorName: b.operatorName || 'Tedbus Express',
      departureCity: b.departureDetails?.city || departure,
      arrivalCity: b.arrivalDetails?.city || arrival,
      busId: b.busId,
      alreadyReviewed: reviewedBookingIds.has(b._id || b.id)
    }));
  }

  computeStats(routeKey: string, allReviews: RouteReview[]): RouteReviewSummary {
    const visible = allReviews
      .filter((r) => r.routeKey === routeKey && !r.isHidden)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const breakdown: { [star: number]: number } = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    if (visible.length === 0) {
      return {
        routeKey,
        averageRating: 0,
        totalReviews: 0,
        ratingBreakdown: breakdown,
        reviews: []
      };
    }

    let sum = 0;
    visible.forEach((r) => {
      const star = Math.min(5, Math.max(1, Math.round(r.rating)));
      sum += star;
      breakdown[star] = (breakdown[star] || 0) + 1;
    });

    return {
      routeKey,
      averageRating: Math.round((sum / visible.length) * 10) / 10,
      totalReviews: visible.length,
      ratingBreakdown: breakdown,
      reviews: visible
    };
  }

  private getLocalRouteSummary(routeKey: string): RouteReviewSummary {
    return this.computeStats(routeKey, this.readAllLocalReviews());
  }

  private getLocalUserReviews(userId: string): RouteReview[] {
    return this.readAllLocalReviews()
      .filter((r) => r.userId === userId && !r.isHidden)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  private createLocalReview(body: any): RouteReviewSummary {
    const all = this.readAllLocalReviews();
    const duplicate = all.find(
      (r) => r.userId === body.userId && r.bookingId === body.bookingId
    );
    if (duplicate) {
      throw { status: 409, error: { error: 'You have already reviewed this journey' } };
    }

    const review: RouteReview = {
      _id: `rev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      routeKey: body.routeKey,
      departureCity: body.departureCity,
      arrivalCity: body.arrivalCity,
      busId: body.busId,
      operatorName: body.operatorName,
      bookingId: body.bookingId,
      userId: body.userId,
      userName: body.userName,
      rating: Number(body.rating),
      comment: String(body.comment).trim(),
      journeyDate: body.journeyDate,
      isHidden: false,
      reportCount: 0,
      reportedBy: [],
      reportReasons: [],
      editedAt: null,
      createdAt: new Date().toISOString()
    };

    all.unshift(review);
    this.writeAllLocalReviews(all);
    return this.computeStats(body.routeKey, all);
  }

  private updateLocalReview(
    reviewId: string,
    payload: { userId: string; rating: number; comment: string; routeKey: string }
  ): RouteReviewSummary {
    const all = this.readAllLocalReviews();
    const target = all.find((r) => r._id === reviewId);
    if (!target) {
      throw { status: 404, error: { error: 'Review not found' } };
    }
    if (!this.canEditReview(target, payload.userId)) {
      throw { status: 403, error: { error: 'Edit window expired (24 hours)' } };
    }
    target.rating = Number(payload.rating);
    target.comment = payload.comment.trim();
    target.editedAt = new Date().toISOString();
    this.writeAllLocalReviews(all);
    return this.computeStats(payload.routeKey, all);
  }

  private hideLocalReview(reviewId: string, userId: string, reason: string): void {
    const all = this.readAllLocalReviews();
    const target = all.find((r) => r._id === reviewId);
    if (target) {
      target.isHidden = true;
      target.reportCount = (target.reportCount || 0) + 1;
      target.reportedBy = [...(target.reportedBy || []), userId || 'anonymous'];
      target.reportReasons = [...(target.reportReasons || []), reason];
      this.writeAllLocalReviews(all);
    }
  }

  private saveLocalReview(review: RouteReview): void {
    const all = this.readAllLocalReviews();
    const idx = all.findIndex((r) => r._id === review._id);
    if (idx >= 0) {
      all[idx] = review;
    } else {
      all.unshift(review);
    }
    this.writeAllLocalReviews(all);
  }

  private mergeServerReviewsIntoLocal(serverReviews: RouteReview[]): void {
    const local = this.readAllLocalReviews();
    serverReviews.forEach((sr) => {
      const idx = local.findIndex((lr) => lr._id === sr._id);
      if (idx >= 0) {
        local[idx] = sr;
      } else {
        local.push(sr);
      }
    });
    this.writeAllLocalReviews(local);
  }

  private readAllLocalReviews(): RouteReview[] {
    try {
      const raw = localStorage.getItem(REVIEWS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private writeAllLocalReviews(reviews: RouteReview[]): void {
    try {
      localStorage.setItem(REVIEWS_STORAGE_KEY, JSON.stringify(reviews));
    } catch {
      // Ignore storage errors
    }
  }

  private readLocalBookings(): any[] {
    try {
      const raw = localStorage.getItem(LOCAL_BOOKINGS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private ensureSeedData(): void {
    const existing = this.readAllLocalReviews();
    if (existing.length > 0) {
      return;
    }

    const now = Date.now();
    const hoursAgo = (h: number) => new Date(now - h * 60 * 60 * 1000).toISOString();

    const seeds: RouteReview[] = [
      {
        _id: 'seed-rev-1',
        routeKey: 'delhi-jaipur',
        departureCity: 'Delhi',
        arrivalCity: 'Jaipur',
        operatorName: 'TravelXpress',
        bookingId: 'seed-bk-1',
        userId: 'seed-u-1',
        userName: 'Priya Deshmukh',
        rating: 5,
        comment:
          'Very punctual departure from Connaught Place. Clean sleeper berths, courteous staff, and smooth highway driving all the way to Jaipur.',
        journeyDate: '2026-10-18',
        isHidden: false,
        reportCount: 0,
        createdAt: hoursAgo(36)
      },
      {
        _id: 'seed-rev-2',
        routeKey: 'delhi-jaipur',
        departureCity: 'Delhi',
        arrivalCity: 'Jaipur',
        operatorName: 'MetroBus',
        bookingId: 'seed-bk-2',
        userId: 'seed-u-2',
        userName: 'Rohan Kulkarni',
        rating: 4,
        comment:
          'Comfortable seats and working charging points throughout the trip. Food halt near Behror was clean and well timed.',
        journeyDate: '2026-10-22',
        isHidden: false,
        reportCount: 0,
        createdAt: hoursAgo(12)
      },
      {
        _id: 'seed-rev-3',
        routeKey: 'mumbai-goa',
        departureCity: 'Mumbai',
        arrivalCity: 'Goa',
        operatorName: 'FastTransit',
        bookingId: 'demo-booking-mum-goa-1',
        userId: 'demo-user-aarav',
        userName: 'Aarav Sharma',
        rating: 5,
        comment:
          'Amazing overnight ride via Konkan highway! Blankets were fresh, AC temperature was just right, and we reached Calangute 15 minutes early.',
        journeyDate: '2026-09-20',
        isHidden: false,
        reportCount: 0,
        // > 24 hours old so the 24h edit lock can be tested immediately on Mumbai -> Goa
        createdAt: hoursAgo(72)
      },
      {
        _id: 'seed-rev-4',
        routeKey: 'mumbai-goa',
        departureCity: 'Mumbai',
        arrivalCity: 'Goa',
        operatorName: 'CityLink',
        bookingId: 'seed-bk-4',
        userId: 'seed-u-4',
        userName: 'Sneha Patil',
        rating: 4,
        comment:
          'Good sleeper bus with live GPS tracking that helped my family know our exact ETA in Goa. Slightly bumpy near ghats but safe driver.',
        journeyDate: '2026-10-05',
        isHidden: false,
        reportCount: 0,
        createdAt: hoursAgo(28)
      },
      {
        _id: 'seed-rev-5',
        routeKey: 'bangalore-mysore',
        departureCity: 'Bangalore',
        arrivalCity: 'Mysore',
        operatorName: 'EliteTravels',
        bookingId: 'seed-bk-5',
        userId: 'seed-u-5',
        userName: 'Karthik Nair',
        rating: 5,
        comment:
          'Super quick 3-hour ride on the expressway! Clean interiors, polite conductor, and effortless boarding near Indiranagar.',
        journeyDate: '2026-10-24',
        isHidden: false,
        reportCount: 0,
        createdAt: hoursAgo(16)
      },
      {
        _id: 'seed-rev-6',
        routeKey: 'kolkata-darjeeling',
        departureCity: 'Kolkata',
        arrivalCity: 'Darjeeling',
        operatorName: 'SwiftTrans',
        bookingId: 'seed-bk-6',
        userId: 'seed-u-6',
        userName: 'Ananya Sen',
        rating: 5,
        comment:
          'Experienced hill drivers and cozy heated cabin for the early morning ascent. Watching sunrise near Siliguri was unforgettable.',
        journeyDate: '2026-10-14',
        isHidden: false,
        reportCount: 0,
        createdAt: hoursAgo(40)
      },
      {
        _id: 'seed-rev-7',
        routeKey: 'chennai-pondicherry',
        departureCity: 'Chennai',
        arrivalCity: 'Pondicherry',
        operatorName: 'TravelMax',
        bookingId: 'seed-bk-7',
        userId: 'seed-u-7',
        userName: 'Vikram Subramanian',
        rating: 4,
        comment:
          'Scenic East Coast Road drive with great AC cooling and punctual stops. Ideal weekend bus option for solo and family travelers.',
        journeyDate: '2026-10-26',
        isHidden: false,
        reportCount: 0,
        createdAt: hoursAgo(8)
      }
    ];

    this.writeAllLocalReviews(seeds);
  }
}
