import { AfterViewInit, Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { CustomerService } from '../../service/customer.service';
import { ThemeService } from '../../service/theme.service';
import { LanguageCode, LanguageOption, TranslationService } from '../../service/translation.service';
import { NotificationService } from '../../service/notification.service';
import { UserSessionService } from '../../service/user-session.service';
import { NotificationCenterService } from '../../service/notification-center.service';

declare var google: any;

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css'
})
export class NavbarComponent implements OnInit, AfterViewInit, OnDestroy {
  isloggedIn = false;
  unreadNotifications = 0;
  private subs: Subscription[] = [];

  constructor(
    private router: Router,
    private customerservice: CustomerService,
    public themeService: ThemeService,
    public translationService: TranslationService,
    private notificationService: NotificationService,
    private userSession: UserSessionService,
    private notifCenter: NotificationCenterService
  ) {}

  get languages(): LanguageOption[] {
    return this.translationService.languages;
  }

  get currentLang(): LanguageCode {
    return this.translationService.currentLang;
  }

  get currentLanguageOption(): LanguageOption {
    return this.translationService.currentLanguageOption;
  }

  get isDarkMode(): boolean {
    return this.themeService.isDarkMode;
  }

  ngOnInit(): void {
    this.subs.push(
      this.userSession.currentUser$.subscribe((user) => {
        this.isloggedIn = !!user;
      }),
      this.notifCenter.unreadCount$.subscribe((count) => {
        this.unreadNotifications = count;
      })
    );

    if (typeof google !== 'undefined' && google?.accounts?.id) {
      google.accounts.id.initialize({
        client_id: '129421237209-jricn8ed4fgld4glk6k716deq5ebsmpb.apps.googleusercontent.com',
        callback: (response: any) => {
          this.handlelogin(response);
        }
      });
    }
  }

  ngAfterViewInit(): void {
    this.rendergooglebutton();
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
  }

  private rendergooglebutton(): void {
    if (typeof google === 'undefined' || !google?.accounts?.id) {
      return;
    }
    const googlebtn = document.getElementById('google-btn');
    if (googlebtn) {
      google.accounts.id.renderButton(googlebtn, {
        theme: this.isDarkMode ? 'filled_black' : 'outline',
        size: 'medium',
        shape: 'pill',
        width: 150
      });
    }
  }

  toggleTheme(): void {
    const nextTheme = this.themeService.toggleTheme();
    const themeLabel = this.translationService.instant(
      nextTheme === 'dark' ? 'navbar.darkMode' : 'navbar.lightMode'
    );
    this.notificationService.show('notifications.themeSwitched', 'info', { theme: themeLabel }, 2200);
  }

  selectLanguage(lang: LanguageCode): void {
    if (lang === this.currentLang) {
      return;
    }
    this.translationService.setLanguage(lang);
    const option = this.languages.find((l) => l.code === lang);
    this.notificationService.show(
      'notifications.languageSwitched',
      'info',
      { language: option?.nativeLabel || lang },
      2200
    );
  }

  showHelp(): void {
    this.notificationService.show('notifications.helpInfo', 'info', undefined, 4500);
  }

  demoSignIn(): void {
    const user = this.userSession.loginAsDemoTraveler();
    this.notificationService.show('notifications.demoSignedIn', 'success', { name: user.name });
  }

  private decodetoken(token: string): any {
    return JSON.parse(atob(token.split('.')[1]));
  }

  handlelogin(response: any): void {
    const payload = this.decodetoken(response.credential);
    this.customerservice.addcustomermongo(payload).subscribe({
      next: (res) => {
        this.userSession.setUser(res);
        this.notificationService.show('notifications.loginSuccess', 'success');
      },
      error: (error) => {
        console.error('Post request failed', error);
        // Graceful fallback if backend is offline on Vercel/Netlify
        this.userSession.setUser({
          _id: payload.sub || payload.email,
          name: payload.name,
          email: payload.email,
          profilepicture: payload.picture
        });
        this.notificationService.show('notifications.loginSuccess', 'success');
      }
    });
  }

  handlelogout(): void {
    if (typeof google !== 'undefined' && google?.accounts?.id) {
      google.accounts.id.disableAutoSelect();
    }
    this.userSession.clearUser();
    window.location.reload();
  }

  navigate(route: string): void {
    this.router.navigate([route]);
  }
}
