import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DataserviceService } from '../../service/dataservice.service';
import { HttpClient } from '@angular/common/http';
import { BusService } from '../../service/bus.service';
import { NotificationService } from '../../service/notification.service';
import { TranslationService } from '../../service/translation.service';
import { NotificationCenterService } from '../../service/notification-center.service';

@Component({
  selector: 'app-payment-page',
  templateUrl: './payment-page.component.html',
  styleUrl: './payment-page.component.css'
})
export class PaymentPageComponent implements OnInit {
  passseatarray: any[] = [];
  passfare: number = 0;
  routedetails: any = {};
  busdepauturetime: number = 0;
  busarrivaltime: number = 0;
  customerid: any = {};
  operatorname: string = '';
  passengerdetails: any = [];
  email: string = '';
  fare: number = 0;
  busid: string = '';
  phonenumber: string = '';
  departuredetails: any = {};
  arrivaldetails: any = {};
  duration: string = '';
  isbuisnesstravel: boolean = false;
  isinsurance: boolean = false;
  iscoviddonated: boolean = false;
  bookingdate: string = new Date().toISOString().split('T')[0];

  constructor(
    private route: ActivatedRoute,
    private dataservice: DataserviceService,
    private http: HttpClient,
    private busservice: BusService,
    private notificationService: NotificationService,
    public translationService: TranslationService,
    private notifCenter: NotificationCenterService
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe((params) => {
      this.operatorname = params['operatorname'];
      this.passseatarray = params['selectedseat'];
      this.email = params['passemail'];
      this.phonenumber = params['passphn'];
      this.isbuisnesstravel = params['passisbuisness'];
      this.isinsurance = params['passinsurance'];
      this.passfare = params['seatprice'];
      this.busid = params['busid'];
      this.busarrivaltime = params['busarrivaltime'];
      this.busdepauturetime = params['busdeparturetime'];
      this.iscoviddonated = params['passiscoviddonate'];
      this.getloggedinuser();
    });

    this.dataservice.currentdata.subscribe((data) => {
      this.routedetails = data || {};
    });
    this.dataservice.passdata.subscribe((data) => {
      this.passengerdetails = data || [];
    });
  }

  getloggedinuser(): any {
    const loggedinuserjson = sessionStorage.getItem('Loggedinuser');
    if (loggedinuserjson) {
      this.customerid = JSON.parse(loggedinuserjson);
    } else {
      this.notificationService.show('notifications.pleaseLogin', 'warning');
    }
    return null;
  }

  makepayment(): void {
    if (!this.customerid?._id) {
      this.notificationService.show('notifications.pleaseLogin', 'warning');
      return;
    }

    const myBooking: any = {};
    myBooking.customerId = this.customerid._id;
    myBooking.passengerDetails = this.passengerdetails;
    myBooking.email = this.customerid.email;
    myBooking.phoneNumber = this.phonenumber;
    myBooking.fare = this.passfare;
    myBooking.status = 'upcoming';
    myBooking.busId = this.busid;
    myBooking.operatorName = this.operatorname;
    const date = new Date();
    myBooking.bookingDate = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
    myBooking.seats = this.passseatarray;
    myBooking.departureDetails = {
      city: this.routedetails?.departureLocation?.name,
      time: this.busdepauturetime,
      date: this.bookingdate
    };
    myBooking.arrivalDetails = {
      city: this.routedetails?.arrivalLocation?.name,
      time: this.busarrivaltime,
      date: this.bookingdate
    };
    myBooking.duration = this.routedetails?.duration;
    myBooking.isBusinessTravel = this.isbuisnesstravel;
    myBooking.isInsurance = this.isinsurance;
    myBooking.isCovidDonated = this.iscoviddonated;

    this.busservice.addbusmongo(myBooking).subscribe({
      next: (response) => {
        console.log('Bus post request success', response);
        this.notifCenter.dispatchEvent('booking_confirmation', {
          from: this.routedetails?.departureLocation?.name || 'Delhi',
          to: this.routedetails?.arrivalLocation?.name || 'Jaipur',
          date: this.bookingdate,
          operator: this.operatorname || 'Tedbus Express',
          fare: this.passfare
        });
      },
      error: (error) => {
        console.error('Post request failed', error);
        this.notificationService.show('notifications.bookingFailed', 'error');
      }
    });
  }
}
