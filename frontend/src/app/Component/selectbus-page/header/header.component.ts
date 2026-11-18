import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslationService } from '../../../service/translation.service';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrl: './header.component.css'
})
export class HeaderComponent implements OnInit {
  departure: string = '';
  arrival: string = '';
  date: string = '';

  constructor(
    private route: ActivatedRoute,
    public translationService: TranslationService
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      this.departure = params['departure'] || '';
      this.arrival = params['arrival'] || '';
      this.date = params['date'] || '';
    });
  }
}
