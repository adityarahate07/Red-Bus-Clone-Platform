import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject } from 'rxjs';
import enFallback from '../../assets/i18n/en.json';
import { CustomerService } from './customer.service';

export type LanguageCode = 'en' | 'hi' | 'mr';

export interface LanguageOption {
  code: LanguageCode;
  label: string;
  nativeLabel: string;
  shortLabel: string;
}

const LANG_STORAGE_KEY = 'tedbus_language';
const USER_PREFS_PREFIX = 'tedbus_user_prefs_';
const DEFAULT_LANGUAGE: LanguageCode = 'en';

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'English', nativeLabel: 'English', shortLabel: 'EN' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी', shortLabel: 'हिं' },
  { code: 'mr', label: 'Marathi', nativeLabel: 'मराठी', shortLabel: 'मरा' }
];

@Injectable({
  providedIn: 'root'
})
export class TranslationService {
  readonly languages: LanguageOption[] = SUPPORTED_LANGUAGES;

  private readonly fallbackTranslations: Record<string, any> = enFallback as Record<string, any>;
  private readonly cache: Partial<Record<LanguageCode, Record<string, any>>> = {
    en: enFallback as Record<string, any>
  };

  private readonly langSubject = new BehaviorSubject<LanguageCode>(DEFAULT_LANGUAGE);
  readonly currentLang$ = this.langSubject.asObservable();

  private readonly versionSubject = new BehaviorSubject<number>(0);
  readonly version$ = this.versionSubject.asObservable();

  constructor(private http: HttpClient, private customerService: CustomerService) {
    this.initLanguage();
  }

  get currentLang(): LanguageCode {
    return this.langSubject.value;
  }

  get version(): number {
    return this.versionSubject.value;
  }

  get currentLanguageOption(): LanguageOption {
    return (
      this.languages.find((l) => l.code === this.currentLang) || this.languages[0]
    );
  }

  private initLanguage(): void {
    const saved = this.readSavedLanguage();
    this.applyDocumentLang(saved);
    this.langSubject.next(saved);
    // Load English JSON from assets as well (keeps runtime file in sync), and load active language
    this.loadLanguageFile('en');
    if (saved !== 'en') {
      this.loadLanguageFile(saved);
    }
  }

  setLanguage(lang: string, syncBackend = true): void {
    const validLang = this.normalizeLanguage(lang);
    this.applyDocumentLang(validLang);
    this.langSubject.next(validLang);
    this.persistLanguage(validLang, syncBackend);

    if (this.cache[validLang]) {
      this.bumpVersion();
    } else {
      this.loadLanguageFile(validLang);
    }
  }

  syncFromUserProfile(user: any): void {
    if (!user) {
      return;
    }
    const email = user.email as string | undefined;
    const profileLang = user.preferredLanguage as string | undefined;
    const localUserPrefs = email ? this.readUserLocalPrefs(email) : null;

    if (profileLang && this.isValidLanguage(profileLang)) {
      this.setLanguage(profileLang, false);
    } else if (localUserPrefs?.language && this.isValidLanguage(localUserPrefs.language)) {
      this.setLanguage(localUserPrefs.language, false);
    } else {
      this.persistLanguage(this.currentLang, true);
    }
  }

  instant(key: string, params?: Record<string, string | number>): string {
    if (!key) {
      return '';
    }
    const activeDict = this.cache[this.currentLang];
    let value = this.resolveNestedKey(activeDict, key);

    // Fallback to English for any missing key
    if (value === undefined || value === null || value === '') {
      value = this.resolveNestedKey(this.cache['en'] || this.fallbackTranslations, key);
    }

    if (value === undefined || value === null) {
      return key;
    }

    let result = String(value);
    if (params) {
      Object.keys(params).forEach((paramKey) => {
        const paramValue = params[paramKey];
        result = result.replace(
          new RegExp(`{{\\s*${paramKey}\\s*}}`, 'g'),
          String(paramValue ?? '')
        );
      });
    }
    return result;
  }

