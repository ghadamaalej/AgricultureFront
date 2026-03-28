import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

export interface ForumUser {
  id: number;
  name: string;
  reputation: number;
  isExpert?: boolean;
}

export interface ForumComment {
  id: number;
  authorId: number;
  content: string;
  createdAt: string;
}

export interface ForumReply {
  id: number;
  authorId: number;
  content: string;
  upvotes: number;
  downvotes: number;
  isAccepted: boolean;
  createdAt: string;
  comments: ForumComment[];
}

export interface ForumPost {
  id: number;
  title: string;
  content: string;
  tags: string[];
  authorId: number;
  createdAt: string;
  views: number;
  replies: ForumReply[];
}

@Injectable({ providedIn: 'root' })
export class ForumsMockService {
  private readonly apiUrl = 'http://localhost:8089/forums/api/forums';

  constructor(private http: HttpClient) {}

  getPosts(): Observable<ForumPost[]> {
    return this.http.get<ForumPost[]>(`${this.apiUrl}/posts`);
  }

  getPostById(postId: number): Observable<ForumPost | undefined> {
    return this.http
      .get<ForumPost>(`${this.apiUrl}/posts/${postId}`)
      .pipe(catchError(() => of(undefined)));
  }

  getUserById(userId: number): Observable<ForumUser | undefined> {
    return this.http
      .get<ForumUser>(`${this.apiUrl}/users/${userId}`)
      .pipe(catchError(() => of(undefined)));
  }

  getBadgeForReputation(reputation: number): string {
    if (reputation >= 1500) return 'Elite Grower';
    if (reputation >= 800) return 'Trusted Contributor';
    if (reputation >= 300) return 'Rising Member';
    return 'New Member';
  }

  createPost(payload: { title: string; content: string; tags: string[]; authorId?: number }): Observable<ForumPost> {
    return this.http.post<ForumPost>(`${this.apiUrl}/posts`, {
      title: payload.title,
      content: payload.content,
      tags: payload.tags,
      authorId: payload.authorId ?? 2
    });
  }

  addReply(postId: number, content: string, authorId = 2): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/posts/${postId}/replies`, {
      content,
      authorId
    });
  }

  voteReply(postId: number, replyId: number, vote: 'up' | 'down'): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/posts/${postId}/replies/${replyId}/vote?type=${vote}`, {});
  }

  addComment(postId: number, replyId: number, content: string, authorId = 2): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/posts/${postId}/replies/${replyId}/comments`, {
      content,
      authorId
    });
  }

  markAcceptedReply(postId: number, replyId: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/posts/${postId}/replies/${replyId}/accept`, {});
  }
}
