import { Component } from '@angular/core';
import { ThemeService } from './service/theme.service';
import { TranslationService } from './service/translation.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'frontend';

  // Inject services at root level so theme and language initialize immediately on any route
  constructor(
    public themeService: ThemeService,
    public translationService: TranslationService
  ) {}
}
