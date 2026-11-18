export interface RouteReview {
  _id: string;
  routeKey: string;
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
  isHidden?: boolean;
  reportCount?: number;
  reportedBy?: string[];
  reportReasons?: string[];
  editedAt?: string | null;
  createdAt: string;
}

export interface RouteReviewSummary {
  routeKey: string;
  averageRating: number;
  totalReviews: number;
  ratingBreakdown: { [star: number]: number };
  reviews: RouteReview[];
}

export interface CompletedJourneyOption {
  bookingId: string;
  journeyDate: string;
  operatorName: string;
  departureCity: string;
  arrivalCity: string;
  busId?: string;
  alreadyReviewed: boolean;
}
