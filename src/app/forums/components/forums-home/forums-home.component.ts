import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Router } from '@angular/router';
import { forkJoin, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { AuthService } from 'src/app/services/auth/auth.service';
import { ForumGroup, ForumPost, ForumReply, ForumUser, ForumsMockService } from '../../forums.mock.service';

interface ForumContributor {
  userId: number;
  name: string;
  reputation: number;
  contributions: number;
  photo?: string | null;
}

interface DuplicateCandidate {
  id: number;
  title: string;
  score: number;
  replies: number;
  views: number;
  reason?: string;
}

interface QualityCheckItem {
  key: string;
  label: string;
  passed: boolean;
}

@Component({
  selector: 'app-forums-home',
  templateUrl: './forums-home.component.html',
  styleUrls: ['./forums-home.component.css']
})
export class ForumsHomeComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private static readonly AI_AUTHOR_ID = -100;
  private routeGroupId: number | null = null;
  private aiRedirectTimerId: number | null = null;
  posts: ForumPost[] = [];
  showComposer = false;
  showAuthPrompt = false;
  authPromptAction = 'continue';
  usersById: Record<number, ForumUser> = {};
  creatingPost = false;
  postSubmitError = '';
  moderationNotice = '';
  currentUserId: number | null = null;
  globalSortBy: string = 'newest';
  globalSortDirection: string = 'desc';
  sortBy: string = 'newest';
  sortDirection: string = 'desc';
  groupSortPreferences: Record<number, { sortBy: string; sortDirection: string }> = {};
  searchTerm: string = '';
  selectedTags: Set<string> = new Set();
  allTags: string[] = ['irrigation', 'fertilizer', 'pest', 'disease', 'wheat', 'beans', 'harvest', 'soil', 'vegetables'];
  trendingTags: { tag: string; count: number; icon: string }[] = [];
  composerTags: Set<string> = new Set();
  tagInput: string = '';
  tagSuggestions: string[] = [];
  showTagSuggestions = false;
  groups: ForumGroup[] = [];
  activeGroup: ForumGroup | null = null;
  selectedGroupId: number | null = null;
  activeGroupRules: string[] = [];
  activeGroupMembers: ForumUser[] = [];
  activeGroupModerators: ForumUser[] = [];
  groupSidebarLoading = false;
  showGroupComposer = false;
  creatingGroup = false;
  groupSubmitError = '';
  aiCreateNotice = '';
  aiCreateInProgress = false;
  aiTagSuggestions: string[] = [];
  aiTagSuggestNotice = '';
  aiTagSuggestError = '';
  suggestingTags = false;
  duplicatePostCandidates: DuplicateCandidate[] = [];
  duplicateScanInProgress = false;
  private duplicateSuggestionRequestId = 0;
  qualityChecklist: QualityCheckItem[] = [];
  qualityReadinessScore = 0;
  qualityNotice = '';
  postMediaUrls: string[] = [];
  postMediaLinkInput = '';
  moderatingMediaPostIds = new Set<number>();

  // Tag categorization with icons and colors
  private tagCategories: Record<string, { icon: string; category: string; color: string }> = {
    'irrigation': { icon: '💧', category: 'water', color: 'cyan' },
    'fertilizer': { icon: '🌱', category: 'soil', color: 'brown' },
    'pest': { icon: '🐛', category: 'disease', color: 'orange' },
    'disease': { icon: '🦠', category: 'disease', color: 'orange' },
    'wheat': { icon: '🌾', category: 'crop', color: 'green' },
    'beans': { icon: '🫘', category: 'crop', color: 'green' },
    'harvest': { icon: '✂️', category: 'crop', color: 'green' },
    'soil': { icon: '🌍', category: 'soil', color: 'brown' },
    'vegetables': { icon: '🥬', category: 'crop', color: 'green' }
  };

  postForm = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(12)]],
    content: ['', [Validators.required, Validators.minLength(30)]],
    tags: ['', [Validators.required]],
    generateAiReply: [true]
  });

  groupForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(4)]],
    description: ['', [Validators.required, Validators.minLength(14)]],
    focusTags: ['', [Validators.required]]
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
    this.route.paramMap
      .pipe(takeUntil(this.destroy$))
      .subscribe((params) => {
        const groupIdParam = params.get('groupId');
        const parsedGroupId = groupIdParam == null ? null : Number(groupIdParam);
        this.routeGroupId = parsedGroupId != null && !Number.isNaN(parsedGroupId) ? parsedGroupId : null;
        this.syncGroupContextFromRoute();
        this.refreshPosts();
      });

    this.loadGroups();

    this.postForm.valueChanges
      .pipe(
        debounceTime(250),
        distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
        takeUntil(this.destroy$)
      )
      .subscribe(() => this.analyzeComposerDraft());
  }

  loadGroups(): void {
    this.forumsService
      .getGroups(this.currentUserId ?? undefined)
      .pipe(takeUntil(this.destroy$))
      .subscribe((groups) => {
        this.groups = groups;
        this.syncGroupContextFromRoute();
      });
  }

  refreshPosts(): void {
    console.log('[ForumsHome] refreshPosts called with sortBy:', this.sortBy, 'searchTerm:', this.searchTerm, 'selectedTags:', Array.from(this.selectedTags));
    this.forumsService.getPosts(
      this.currentUserId ?? undefined,
      this.sortBy,
      this.sortDirection,
      this.searchTerm,
      Array.from(this.selectedTags),
      this.selectedGroupId ?? undefined
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (posts) => {
          console.log('[ForumsHome] Received posts:', posts.length);
          this.posts = posts;
          this.preloadUsers(posts);
          this.calculateTrendingTags();
        },
        error: (err) => {
          console.error('[ForumsHome] Error loading posts:', err);
          this.posts = [];
        }
      });
  }

  changeGroupFilter(groupId: number | null): void {
    if (groupId == null) {
      this.router.navigate(['/forums']);
      return;
    }

    this.router.navigate(['/forums/group', groupId]);
  }

  openGroupSpace(groupId: number): void {
    this.router.navigate(['/forums/group', groupId]);
  }

  toggleGroupComposer(): void {
    if (!this.showGroupComposer && !this.ensureAuthenticated('create a group')) {
      return;
    }

    this.groupSubmitError = '';
    this.showGroupComposer = !this.showGroupComposer;
  }

  createGroup(): void {
    this.groupSubmitError = '';

    if (!this.ensureAuthenticated('create a group')) {
      return;
    }

    if (this.groupForm.invalid) {
      this.groupForm.markAllAsTouched();
      this.groupSubmitError = 'Please provide a valid group name, description, and at least one focus tag.';
      return;
    }

    const rawTags = this.groupForm.value.focusTags ?? '';
    const focusTags = rawTags
      .split(',')
      .map((tag) => tag.trim().toLowerCase())
      .filter((tag) => !!tag)
      .slice(0, 6);

    if (focusTags.length === 0) {
      this.groupSubmitError = 'Add at least one focus tag.';
      return;
    }

    this.creatingGroup = true;
    this.forumsService
      .createGroup({
        name: this.groupForm.value.name ?? '',
        description: this.groupForm.value.description ?? '',
        focusTags
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (newGroup) => {
          this.creatingGroup = false;
          this.showGroupComposer = false;
          this.groupForm.reset();
          this.openGroupSpace(newGroup.id);
          this.loadGroups();
        },
        error: () => {
          this.creatingGroup = false;
          this.groupSubmitError = 'Could not create group right now. Please try again.';
        }
      });
  }

  joinGroup(groupId: number): void {
    if (!this.ensureAuthenticated('join a group')) {
      return;
    }

    this.forumsService
      .joinGroup(groupId)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.loadGroups());
  }

  leaveGroup(groupId: number): void {
    this.forumsService
      .leaveGroup(groupId)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.selectedGroupId === groupId) {
          this.router.navigate(['/forums']);
        }
        this.loadGroups();
      });
  }

  isGroupSelected(groupId: number): boolean {
    return this.selectedGroupId === groupId;
  }

  getSelectedGroupName(): string {
    if (this.selectedGroupId == null) {
      return 'All groups';
    }

    return this.groups.find((group) => group.id === this.selectedGroupId)?.name ?? 'Selected group';
  }

  isGroupSpaceView(): boolean {
    return this.selectedGroupId != null;
  }

  changeSortBy(newSort: string): void {
    this.sortBy = newSort;
    if (this.selectedGroupId != null) {
      const current = this.groupSortPreferences[this.selectedGroupId] ?? { sortBy: 'newest', sortDirection: 'desc' };
      this.groupSortPreferences[this.selectedGroupId] = {
        ...current,
        sortBy: newSort
      };
    } else {
      this.globalSortBy = newSort;
    }
    this.refreshPosts();
  }

  onSearchChange(term: string): void {
    this.searchTerm = term;
    this.refreshPosts();
  }

  toggleTag(tag: string): void {
    if (this.selectedTags.has(tag)) {
      this.selectedTags.delete(tag);
    } else {
      this.selectedTags.add(tag);
    }
    this.refreshPosts();
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.selectedTags.clear();
    this.changeSortBy('newest');
    if (this.selectedGroupId != null) {
      const current = this.groupSortPreferences[this.selectedGroupId] ?? { sortBy: 'newest', sortDirection: 'desc' };
      current.sortDirection = 'desc';
      this.groupSortPreferences[this.selectedGroupId] = current;
      this.sortDirection = current.sortDirection;
    } else {
      this.globalSortDirection = 'desc';
      this.sortDirection = this.globalSortDirection;
    }
    this.refreshPosts();
  }

  getTagInfo(tag: string): { icon: string; category: string; color: string } {
    return this.tagCategories[tag.toLowerCase()] || { icon: '🏷️', category: 'general', color: 'gray' };
  }

  getTagIcon(tag: string): string {
    return this.getTagInfo(tag).icon;
  }

  getTagCategory(tag: string): string {
    return this.getTagInfo(tag).category;
  }

  getTagColorClass(tag: string): string {
    const colorMap: Record<string, string> = {
      'cyan': 'tag-cyan',
      'brown': 'tag-brown',
      'orange': 'tag-orange',
      'green': 'tag-green',
      'gray': 'tag-gray'
    };
    return colorMap[this.getTagInfo(tag).color] || 'tag-gray';
  }

  calculateTrendingTags(): void {
    const tagFrequency: Record<string, number> = {};
    
    // Count tag frequencies from all posts
    this.posts.forEach(post => {
      post.tags.forEach(tag => {
        tagFrequency[tag] = (tagFrequency[tag] || 0) + 1;
      });
    });

    // Convert to array and sort by frequency
    this.trendingTags = Object.entries(tagFrequency)
      .map(([tag, count]) => ({
        tag,
        count,
        icon: this.getTagIcon(tag)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8); // Top 8 trending tags
  }

  onTagInputChange(value: string): void {
    this.tagInput = value;
    this.showTagSuggestions = value.trim().length > 0;
    
    if (this.showTagSuggestions) {
      const lowerValue = value.toLowerCase();
      this.tagSuggestions = this.allTags
        .filter(tag => 
          tag.toLowerCase().includes(lowerValue) && 
          !this.composerTags.has(tag)
        );
    } else {
      this.tagSuggestions = [];
    }
  }

  selectTagSuggestion(tag: string): void {
    this.addComposerTag(tag);
    this.tagInput = '';
    this.tagSuggestions = [];
    this.showTagSuggestions = false;
  }

  addComposerTag(tag: string): void {
    if (!this.composerTags.has(tag)) {
      this.composerTags.add(tag);
      this.updatePostFormTags();
    }
  }

  removeComposerTag(tag: string): void {
    this.composerTags.delete(tag);
    this.updatePostFormTags();
  }

  formatPostContent(textarea: HTMLTextAreaElement, openTag: string, closeTag: string): void {
    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;
    const value = textarea.value ?? '';
    const selected = value.substring(start, end);
    const replacement = `${openTag}${selected}${closeTag}`;
    const updated = `${value.substring(0, start)}${replacement}${value.substring(end)}`;
    this.postForm.patchValue({ content: updated });
    textarea.focus();
  }

  onPostMediaSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    if (files.length === 0) {
      return;
    }

    files.slice(0, 4).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        if (result && !this.postMediaUrls.includes(result) && this.postMediaUrls.length < 6) {
          this.postMediaUrls.push(result);
        }
      };
      reader.readAsDataURL(file);
    });

    input.value = '';
  }

  addPostMediaLink(): void {
    const link = (this.postMediaLinkInput ?? '').trim();
    if (!link || !(link.startsWith('https://') || link.startsWith('http://'))) {
      return;
    }

    if (!this.postMediaUrls.includes(link) && this.postMediaUrls.length < 6) {
      this.postMediaUrls.push(link);
    }
    this.postMediaLinkInput = '';
  }

  removePostMedia(index: number): void {
    this.postMediaUrls.splice(index, 1);
  }

  isVideoMedia(url: string): boolean {
    const lower = (url ?? '').toLowerCase();
    return lower.startsWith('data:video/') || /(\.mp4|\.webm|\.mov|youtube\.com|youtu\.be|vimeo\.com)/.test(lower);
  }

  isImageMedia(url: string): boolean {
    const lower = (url ?? '').toLowerCase();
    return lower.startsWith('data:image/') || /(\.png|\.jpg|\.jpeg|\.gif|\.webp|tenor\.com|giphy\.com)/.test(lower);
  }

  stripHtml(value: string): string {
    return (value ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  commitTypedTag(event?: Event): void {
    if (event) {
      event.preventDefault();
    }

    const typedTag = (this.tagInput ?? '').trim().toLowerCase();
    if (!typedTag) {
      this.showTagSuggestions = false;
      this.tagSuggestions = [];
      return;
    }

    this.addComposerTag(typedTag);
    this.tagInput = '';
    this.tagSuggestions = [];
    this.showTagSuggestions = false;
  }

  private updatePostFormTags(): void {
    const tagsArray = Array.from(this.composerTags);
    this.postForm.patchValue({
      tags: tagsArray.length > 0 ? tagsArray.join(', ') : ''
    });
  }

  hasActiveFilters(): boolean {
    return this.searchTerm.trim().length > 0 || this.selectedTags.size > 0;
  }

  openPost(postId: number): void {
    if (this.selectedGroupId != null) {
      this.router.navigate(['/forums/group', this.selectedGroupId, 'post', postId]);
      return;
    }

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
      this.aiCreateNotice = '';
      this.aiCreateInProgress = false;
      this.aiTagSuggestions = [];
      this.aiTagSuggestNotice = '';
      this.aiTagSuggestError = '';
      this.duplicatePostCandidates = [];
      this.qualityChecklist = [];
      this.qualityReadinessScore = 0;
      this.qualityNotice = '';
      this.postMediaUrls = [];
      this.postMediaLinkInput = '';
      return;
    }

    if (!this.ensureAuthenticated('ask a question')) {
      return;
    }

    this.showComposer = true;
    this.aiCreateNotice = '';
    this.aiCreateInProgress = false;
    this.aiTagSuggestions = [];
    this.aiTagSuggestNotice = '';
    this.aiTagSuggestError = '';
    this.duplicatePostCandidates = [];
    this.qualityChecklist = [];
    this.qualityReadinessScore = 0;
    this.qualityNotice = '';
    this.postMediaUrls = [];
    this.postMediaLinkInput = '';
  }

  createPost(): void {
    this.postSubmitError = '';
    this.aiCreateNotice = '';
    this.aiCreateInProgress = false;

    this.commitTypedTag();

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
    const baseTags = tagsInput
      .split(',')
      .map((item) => item.trim())
      .filter((item) => !!item)
      .slice(0, 5);

    const selectedGroup = this.groups.find((group) => group.id === this.selectedGroupId);
    const mergedTags = [
      ...baseTags,
      ...(selectedGroup?.focusTags ?? [])
    ]
      .map((tag) => tag.trim())
      .filter((tag, index, arr) => !!tag && arr.indexOf(tag) === index)
      .slice(0, 5);

    const tags = mergedTags;

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
        mediaUrls: this.postMediaUrls,
        groupId: this.selectedGroupId,
        authorId: currentUserId,
        generateAiReply: shouldGenerateAiReply
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (createdPost) => {
          if (shouldGenerateAiReply && createdPost?.id) {
            this.creatingPost = false;
            const targetGroupName = this.selectedGroupId == null
              ? null
              : this.groups.find((group) => group.id === this.selectedGroupId)?.name ?? null;
            this.aiCreateNotice = targetGroupName
              ? `Published. AI insight will be tuned to ${targetGroupName} community context.`
              : 'Published. AI insight is being generated now.';
            this.aiCreateInProgress = true;
            const target = this.selectedGroupId != null
              ? ['/forums/group', this.selectedGroupId, 'post', createdPost.id]
              : ['/forums/post', createdPost.id];

            if (this.aiRedirectTimerId != null) {
              window.clearTimeout(this.aiRedirectTimerId);
            }

            this.aiRedirectTimerId = window.setTimeout(() => {
              this.postForm.reset({ generateAiReply: true });
              this.composerTags.clear();
              this.tagInput = '';
              this.tagSuggestions = [];
              this.showTagSuggestions = false;
              this.postMediaUrls = [];
              this.postMediaLinkInput = '';
              this.showComposer = false;
              this.aiCreateNotice = '';
              this.aiCreateInProgress = false;
              this.router.navigate(target, {
                queryParams: { awaitAi: '1' }
              });
            }, 1000);
            return;
          }

          this.creatingPost = false;
          this.postForm.reset({ generateAiReply: true });
          this.composerTags.clear();
          this.tagInput = '';
          this.tagSuggestions = [];
          this.showTagSuggestions = false;
          this.aiTagSuggestions = [];
          this.aiTagSuggestNotice = '';
          this.aiTagSuggestError = '';
          this.duplicatePostCandidates = [];
          this.qualityChecklist = [];
          this.qualityReadinessScore = 0;
          this.qualityNotice = '';
          this.postMediaUrls = [];
          this.postMediaLinkInput = '';
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

  suggestTagsWithAi(): void {
    this.aiTagSuggestError = '';
    this.aiTagSuggestNotice = '';

    const title = (this.postForm.value.title ?? '').trim();
    const content = (this.postForm.value.content ?? '').trim();

    if (title.length < 8 || content.length < 20) {
      this.aiTagSuggestError = 'Add a clearer title and more details first, then ask AI for tags.';
      return;
    }

    this.suggestingTags = true;
    this.forumsService.getAiTagSuggestions({
      title,
      content,
      tags: Array.from(this.composerTags),
      groupId: this.selectedGroupId
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (suggestions) => {
          this.suggestingTags = false;

          const deduped = suggestions
            .map((tag) => tag.trim().toLowerCase())
            .filter((tag, index, arr) => !!tag && arr.indexOf(tag) === index)
            .filter((tag) => !this.composerTags.has(tag))
            .slice(0, 5);

          this.aiTagSuggestions = deduped;
          if (deduped.length === 0) {
            this.aiTagSuggestNotice = 'AI did not find new tags beyond your current selection.';
          } else {
            this.aiTagSuggestNotice = `AI suggested ${deduped.length} tag${deduped.length > 1 ? 's' : ''}.`;
          }
        },
        error: () => {
          this.suggestingTags = false;
          this.aiTagSuggestError = 'Could not generate AI tags right now. Please try again.';
        }
      });
  }

  applyAiTag(tag: string): void {
    this.addComposerTag(tag);
    this.aiTagSuggestions = this.aiTagSuggestions.filter((item) => item !== tag);
  }

  applyAllAiTags(): void {
    this.aiTagSuggestions.forEach((tag) => this.addComposerTag(tag));
    this.aiTagSuggestions = [];
  }

  openDuplicateCandidate(postId: number): void {
    this.openPost(postId);
  }

  getDuplicateConfidenceLabel(score: number): string {
    if (score >= 80) {
      return 'High confidence';
    }

    if (score >= 60) {
      return 'Medium confidence';
    }

    return 'Low confidence';
  }

  getDuplicateConfidenceClass(score: number): string {
    if (score >= 80) {
      return 'confidence-high';
    }

    if (score >= 60) {
      return 'confidence-medium';
    }

    return 'confidence-low';
  }

  private analyzeComposerDraft(): void {
    if (!this.showComposer) {
      return;
    }

    const title = (this.postForm.value.title ?? '').trim();
    const content = this.stripHtml((this.postForm.value.content ?? '').trim());
    const tags = Array.from(this.composerTags);

    const quality = this.computeQualityChecklist(title, content, tags);
    this.qualityChecklist = quality.items;
    this.qualityReadinessScore = quality.score;
    this.qualityNotice = quality.notice;

    this.requestDuplicateSuggestions(title, content, tags);
  }

  private requestDuplicateSuggestions(title: string, content: string, tags: string[]): void {
    const draftText = `${title} ${content}`.trim();
    if (draftText.length < 18 || this.isUnsafeOrOffTopicDraft(draftText)) {
      this.duplicateScanInProgress = false;
      this.duplicatePostCandidates = [];
      return;
    }

    const requestId = ++this.duplicateSuggestionRequestId;
    this.duplicateScanInProgress = true;

    this.forumsService.getAiDuplicateSuggestions({
      title,
      content,
      tags,
      groupId: this.selectedGroupId
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (candidates) => {
          if (requestId !== this.duplicateSuggestionRequestId) {
            return;
          }

          this.duplicatePostCandidates = candidates
            .map((candidate) => ({
              id: candidate.id,
              title: candidate.title,
              score: candidate.score,
              replies: candidate.replies,
              views: candidate.views,
              reason: candidate.reason
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 4);
          this.duplicateScanInProgress = false;

          if (this.duplicatePostCandidates.length === 0) {
            this.duplicatePostCandidates = this.computeDuplicateCandidates(title, content, tags).map((candidate) => ({
              ...candidate,
              reason: 'Local fallback match'
            }));
          }
        },
        error: () => {
          if (requestId !== this.duplicateSuggestionRequestId) {
            return;
          }

          this.duplicatePostCandidates = this.computeDuplicateCandidates(title, content, tags).map((candidate) => ({
            ...candidate,
            reason: 'Local fallback match'
          }));
          this.duplicateScanInProgress = false;
        }
      });
  }

  private computeDuplicateCandidates(title: string, content: string, tags: string[]): DuplicateCandidate[] {
    const draftText = `${title} ${content}`.toLowerCase();
    if (draftText.trim().length < 18 || this.isUnsafeOrOffTopicDraft(draftText)) {
      return [];
    }

    const draftTokens = this.tokenizeText(draftText);
    const draftTags = new Set(tags.map((tag) => tag.toLowerCase()));

    return this.posts
      .map((post) => {
        const postText = `${post.title} ${post.content}`.toLowerCase();
        const postTokens = this.tokenizeText(postText);

        const sharedTokenCount = [...draftTokens].filter((token) => postTokens.has(token)).length;
        const tokenUnionSize = new Set([...draftTokens, ...postTokens]).size || 1;
        const tokenSimilarity = sharedTokenCount / tokenUnionSize;

        const postTagSet = new Set((post.tags ?? []).map((tag) => tag.toLowerCase()));
        const sharedTagCount = [...draftTags].filter((tag) => postTagSet.has(tag)).length;
        const tagSimilarity = draftTags.size === 0 ? 0 : sharedTagCount / draftTags.size;

        const titleBoost = title.length > 0 && post.title.toLowerCase().includes(title.toLowerCase().slice(0, Math.min(20, title.length)))
          ? 0.2
          : 0;

        const rawScore = tokenSimilarity * 0.6 + tagSimilarity * 0.3 + titleBoost;
        const score = Math.min(100, Math.round(rawScore * 100));

        return {
          id: post.id,
          title: post.title,
          score,
          replies: post.replies.length,
          views: post.views
        };
      })
      .filter((candidate) => candidate.score >= 35)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);
  }

  private isUnsafeOrOffTopicDraft(text: string): boolean {
    const lower = (text ?? '').toLowerCase();
    const harmfulTerms = ['hate', 'hateful', 'racist', 'sexist', 'harass', 'abuse', 'violent', 'threat', 'kill', 'die', 'attack'];
    const offTopicTerms = ['javascript', 'python', 'react', 'angular', 'movie', 'restaurant', 'cake', 'pizza', 'burger'];

    return harmfulTerms.some((term) => lower.includes(term)) || offTopicTerms.some((term) => lower.includes(term));
  }

  private tokenizeText(text: string): Set<string> {
    const tokens = text
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 4);
    return new Set(tokens);
  }

  private computeQualityChecklist(title: string, content: string, tags: string[]): { items: QualityCheckItem[]; score: number; notice: string } {
    const lower = `${title} ${content}`.toLowerCase();
    const checks: QualityCheckItem[] = [
      { key: 'crop', label: 'Mentions crop or livestock target', passed: /(wheat|barley|olive|date|bean|corn|tomato|pepper|cow|sheep|goat|chicken)/.test(lower) },
      { key: 'region', label: 'Mentions location or climate context', passed: /(region|area|village|tunisia|beja|sfax|north|south|coastal|rainfed)/.test(lower) },
      { key: 'season', label: 'Mentions season or timing', passed: /(season|spring|summer|autumn|winter|month|week|days|timing)/.test(lower) },
      { key: 'symptoms', label: 'Describes symptoms or observed problem', passed: /(symptom|yellow|spots|wilting|rot|mold|fung|pest|damage|decline)/.test(lower) },
      { key: 'attempted', label: 'Mentions what was already tried', passed: /(tried|attempted|already|applied|used|tested|did)/.test(lower) },
      { key: 'tags', label: 'Has at least 2 relevant tags', passed: tags.length >= 2 }
    ];

    const passed = checks.filter((item) => item.passed).length;
    const score = Math.round((passed / checks.length) * 100);

    let notice = 'Good structure. You can publish.';
    if (score < 50) {
      notice = 'Low clarity: add more practical details before publishing.';
    } else if (score < 75) {
      notice = 'Decent draft: a bit more context will improve answer quality.';
    }

    return { items: checks, score, notice };
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

  canReviewPostMedia(post: ForumPost): boolean {
    return this.isCurrentUserAdmin() && !!post.mediaPendingReview;
  }

  isModeratingPostMedia(postId: number): boolean {
    return this.moderatingMediaPostIds.has(postId);
  }

  approvePostMedia(post: ForumPost, event?: Event): void {
    event?.stopPropagation();
    if (!this.canReviewPostMedia(post)) {
      return;
    }

    this.moderationNotice = '';
    this.moderatingMediaPostIds.add(post.id);
    this.forumsService.approvePostMedia(post.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.moderatingMediaPostIds.delete(post.id);
          this.moderationNotice = 'Post media approved and now visible to all users.';
          this.refreshPosts();
        },
        error: (err) => {
          this.moderatingMediaPostIds.delete(post.id);
          this.moderationNotice = err?.error?.error || 'Could not approve media right now.';
        }
      });
  }

  rejectPostMedia(post: ForumPost, event?: Event): void {
    event?.stopPropagation();
    if (!this.canReviewPostMedia(post)) {
      return;
    }

    this.moderationNotice = '';
    this.moderatingMediaPostIds.add(post.id);
    this.forumsService.rejectPostMedia(post.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.moderatingMediaPostIds.delete(post.id);
          this.moderationNotice = 'Post media rejected and removed.';
          this.refreshPosts();
        },
        error: (err) => {
          this.moderatingMediaPostIds.delete(post.id);
          this.moderationNotice = err?.error?.error || 'Could not reject media right now.';
        }
      });
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
    if (this.aiRedirectTimerId != null) {
      window.clearTimeout(this.aiRedirectTimerId);
      this.aiRedirectTimerId = null;
    }
    this.aiCreateInProgress = false;
    this.destroy$.next();
    this.destroy$.complete();
  }

  private getHumanReplies(post: ForumPost): ForumReply[] {
    return (post.replies || []).filter((reply) => !this.isAiReply(reply));
  }

  private isAiReply(reply: ForumReply): boolean {
    return reply.authorId === ForumsHomeComponent.AI_AUTHOR_ID;
  }

  private syncGroupContextFromRoute(): void {
    if (this.routeGroupId == null) {
      this.selectedGroupId = null;
      this.activeGroup = null;
      this.activeGroupRules = [];
      this.activeGroupMembers = [];
      this.activeGroupModerators = [];
      this.sortBy = this.globalSortBy;
      this.sortDirection = this.globalSortDirection;
      return;
    }

    this.selectedGroupId = this.routeGroupId;
    this.activeGroup = this.groups.find((group) => group.id === this.routeGroupId) ?? null;
    const groupSort = this.groupSortPreferences[this.routeGroupId] ?? { sortBy: 'newest', sortDirection: 'desc' };
    this.sortBy = groupSort.sortBy;
    this.sortDirection = groupSort.sortDirection;
    this.loadActiveGroupSidebar();
  }

  private loadActiveGroupSidebar(): void {
    if (this.selectedGroupId == null) {
      this.activeGroupRules = [];
      this.activeGroupMembers = [];
      this.activeGroupModerators = [];
      return;
    }

    this.groupSidebarLoading = true;
    this.forumsService
      .getGroupById(this.selectedGroupId, this.currentUserId ?? undefined)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (group) => {
          this.activeGroup = group;
          this.activeGroupRules = group.rules ?? [];

          const memberIds = group.memberIds ?? [];
          const moderatorIds = group.moderatorIds ?? [];
          const uniqueUserIds = Array.from(new Set([...memberIds, ...moderatorIds]));

          if (uniqueUserIds.length === 0) {
            this.activeGroupMembers = [];
            this.activeGroupModerators = [];
            this.groupSidebarLoading = false;
            return;
          }

          const requests = uniqueUserIds.map((userId) => this.forumsService.getUserById(userId));
          forkJoin(requests)
            .pipe(takeUntil(this.destroy$))
            .subscribe((users) => {
              const usersById: Record<number, ForumUser> = {};
              users.forEach((user) => {
                if (!user) {
                  return;
                }
                usersById[user.id] = user;
              });

              this.activeGroupMembers = memberIds
                .map((id) => usersById[id])
                .filter((user): user is ForumUser => !!user)
                .slice(0, 8);

              this.activeGroupModerators = moderatorIds
                .map((id) => usersById[id])
                .filter((user): user is ForumUser => !!user);

              this.groupSidebarLoading = false;
            });
        },
        error: () => {
          this.groupSidebarLoading = false;
        }
      });
  }
}
