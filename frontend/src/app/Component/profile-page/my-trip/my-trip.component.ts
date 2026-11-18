import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { Router } from '@angular/router';
import { TranslationService } from '../../../service/translation.service';
import { BusService } from '../../../service/bus.service';
import { NotificationService } from '../../../service/notification.service';
import { NotificationCenterService } from '../../../service/notification-center.service';

@Component({
  selector: 'app-my-trip',
  templateUrl: './my-trip.component.html',
  styleUrl: './my-trip.component.css'
})
export class MyTripComponent implements OnInit {
  @Input() booking: any;
  @Output() statusUpdated = new EventEmitter<void>();

  constructor(
    public translationService: TranslationService,
    private busService: BusService,
    private notificationService: NotificationService,
    private notifCenter: NotificationCenterService,
    private router: Router
  ) {}

  imageArr = [
    {
      _id: { $oid: '6049b8a97501a24470b9a526' },
      images: 'https://s3-ap-southeast-1.amazonaws.com/rb-plus/BI/APP/IND/WM/2323/1087/GW/DL/6fNUIf.jpeg'
    },
    {
      _id: { $oid: '6049b8a97501a24470b9a528' },
      images: 'https://s3-ap-southeast-1.amazonaws.com/rb-plus/BI/APP/IND/WM/9365/1087/GW/DL/hDsqel.jpeg'
    },
    {
      _id: { $oid: '6049b8a97501a24470b9a529' },
      images: 'https://s3-ap-southeast-1.amazonaws.com/rb-plus/BI/APP/IND/WM/10/411/ST/L/penRe7.jpeg'
    }
  ];

  randomimage: string = '';

  ngOnInit(): void {
    const randomindex = Math.floor(Math.random() * this.imageArr.length);
    this.randomimage = this.imageArr[randomindex].images;
  }

  isCancelled(trip: any): boolean {
    return trip?.status === 'cancelled';
  }

  isCompleted(trip: any): boolean {
    if (this.isCancelled(trip)) {
      return false;
    }
    if (trip?.status === 'completed') {
      return true;
    }
    const depDate = trip?.departureDetails?.date;
    return depDate ? new Date(depDate).getTime() < Date.now() : false;
  }

  markCompleted(trip: any): void {
    const id = trip._id || trip.id;
    this.busService.markBookingCompleted(id).subscribe(() => {
      trip.status = 'completed';
      this.statusUpdated.emit();
      this.notificationService.show('notifications.tripCompleted', 'success');
    });
  }

  cancelTrip(trip: any): void {
    const id = trip._id || trip.id;
    this.busService.cancelBooking(id).subscribe(() => {
      trip.status = 'cancelled';
      this.statusUpdated.emit();
      this.notifCenter.dispatchEvent('cancellation', {
        from: trip?.departureDetails?.city || 'Delhi',
        to: trip?.arrivalDetails?.city || 'Jaipur',
        date: trip?.departureDetails?.date || ''
      });
    });
  }

  goToReviewRoute(trip: any): void {
    this.router.navigate(['/select-bus'], {
      queryParams: {
        departure: trip?.departureDetails?.city,
        arrival: trip?.arrivalDetails?.city,
        date: trip?.departureDetails?.date || new Date().toISOString().split('T')[0]
      }
    });
  }
}
