import { Component } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { DiagnosticAssistantChatRequest } from '../../models/appointments.models';
import { AppointmentsApiService } from '../../services/appointments-api.service';

interface AiChatMessage {
  role: 'farmer' | 'ai';
  content: string;
}

@Component({
  selector: 'app-vet-ai-chatbot',
  templateUrl: './vet-ai-chatbot.component.html',
  styleUrls: ['./vet-ai-chatbot.component.css']
})
export class VetAiChatbotComponent {
  chatting = false;
  chatError = '';
  chatMessages: AiChatMessage[] = [
    {
      role: 'ai',
      content: 'Bonjour. Je suis votre chatbot veterinaire intelligent. Vous pouvez me decrire librement le cas de votre animal ici.'
    }
  ];

  readonly chatForm = this.fb.group({
    question: ['', Validators.required],
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly appointmentsApi: AppointmentsApiService
  ) {}

  sendChat(): void {
    const question = this.chatForm.getRawValue().question?.trim() || '';
    this.chatError = '';

    if (!question || this.chatting) {
      return;
    }

    if (this.chatForm.invalid) {
      this.chatForm.markAllAsTouched();
      this.chatError = 'Saisissez votre question pour discuter avec le chatbot.';
      return;
    }

    this.chatMessages = [...this.chatMessages, { role: 'farmer', content: question }];
    const payload = this.buildChatPayload();
    this.chatForm.patchValue({ question: '' });
    this.chatting = true;

    this.appointmentsApi.chatWithIndependentAssistant(payload)
      .pipe(finalize(() => this.chatting = false))
      .subscribe({
        next: response => {
          this.chatMessages = [
            ...this.chatMessages,
            {
              role: 'ai',
              content: response.answer || 'Je n ai pas pu generer de reponse pour le moment.'
            }
          ];
        },
        error: err => {
          this.chatError = err?.error?.message || 'La conversation IA a echoue.';
          this.chatMessages = [
            ...this.chatMessages,
            {
              role: 'ai',
              content: 'Je n ai pas pu repondre pour le moment. Verifiez le service IA puis reessayez.'
            }
          ];
        }
      });
  }

  hasChatError(controlName: string): boolean {
    const control = this.chatForm.get(controlName);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  private buildChatPayload(): DiagnosticAssistantChatRequest {
    const value = this.chatForm.getRawValue();
    return {
      question: value.question?.trim() || '',
    };
  }
}