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
  selectedFile: File | null = null;
  recording = false;
  recordingSupported = typeof navigator !== 'undefined' && !!navigator.mediaDevices && !!(window as any).MediaRecorder;

  private recorder: MediaRecorder | null = null;
  private recorderChunks: Blob[] = [];
  private stoppingRecording = false;
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
    this.stopMediaTracks();
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
      error: e => this.error = e.error?.message || 'Impossible de demarrer la conversation'
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
    if (!this.selectedConversation || this.sending || (!content && !this.selectedFile)) return;

    this.sending = true;
    const request$ = this.selectedFile
      ? this.api.sendConversationAttachment(this.selectedConversation.id, this.selectedFile, content)
      : this.api.sendConversationMessage(this.selectedConversation.id, content);

    request$.subscribe({
      next: sentMessage => {
        this.applyOutgoingMessage(sentMessage);
        this.draft = '';
        this.selectedFile = null;
        this.recorderChunks = [];
        this.stoppingRecording = false;
        this.recording = false;
        this.stopMediaTracks();
        this.sending = false;
      },
      error: e => {
        this.recorderChunks = [];
        this.stoppingRecording = false;
        this.recording = false;
        this.sending = false;
        this.error = e.error?.message || 'Envoi impossible';
      }
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files.length ? input.files[0] : null;
    this.selectedFile = file;
    if (input) input.value = '';
  }

  clearSelectedFile(): void {
    this.selectedFile = null;
  }

  toggleRecording(): void {
    if (!this.recordingSupported || this.sending) {
      this.error = 'Enregistrement vocal non supporte sur ce navigateur';
      return;
    }
    if (this.stoppingRecording) return;

    if (this.recording) {
      this.stopRecording();
      return;
    }

    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      this.recorderChunks = [];
      this.recorder = new MediaRecorder(stream);
      this.recorder.ondataavailable = (evt: BlobEvent) => {
        if (evt.data && evt.data.size > 0) this.recorderChunks.push(evt.data);
      };
      this.recorder.onstop = () => {
        const mimeType = this.recorder?.mimeType || 'audio/webm';
        const blob = new Blob(this.recorderChunks, { type: mimeType });
        if (!this.sending && blob.size > 0) {
          this.selectedFile = new File([blob], `message-vocal-${Date.now()}.webm`, { type: mimeType });
        }
        this.recorderChunks = [];
        this.stoppingRecording = false;
        this.recording = false;
        this.stopMediaTracks();
      };
      this.recorder.start();
      this.stoppingRecording = false;
      this.recording = true;
      this.error = '';
    }).catch(() => {
      this.error = "Impossible d'acceder au microphone";
      this.stoppingRecording = false;
      this.recording = false;
    });
  }

  stopRecording(): void {
    if (!this.recorder || this.recorder.state === 'inactive') {
      this.stoppingRecording = false;
      this.recording = false;
      return;
    }

    this.stoppingRecording = true;
    this.recording = false;

    try {
      this.recorder.requestData();
    } catch {}

    this.recorder.stop();

    setTimeout(() => {
      if (!this.stoppingRecording) return;
      this.stoppingRecording = false;
      this.stopMediaTracks();
    }, 1200);
  }

  getAttachmentUrl(message: ChatMessage): string {
    const raw = message.attachmentUrl || '';
    if (!raw) return '';
    if (raw.startsWith('http')) return raw;
    if (raw.startsWith('/inventaires/')) return `http://localhost:8088${raw}`;
    if (raw.startsWith('/chat-uploads/')) return `http://localhost:8088/inventaires${raw}`;
    if (raw.startsWith('chat-uploads/')) return `http://localhost:8088/inventaires/${raw}`;
    return raw.startsWith('/') ? `http://localhost:8088${raw}` : `http://localhost:8088/${raw}`;
  }

  getMessagePreview(message: ChatMessage): string {
    if (message.content?.trim()) return message.content;
    switch (message.messageType) {
      case 'IMAGE': return 'Image envoyee';
      case 'AUDIO': return 'Message vocal';
      case 'FILE': return 'Piece jointe';
      default: return 'Message';
    }
  }

  handleRealtimeMessage(message: ChatMessage): void {
    message.messageType = message.messageType || 'TEXT';
    if (message.senderId === this.currentUserId) {
      this.selectedFile = null;
      this.stoppingRecording = false;
      this.recording = false;
    }

    this.applyOutgoingMessage(message);
  }

  getConversationTitle(conversation: ChatConversation): string {
    const p = conversation.otherParticipant;
    return p ? `${p.prenom || ''} ${p.nom || ''}`.trim() : 'Conversation';
  }

  isMine(message: ChatMessage): boolean {
    return message.senderId === this.currentUserId;
  }

  private stopMediaTracks(): void {
    const stream = this.recorder?.stream;
    stream?.getTracks().forEach(track => track.stop());
    this.recorder = null;
    this.stoppingRecording = false;
    this.recording = false;
  }

  private applyOutgoingMessage(message: ChatMessage): void {
    const convo = this.conversations.find(c => c.id === message.conversationId);
    if (convo) {
      convo.lastMessage = this.getMessagePreview(message);
      convo.lastMessageAt = message.sentAt;
      this.conversations = [convo, ...this.conversations.filter(c => c.id !== convo.id)];
    } else {
      this.loadConversations(message.conversationId);
    }

    if (this.selectedConversation?.id === message.conversationId && !this.messages.some(m => m.id === message.id)) {
      this.messages = [...this.messages, message];
    }
  }

  trackByConversation(_: number, item: ChatConversation): number { return item.id; }
  trackByMessage(_: number, item: ChatMessage): number { return item.id; }
}
