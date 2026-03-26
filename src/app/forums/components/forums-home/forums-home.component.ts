import { Component, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ForumPost, ForumUser, ForumsMockService } from '../../forums.mock.service';

interface ForumContributor {
  userId: number;
  name: string;
  reputation: number;
  contributions: number;
}

@Component({
  selector: 'app-forums-home',
  templateUrl: './forums-home.component.html',
  styleUrls: ['./forums-home.component.css']
})
export class ForumsHomeComponent implements OnInit {
  posts: ForumPost[] = [];
  showComposer = false;
  usersById: Record<number, ForumUser> = {};
  creatingPost = false;
  postSubmitError = '';

  postForm = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(12)]],
    content: ['', [Validators.required, Validators.minLength(30)]],
    tags: ['', [Validators.required]]
  });

  constructor(
    private fb: FormBuilder,
    private forumsService: ForumsMockService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.refreshPosts();
  }

  refreshPosts(): void {
    this.forumsService.getPosts().subscribe({
      next: (posts) => {
        this.posts = posts;
        this.preloadUsers(posts);
      },
      error: () => {
        this.posts = [];
      }
    });
  }

  openPost(postId: number): void {
    this.router.navigate(['/forums/post', postId]);
  }

  createPost(): void {
    this.postSubmitError = '';

    if (this.postForm.invalid) {
      this.postForm.markAllAsTouched();
      this.postSubmitError = 'Please fill all fields with valid lengths before publishing.';
      return;
    }

    const tagsInput = this.postForm.value.tags ?? '';
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
        authorId: 2
      })
      .subscribe({
        next: () => {
          this.creatingPost = false;
          this.postForm.reset();
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

  getUser(authorId: number): ForumUser | undefined {
    return this.usersById[authorId];
  }

  getBadgeLabel(reputation = 0): string {
    return this.forumsService.getBadgeForReputation(reputation);
  }

  answerCount(post: ForumPost): number {
    return post.replies.length;
  }

  isSolved(post: ForumPost): boolean {
    return post.replies.some((reply) => reply.isAccepted);
  }

  score(post: ForumPost): number {
    return post.replies.reduce((total, reply) => total + reply.upvotes - reply.downvotes, 0);
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
    return this.posts.reduce((sum, post) => sum + post.replies.length, 0);
  }

  get totalViews(): number {
    return this.posts.reduce((sum, post) => sum + post.views, 0);
  }

  get unansweredCount(): number {
    return this.posts.filter((post) => post.replies.length === 0).length;
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

      post.replies.forEach((reply) => {
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
          contributions
        };
      })
      .sort((a, b) => b.contributions - a.contributions)
      .slice(0, 4);
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
}
