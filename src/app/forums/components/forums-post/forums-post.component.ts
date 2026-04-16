import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  ForumComment,
  ForumPost,
  ForumReportDetail,
  ForumReportResult,
  ForumReply,
  ForumUser,
  ForumsMockService
} from '../../forums.mock.service';

type ReportTargetType = 'POST' | 'REPLY' | 'COMMENT';

interface ReportTargetContext {
  targetType: ReportTargetType;
  targetId: number;
  postId: number;
  replyId?: number;
  commentId?: number;
  label: string;
}
import { AuthService } from 'src/app/services/auth/auth.service';

@Component({
  selector: 'app-forums-post',
  templateUrl: './forums-post.component.html',
  styleUrls: ['./forums-post.component.css']
})
export class ForumsPostComponent implements OnInit, OnDestroy {
  private static readonly AI_AUTHOR_ID = -100;
  private aiPollingTimerId: number | null = null;
  private awaitingAiFromCreate = false;
  private aiPollingAttempts = 0;
  private readonly maxAiPollingAttempts = 8;

  private destroy$ = new Subject<void>();
  post?: ForumPost;
  showAuthPrompt = false;
  authPromptAction = 'continue';
  similarQuestions: ForumPost[] = [];
  recentDiscussions: ForumPost[] = [];
  commentDraftByReply: Record<number, string> = {};
  collapsedReplyIds = new Set<number>();
  collapsedCommentKeys = new Set<string>();
  usersById: Record<number, ForumUser> = {};
  submittingReply = false;
  replySubmitError = '';
  reportingPost = false;
  moderatingPost = false;
  reportingReplyIds = new Set<number>();
  reportingCommentKeys = new Set<string>();
  moderatingReplyIds = new Set<number>();
  moderatingCommentKeys = new Set<string>();
  reportFeedback = '';
  showReportDialog = false;
  reportDialogMode: 'submit' | 'review' = 'submit';
  reportDialogLoading = false;
  reportDialogSubmitting = false;
  reportDialogError = '';
  activeReportTarget: ReportTargetContext | null = null;
  reportDetails: ForumReportDetail[] = [];
  reportScreenshotDataUrl: string | null = null;
  reportScreenshotName = '';
  currentUserId: number | null = null;

  replyForm = this.fb.group({
    content: ['', [Validators.required, Validators.minLength(12)]]
  });

  reportForm = this.fb.group({
    reason: ['', [Validators.required, Validators.minLength(12)]]
  });

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private forumsService: ForumsMockService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.currentUserId = this.authService.getCurrentUserId();

