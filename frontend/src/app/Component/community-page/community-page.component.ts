import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { CommunityPost, CommunityTopic } from '../../model/community.model';
import { CommunityService } from '../../service/community.service';
import { SessionUser, UserSessionService } from '../../service/user-session.service';
import { NotificationService } from '../../service/notification.service';
import { TranslationService } from '../../service/translation.service';

@Component({
  selector: 'app-community-page',
  templateUrl: './community-page.component.html',
  styleUrl: './community-page.component.css'
})
export class CommunityPageComponent implements OnInit, OnDestroy {
  allPosts: CommunityPost[] = [];
  currentUser: SessionUser | null = null;

  activeBoard: 'all' | CommunityTopic | 'moderation' = 'all';
  sortBy: 'latest' | 'popular' = 'latest';
  searchQuery: string = '';

  showComposer = false;
  newTitle = '';
  newTopic: CommunityTopic = 'Routes';
  newRouteTag = '';
  newContent = '';
  newTipsInput = '';
  newPhotoUrl = '';

  expandedComments: { [postId: string]: boolean } = {};
  commentDrafts: { [postId: string]: string } = {};
  reportingPostId: string | null = null;
  reportReasonKey: string = 'inappropriate';

  readonly topics: CommunityTopic[] = ['Routes', 'Destinations', 'Travel Advice'];

  private userSub?: Subscription;

  constructor(
    private communityService: CommunityService,
    private userSession: UserSessionService,
    private notificationService: NotificationService,
    public translationService: TranslationService
  ) {}

  ngOnInit(): void {
    this.userSub = this.userSession.currentUser$.subscribe((user) => {
      this.currentUser = user;
    });
    this.loadPosts();
  }

  ngOnDestroy(): void {
    this.userSub?.unsubscribe();
  }

  loadPosts(): void {
    this.communityService.getPosts(true).subscribe((posts) => {
      this.allPosts = posts;
    });
  }

  get trendingPosts(): CommunityPost[] {
    return this.communityService.getTrendingPosts(this.allPosts, 3);
  }

  get moderationPosts(): CommunityPost[] {
    return this.allPosts.filter((p) => p.status === 'flagged' || p.status === 'hidden');
  }

