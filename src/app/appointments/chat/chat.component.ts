import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { AppointmentsApiService } from '../services/appointments-api.service';
import { ChatWebsocketService } from '../services/chat-websocket.service';
import { AuthService } from '../../services/auth/auth.service';
import { ChatConversation, ChatMessage, VetUser } from '../models/appointments.models';

@Component({
  selector: 'app-chat',
  standalone: false,
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.css']
})
export class ChatComponent implements OnInit, OnDestroy {
  conversations: ChatConversation[] = [];
  messages: ChatMessage[] = [];
  vets: VetUser[] = [];
  selectedConversation: ChatConversation | null = null;
  draft = '';
  loadingConversations = true;
  loadingMessages = false;
  sending = false;
  error = '';
  currentUserId: number | null = null;
  isFarmer = false;
  private sub?: Subscription;

  constructor(
    private api: AppointmentsApiService,
    private ws: ChatWebsocketService,
    private auth: AuthService
  ) {}

  ngOnInit(): void {
    this.currentUserId = this.auth.getCurrentUserId();
    this.isFarmer = this.auth.getCurrentRole() === 'AGRICULTEUR';
    this.loadConversations();
    if (this.isFarmer) {
      this.api.getAllVets().subscribe({ next: vets => this.vets = vets });
    }
    this.ws.connect();
    this.sub = this.ws.messages$().subscribe(message => this.handleRealtimeMessage(message));

    const preselectedVetId = localStorage.getItem('chatVetId');
    if (preselectedVetId && this.isFarmer) {
      localStorage.removeItem('chatVetId');
      setTimeout(() => this.startConversation(+preselectedVetId), 300);
    }
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  loadConversations(selectId?: number): void {
    this.loadingConversations = true;
    this.api.getMyConversations().subscribe({
      next: convs => {
        this.conversations = convs;
        this.loadingConversations = false;
        if (selectId) {
          const found = convs.find(c => c.id === selectId);
          if (found) this.selectConversation(found);
        } else if (!this.selectedConversation && convs.length) {
          this.selectConversation(convs[0]);
        }
      },
      error: () => {
        this.loadingConversations = false;
        this.error = 'Impossible de charger les conversations';
      }
    });
  }

  startConversation(veterinarianId: number): void {
    if (!veterinarianId) return;
    this.api.createOrGetConversation(veterinarianId).subscribe({
      next: convo => {
        if (!this.conversations.some(c => c.id === convo.id)) {
          this.conversations.unshift(convo);
        }
        this.selectConversation(convo);
        this.loadConversations(convo.id);
      },
      error: e => this.error = e.error?.message || 'Impossible de démarrer la conversation'
    });
  }

  selectConversation(conversation: ChatConversation): void {
    this.selectedConversation = conversation;
    this.loadingMessages = true;
    this.api.getConversationMessages(conversation.id).subscribe({
      next: msgs => {
        this.messages = msgs;
        this.loadingMessages = false;
      },
      error: () => {
        this.loadingMessages = false;
        this.error = 'Impossible de charger les messages';
      }
    });
  }

  send(): void {
    const content = this.draft.trim();
    if (!content || !this.selectedConversation || this.sending) return;
    this.sending = true;
    this.api.sendConversationMessage(this.selectedConversation.id, content).subscribe({
      next: () => {
        this.draft = '';
        this.sending = false;
      },
      error: e => {
        this.sending = false;
        this.error = e.error?.message || 'Envoi impossible';
      }
    });
  }

  handleRealtimeMessage(message: ChatMessage): void {
    const convo = this.conversations.find(c => c.id === message.conversationId);
    if (convo) {
      convo.lastMessage = message.content;
      convo.lastMessageAt = message.sentAt;
      this.conversations = [convo, ...this.conversations.filter(c => c.id !== convo.id)];
    } else {
      this.loadConversations(message.conversationId);
    }
    if (this.selectedConversation?.id === message.conversationId && !this.messages.some(m => m.id === message.id)) {
      this.messages = [...this.messages, message];
    }
  }

  getConversationTitle(conversation: ChatConversation): string {
    const p = conversation.otherParticipant;
    return p ? `${p.prenom || ''} ${p.nom || ''}`.trim() : 'Conversation';
  }

  isMine(message: ChatMessage): boolean {
    return message.senderId === this.currentUserId;
  }

  trackByConversation(_: number, item: ChatConversation): number { return item.id; }
  trackByMessage(_: number, item: ChatMessage): number { return item.id; }
}
