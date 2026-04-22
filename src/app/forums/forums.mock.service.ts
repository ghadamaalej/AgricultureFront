import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { HttpParams } from '@angular/common/http';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, of, timer } from 'rxjs';
import { catchError, map, retry, shareReplay, tap } from 'rxjs/operators';

export interface ForumUser {
  id: number;
  name: string;
  reputation: number;
  isExpert?: boolean;
  photo?: string | null;
  badgeTier?: string;
  badgeLabel?: string;
}

export interface ForumComment {
  id: number;
  authorId: number;
  content: string;
  createdAt: string;
  isDeleted?: boolean;
  deletedByAdmin?: boolean;
  reportCount?: number;
  isHiddenByReports?: boolean;
  currentUserHasPendingReport?: boolean;
}

export interface ForumReply {
  id: number;
  authorId: number;
  content: string;
  mediaUrls?: string[];
  upvotes: number;
  downvotes: number;
  isAccepted: boolean;
  createdAt: string;
  currentUserVote?: 'UP' | 'DOWN' | null;
  isDeleted?: boolean;
  deletedByAdmin?: boolean;
  reportCount?: number;
  isHiddenByReports?: boolean;
  currentUserHasPendingReport?: boolean;
  comments: ForumComment[];
}

export interface ForumPost {
  id: number;
  title: string;
  content: string;
  mediaUrls?: string[];
  mediaApproved?: boolean;
  mediaPendingReview?: boolean;
  tags: string[];
  authorId: number;
  groupId?: number | null;
  createdAt: string;
  views: number;
  isDeleted?: boolean;
  deletedByAdmin?: boolean;
  reportCount?: number;
  isHiddenByReports?: boolean;
  activeReportCount?: number;
  currentUserHasPendingReport?: boolean;
  replies: ForumReply[];
}

export interface ForumGroup {
  id: number;
  name: string;
  description: string;
  focusTags: string[];
  rules?: string[];
  memberIds?: number[];
  moderatorIds?: number[];
  createdAt?: string;
  memberCount: number;
  joined: boolean;
  createdBy?: number | null;
}

export interface ForumReportResult {
  targetType: 'POST' | 'REPLY' | 'COMMENT';
  targetId: number;
  reportCount: number;
  hidden: boolean;
  threshold: number;
  reportId?: number;
}

export interface ForumReportDetail {
  id: number;
  targetType: 'POST' | 'REPLY' | 'COMMENT';
  targetId: number;
  postId?: number | null;
  replyId?: number | null;
  commentId?: number | null;
  reporterId: number;
  reason: string;
  screenshotDataUrl?: string | null;
  createdAt: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewedAt?: string | null;
  reviewedBy?: number | null;
  adminNotes?: string | null;
}

interface AiTagSuggestionResponse {
  tags: string[];
}

interface AiReplyImproveResponse {
  draft: string;
}

interface AiDuplicateCandidateResponse {
  id: number;
  title: string;
  score: number;
  replies: number;
  views: number;
  reason?: string;
}

interface AiModerationAnalysisResponse {
  recommendation: 'APPROVE' | 'REVIEW_CAREFULLY' | 'REJECT';
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  rationale: string;
  signals: string[];
}

@Injectable({ providedIn: 'root' })
export class ForumsMockService {
  private readonly apiUrl = 'http://localhost:8089/forums/api/forums';
  private readonly userRequestCache = new Map<number, Observable<ForumUser | undefined>>();

  constructor(private http: HttpClient) {}

  getPosts(userId?: number, sortBy: string = 'newest', sortDirection: string = 'desc', searchTerm?: string, tags?: string[], groupId?: number): Observable<ForumPost[]> {
    let params = new HttpParams();
    if (userId != null) {
      params = params.set('userId', userId.toString());
    }
    params = params.set('sortBy', sortBy);
    params = params.set('sortDirection', sortDirection);
    if (searchTerm && searchTerm.trim()) {
      params = params.set('search', searchTerm.trim());
    }
    if (tags && tags.length > 0) {
      params = params.set('tags', tags.join(','));
    }
    if (groupId != null) {
      params = params.set('groupId', groupId.toString());
    }

    return this.http.get<ForumPost[]>(`${this.apiUrl}/posts`, { params }).pipe(
      retry({
        count: 3,
        delay: (error: HttpErrorResponse, retryCount: number) => {
          const status = error?.status ?? 0;
          if (status >= 500 || status === 0) {
            return timer(Math.min(1000 * Math.pow(2, retryCount - 1), 5000));
          }
          throw error;
        }
      })
    );
  }

