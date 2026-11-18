import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { BusService } from '../../service/bus.service';
import { ThemeMode, ThemeService } from '../../service/theme.service';
import { LanguageCode, LanguageOption, TranslationService } from '../../service/translation.service';
import { NotificationService } from '../../service/notification.service';
import { SessionUser, UserSessionService } from '../../service/user-session.service';
import { CommunityService } from '../../service/community.service';
import { ReviewService } from '../../service/review.service';
import { UserCommunityActivity } from '../../model/community.model';
import { RouteReview } from '../../model/review.model';

@Component({
  selector: 'app-profile-page',
  templateUrl: './profile-page.component.html',
  styleUrl: './profile-page.component.css'
})
export class ProfilePageComponent implements OnInit, OnDestroy {
  selecteditem: string = 'trips';
  currentcustomer: SessionUser | null = null;
  currentname: string = '';
  currentemail: string = '';
  mytrip: any[] = [];

  userActivity: UserCommunityActivity = {
    posts: [],
    commentsCount: 0,
    likesReceived: 0
  };
  userReviews: RouteReview[] = [];

  private userSub?: Subscription;

  constructor(
    private router: Router,
    private busbooking: BusService,
    public themeService: ThemeService,
    public translationService: TranslationService,
    private notificationService: NotificationService,
    private userSession: UserSessionService,
    private communityService: CommunityService,
    private reviewService: ReviewService
  ) {}

  get languages(): LanguageOption[] {
    return this.translationService.languages;
  }

  handlelistitemclick(selected: string): void {
    this.selecteditem = selected;
    if (selected === 'activity' && this.currentcustomer) {
      this.loadUserActivity(this.currentcustomer._id);
    }
  }

  onThemeChange(theme: ThemeMode): void {
    this.themeService.setTheme(theme);
    const themeLabel = this.translationService.instant(
      theme === 'dark' ? 'navbar.darkMode' : 'navbar.lightMode'
    );
    this.notificationService.show('notifications.themeSwitched', 'info', { theme: themeLabel }, 2200);
  }

  onLanguageChange(lang: LanguageCode): void {
    this.translationService.setLanguage(lang);
    const option = this.languages.find((l) => l.code === lang);
    this.notificationService.show(
      'notifications.languageSwitched',
      'info',
      { language: option?.nativeLabel || lang },
      2200
    );
  }

  signInDemo(): void {
    const user = this.userSession.loginAsDemoTraveler();
    this.notificationService.show('notifications.demoSignedIn', 'success', { name: user.name });
  }

  goToCommunity(): void {
    this.router.navigate(['/community']);
  }

  onTripStatusUpdated(): void {
    if (this.currentcustomer) {
      this.loadTrips(this.currentcustomer._id);
    }
  }

  ngOnInit(): void {
    this.userSub = this.userSession.currentUser$.subscribe((user) => {
      this.currentcustomer = user;
      this.currentname = user?.name || '';
      this.currentemail = user?.email || '';
      if (user?._id) {
        this.loadTrips(user._id);
        this.loadUserActivity(user._id);
      } else {
        this.mytrip = [];
        this.userActivity = { posts: [], commentsCount: 0, likesReceived: 0 };
        this.userReviews = [];
      }
    });
  }

  ngOnDestroy(): void {
    this.userSub?.unsubscribe();
  }

  private loadTrips(userId: string): void {
    this.busbooking.getbusmongo(userId).subscribe({
      next: (response: any) => {
        this.mytrip = response || [];
      },
      error: () => {
        this.mytrip = [];
      }
    });
  }

  private loadUserActivity(userId: string): void {
    this.userActivity = this.communityService.getUserActivity(userId);
    this.reviewService.getUserReviews(userId).subscribe((reviews) => {
      this.userReviews = reviews || [];
    });
  }
}
