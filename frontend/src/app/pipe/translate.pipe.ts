import { Pipe, PipeTransform } from '@angular/core';
import { TranslationService } from '../service/translation.service';

@Pipe({
  name: 'translate',
  pure: false
})
export class TranslatePipe implements PipeTransform {
  private lastKey = '';
  private lastLang = '';
  private lastVersion = -1;
  private lastParamsKey = '';
  private lastValue = '';

  constructor(private translationService: TranslationService) {}

  transform(key: string, params?: Record<string, string | number>): string {
    if (!key) {
      return '';
    }

    const currentLang = this.translationService.currentLang;
    const currentVersion = this.translationService.version;
    const paramsKey = params ? JSON.stringify(params) : '';

    if (
      key === this.lastKey &&
      currentLang === this.lastLang &&
      currentVersion === this.lastVersion &&
      paramsKey === this.lastParamsKey
    ) {
      return this.lastValue;
    }

    this.lastKey = key;
    this.lastLang = currentLang;
    this.lastVersion = currentVersion;
    this.lastParamsKey = paramsKey;
    this.lastValue = this.translationService.instant(key, params);

    return this.lastValue;
  }
}
