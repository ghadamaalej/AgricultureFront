import { Component } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { AppointmentsApiService } from '../../services/appointments-api.service';
import { ImageChatbotResponse } from '../../models/appointments.models';

@Component({
  selector: 'app-farmer-poultry-chatbot',
  templateUrl: './farmer-poultry-chatbot.component.html',
  styleUrls: ['./farmer-poultry-chatbot.component.css']
})
export class FarmerPoultryChatbotComponent {
  selectedFile: File | null = null;
  question = '';
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
      this.error = 'Veuillez selectionner une image de volaille.';
      return;
    }

    this.loading = true;
    this.appointmentsApi.analyzePoultryChatbotImage(this.selectedFile, this.question, 'farmer')
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: response => this.result = response,
        error: err => {
          this.error = err?.error?.message || 'Impossible d analyser l image poultry pour le moment.';
        }
      });
  }
}
