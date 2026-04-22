import { Component } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { AppointmentsApiService } from '../../services/appointments-api.service';
import { ImageChatbotResponse } from '../../models/appointments.models';

@Component({
  selector: 'app-vet-poultry-chatbot',
  templateUrl: './vet-poultry-chatbot.component.html',
  styleUrls: ['./vet-poultry-chatbot.component.css']
})
export class VetPoultryChatbotComponent {
  selectedFile: File | null = null;
  clinicalQuestion = '';
  loading = false;
  error = '';
  result: ImageChatbotResponse | null = null;

  constructor(private readonly appointmentsApi: AppointmentsApiService) {}

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFile = input.files && input.files.length ? input.files[0] : null;
  }

  analyze(): void {
    this.error = '';
    this.result = null;

    if (!this.selectedFile) {
      this.error = 'Veuillez selectionner une image aviaire clinique.';
      return;
    }

    this.loading = true;
    this.appointmentsApi.analyzePoultryChatbotImage(this.selectedFile, this.clinicalQuestion, 'vet')
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: response => this.result = response,
        error: err => {
          this.error = err?.error?.message || 'Le chatbot clinique poultry ne repond pas pour le moment.';
        }
      });
  }
}