  getPostById(postId: number, userId?: number): Observable<ForumPost | undefined> {
    const params = userId == null ? undefined : new HttpParams().set('userId', userId.toString());
    return this.http.get<ForumPost>(`${this.apiUrl}/posts/${postId}`, { params }).pipe(catchError(() => of(undefined)));
  }

  getUserById(userId: number): Observable<ForumUser | undefined> {
    const cached = this.userRequestCache.get(userId);
    if (cached) {
      return cached;
    }

    const request$ = this.http.get<ForumUser>(`${this.apiUrl}/users/${userId}`).pipe(
      tap(() => {}),
      catchError(() => of(undefined)),
      shareReplay(1)
    );

    this.userRequestCache.set(userId, request$);
    return request$;
  }

  getBadgeForReputation(reputation: number): string {
    if (reputation >= 1500) return 'Elite Grower';
    if (reputation >= 800) return 'Trusted Contributor';
    if (reputation >= 300) return 'Rising Member';
    return 'New Member';
  }

  getAvatarUrl(user?: ForumUser | null): string {
    if (!user) {
      return this.buildFallbackAvatar('Community member');
    }

    if (user.photo && user.photo.trim()) {
      return user.photo;
    }

    return this.buildFallbackAvatar(user.name || 'Community member');
  }

