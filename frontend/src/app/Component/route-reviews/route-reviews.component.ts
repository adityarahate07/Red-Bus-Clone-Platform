import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { Subscription } from 'rxjs';
import {
  CompletedJourneyOption,
  RouteReview,
  RouteReviewSummary
} from '../../model/review.model';
import { ReviewService } from '../../service/review.service';
import { SessionUser, UserSessionService } from '../../service/user-session.service';
import { NotificationService } from '../../service/notification.service';
import { TranslationService } from '../../service/translation.service';

@Component({
  selector: 'app-route-reviews',
  templateUrl: './route-reviews.component.html',
  styleUrl: './route-reviews.component.css'
})
export class RouteReviewsComponent implements OnInit, OnChanges, OnDestroy {
  @Input() departure: string = '';
  @Input() arrival: string = '';
  @Input() compact: boolean = false;

  summary: RouteReviewSummary = {
    routeKey: '',
    averageRating: 0,
    totalReviews: 0,
    ratingBreakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    reviews: []
  };

  currentUser: SessionUser | null = null;
  completedJourneys: CompletedJourneyOption[] = [];
  eligibleJourneys: CompletedJourneyOption[] = [];
  selectedBookingId: string = '';

  // Create form state
  newRating: number = 0;
  hoverRating: number = 0;
  newComment: string = '';
  submitting = false;

  // Edit state
  editingReviewId: string | null = null;
  editRating: number = 0;
  editComment: string = '';

  // Report state
  reportingReviewId: string | null = null;
  selectedReportReason: string = 'spam';

  readonly starLevels = [5, 4, 3, 2, 1];
  readonly starInputs = [1, 2, 3, 4, 5];

  private userSub?: Subscription;
  private reviewsSub?: Subscription;

  constructor(
    private reviewService: ReviewService,
    private userSession: UserSessionService,
    private notificationService: NotificationService,
    public translationService: TranslationService
  ) {}