    this.route.paramMap
      .pipe(takeUntil(this.destroy$))
      .subscribe((params) => {
        const postId = Number(params.get('id'));
        if (!postId) {
          this.router.navigate(['/forums']);
          return;
        }

        this.awaitingAiFromCreate = this.route.snapshot.queryParamMap.get('awaitAi') === '1';
        this.loadPost(postId, this.awaitingAiFromCreate);
      });
  }

  loadPost(postId: number, allowAiAwait = false): void {
    this.forumsService.getPostById(postId, this.currentUserId ?? undefined)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (post) => {
          if (!post) {
            this.router.navigate(['/forums']);
            return;
          }

          this.post = post;
          this.preloadUsers([post]);

          if (allowAiAwait && !this.aiReply) {
            this.scheduleAiRefresh(postId);
          } else {
            this.stopAiRefresh();
            if (this.awaitingAiFromCreate && this.aiReply) {
              this.awaitingAiFromCreate = false;
              this.router.navigate([], {
                relativeTo: this.route,
                queryParams: { awaitAi: null },
                queryParamsHandling: 'merge',
                replaceUrl: true
              });
            }
          }

          this.forumsService.getPosts(this.currentUserId ?? undefined)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: (posts) => {
                this.similarQuestions = this.computeSimilarQuestions(post, posts);
                this.recentDiscussions = posts
                  .filter((item) => item.id !== post.id)
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .slice(0, 4);
                this.preloadUsers(this.recentDiscussions);
              }
            });
        },
        error: () => this.router.navigate(['/forums'])
      });
  }

  get aiReply(): ForumReply | undefined {
    if (!this.post?.replies?.length || this.post.isDeleted) {
      return undefined;
    }

    return this.post.replies.find((reply) => this.isAiReply(reply) && !reply.isDeleted);
  }

  get humanReplies(): ForumReply[] {
    if (!this.post?.replies?.length) {
      return [];
    }

    return this.post.replies.filter((reply) => !this.isAiReply(reply));
  }

  get isAwaitingAiReply(): boolean {
    return this.awaitingAiFromCreate && !this.aiReply;
  }

  get visibleReplyCount(): number {
    return this.humanReplies.length;
  }

  goBack(): void {
    this.router.navigate(['/forums']);
  }

  getUser(userId: number): ForumUser | undefined {
    return this.usersById[userId];
  }

  openUserProfile(userId: number): void {
    this.router.navigate(['/forums/profile', userId]);
  }

  getAvatarUrl(user: ForumUser | undefined): string {
    return this.forumsService.getAvatarUrl(user ?? null);
  }

  getAvatarTitle(user: ForumUser | undefined): string {
    return `${user?.name ?? 'Community member'} profile image`;
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

  displayReplyContent(reply: ForumReply): string {
    if (reply.isHiddenByReports) {
      return 'This reply was hidden after reports and is currently pending admin review.';
    }

    if (!reply.isDeleted) {
      return reply.content;
    }

    const fromApi = (reply.content || '').trim();
    if (fromApi) {
      return fromApi;
    }

    return reply.deletedByAdmin ? 'This reply has been removed by an administrator.' : 'This reply has been removed by the user.';
  }

  isReplyDeletedNotice(reply: ForumReply): boolean {
    return !!reply.isDeleted;
  }

  isReplyHiddenNotice(reply: ForumReply): boolean {
    return !!reply.isHiddenByReports && !this.isCurrentUserAdmin() && !reply.isDeleted;
  }

  displayCommentContent(comment: { isDeleted?: boolean; deletedByAdmin?: boolean; isHiddenByReports?: boolean; content: string }): string {
    if (comment.isHiddenByReports) {
      return 'This comment was hidden after reports and is currently pending admin review.';
    }

    if (!comment.isDeleted) {
      return comment.content;
    }

    const fromApi = (comment.content || '').trim();
    if (fromApi) {
      return fromApi;
    }

    return comment.deletedByAdmin ? 'This comment has been removed by an administrator.' : 'This comment has been removed by the user.';
  }

  isCommentDeletedNotice(comment: ForumComment): boolean {
    return !!comment.isDeleted;
  }

  isCommentHiddenNotice(comment: ForumComment): boolean {
    return !!comment.isHiddenByReports && !this.isCurrentUserAdmin() && !comment.isDeleted;
  }

  canDeletePost(post: ForumPost): boolean {
    return this.canManageAuthor(post.authorId);
  }

  canDeleteReply(reply: ForumReply): boolean {
    return this.canManageAuthor(reply.authorId);
  }

  canDeleteComment(comment: ForumComment): boolean {
    return this.canManageAuthor(comment.authorId);
  }

  canReportPost(post: ForumPost): boolean {
    return !post.isDeleted && !post.isHiddenByReports && !post.currentUserHasPendingReport;
  }

  canReportReply(reply: ForumReply): boolean {
    return !reply.isDeleted && !reply.isHiddenByReports && !reply.currentUserHasPendingReport;
  }

  canReportComment(comment: ForumComment): boolean {
    return !comment.isDeleted && !comment.isHiddenByReports && !comment.currentUserHasPendingReport;
  }

  reportPostButtonLabel(post: ForumPost): string {
    if (post.isHiddenByReports) {
      return 'Under review';
    }

    if (post.currentUserHasPendingReport) {
      return 'Reported';
    }

    return 'Report post';
  }

  reportReplyButtonLabel(reply: ForumReply): string {
    if (reply.isHiddenByReports) {
      return 'Under review';
    }

    if (reply.currentUserHasPendingReport) {
      return 'Reported';
    }

    return 'Report';
  }

  reportCommentButtonLabel(comment: ForumComment): string {
    if (comment.isHiddenByReports) {
      return 'Under review';
    }

    if (comment.currentUserHasPendingReport) {
      return 'Reported';
    }

    return 'Report';
  }

  isCurrentUserAdmin(): boolean {
    return this.authService.hasRole('ADMIN');
  }

  private canManageAuthor(authorId: number): boolean {
    return this.currentUserId != null && (this.currentUserId === authorId || this.isCurrentUserAdmin());
  }

  replyScore(reply: ForumReply): number {
    return reply.upvotes - reply.downvotes;
  }

  hasUpvoted(reply: ForumReply): boolean {
    return reply.currentUserVote === 'UP';
  }

  hasDownvoted(reply: ForumReply): boolean {
    return reply.currentUserVote === 'DOWN';
  }

  deletePost(): void {
    if (!this.post || this.currentUserId == null) return;
    const currentUserId = this.currentUserId;
    this.forumsService.deletePost(this.post.id, currentUserId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.loadPost(this.post!.id)
      });
  }

  reportPost(): void {
    if (!this.post) return;
    if (!this.ensureAuthenticated('report this post')) {
      return;
    }

    this.openReportDialog({ targetType: 'POST', targetId: this.post.id, postId: this.post.id, label: 'post' });
  }

  reviewReportedPost(): void {
    if (!this.post || !this.isCurrentUserAdmin()) {
      return;
    }

    if (!this.isThreadReported(this.post)) {
      return;
    }

    this.openReportDialog({ targetType: 'POST', targetId: this.post.id, postId: this.post.id, label: 'post' }, 'review');
  }

  approveReportedPost(): void {
    if (!this.post || !this.isCurrentUserAdmin()) {
      return;
    }

    this.moderatingPost = true;
    this.reportFeedback = '';
    this.forumsService.approveReportedPost(this.post.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.moderatingPost = false;
          this.reportFeedback = 'Post approved and restored for all users.';
          this.closeReportDialog();
          this.loadPost(this.post!.id);
        },
        error: (err) => {
          this.moderatingPost = false;
          this.reportFeedback = err?.error?.error || 'Could not approve this post.';
        }
      });
  }

  rejectReportedPost(): void {
    if (!this.post || !this.isCurrentUserAdmin()) {
      return;
    }

    this.moderatingPost = true;
    this.reportFeedback = '';
    this.forumsService.rejectReportedPost(this.post.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.moderatingPost = false;
          this.closeReportDialog();
          this.router.navigate(['/forums'], { queryParams: { notice: 'post-rejected' } });
        },
        error: (err) => {
          this.moderatingPost = false;
          this.reportFeedback = err?.error?.error || 'Could not reject this post.';
        }
      });
  }

  deleteReply(replyId: number): void {
    if (!this.post || this.currentUserId == null) return;
    const currentUserId = this.currentUserId;
    this.forumsService.deleteReply(this.post.id, replyId, currentUserId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.loadPost(this.post!.id)
      });
  }

  reportReply(replyId: number): void {
    if (!this.post) return;
    if (!this.ensureAuthenticated('report this reply')) {
      return;
    }

    this.openReportDialog({ targetType: 'REPLY', targetId: replyId, postId: this.post.id, replyId, label: 'reply' });
  }

  reviewReportedReply(replyId: number): void {
    if (!this.post || !this.isCurrentUserAdmin()) return;

    const reply = this.post.replies.find((item) => item.id === replyId);
    const reportCount = reply?.reportCount ?? 0;
    if (!reply || (!reply.isHiddenByReports && reportCount <= 0)) {
      return;
    }

    this.openReportDialog({ targetType: 'REPLY', targetId: replyId, postId: this.post.id, replyId, label: 'reply' }, 'review');
  }

  approveReportedReply(replyId: number): void {
    if (!this.post || !this.isCurrentUserAdmin()) return;

    this.reportFeedback = '';
    this.moderatingReplyIds.add(replyId);
    this.forumsService.approveReportedReply(this.post.id, replyId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.moderatingReplyIds.delete(replyId);
          this.reportFeedback = 'Reply approved and restored for all users.';
          this.closeReportDialog();
          this.loadPost(this.post!.id);
        },
        error: (err) => {
          this.moderatingReplyIds.delete(replyId);
          this.reportFeedback = err?.error?.error || 'Could not approve this reply.';
        }
      });
  }

  rejectReportedReply(replyId: number): void {
    if (!this.post || !this.isCurrentUserAdmin()) return;

    this.reportFeedback = '';
    this.moderatingReplyIds.add(replyId);
    this.forumsService.rejectReportedReply(this.post.id, replyId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.moderatingReplyIds.delete(replyId);
          this.reportFeedback = 'Reply deleted after moderation.';
          this.closeReportDialog();
          this.loadPost(this.post!.id);
        },
        error: (err) => {
          this.moderatingReplyIds.delete(replyId);
          this.reportFeedback = err?.error?.error || 'Could not reject this reply.';
        }
      });
  }

  deleteComment(replyId: number, commentId: number): void {
    if (!this.post || this.currentUserId == null) return;
    const currentUserId = this.currentUserId;
    this.forumsService.deleteComment(this.post.id, replyId, commentId, currentUserId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.loadPost(this.post!.id)
      });
  }

  reportComment(replyId: number, commentId: number): void {
    if (!this.post) return;
    if (!this.ensureAuthenticated('report this comment')) {
      return;
    }

    this.openReportDialog({ targetType: 'COMMENT', targetId: commentId, postId: this.post.id, replyId, commentId, label: 'comment' });
  }

  reviewReportedComment(replyId: number, commentId: number): void {
    if (!this.post || !this.isCurrentUserAdmin()) return;

    const reply = this.post.replies.find((item) => item.id === replyId);
    const comment = reply?.comments.find((item) => item.id === commentId);
    const reportCount = comment?.reportCount ?? 0;
    if (!reply || !comment || (!comment.isHiddenByReports && reportCount <= 0)) {
      return;
    }

    this.openReportDialog({ targetType: 'COMMENT', targetId: commentId, postId: this.post.id, replyId, commentId, label: 'comment' }, 'review');
  }

  approveReportedComment(replyId: number, commentId: number): void {
    if (!this.post || !this.isCurrentUserAdmin()) return;

    this.reportFeedback = '';
    const key = `${replyId}-${commentId}`;
    this.moderatingCommentKeys.add(key);
    this.forumsService.approveReportedComment(this.post.id, replyId, commentId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.moderatingCommentKeys.delete(key);
          this.reportFeedback = 'Comment approved and restored for all users.';
          this.closeReportDialog();
          this.loadPost(this.post!.id);
        },
        error: (err) => {
          this.moderatingCommentKeys.delete(key);
          this.reportFeedback = err?.error?.error || 'Could not approve this comment.';
        }
      });
  }

  rejectReportedComment(replyId: number, commentId: number): void {
    if (!this.post || !this.isCurrentUserAdmin()) return;

    this.reportFeedback = '';
    const key = `${replyId}-${commentId}`;
    this.moderatingCommentKeys.add(key);
    this.forumsService.rejectReportedComment(this.post.id, replyId, commentId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.moderatingCommentKeys.delete(key);
          this.reportFeedback = 'Comment deleted after moderation.';
          this.closeReportDialog();
          this.loadPost(this.post!.id);
        },
        error: (err) => {
          this.moderatingCommentKeys.delete(key);
          this.reportFeedback = err?.error?.error || 'Could not reject this comment.';
        }
      });
  }

  isReportingReply(replyId: number): boolean {
    return this.reportingReplyIds.has(replyId);
  }

  isReportingComment(replyId: number, commentId: number): boolean {
    return this.reportingCommentKeys.has(`${replyId}-${commentId}`);
  }

  isModeratingReply(replyId: number): boolean {
    return this.moderatingReplyIds.has(replyId);
  }

  isModeratingComment(replyId: number, commentId: number): boolean {
    return this.moderatingCommentKeys.has(`${replyId}-${commentId}`);
  }

  canReviewPost(post: ForumPost): boolean {
    return this.isCurrentUserAdmin() && this.isThreadReported(post);
  }

  canReviewReply(reply: ForumReply): boolean {
    return this.isCurrentUserAdmin() && (reply.isHiddenByReports || (reply.reportCount ?? 0) > 0);
  }

  canReviewComment(comment: ForumComment): boolean {
    return this.isCurrentUserAdmin() && (comment.isHiddenByReports || (comment.reportCount ?? 0) > 0);
  }

  get reportCaseSummary(): { totalReports: number; uniqueReporters: number; latestReason: string; previousReasons: string[] } {
    const reports = this.reportDetails ?? [];
    const uniqueReporters = new Set(reports.map((report) => report.reporterId)).size;

    return {
      totalReports: reports.length,
      uniqueReporters,
      latestReason: reports[0]?.reason ?? '',
      previousReasons: reports.slice(1).map((report) => report.reason)
    };
  }

  submitReply(): void {
    if (!this.post) return;
    this.replySubmitError = '';

    if (!this.ensureAuthenticated('post a reply')) {
      return;
    }

    if (this.replyForm.invalid) {
      this.replyForm.markAllAsTouched();
      this.replySubmitError = 'Reply must be at least 12 characters.';
      return;
    }

    this.submittingReply = true;
    const currentUserId = this.currentUserId;
    if (currentUserId == null) {
      this.submittingReply = false;
      return;
    }

    this.forumsService.addReply(this.post.id, this.replyForm.value.content ?? '', currentUserId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.submittingReply = false;
          this.replyForm.reset();
          this.loadPost(this.post!.id);
        },
        error: (err) => {
          this.submittingReply = false;
          this.replySubmitError = err?.error?.error
            || 'Could not post reply. Check the text and try again.';
        }
      });
  }

  vote(replyId: number, type: 'up' | 'down'): void {
    if (!this.post) return;
    if (!this.ensureAuthenticated(type === 'up' ? 'upvote replies' : 'downvote replies')) {
      return;
    }

    const currentUserId = this.currentUserId;
    if (currentUserId == null) {
      return;
    }

    this.forumsService.voteReply(this.post.id, replyId, type, currentUserId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.loadPost(this.post!.id)
      });
  }

  addComment(replyId: number): void {
    if (!this.post) return;

    const content = (this.commentDraftByReply[replyId] || '').trim();
    if (!content) return;

    if (!this.ensureAuthenticated('add a comment')) {
      return;
    }

    const currentUserId = this.currentUserId;
    if (currentUserId == null) {
      return;
    }

    this.forumsService.addComment(this.post.id, replyId, content, currentUserId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.commentDraftByReply[replyId] = '';
          this.loadPost(this.post!.id);
        }
      });
  }

  openSimilar(postId: number): void {
    this.router.navigate(['/forums/post', postId]);
  }

  toggleReplyCollapse(replyId: number): void {
    if (this.collapsedReplyIds.has(replyId)) {
      this.collapsedReplyIds.delete(replyId);
      return;
    }

    this.collapsedReplyIds.add(replyId);
  }

  isReplyCollapsed(replyId: number): boolean {
    return this.collapsedReplyIds.has(replyId);
  }

  toggleAllRepliesCollapse(): void {
    if (!this.humanReplies.length) return;

    const shouldExpandAll = this.humanReplies.every((reply) => this.collapsedReplyIds.has(reply.id));

    if (shouldExpandAll) {
      this.collapsedReplyIds.clear();
      return;
    }

    this.humanReplies.forEach((reply) => this.collapsedReplyIds.add(reply.id));
  }

  areAllRepliesCollapsed(): boolean {
    if (!this.humanReplies.length) return false;
    return this.humanReplies.every((reply) => this.collapsedReplyIds.has(reply.id));
  }

  toggleAllCommentsCollapse(reply: ForumReply): void {
    if (!reply.comments.length) return;

    const shouldExpandAll = reply.comments.every((comment) => this.isCommentCollapsed(reply.id, comment.id));

    reply.comments.forEach((comment) => {
      const key = `${reply.id}-${comment.id}`;
      if (shouldExpandAll) {
        this.collapsedCommentKeys.delete(key);
      } else {
        this.collapsedCommentKeys.add(key);
      }
    });
  }

  areAllCommentsCollapsed(reply: ForumReply): boolean {
    if (!reply.comments.length) return false;
    return reply.comments.every((comment) => this.isCommentCollapsed(reply.id, comment.id));
  }

  toggleCommentCollapse(replyId: number, commentId: number): void {
    const key = `${replyId}-${commentId}`;
    if (this.collapsedCommentKeys.has(key)) {
      this.collapsedCommentKeys.delete(key);
      return;
    }

    this.collapsedCommentKeys.add(key);
  }

  isCommentCollapsed(replyId: number, commentId: number): boolean {
    return this.collapsedCommentKeys.has(`${replyId}-${commentId}`);
  }

  get totalThreadVotes(): number {
    return this.humanReplies.reduce((sum, reply) => sum + (reply.upvotes - reply.downvotes), 0);
  }

  get bestAnswerCount(): number {
    return this.humanReplies.filter((reply) => reply.isAccepted).length;
  }

  private computeSimilarQuestions(currentPost: ForumPost, allPosts: ForumPost[]): ForumPost[] {
    const candidates = allPosts.filter((item) => item.id !== currentPost.id);

    return candidates
      .map((candidate) => {
        const sharedTags = candidate.tags.filter((tag) => currentPost.tags.includes(tag)).length;
        const rank = sharedTags * 10 + candidate.replies.length * 2 + candidate.views * 0.02;
        return { candidate, rank };
      })
      .filter((item) => item.rank > 0)
      .sort((a, b) => b.rank - a.rank)
      .slice(0, 5)
      .map((item) => item.candidate);
  }

  private preloadUsers(posts: ForumPost[]): void {
    const userIds = new Set<number>();

    posts.forEach((post) => {
      userIds.add(post.authorId);
      post.replies
        .filter((reply) => !this.isAiReply(reply))
        .forEach((reply) => {
        userIds.add(reply.authorId);
        reply.comments.forEach((comment) => userIds.add(comment.authorId));
      });
    });

    [...userIds].forEach((id, index) => {
      if (this.usersById[id]) {
        return;
      }

      window.setTimeout(() => {
        this.forumsService.getUserById(id)
          .pipe(takeUntil(this.destroy$))
          .subscribe((user) => {
            if (user) {
              this.usersById[id] = user;
            }
          });
      }, index * 35);
    });
  }

  ngOnDestroy(): void {
    this.stopAiRefresh();
    this.destroy$.next();
    this.destroy$.complete();
  }

  private isAiReply(reply: ForumReply): boolean {
    return reply.authorId === ForumsPostComponent.AI_AUTHOR_ID;
  }

  private scheduleAiRefresh(postId: number): void {
    if (this.aiPollingAttempts >= this.maxAiPollingAttempts) {
      this.awaitingAiFromCreate = false;
      this.stopAiRefresh();
      return;
    }

    this.stopAiRefresh();
    this.aiPollingAttempts += 1;
    this.aiPollingTimerId = window.setTimeout(() => {
      this.loadPost(postId, true);
    }, 900);
  }

  private stopAiRefresh(): void {
    if (this.aiPollingTimerId != null) {
      window.clearTimeout(this.aiPollingTimerId);
      this.aiPollingTimerId = null;
    }
  }

  private handleReportResult(result: ForumReportResult, targetLabel: string): void {
    if (result.hidden) {
      this.reportFeedback = `Thanks. The ${targetLabel} reached the moderation threshold and is now hidden pending admin review.`;
    } else {
      this.reportFeedback = `Thanks. Report submitted for this ${targetLabel} (${result.reportCount}/${result.threshold}).`;
    }

    if (this.post) {
      if (targetLabel === 'post' && result.hidden) {
        this.router.navigate(['/forums'], { queryParams: { notice: 'post-hidden' } });
        return;
      }
      this.loadPost(this.post.id);
    }
  }

  openReportDialog(target: ReportTargetContext, mode: 'submit' | 'review' = 'submit'): void {
    this.activeReportTarget = target;
    this.reportDialogMode = mode;
    this.reportDialogError = '';
    this.reportFeedback = '';
    this.reportScreenshotDataUrl = null;
    this.reportScreenshotName = '';
    this.reportDetails = [];
    this.reportForm.reset();
    this.showReportDialog = true;

    if (mode === 'review') {
      this.loadReportDetails(target);
    }
  }

  closeReportDialog(): void {
    this.showReportDialog = false;
    this.activeReportTarget = null;
    this.reportDialogError = '';
    this.reportDetails = [];
    this.reportForm.reset();
    this.reportScreenshotDataUrl = null;
    this.reportScreenshotName = '';
  }

  onReportScreenshotSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      this.reportScreenshotDataUrl = null;
      this.reportScreenshotName = '';
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.reportDialogError = 'Please choose an image file for the screenshot.';
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      this.reportScreenshotDataUrl = typeof reader.result === 'string' ? reader.result : null;
      this.reportScreenshotName = file.name;
    };
    reader.readAsDataURL(file);
  }

  submitReport(): void {
    if (!this.activeReportTarget) {
      return;
    }

    if (this.reportForm.invalid) {
      this.reportForm.markAllAsTouched();
      this.reportDialogError = 'Please add a clear report reason before submitting.';
      return;
    }

    const reason = (this.reportForm.value.reason ?? '').trim();
    if (!reason) {
      this.reportDialogError = 'Please add a clear report reason before submitting.';
      return;
    }

    this.reportDialogSubmitting = true;
    this.reportDialogError = '';

    const payload = {
      reason,
      screenshotDataUrl: this.reportScreenshotDataUrl
    };

    const request$ = this.activeReportTarget.targetType === 'POST'
      ? this.forumsService.reportPost(this.activeReportTarget.targetId, payload)
      : this.activeReportTarget.targetType === 'REPLY'
        ? this.forumsService.reportReply(this.activeReportTarget.postId, this.activeReportTarget.replyId ?? this.activeReportTarget.targetId, payload)
        : this.forumsService.reportComment(this.activeReportTarget.postId, this.activeReportTarget.replyId ?? 0, this.activeReportTarget.commentId ?? this.activeReportTarget.targetId, payload);

    request$
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.reportDialogSubmitting = false;
          this.handleReportResult(result, this.activeReportTarget?.label ?? 'item');
          this.closeReportDialog();
        },
        error: (err) => {
          this.reportDialogSubmitting = false;
          this.reportDialogError = err?.error?.error || 'Could not submit report right now.';
        }
      });
  }

  private loadReportDetails(target: ReportTargetContext): void {
    this.reportDialogLoading = true;
    this.forumsService.getReportDetails(target.targetType, target.targetId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (reports) => {
          this.reportDetails = reports;
          this.reportDialogLoading = false;
        },
        error: (err) => {
          this.reportDialogLoading = false;
          this.reportDialogError = err?.error?.error || 'Could not load report details.';
        }
      });
  }

  autoResizeCommentInput(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
    }
  }

  scrollToReplyComposer(): void {
    const composer = document.getElementById('reply-composer');
    if (!composer) return;

    composer.scrollIntoView({ behavior: 'smooth', block: 'start' });

    const textarea = composer.querySelector('textarea');
    if (textarea instanceof HTMLTextAreaElement) {
      window.setTimeout(() => textarea.focus(), 250);
    }
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
}