  private buildFallbackAvatar(name: string): string {
    const safeName = (name || 'Community member').trim();
    const initials = safeName
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || 'CM';
    const background = encodeURIComponent('linear-gradient(135deg, #0f766e 0%, #2563eb 100%)');
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#0f766e" />
            <stop offset="100%" stop-color="#2563eb" />
          </linearGradient>
        </defs>
        <rect width="128" height="128" rx="32" fill="url(#g)" />
        <circle cx="64" cy="49" r="23" fill="rgba(255,255,255,0.9)" />
        <path d="M25 112c7-22 25-33 39-33s32 11 39 33" fill="rgba(255,255,255,0.9)" />
        <text x="64" y="72" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" font-weight="700" fill="#0f172a">${initials}</text>
      </svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg).replace(/background/g, background)}`;
  }

  createPost(payload: { title: string; content: string; tags: string[]; mediaUrls?: string[]; groupId?: number | null; authorId?: number; generateAiReply?: boolean }): Observable<ForumPost> {
    return this.http.post<ForumPost>(`${this.apiUrl}/posts`, {
      title: payload.title,
      content: payload.content,
      tags: payload.tags,
      mediaUrls: payload.mediaUrls ?? [],
      groupId: payload.groupId ?? null,
      authorId: payload.authorId ?? 2,
      generateAiReply: payload.generateAiReply !== false
    });
  }

  getAiTagSuggestions(payload: { title: string; content: string; tags?: string[]; groupId?: number | null }): Observable<string[]> {
    return this.http.post<AiTagSuggestionResponse>(`${this.apiUrl}/ai/tags`, {
      title: payload.title,
      content: payload.content,
      tags: payload.tags ?? [],
      groupId: payload.groupId ?? null
    }).pipe(
      map((response) => (response?.tags ?? []).filter((tag) => !!tag && tag.trim().length > 0))
    );
  }

  improveReplyDraft(payload: { draft: string; postTitle: string; postContent: string; groupId?: number | null }): Observable<string> {
    return this.http.post<AiReplyImproveResponse>(`${this.apiUrl}/ai/replies/improve`, {
      draft: payload.draft,
      postTitle: payload.postTitle,
      postContent: payload.postContent,
      groupId: payload.groupId ?? null
    }).pipe(
      map((response) => response?.draft ?? payload.draft)
    );
  }

  getAiDuplicateSuggestions(payload: { title: string; content: string; tags?: string[]; groupId?: number | null }): Observable<AiDuplicateCandidateResponse[]> {
    return this.http.post<AiDuplicateCandidateResponse[]>(`${this.apiUrl}/ai/duplicates`, {
      title: payload.title,
      content: payload.content,
      tags: payload.tags ?? [],
      groupId: payload.groupId ?? null
    }).pipe(
      map((response) => (response ?? []).filter((item) => !!item && typeof item.id === 'number'))
    );
  }

  getModerationAnalysis(payload: { targetType: 'POST'; title: string; content: string; tags?: string[]; groupId?: number | null }): Observable<AiModerationAnalysisResponse> {
    return this.http.post<AiModerationAnalysisResponse>(`${this.apiUrl}/ai/moderation/analyze`, {
      targetType: payload.targetType,
      title: payload.title,
      content: payload.content,
      tags: payload.tags ?? [],
      groupId: payload.groupId ?? null
    });
  }

  addReply(postId: number, content: string, mediaUrls: string[] = [], authorId = 2): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/posts/${postId}/replies`, {
      content,
      mediaUrls,
      authorId
    });
  }

  voteReply(postId: number, replyId: number, vote: 'up' | 'down', userId: number): Observable<void> {
    const params = new HttpParams().set('type', vote);
    return this.http.post<void>(`${this.apiUrl}/posts/${postId}/replies/${replyId}/vote`, {}, { params });
  }

  addComment(postId: number, replyId: number, content: string, authorId = 2): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/posts/${postId}/replies/${replyId}/comments`, {
      content,
      authorId
    });
  }

  deletePost(postId: number, userId: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/posts/${postId}/delete`, {});
  }

  deleteReply(postId: number, replyId: number, userId: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/posts/${postId}/replies/${replyId}/delete`, {});
  }

  deleteComment(postId: number, replyId: number, commentId: number, userId: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/posts/${postId}/replies/${replyId}/comments/${commentId}/delete`, {});
  }

  reportPost(postId: number, payload: { reason: string; screenshotDataUrl?: string | null }): Observable<ForumReportResult> {
    return this.http.post<ForumReportResult>(`${this.apiUrl}/posts/${postId}/report`, payload);
  }

  reportReply(postId: number, replyId: number, payload: { reason: string; screenshotDataUrl?: string | null }): Observable<ForumReportResult> {
    return this.http.post<ForumReportResult>(`${this.apiUrl}/posts/${postId}/replies/${replyId}/report`, payload);
  }

  reportComment(postId: number, replyId: number, commentId: number, payload: { reason: string; screenshotDataUrl?: string | null }): Observable<ForumReportResult> {
    return this.http.post<ForumReportResult>(`${this.apiUrl}/posts/${postId}/replies/${replyId}/comments/${commentId}/report`, payload);
  }

  getReportDetails(targetType: 'POST' | 'REPLY' | 'COMMENT', targetId: number): Observable<ForumReportDetail[]> {
    return this.http.get<ForumReportDetail[]>(`${this.apiUrl}/reports/${targetType.toLowerCase()}/${targetId}`);
  }

  approveReportedPost(postId: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/posts/${postId}/moderation/approve`, {});
  }

  rejectReportedPost(postId: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/posts/${postId}/moderation/reject`, {});
  }

  approvePostMedia(postId: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/posts/${postId}/media/approve`, {});
  }

  rejectPostMedia(postId: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/posts/${postId}/media/reject`, {});
  }

  approveReportedReply(postId: number, replyId: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/posts/${postId}/replies/${replyId}/moderation/approve`, {});
  }

  rejectReportedReply(postId: number, replyId: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/posts/${postId}/replies/${replyId}/moderation/reject`, {});
  }

  approveReportedComment(postId: number, replyId: number, commentId: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/posts/${postId}/replies/${replyId}/comments/${commentId}/moderation/approve`, {});
  }

  rejectReportedComment(postId: number, replyId: number, commentId: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/posts/${postId}/replies/${replyId}/comments/${commentId}/moderation/reject`, {});
  }

  acceptReply(postId: number, replyId: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/posts/${postId}/replies/${replyId}/accept`, {});
  }

  getUserProfile(userId: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/users/${userId}/profile`).pipe(catchError(() => of(undefined)));
  }

  getGroups(userId?: number): Observable<ForumGroup[]> {
    let params = new HttpParams();
    if (userId != null) {
      params = params.set('userId', userId.toString());
    }
    return this.http.get<ForumGroup[]>(`${this.apiUrl}/groups`, { params });
  }

  getGroupById(groupId: number, userId?: number): Observable<ForumGroup> {
    let params = new HttpParams();
    if (userId != null) {
      params = params.set('userId', userId.toString());
    }
    return this.http.get<ForumGroup>(`${this.apiUrl}/groups/${groupId}`, { params });
  }

  createGroup(payload: { name: string; description: string; focusTags: string[]; rules?: string[] }): Observable<ForumGroup> {
    return this.http.post<ForumGroup>(`${this.apiUrl}/groups`, {
      name: payload.name,
      description: payload.description,
      focusTags: payload.focusTags,
      rules: payload.rules ?? []
    });
  }

  joinGroup(groupId: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/groups/${groupId}/join`, {});
  }

  leaveGroup(groupId: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/groups/${groupId}/leave`, {});
  }
}
