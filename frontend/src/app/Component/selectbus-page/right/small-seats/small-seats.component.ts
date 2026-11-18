import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NotificationService } from '../../../../service/notification.service';

@Component({
  selector: 'app-small-seats',
  templateUrl: './small-seats.component.html',
  styleUrl: './small-seats.component.css'
})
export class SmallSeatsComponent {
  @Input() seatno: number = 0;
  @Input() alreadybookedseats: number[] = [];
  @Input() selectedseats: number[] = [];
  @Output() seatselected: EventEmitter<number> = new EventEmitter<number>();

  constructor(private notificationService: NotificationService) {}

  getcolor(seatno: number): string {
    if (this.selectedseats.includes(seatno)) {
      return 'var(--seat-selected)';
    } else if (this.alreadybookedseats.includes(seatno)) {
      return 'var(--seat-booked)';
    } else {
      return 'var(--seat-available)';
    }
  }

  onclick(): void {
    this.seatselected.emit(this.seatno);
  }

  handleselectedseats(seatno: number): void {
    console.log(this.alreadybookedseats);
    console.log('selected seat:', seatno);
  }

  handleseatbooking(seatno: number): void {
    if (!this.alreadybookedseats.includes(this.seatno)) {
      if (this.selectedseats.includes(this.seatno)) {
        const seatindex = this.selectedseats.indexOf(seatno);
        this.selectedseats.splice(seatindex, 1);
      } else {
        this.selectedseats.push(this.seatno);
      }
    } else {
      this.notificationService.show('notifications.seatAlreadyBooked', 'warning', { seat: seatno });
    }
  }
}
