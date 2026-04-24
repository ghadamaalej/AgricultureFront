import { Component, OnInit, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { EventService } from '../../services/event/event.service';
import { AuthService } from 'src/app/services/auth/auth.service';
import { AiEventService } from 'src/app/services/aiEvent/aiEvent.service';


interface ChatMessage {
  role: 'user' | 'ai';
  text: string;
}

@Component({
  selector: 'app-organisateur-event-list',
  templateUrl: './organisateur-event-list.component.html',
  styleUrls: ['./organisateur-event-list.component.css']
})

export class OrganisateurEventListComponent implements OnInit , AfterViewChecked {

  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;

  organisateurId!: number;
  events: any[] = [];

  showSuccess = false;
  message = '';

showDelayModal = false;
delayEventId: number | null = null;

delayForm = {
  reason: '',
  newDateDebut: '',
  newDateFin: '',
  autorisationMunicipale: ''
};

showCancelConfirm = false;
cancelEventId: number | null = null;

  constructor(
    private AiEventService: AiEventService,
    private eventService: EventService,
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    const id = this.authService.getCurrentUserId();
    if (!id) {
      this.router.navigate(['/auth']);
      return;
    }
    this.organisateurId = id;

     this.route.queryParams.subscribe(params => {
    if (params['success']) {
      this.triggerSuccess(params['success']);
    }
  });
  
    this.loadEvents();
  }

  loadEvents(): void {
    this.eventService
      .getEventsByOrganisateur(this.organisateurId)
      .subscribe({
        next: data => (this.events = data),
        error: err => console.error('Error loading events', err)
      });
  }

  goToAdd(): void {
    this.router.navigate(['events/organizer/events/add']);
  }

  goToEdit(ev: any): void {
    this.router.navigate(['events/organizer/events/edit', ev.id]);
  }

  onDelete(id: number): void {
    if (!confirm('Delete this event?')) return;

    this.eventService.deleteEvent(id).subscribe({
      next: () => {
        this.events = this.events.filter(e => e.id !== id);
        this.triggerSuccess('deleted'); 
      },
      error: err => console.error('Error deleting event', err)
    });
  }

  openCancelConfirm(id: number): void {
  this.cancelEventId = id;
  this.showCancelConfirm = true;
}

closeCancelConfirm(): void {
  this.showCancelConfirm = false;
  this.cancelEventId = null;
}

confirmCancel(): void {
  if (this.cancelEventId == null) return;

  this.eventService.cancelEvent(this.cancelEventId).subscribe({
    next: (res: any) => {
      const ev = this.events.find(e => e.id === this.cancelEventId);
      if (ev) ev.statut = 'CANCELLED';

      this.closeCancelConfirm();
      this.triggerSuccess('updated'); 
    },
    error: err => {
      console.error(err);
      this.closeCancelConfirm();
    }
  });
}

openDelayModal(id: number): void {
  this.delayEventId = id;
  this.delayForm = {
    reason: '',
    newDateDebut: '',
    newDateFin: '',
    autorisationMunicipale: ''
  };
  this.showDelayModal = true;
}

closeDelayModal(): void {
  this.showDelayModal = false;
  this.delayEventId = null;
}

 selectedFileName: string = '';

onFileSelected(event: any) {
  const file: File = event.target.files[0];
  if (file) {
    this.selectedFileName = file.name;

    this.delayForm.autorisationMunicipale = file.name;
  }
}

submitDelay() {
  if (!this.delayEventId) return;

  const payload = {
    reason: this.delayForm.reason,
    newDateDebut: this.delayForm.newDateDebut,
    newDateFin: this.delayForm.newDateFin,
    fileName: this.delayForm.autorisationMunicipale 
  };

  this.eventService.delayEvent(this.delayEventId, payload).subscribe({
    next: (res) => {
      console.log('Event postponed', res);
      const ev = this.events.find(e => e.id === this.delayEventId);
      if (ev) {
        ev.dateDebut = this.delayForm.newDateDebut;
        ev.dateFin = this.delayForm.newDateFin;
      }

      this.closeDelayModal();
      this.triggerSuccess('updated');
    },
    error: (err) => console.error(err)
  });
}

  private triggerSuccess(type: 'created' | 'updated' | 'deleted'): void {

    if (type === 'created') {
      this.message = 'Event created successfully!';
    } else if (type === 'updated') {
      this.message = 'Event updated successfully!';
    } else if (type === 'deleted') {
      this.message = 'Event deleted successfully!';
    }

    this.showSuccess = true;

    setTimeout(() => {
      this.showSuccess = false;
    }, 3000);
  }


  aiOpen = false;
  userInput = '';
  isLoading = false;
  messages: ChatMessage[] = [
    {
      role: 'ai',
      text: `Hello! I am your AI agricultural assistant 🌿<br><br>
             I can help you choose the <strong>location</strong>, the <strong>date</strong>, 
             estimate <strong>attendance</strong>, and analyze <strong>weather</strong> conditions 
             for your event. What would you like to plan?`
    }
  ];

  private readonly SYSTEM_PROMPT = `You are an assistant specialized ONLY in organizing agricultural events in Tunisia.

You help organizers to:
- Choose the best location based on the type of event (fair, market, exhibition, training, agricultural festival)
- Recommend optimal dates based on weather and Tunisian agricultural seasons
- Estimate capacity and potential number of participants
- Analyze weather risks (heat, rain, sirocco)
- Suggest regions based on local crops (olives→Sfax, dates→Tozeur, citrus→Nabeul, cereals→Béja)
- Propose estimated budgets and logistical advice

STRICT RULES:
1. Answer ONLY questions related to agricultural events and their organization.
2. If the question is not related to agriculture or event organization, respond:
"I am specialized only in agricultural event organization. I cannot answer this question."
3. Always respond in English.
4. Be concise, practical, and give concrete and direct recommendations with Tunisian examples (not too much explanations)..
5. No bullet points , no lists . 
6. Give only the necessary information.
7. Maximum 10 sentences.
8. Use agricultural emojis to make your responses more readable.`;


  toggleAI(): void {
    this.aiOpen = !this.aiOpen;
  }

  quickAsk(question: string): void {
    this.userInput = question;
    this.sendMessage();
  }

  sendMessage(): void {
  const q = this.userInput.trim();
  if (!q || this.isLoading) return;

  this.messages.push({ role: 'user', text: q });
  this.userInput = '';
  this.isLoading = true;

  const history = this.messages
    .filter(m => m.role === 'user' || (m.role === 'ai' && m !== this.messages[0]))
    .map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.text.replace(/<[^>]*>/g, '')
    }));

  this.AiEventService.chat(history).subscribe({
  next: (res) => {

    if (!res || !res.reply) {
      throw new Error('Empty response');
    }

    const formatted = res.reply
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');

    this.messages.push({ role: 'ai', text: formatted });
  },

  error: (err) => {
    console.error(err);

    this.messages.push({
      role: 'ai',
      text: '⚠️ AI service error. Please try again.'
    });
  },

  complete: () => {
    this.isLoading = false;
  }
});
}

  ngAfterViewChecked(): void {
    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    try {
      this.messagesContainer.nativeElement.scrollTop =
        this.messagesContainer.nativeElement.scrollHeight;
    } catch {}
  }
}