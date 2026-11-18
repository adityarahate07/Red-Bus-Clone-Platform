import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { CustomerService } from './customer.service';

export type ThemeMode = 'light' | 'dark';

const THEME_STORAGE_KEY = 'tedbus_theme';
const USER_PREFS_PREFIX = 'tedbus_user_prefs_';
const DEFAULT_THEME: ThemeMode = 'light';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly themeSubject = new BehaviorSubject<ThemeMode>(DEFAULT_THEME);
  readonly currentTheme$ = this.themeSubject.asObservable();

  constructor(private customerService: CustomerService) {
    this.initTheme();
  }

  get currentTheme(): ThemeMode {
    return this.themeSubject.value;
  }

  get isDarkMode(): boolean {
    return this.themeSubject.value === 'dark';
  }

  private initTheme(): void {
    const resolved = this.readSavedTheme();
    this.applyThemeToDom(resolved);
    this.themeSubject.next(resolved);
  }

  toggleTheme(): ThemeMode {
    const nextTheme: ThemeMode = this.currentTheme === 'dark' ? 'light' : 'dark';
    this.setTheme(nextTheme);
    return nextTheme;
  }

  setTheme(theme: string, syncBackend = true): void {
    const validTheme: ThemeMode = this.normalizeTheme(theme);
    this.applyThemeToDom(validTheme);
    this.themeSubject.next(validTheme);
    this.persistTheme(validTheme, syncBackend);
  }

  syncFromUserProfile(user: any): void {
    if (!user) {
      return;
    }
    const email = user.email as string | undefined;
    const profileTheme = user.preferredTheme as string | undefined;
    const localUserPrefs = email ? this.readUserLocalPrefs(email) : null;

    if (profileTheme && this.isValidTheme(profileTheme)) {
      this.setTheme(profileTheme, false);
    } else if (localUserPrefs?.theme && this.isValidTheme(localUserPrefs.theme)) {
      this.setTheme(localUserPrefs.theme, false);
    } else {
      // Save current browser theme to the newly signed-in user profile
      this.persistTheme(this.currentTheme, true);
    }
  }

  private isValidTheme(value: unknown): value is ThemeMode {
    return value === 'light' || value === 'dark';
  }

  private normalizeTheme(value: unknown): ThemeMode {
    return this.isValidTheme(value) ? value : DEFAULT_THEME;
  }

  private readSavedTheme(): ThemeMode {
    try {
      const loggedInRaw = sessionStorage.getItem('Loggedinuser');
      if (loggedInRaw) {
        const user = JSON.parse(loggedInRaw);
        if (this.isValidTheme(user?.preferredTheme)) {
          return user.preferredTheme;
        }
        if (user?.email) {
          const prefs = this.readUserLocalPrefs(user.email);
          if (this.isValidTheme(prefs?.theme)) {
            return prefs.theme;
          }
        }
      }
    } catch {
      // Fallback gracefully if sessionStorage is unavailable or malformed
    }

    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (this.isValidTheme(stored)) {
        return stored;
      }
    } catch {
      // Fallback gracefully if localStorage is unavailable
    }

    return DEFAULT_THEME;
  }

  private readUserLocalPrefs(email: string): { theme?: string; language?: string } | null {
    try {
      const raw = localStorage.getItem(`${USER_PREFS_PREFIX}${email}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private persistTheme(theme: ThemeMode, syncBackend: boolean): void {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore storage quota / privacy mode errors
    }

    try {
      const loggedInRaw = sessionStorage.getItem('Loggedinuser');
      if (loggedInRaw) {
        const user = JSON.parse(loggedInRaw);
        user.preferredTheme = theme;
        sessionStorage.setItem('Loggedinuser', JSON.stringify(user));

        if (user.email) {
          const existing = this.readUserLocalPrefs(user.email) || {};
          localStorage.setItem(
            `${USER_PREFS_PREFIX}${user.email}`,
            JSON.stringify({ ...existing, theme })
          );
          if (syncBackend && user._id) {
            this.customerService.updatePreferences(user._id, { preferredTheme: theme }).subscribe({
              error: () => {
                // Silently ignore backend errors when running frontend-only (e.g., Vercel/Netlify)
              }
            });
          }
        }
      }
    } catch {
      // Graceful fallback
    }
  }

  private applyThemeToDom(theme: ThemeMode): void {
    if (typeof document === 'undefined') {
      return;
    }
    const root = document.documentElement;
    const body = document.body;
    root.setAttribute('data-theme', theme);
    root.style.colorScheme = theme;

    if (theme === 'dark') {
      root.classList.add('dark-theme');
      body?.classList.add('dark-theme');
    } else {
      root.classList.remove('dark-theme');
      body?.classList.remove('dark-theme');
    }
  }
}