  translateCity(cityName: string | undefined | null): string {
    if (!cityName) {
      return '';
    }
    const key = `cities.${cityName}`;
    const translated = this.instant(key);
    return translated === key ? cityName : translated;
  }

  translateBusType(busType: string | undefined | null): string {
    if (!busType) {
      return '';
    }
    const clean = busType.replace(/;$/, '').trim();
    const key = `busTypes.${clean}`;
    const translated = this.instant(key);
    return translated === key ? clean : translated;
  }

  private loadLanguageFile(lang: LanguageCode): void {
    this.http.get<Record<string, any>>(`assets/i18n/${lang}.json`).subscribe({
      next: (data) => {
        if (data && typeof data === 'object') {
          this.cache[lang] = data;
          this.bumpVersion();
        }
      },
      error: () => {
        // Fallback gracefully to English if JSON file fails to load
        if (!this.cache[lang]) {
          this.cache[lang] = this.fallbackTranslations;
        }
        this.bumpVersion();
      }
    });
  }

  private bumpVersion(): void {
    this.versionSubject.next(this.versionSubject.value + 1);
  }

  private resolveNestedKey(obj: Record<string, any> | undefined, key: string): any {
    if (!obj) {
      return undefined;
    }
    const parts = key.split('.');
    let current: any = obj;
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return undefined;
      }
    }
    return typeof current === 'string' || typeof current === 'number' ? current : undefined;
  }

  private isValidLanguage(value: unknown): value is LanguageCode {
    return value === 'en' || value === 'hi' || value === 'mr';
  }

  private normalizeLanguage(value: unknown): LanguageCode {
    return this.isValidLanguage(value) ? value : DEFAULT_LANGUAGE;
  }

  private readSavedLanguage(): LanguageCode {
    try {
      const loggedInRaw = sessionStorage.getItem('Loggedinuser');
      if (loggedInRaw) {
        const user = JSON.parse(loggedInRaw);
        if (this.isValidLanguage(user?.preferredLanguage)) {
          return user.preferredLanguage;
        }
        if (user?.email) {
          const prefs = this.readUserLocalPrefs(user.email);
          if (this.isValidLanguage(prefs?.language)) {
            return prefs.language;
          }
        }
      }
    } catch {
      // Fallback gracefully
    }

    try {
      const stored = localStorage.getItem(LANG_STORAGE_KEY);
      if (this.isValidLanguage(stored)) {
        return stored;
      }
    } catch {
      // Fallback gracefully
    }

    return DEFAULT_LANGUAGE;
  }

  private readUserLocalPrefs(email: string): { theme?: string; language?: string } | null {
    try {
      const raw = localStorage.getItem(`${USER_PREFS_PREFIX}${email}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private persistLanguage(lang: LanguageCode, syncBackend: boolean): void {
    try {
      localStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch {
      // Ignore storage errors
    }

    try {
      const loggedInRaw = sessionStorage.getItem('Loggedinuser');
      if (loggedInRaw) {
        const user = JSON.parse(loggedInRaw);
        user.preferredLanguage = lang;
        sessionStorage.setItem('Loggedinuser', JSON.stringify(user));

        if (user.email) {
          const existing = this.readUserLocalPrefs(user.email) || {};
          localStorage.setItem(
            `${USER_PREFS_PREFIX}${user.email}`,
            JSON.stringify({ ...existing, language: lang })
          );
          if (syncBackend && user._id) {
            this.customerService
              .updatePreferences(user._id, { preferredLanguage: lang })
              .subscribe({
                error: () => {
                  // Silently ignore when backend is unavailable on static hosting
                }
              });
          }
        }
      }
    } catch {
      // Graceful fallback
    }
  }

  private applyDocumentLang(lang: LanguageCode): void {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
    }
  }
}