  ngOnInit(): void {
    this.userSub = this.userSession.currentUser$.subscribe((user) => {
      this.currentUser = user;
      this.refreshEligibility();
    });
    this.reviewsSub = this.reviewService.reviewsChanged$.subscribe((changedRouteKey) => {
      if (changedRouteKey === this.reviewService.buildRouteKey(this.departure, this.arrival)) {
        this.loadReviews();
      }
    });
    this.loadReviews();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['departure'] || changes['arrival']) {
      this.loadReviews();
    }
  }

  ngOnDestroy(): void {
    this.userSub?.unsubscribe();
    this.reviewsSub?.unsubscribe();
  }

  loadReviews(): void {
    if (!this.departure || !this.arrival) {
      return;
    }
    this.reviewService.getRouteReviews(this.departure, this.arrival).subscribe((res) => {
      this.summary = res;
      this.refreshEligibility();
    });
  }

  refreshEligibility(): void {
    if (!this.currentUser || !this.departure || !this.arrival) {
      this.completedJourneys = [];
      this.eligibleJourneys = [];
      this.selectedBookingId = '';
      return;
    }

    this.completedJourneys = this.reviewService.getCompletedJourneysForRoute(
      this.currentUser._id,
      this.departure,
      this.arrival,
      this.summary.reviews
    );
    this.eligibleJourneys = this.completedJourneys.filter((j) => !j.alreadyReviewed);
    if (
      this.eligibleJourneys.length > 0 &&
      !this.eligibleJourneys.some((j) => j.bookingId === this.selectedBookingId)
    ) {
      this.selectedBookingId = this.eligibleJourneys[0].bookingId;
    } else if (this.eligibleJourneys.length === 0) {
      this.selectedBookingId = '';
    }
  }

  signInDemo(): void {
    const user = this.userSession.loginAsDemoTraveler();
    this.notificationService.show('notifications.demoSignedIn', 'success', { name: user.name });
  }

  getBreakdownPercent(star: number): number {
    if (!this.summary.totalReviews) {
      return 0;
    }
    return Math.round(((this.summary.ratingBreakdown[star] || 0) / this.summary.totalReviews) * 100);
  }

  setRating(star: number): void {
    this.newRating = star;
  }

  submitReview(): void {
    if (!this.currentUser) {
      this.notificationService.show('notifications.signInRequired', 'warning');
      return;
    }
    if (this.newRating < 1 || this.newRating > 5) {
      this.notificationService.show('notifications.reviewSelectRating', 'warning');
      return;
    }
    const trimmed = this.newComment.trim();
    if (trimmed.length < 20) {
      this.notificationService.show('notifications.reviewMinChars', 'warning');
      return;
    }

    const journey = this.eligibleJourneys.find((j) => j.bookingId === this.selectedBookingId);
    if (!journey) {
      this.notificationService.show('notifications.reviewDuplicate', 'warning');
      return;
    }

    this.submitting = true;
    this.reviewService
      .createReview({
        departureCity: this.departure,
        arrivalCity: this.arrival,
        busId: journey.busId,
        operatorName: journey.operatorName,
        bookingId: journey.bookingId,
        userId: this.currentUser._id,
        userName: this.currentUser.name,
        rating: this.newRating,
        comment: trimmed,
        journeyDate: journey.journeyDate
      })
      .subscribe({
        next: (updatedSummary) => {
          this.summary = updatedSummary;
          this.newRating = 0;
          this.newComment = '';
          this.submitting = false;
          this.refreshEligibility();
          this.notificationService.show('notifications.reviewSubmitted', 'success');
        },
        error: (err) => {
          this.submitting = false;
          if (err?.status === 409) {
            this.notificationService.show('notifications.reviewDuplicate', 'warning');
          } else {
            this.notificationService.show('notifications.reviewMinChars', 'error');
          }
        }
      });
  }

  isAuthor(review: RouteReview): boolean {
    return !!this.currentUser && review.userId === this.currentUser._id;
  }

  canEdit(review: RouteReview): boolean {
    return this.reviewService.canEditReview(review, this.currentUser?._id);
  }

  remainingEditHours(review: RouteReview): number {
    return this.reviewService.getRemainingEditHours(review);
  }

  startEdit(review: RouteReview): void {
    if (!this.canEdit(review)) {
      this.notificationService.show('notifications.reviewEditLocked', 'warning');
      return;
    }
    this.editingReviewId = review._id;
    this.editRating = review.rating;
    this.editComment = review.comment;
    this.reportingReviewId = null;
  }

  cancelEdit(): void {
    this.editingReviewId = null;
    this.editRating = 0;
    this.editComment = '';
  }

  saveEdit(review: RouteReview): void {
    if (!this.currentUser) {
      return;
    }
    if (this.editRating < 1 || this.editRating > 5) {
      this.notificationService.show('notifications.reviewSelectRating', 'warning');
      return;
    }
    if (this.editComment.trim().length < 20) {
      this.notificationService.show('notifications.reviewMinChars', 'warning');
      return;
    }

    this.reviewService
      .updateReview(review._id, {
        userId: this.currentUser._id,
        rating: this.editRating,
        comment: this.editComment.trim(),
        routeKey: this.summary.routeKey
      })
      .subscribe({
        next: (updatedSummary) => {
          this.summary = updatedSummary;
          this.cancelEdit();
          this.notificationService.show('notifications.reviewUpdated', 'success');
        },
        error: () => {
          this.notificationService.show('notifications.reviewEditLocked', 'error');
        }
      });
  }

  openReport(review: RouteReview): void {
    this.reportingReviewId = this.reportingReviewId === review._id ? null : review._id;
    this.selectedReportReason = 'spam';
    this.editingReviewId = null;
  }

  confirmReport(review: RouteReview): void {
    const reasonText = this.translationService.instant(
      `reviews.reportReasons.${this.selectedReportReason}`
    );
    this.reviewService
      .reportReview(review._id, {
        userId: this.currentUser?._id || 'anonymous',
        reason: reasonText,
        routeKey: this.summary.routeKey
      })
      .subscribe((updatedSummary) => {
        this.summary = updatedSummary;
        this.reportingReviewId = null;
        this.refreshEligibility();
        this.notificationService.show('notifications.reviewReported', 'info');
      });
  }
}