  get visiblePosts(): CommunityPost[] {
    let list = this.allPosts.filter((p) => p.status !== 'hidden');

    if (this.activeBoard !== 'all' && this.activeBoard !== 'moderation') {
      list = list.filter((p) => p.topic === this.activeBoard);
    }

    const q = this.searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.content.toLowerCase().includes(q) ||
          (p.routeTag || '').toLowerCase().includes(q) ||
          p.travelTips.some((t) => t.toLowerCase().includes(q))
      );
    }

    if (this.sortBy === 'popular') {
      return list
        .slice()
        .sort((a, b) => b.likes.length * 2 + b.comments.length - (a.likes.length * 2 + a.comments.length));
    }
    return list;
  }

  signInDemo(): void {
    const user = this.userSession.loginAsDemoTraveler();
    this.notificationService.show('notifications.demoSignedIn', 'success', { name: user.name });
  }

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        this.newPhotoUrl = reader.result;
      }
    };
    reader.readAsDataURL(file);
  }

  publishStory(): void {
    if (!this.currentUser || !this.userSession.isVerified) {
      this.notificationService.show('notifications.signInRequired', 'warning');
      return;
    }
    if (!this.newTitle.trim() || this.newContent.trim().length < 15) {
      this.notificationService.show('notifications.postValidation', 'warning');
      return;
    }

    const tips = this.newTipsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    this.communityService
      .createPost({
        authorId: this.currentUser._id,
        authorName: this.currentUser.name,
        authorEmail: this.currentUser.email,
        authorVerified: true,
        title: this.newTitle.trim(),
        content: this.newContent.trim(),
        topic: this.newTopic,
        routeTag: this.newRouteTag.trim(),
        travelTips: tips,
        photoUrl: this.newPhotoUrl.trim()
      })
      .subscribe((created) => {
        this.allPosts = [created, ...this.allPosts.filter((p) => p._id !== created._id)];
        this.newTitle = '';
        this.newContent = '';
        this.newRouteTag = '';
        this.newTipsInput = '';
        this.newPhotoUrl = '';
        this.showComposer = false;
        this.activeBoard = 'all';
        this.notificationService.show('notifications.postPublished', 'success');
      });
  }

  hasLiked(post: CommunityPost): boolean {
    return !!this.currentUser && post.likes.includes(this.currentUser._id);
  }

  toggleLike(post: CommunityPost): void {
    if (!this.currentUser) {
      this.notificationService.show('notifications.signInRequired', 'warning');
      return;
    }
    this.communityService.toggleLike(post._id, this.currentUser._id).subscribe((updated) => {
      if (updated) {
        this.replacePost(updated);
      }
    });
  }

  toggleComments(postId: string): void {
    this.expandedComments[postId] = !this.expandedComments[postId];
  }

  addComment(post: CommunityPost): void {
    if (!this.currentUser) {
      this.notificationService.show('notifications.signInRequired', 'warning');
      return;
    }
    const text = (this.commentDrafts[post._id] || '').trim();
    if (!text) {
      this.notificationService.show('notifications.commentEmpty', 'warning');
      return;
    }
    this.communityService
      .addComment(post._id, {
        userId: this.currentUser._id,
        userName: this.currentUser.name,
        text
      })
      .subscribe((updated) => {
        if (updated) {
          this.replacePost(updated);
          this.commentDrafts[post._id] = '';
          this.expandedComments[post._id] = true;
          this.notificationService.show('notifications.commentAdded', 'success', undefined, 2200);
        }
      });
  }

  openReport(postId: string): void {
    this.reportingPostId = this.reportingPostId === postId ? null : postId;
    this.reportReasonKey = 'inappropriate';
  }

  submitReport(post: CommunityPost): void {
    const reason = this.translationService.instant(
      `community.reportReasons.${this.reportReasonKey}`
    );
    this.communityService
      .reportPost(post._id, {
        userId: this.currentUser?._id || 'anonymous',
        userName: this.currentUser?.name || 'Traveler',
        reason
      })
      .subscribe((updated) => {
        if (updated) {
          this.replacePost(updated);
        }
        this.reportingPostId = null;
        this.notificationService.show('notifications.postReported', 'info');
      });
  }

  moderate(post: CommunityPost, action: 'approve' | 'hide' | 'remove'): void {
    this.communityService.moderatePost(post._id, action).subscribe((posts) => {
      this.allPosts = posts;
      const key =
        action === 'approve'
          ? 'notifications.postApproved'
          : action === 'hide'
            ? 'notifications.postHidden'
            : 'notifications.postRemoved';
      this.notificationService.show(key, 'success');
    });
  }

  sharePost(post: CommunityPost, platform: 'whatsapp' | 'twitter' | 'facebook' | 'copy'): void {
    const shareUrl = `${window.location.origin}/community#post-${post._id}`;
    const text = `${post.title} — Tedbus Travel Community`;

    if (platform === 'copy') {
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(`${text}\n${shareUrl}`).catch(() => {});
      }
      this.notificationService.show('notifications.linkCopied', 'success', undefined, 2500);
      return;
    }

    const encodedUrl = encodeURIComponent(shareUrl);
    const encodedText = encodeURIComponent(text);
    const links: Record<'whatsapp' | 'twitter' | 'facebook', string> = {
      whatsapp: `https://wa.me/?text=${encodedText}%20${encodedUrl}`,
      twitter: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`
    };
    window.open(links[platform], '_blank', 'noopener,noreferrer');
  }

  focusPost(postId: string): void {
    this.activeBoard = 'all';
    setTimeout(() => {
      const el = document.getElementById(`post-${postId}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  }

  private replacePost(updated: CommunityPost): void {
    const idx = this.allPosts.findIndex((p) => p._id === updated._id);
    if (idx >= 0) {
      this.allPosts[idx] = updated;
      this.allPosts = [...this.allPosts];
    }
  }
}
