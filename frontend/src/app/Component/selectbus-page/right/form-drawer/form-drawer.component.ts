import { Component, Input } from '@angular/core';
import { MatDrawer } from '@angular/material/sidenav';
import { NotificationService } from '../../../../service/notification.service';

@Component({
  selector: 'app-form-drawer',
  templateUrl: './form-drawer.component.html',
  styleUrl: './form-drawer.component.css'
})
export class FormDrawerComponent {
  @Input() selectedseat: number[] = [];
  @Input() seatprice: number = 0;
  @Input() routedetails: any;
  @Input() busid: string = '';
  @Input() busarrivaltime: number = 0;
  @Input() busdeparturetime: number = 0;
  @Input() operatorname: string = '';
  formdrawerstate: boolean = false;
  sidenavopened = false;

  constructor(private notificationService: NotificationService) {}

  toogledrawer(open: boolean): void {
    this.formdrawerstate = open;
  }

  openBookingDrawer(drawer: MatDrawer): void {
    if (!this.selectedseat || this.selectedseat.length === 0) {
      this.notificationService.show('notifications.selectSeatFirst', 'warning');
      return;
    }
    drawer.toggle();
  }
}
