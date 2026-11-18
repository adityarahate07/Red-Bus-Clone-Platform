import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { DialogComponent } from './dialog/dialog.component';
import { NotificationService } from '../../service/notification.service';
import { TranslationService } from '../../service/translation.service';

@Component({
  selector: 'app-landing-page',
  templateUrl: './landing-page.component.html',
  styleUrl: './landing-page.component.css'
})
export class LandingPageComponent {
  fromoption: string = '';
  tooption: string = '';
  date: string = '';
  activeFaqTab: string = 'general';

  readonly fromCities: string[] = ['Delhi', 'Mumbai', 'Bangalore', 'Kolkata', 'Chennai'];
  readonly toCities: string[] = ['Jaipur', 'Goa', 'Mysore', 'Darjeeling', 'Pondicherry'];

  constructor(
    private router: Router,
    public dialog: MatDialog,
    private notificationService: NotificationService,
    public translationService: TranslationService
  ) {}

  fromEvent(option: string): void {
    this.fromoption = option;
  }

  toEvent(option: string): void {
    this.tooption = option;
  }

  swapCities(): void {
    const temp = this.fromoption;
    this.fromoption = this.tooption;
    this.tooption = temp;
  }

  getDisplayCity(city: string): string {
    return city ? this.translationService.translateCity(city) : '';
  }

  copyOfferCode(code: string): void {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(code).catch(() => {});
    }
    this.notificationService.show('notifications.offerCopied', 'success', { code }, 2500);
  }

  setFaqTab(tab: string, event: Event): void {
    event.preventDefault();
    this.activeFaqTab = tab;
  }

  matchDate(event: any): void {
    if (event.value) {
      const date = new Date(event.value);
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear().toString();
      this.date = `${year}-${month}-${day}`;
    } else {
      this.date = '';
    }
  }

  submit(): void {
    if (this.fromoption && this.tooption && this.date) {
      if (
        (this.fromoption === 'Delhi' && this.tooption === 'Jaipur') ||
        (this.fromoption === 'Mumbai' && this.tooption === 'Goa') ||
        (this.fromoption === 'Bangalore' && this.tooption === 'Mysore') ||
        (this.fromoption === 'Kolkata' && this.tooption === 'Darjeeling') ||
        (this.fromoption === 'Chennai' && this.tooption === 'Pondicherry')
      ) {
        this.router.navigate(['/select-bus'], {
          queryParams: {
            departure: this.fromoption,
            arrival: this.tooption,
            date: this.date
          }
        });
      } else {
        const dialogRef = this.dialog.open(DialogComponent);
        dialogRef.afterClosed().subscribe((result) => {
          console.log(`Dialog result: ${result}`);
        });
      }
    } else {
      this.notificationService.show('notifications.fillDetails', 'warning');
    }
  }
}
