import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, Validators } from '@angular/forms';
import {
  ForumPost,
  ForumReply,
  ForumUser,
  ForumsMockService
} from '../../forums.mock.service';

@Component({
  selector: 'app-forums-post',
  templateUrl: './forums-post.component.html',
  styleUrls: ['./forums-post.component.css']
})
export class ForumsPostComponent implements OnInit {
  post?: ForumPost;
  similarQuestions: ForumPost[] = [];
  recentDiscussions: ForumPost[] = [];
  commentDraftByReply: Record<number, string> = {};
  collapsedReplyIds = new Set<number>();
  collapsedCommentKeys = new Set<string>();
  usersById: Record<number, ForumUser> = {};
  submittingReply = false;
  replySubmitError = '';

  replyForm = this.fb.group({
    content: ['', [Validators.required, Validators.minLength(12)]]
  });

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private forumsService: ForumsMockService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const postId = Number(params.get('id'));
      if (!postId) {
        this.router.navigate(['/forums']);
        return;
      }

      this.loadPost(postId);
    });
  }

  loadPost(postId: number): void {
    this.forumsService.getPostById(postId).subscribe({
      next: (post) => {
        if (!post) {
          this.router.navigate(['/forums']);
          return;
        }

        this.post = post;
        this.preloadUsers([post]);

        this.forumsService.getPosts().subscribe({
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

  goBack(): void {
    this.router.navigate(['/forums']);
  }

  getUser(userId: number): ForumUser | undefined {
    return this.usersById[userId];
  }

  getBadgeLabel(reputation = 0): string {
    return this.forumsService.getBadgeForReputation(reputation);
  }

  replyScore(reply: ForumReply): number {
    return reply.upvotes - reply.downvotes;
  }

  submitReply(): void {
    if (!this.post) return;
    this.replySubmitError = '';

    if (this.replyForm.invalid) {
      this.replyForm.markAllAsTouched();
      this.replySubmitError = 'Reply must be at least 12 characters.';
      return;
    }

    this.submittingReply = true;
    this.forumsService.addReply(this.post.id, this.replyForm.value.content ?? '', 2).subscribe({
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
    this.forumsService.voteReply(this.post.id, replyId, type).subscribe({
      next: () => this.loadPost(this.post!.id)
    });
  }

  addComment(replyId: number): void {
    if (!this.post) return;

    const content = (this.commentDraftByReply[replyId] || '').trim();
    if (!content) return;

    this.forumsService.addComment(this.post.id, replyId, content, 2).subscribe({
      next: () => {
        this.commentDraftByReply[replyId] = '';
        this.loadPost(this.post!.id);
      }
    });
  }

  markAccepted(replyId: number): void {
    if (!this.post) return;
    this.forumsService.markAcceptedReply(this.post.id, replyId).subscribe({
      next: () => this.loadPost(this.post!.id)
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
    if (!this.post?.replies.length) return;

    const shouldExpandAll = this.post.replies.every((reply) => this.collapsedReplyIds.has(reply.id));

    if (shouldExpandAll) {
      this.collapsedReplyIds.clear();
      return;
    }

    this.post.replies.forEach((reply) => this.collapsedReplyIds.add(reply.id));
  }

  areAllRepliesCollapsed(): boolean {
    if (!this.post?.replies.length) return false;
    return this.post.replies.every((reply) => this.collapsedReplyIds.has(reply.id));
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
    if (!this.post) return 0;
    return this.post.replies.reduce((sum, reply) => sum + (reply.upvotes - reply.downvotes), 0);
  }

  get acceptedCount(): number {
    if (!this.post) return 0;
    return this.post.replies.filter((reply) => reply.isAccepted).length;
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
      post.replies.forEach((reply) => {
        userIds.add(reply.authorId);
        reply.comments.forEach((comment) => userIds.add(comment.authorId));
      });
    });

    [...userIds].forEach((id) => {
      if (this.usersById[id]) {
        return;
      }

      this.forumsService.getUserById(id).subscribe((user) => {
        if (user) {
          this.usersById[id] = user;
        }
      });
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
}
