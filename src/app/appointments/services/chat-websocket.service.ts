import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { AuthService } from '../../services/auth/auth.service';
import { ChatMessage } from '../models/appointments.models';

@Injectable({ providedIn: 'root' })
export class ChatWebsocketService {
  private socket: WebSocket | null = null;
  private messageSubject = new Subject<ChatMessage>();
  private reconnectTimer: any = null;

  constructor(private auth: AuthService) {}

  connect(): void {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }
    const token = this.auth.getToken();
    if (!token) return;
    this.socket = new WebSocket(`ws://localhost:8088/inventaires/ws/chat?token=${token}`);
    this.socket.onmessage = (event) => {
      try {
        this.messageSubject.next(JSON.parse(event.data) as ChatMessage);
      } catch {}
    };
    this.socket.onclose = () => {
      this.socket = null;
      this.reconnectTimer = setTimeout(() => this.connect(), 3000);
    };
    this.socket.onerror = () => this.socket?.close();
  }

  messages$(): Observable<ChatMessage> {
    return this.messageSubject.asObservable();
  }

  disconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.socket?.close();
    this.socket = null;
  }
}
