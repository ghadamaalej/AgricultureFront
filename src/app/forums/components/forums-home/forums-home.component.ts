import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AuthService } from 'src/app/services/auth/auth.service';
import { ForumPost, ForumReply, ForumUser, ForumsMockService } from '../../forums.mock.service';

interface ForumContributor {
  userId: number;
  name: string;
  reputation: number;
  contributions: number;
  photo?: string | null;
}

@Component({
  selector: 'app-forums-home',
  templateUrl: './forums-home.component.html',
  styleUrls: ['./forums-home.component.css']
})
export class ForumsHomeComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private static readonly AI_AUTHOR_ID = -100;
  posts: ForumPost[] = [];
  showComposer = false;
  showAuthPrompt = false;
  authPromptAction = 'continue';
  usersById: Record<number, ForumUser> = {};
  creatingPost = false;
  postSubmitError = '';
  moderationNotice = '';
  currentUserId: number | null = null;
  sortBy: string = 'newest';
  sortDirection: string = 'desc';

  postForm = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(12)]],
    content: ['', [Validators.required, Validators.minLength(30)]],
    tags: ['', [Validators.required]],
    generateAiReply: [true]
  });

  constructor(
    private fb: FormBuilder,
    private forumsService: ForumsMockService,
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    console.log('[ForumsHome] ngOnInit started');
    const notice = this.route.snapshot.queryParamMap.get('notice');
    if (notice === 'post-hidden') {
      this.moderationNotice = 'This post reached the report threshold and is now hidden pending admin review.';
    } else if (notice === 'post-rejected') {
      this.moderationNotice = 'The post was rejected during moderation and has been removed.';
    }
    this.currentUserId = this.authService.getCurrentUserId();
    console.log('[ForumsHome] currentUserId:', this.currentUserId);
    this.refreshPosts();
  }

  refreshPosts(): void {
    console.log('[ForumsHome] refreshPosts called with sortBy:', this.sortBy);
    this.forumsService.getPosts(this.currentUserId ?? undefined, this.sortBy, this.sortDirection)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (posts) => {
          console.log('[ForumsHome] Received posts:', posts.length);
          this.posts = posts;
          this.preloadUsers(posts);
        },
        error: (err) => {
          console.error('[ForumsHome] Error loading posts:', err);
          this.posts = [];
        }
      });
  }

  changeSortBy(newSort: string): void {
    this.sortBy = newSort;
    this.refreshPosts();
  }

  openPost(postId: number): void {
    this.router.navigate(['/forums/post', postId]);
  }

  openUserProfile(userId: number, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.router.navigate(['/forums/profile', userId]);
  }

  toggleComposer(): void {
    if (this.showComposer) {
      this.showComposer = false;
      return;
    }

    if (!this.ensureAuthenticated('ask a question')) {
      return;
    }

    this.showComposer = true;
  }

  createPost(): void {
    this.postSubmitError = '';

    if (!this.ensureAuthenticated('create a post')) {
      return;
    }

    const currentUserId = this.currentUserId;
    if (currentUserId == null) {
      this.postSubmitError = 'Your session has expired. Please login again.';
      return;
    }

    if (this.postForm.invalid) {
      this.postForm.markAllAsTouched();
      this.postSubmitError = 'Please fill all fields with valid lengths before publishing.';
      return;
    }

    const tagsInput = this.postForm.value.tags ?? '';
    const shouldGenerateAiReply = this.postForm.value.generateAiReply !== false;
    const tags = tagsInput
      .split(',')
      .map((item) => item.trim())
      .filter((item) => !!item)
      .slice(0, 5);

    if (tags.length === 0) {
      this.postSubmitError = 'Please add at least one tag.';
      return;
    }

    this.creatingPost = true;

    this.forumsService
      .createPost({
        title: this.postForm.value.title ?? '',
        content: this.postForm.value.content ?? '',
        tags,
        authorId: currentUserId,
        generateAiReply: shouldGenerateAiReply
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (createdPost) => {
          if (shouldGenerateAiReply && createdPost?.id) {
            this.creatingPost = false;
            this.postForm.reset({ generateAiReply: true });
            this.showComposer = false;
            this.router.navigate(['/forums/post', createdPost.id], {
              queryParams: { awaitAi: '1' }
            });
            return;
          }

          this.creatingPost = false;
          this.postForm.reset({ generateAiReply: true });
          this.showComposer = false;
          this.refreshPosts();
        },
        error: (err) => {
          this.creatingPost = false;
          this.postSubmitError = err?.error?.error
            || 'Could not create post. Check title/content lengths and try again.';
        }
      });
  }

  closeAuthPrompt(): void {
    this.showAuthPrompt = false;
  }

  openAuth(mode: 'signin' | 'signup'): void {
    this.showAuthPrompt = false;
    localStorage.setItem('authMode', mode);
    this.router.navigate(['/auth'], { queryParams: { returnUrl: this.router.url || '/forums' } });
  }

  private ensureAuthenticated(action: string): boolean {
    if (!this.authService.hasActiveSession()) {
      this.currentUserId = null;
      this.authPromptAction = action;
      this.showAuthPrompt = true;
      return false;
    }

    this.currentUserId = this.authService.getCurrentUserId();
    if (this.currentUserId != null) {
      return true;
    }

    this.authPromptAction = action;
    this.showAuthPrompt = true;
    return false;
  }

  getUser(authorId: number): ForumUser | undefined {
    return this.usersById[authorId];
  }

  displayPostTitle(post: ForumPost): string {
    if (post.isHiddenByReports && !this.isCurrentUserAdmin()) {
      return 'Hidden pending review';
    }

    if (!post.isDeleted) {
      return post.title;
    }

    const fromApi = (post.title || '').trim();
    return fromApi || 'Post was removed';
  }

  displayPostContent(post: ForumPost): string {
    if (post.isHiddenByReports && !this.isCurrentUserAdmin()) {
      return 'This post was hidden after reports and is currently pending admin review.';
    }

    if (!post.isDeleted) {
      return post.content;
    }

    const fromApi = (post.content || '').trim();
    if (fromApi) {
      return fromApi;
    }

    return post.deletedByAdmin ? 'This post was removed by an administrator.' : 'This post was removed by the user.';
  }

  isPostDeletedNotice(post: ForumPost): boolean {
    return !!post.isDeleted;
  }

  isPostHiddenNotice(post: ForumPost): boolean {
    return !!post.isHiddenByReports && !this.isCurrentUserAdmin() && !post.isDeleted;
  }

  isThreadReported(post: ForumPost): boolean {
    if (post.isHiddenByReports || (post.activeReportCount ?? 0) > 0 || (post.reportCount ?? 0) > 0) {
      return true;
    }

    return (post.replies ?? []).some((reply) =>
      reply.isHiddenByReports
      || (reply.reportCount ?? 0) > 0
      || (reply.comments ?? []).some((comment) => comment.isHiddenByReports || (comment.reportCount ?? 0) > 0)
    );
  }

  getThreadReportLabel(post: ForumPost): string {
    return 'Needs review';
  }

  getThreadReportTooltip(post: ForumPost): string {
    if (post.isHiddenByReports || (post.activeReportCount ?? 0) > 0 || (post.reportCount ?? 0) > 0) {
      return 'Reported post';
    }

    return 'Reported reply/comment inside this thread';
  }

  isCurrentUserAdmin(): boolean {
    return this.authService.hasRole('ADMIN');
  }

  getAvatarTitle(user: ForumUser): string {
    return `${user.name} profile image`;
  }

  getAvatarUrl(user: ForumUser | undefined): string {
    return this.forumsService.getAvatarUrl(user ?? null);
  }

  answerCount(post: ForumPost): number {
    return this.getHumanReplies(post).length;
  }

  isSolved(post: ForumPost): boolean {
    return this.getHumanReplies(post).some((reply) => reply.isAccepted);
  }

  score(post: ForumPost): number {
    return this.getHumanReplies(post).reduce((total, reply) => total + reply.upvotes - reply.downvotes, 0);
  }

  get topQuestions(): ForumPost[] {
    return [...this.posts]
      .sort((a, b) => {
        const scoreA = this.score(a) + a.replies.length * 2 + a.views * 0.02;
        const scoreB = this.score(b) + b.replies.length * 2 + b.views * 0.02;
        return scoreB - scoreA;
      })
      .slice(0, 5);
  }

  get recentQuestions(): ForumPost[] {
    return [...this.posts]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }

  get totalAnswers(): number {
    return this.posts.reduce((sum, post) => sum + this.getHumanReplies(post).length, 0);
  }

  get totalViews(): number {
    return this.posts.reduce((sum, post) => sum + post.views, 0);
  }

  get unansweredCount(): number {
    return this.posts.filter((post) => this.getHumanReplies(post).length === 0).length;
  }

  get hotTags(): string[] {
    const tagsCount = new Map<string, number>();

    this.posts.forEach((post) => {
      post.tags.forEach((tag) => {
        tagsCount.set(tag, (tagsCount.get(tag) ?? 0) + 1);
      });
    });

    return [...tagsCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tag]) => tag);
  }

  get topContributors(): ForumContributor[] {
    const contributionMap = new Map<number, number>();

    this.posts.forEach((post) => {
      contributionMap.set(post.authorId, (contributionMap.get(post.authorId) ?? 0) + 1);

      this.getHumanReplies(post).forEach((reply) => {
        contributionMap.set(reply.authorId, (contributionMap.get(reply.authorId) ?? 0) + 1);
      });
    });

    return [...contributionMap.entries()]
      .map(([userId, contributions]) => {
        const user = this.usersById[userId];
        return {
          userId,
          name: user?.name ?? 'Community member',
          reputation: user?.reputation ?? 0,
          photo: user?.photo ?? null,
          contributions
        };
      })
      .sort((a, b) => b.contributions - a.contributions)
      .slice(0, 4);
  }

  private preloadUsers(posts: ForumPost[]): void {
    console.log('[ForumsHome] preloadUsers called for', posts.length, 'posts');
    const userIds = new Set<number>();

    posts.forEach((post) => {
      userIds.add(post.authorId);
      this.getHumanReplies(post).forEach((reply) => {
        userIds.add(reply.authorId);
        reply.comments.forEach((comment) => userIds.add(comment.authorId));
      });
    });

    console.log('[ForumsHome] Unique user IDs to load:', Array.from(userIds));
    let subscriptionsCompleted = 0;
    const totalSubscriptions = userIds.size;

    [...userIds].forEach((id, index) => {
      if (this.usersById[id]) {
        console.log('[ForumsHome] Using cached user:', id);
        subscriptionsCompleted++;
        return;
      }

      // Stagger requests to avoid bursts that can lock up SPA navigation transitions.
      window.setTimeout(() => {
        this.forumsService.getUserById(id)
          .pipe(takeUntil(this.destroy$))
          .subscribe((user) => {
            if (user) {
              this.usersById[id] = user;
            }
            subscriptionsCompleted++;
            console.log('[ForumsHome] User loaded:', id, '(' + subscriptionsCompleted + '/' + totalSubscriptions + ')');
          });
      }, index * 35);
    });

    if (totalSubscriptions === 0) {
      console.log('[ForumsHome] No users to preload');
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private getHumanReplies(post: ForumPost): ForumReply[] {
    return (post.replies || []).filter((reply) => !this.isAiReply(reply));
  }

  private isAiReply(reply: ForumReply): boolean {
    return reply.authorId === ForumsHomeComponent.AI_AUTHOR_ID;
  }
}
