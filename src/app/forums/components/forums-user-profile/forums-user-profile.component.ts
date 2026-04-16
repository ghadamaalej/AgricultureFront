import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ForumsMockService, ForumUser, ForumPost } from '../../forums.mock.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-forums-user-profile',
  templateUrl: './forums-user-profile.component.html',
  styleUrls: ['./forums-user-profile.component.css']
})
export class ForumsUserProfileComponent implements OnInit, OnDestroy {
  userId: number | null = null;
  userProfile: any;
  userDetails: ForumUser | undefined;
  allPosts: ForumPost[] = [];
  userPosts: ForumPost[] = [];
  userReplyCount: number = 0;
  isLoading = true;
  errorMessage: string | null = null;
  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private forumsService: ForumsMockService
  ) {}

  ngOnInit(): void {
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      this.userId = Number(params['userId']);
      this.loadProfile();
    });
  }

  loadProfile(): void {
    if (!this.userId) {
      this.router.navigate(['/forums']);
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;

    // Load user profile stats
    this.forumsService.getUserProfile(this.userId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (profile) => {
          this.userProfile = profile;
        },
        error: () => {
          this.errorMessage = 'Failed to load user profile';
        }
      });

    // Load user details
    this.forumsService.getUserById(this.userId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (user) => {
          this.userDetails = user;
        }
      });

    // Load all posts and filter by user
    this.forumsService.getPosts()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (posts) => {
          this.allPosts = posts;
          this.userPosts = posts.filter((post) => post.authorId === this.userId);
          this.userReplyCount = posts.reduce((count, post) => {
            return count + post.replies.filter((reply) => reply.authorId === this.userId).length;
          }, 0);
          this.isLoading = false;
        },
        error: () => {
          this.errorMessage = 'Failed to load posts';
          this.isLoading = false;
        }
      });
  }

  viewPost(postId: number): void {
    this.router.navigate(['/forums/post', postId]);
  }

  truncateContent(content: string, length: number = 100): string {
    return content.length > length ? content.substring(0, length) + '...' : content;
  }

  formatDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return dateString;
    }
  }

  goBack(): void {
    this.router.navigate(['/forums']);
  }

  getBadgeColor(): string {
    const tier = (this.userProfile?.badgeTier || '').toString().toUpperCase();

    if (tier === 'ELITE_GROWER') {
      return 'platinum';
    }

    if (tier === 'TRUSTED_CONTRIBUTOR') {
      return 'gold';
    }

    if (tier === 'RISING_MEMBER') {
      return 'silver';
    }

    return 'bronze';
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
