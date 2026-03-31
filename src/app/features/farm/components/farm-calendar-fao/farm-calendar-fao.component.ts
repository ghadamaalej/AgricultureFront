import { Component } from '@angular/core';
import { AgriCalendarService } from '../../services/agri-calendar.service';
import { CropWindow } from '../../models/calendar.model';

@Component({
  selector: 'app-farm-calendar-fao',
  standalone: false,
  templateUrl: './farm-calendar-fao.component.html',
  styleUrls: ['./farm-calendar-fao.component.css']
})
export class FarmCalendarFaoComponent {
  selectedCrop = '';
  cropWindows: CropWindow[] = [];
  faoLoading = false;

  constructor(private agriCalendarService: AgriCalendarService) {}

  loadCropWindows(): void {
    this.faoLoading = true;
    this.agriCalendarService.getCropWindows(this.selectedCrop.trim()).subscribe({
      next: (windows) => {
        this.cropWindows = windows;
        this.faoLoading = false;
      },
      error: (err) => {
        console.error(err);
        this.cropWindows = [];
        this.faoLoading = false;
      }
    });
  }
}
