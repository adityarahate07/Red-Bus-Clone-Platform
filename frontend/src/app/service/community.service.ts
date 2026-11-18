import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { url } from '../config';
import {
  CommunityPost,
  CommunityTopic,
  UserCommunityActivity
} from '../model/community.model';

const COMMUNITY_STORAGE_KEY = 'tedbus_community_posts';

@Injectable({
  providedIn: 'root'
})
export class CommunityService {
  private readonly apiBase = `${url}community/posts`;

  constructor(private http: HttpClient) {
    this.ensureSeedPosts();
  }

  getPosts(includeModerated = true): Observable<CommunityPost[]> {
    const query = includeModerated ? '?includeModerated=true' : '';
    return this.http.get<CommunityPost[]>(`${this.apiBase}${query}`).pipe(
      map((posts) => {
        if (Array.isArray(posts) && posts.length > 0) {
          this.mergeServerPosts(posts);
          return this.readLocalPosts();
        }
        return this.readLocalPosts();
      }),
      catchError(() => of(this.readLocalPosts()))
    );
  }

  createPost(payload: {
    authorId: string;
    authorName: string;
    authorEmail?: string;
    authorVerified: boolean;
    title: string;
    content: string;
    topic: CommunityTopic;
    routeTag?: string;
    travelTips: string[];
    photoUrl?: string;
  }): Observable<CommunityPost> {
    return this.http.post<CommunityPost>(this.apiBase, payload).pipe(
      tap((created) => this.upsertLocalPost(created)),
      catchError(() => {
        const localPost: CommunityPost = {
          _id: `post-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          authorId: payload.authorId,
          authorName: payload.authorName,
          authorEmail: payload.authorEmail,
          authorVerified: true,
          title: payload.title.trim(),
          content: payload.content.trim(),
          topic: payload.topic,
          routeTag: payload.routeTag?.trim() || '',
          travelTips: payload.travelTips,
          photoUrl: payload.photoUrl?.trim() || '',
          likes: [],
          comments: [],
          reports: [],
          status: 'published',
          createdAt: new Date().toISOString()
        };
        this.upsertLocalPost(localPost);
        return of(localPost);
      })
    );
  }

  toggleLike(postId: string, userId: string): Observable<CommunityPost | null> {
    return this.http.post<CommunityPost>(`${this.apiBase}/${postId}/like`, { userId }).pipe(
      tap((updated) => this.upsertLocalPost(updated)),
      catchError(() => {
        const posts = this.readLocalPosts();
        const post = posts.find((p) => p._id === postId);
        if (!post) {
          return of(null);
        }
        const idx = post.likes.indexOf(userId);
        if (idx === -1) {
          post.likes.push(userId);
        } else {
          post.likes.splice(idx, 1);
        }
        this.writeLocalPosts(posts);
        return of(post);
      })
    );
  }

  addComment(
    postId: string,
    payload: { userId: string; userName: string; text: string }
  ): Observable<CommunityPost | null> {
    return this.http.post<CommunityPost>(`${this.apiBase}/${postId}/comments`, payload).pipe(
      tap((updated) => this.upsertLocalPost(updated)),
      catchError(() => {
        const posts = this.readLocalPosts();
        const post = posts.find((p) => p._id === postId);
        if (!post) {
          return of(null);
        }
        post.comments.push({
          _id: `cmt-${Date.now()}`,
          userId: payload.userId,
          userName: payload.userName,
          text: payload.text.trim(),
          createdAt: new Date().toISOString()
        });
        this.writeLocalPosts(posts);
        return of(post);
      })
    );
  }

  reportPost(
    postId: string,
    payload: { userId: string; userName: string; reason: string }
  ): Observable<CommunityPost | null> {
    return this.http.post<CommunityPost>(`${this.apiBase}/${postId}/report`, payload).pipe(
      tap((updated) => this.upsertLocalPost(updated)),
      catchError(() => {
        const posts = this.readLocalPosts();
        const post = posts.find((p) => p._id === postId);
        if (!post) {
          return of(null);
        }
        post.reports.push({
          userId: payload.userId,
          userName: payload.userName,
          reason: payload.reason,
          createdAt: new Date().toISOString()
        });
        if (post.status !== 'hidden') {
          post.status = 'flagged';
        }
        this.writeLocalPosts(posts);
        return of(post);
      })
    );
  }

  moderatePost(
    postId: string,
    action: 'approve' | 'hide' | 'remove'
  ): Observable<CommunityPost[]> {
    return this.http.patch<any>(`${this.apiBase}/${postId}/moderate`, { action }).pipe(
      map(() => this.applyLocalModeration(postId, action)),
      catchError(() => of(this.applyLocalModeration(postId, action)))
    );
  }

  getTrendingPosts(posts: CommunityPost[], limit = 3): CommunityPost[] {
    return posts
      .filter((p) => p.status !== 'hidden')
      .slice()
      .sort((a, b) => {
        const scoreA = a.likes.length * 2 + a.comments.length;
        const scoreB = b.likes.length * 2 + b.comments.length;
        return scoreB - scoreA;
      })
      .slice(0, limit);
  }

  getUserActivity(userId: string): UserCommunityActivity {
    const all = this.readLocalPosts();
    const userPosts = all.filter((p) => p.authorId === userId && p.status !== 'hidden');
    let commentsCount = 0;
    all.forEach((p) => {
      commentsCount += p.comments.filter((c) => c.userId === userId).length;
    });
    const likesReceived = userPosts.reduce((sum, p) => sum + p.likes.length, 0);
    return {
      posts: userPosts,
      commentsCount,
      likesReceived
    };
  }

  private applyLocalModeration(
    postId: string,
    action: 'approve' | 'hide' | 'remove'
  ): CommunityPost[] {
    let posts = this.readLocalPosts();
    if (action === 'remove') {
      posts = posts.filter((p) => p._id !== postId);
    } else {
      const target = posts.find((p) => p._id === postId);
      if (target) {
        if (action === 'approve') {
          target.status = 'published';
          target.reports = [];
        } else if (action === 'hide') {
          target.status = 'hidden';
        }
      }
    }
    this.writeLocalPosts(posts);
    return posts;
  }

  private upsertLocalPost(post: CommunityPost): void {
    const posts = this.readLocalPosts();
    const idx = posts.findIndex((p) => p._id === post._id);
    if (idx >= 0) {
      posts[idx] = post;
    } else {
      posts.unshift(post);
    }
    this.writeLocalPosts(posts);
  }

  private mergeServerPosts(serverPosts: CommunityPost[]): void {
    const local = this.readLocalPosts();
    serverPosts.forEach((sp) => {
      const idx = local.findIndex((lp) => lp._id === sp._id);
      if (idx >= 0) {
        local[idx] = sp;
      } else {
        local.unshift(sp);
      }
    });
    this.writeLocalPosts(local);
  }

  private readLocalPosts(): CommunityPost[] {
    try {
      const raw = localStorage.getItem(COMMUNITY_STORAGE_KEY);
      const parsed: CommunityPost[] = raw ? JSON.parse(raw) : [];
      return parsed.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } catch {
      return [];
    }
  }

  private writeLocalPosts(posts: CommunityPost[]): void {
    try {
      localStorage.setItem(COMMUNITY_STORAGE_KEY, JSON.stringify(posts));
    } catch {
      // Ignore storage errors
    }
  }

  private ensureSeedPosts(): void {
    if (this.readLocalPosts().length > 0) {
      return;
    }

    const now = Date.now();
    const hoursAgo = (h: number) => new Date(now - h * 60 * 60 * 1000).toISOString();

    const seeds: CommunityPost[] = [
      {
        _id: 'seed-post-1',
        authorId: 'demo-user-aarav',
        authorName: 'Aarav Sharma',
        authorEmail: 'aarav.traveler@tedbus.in',
        authorVerified: true,
        title: 'Monsoon Overnight Sleeper Guide: Mumbai to Goa on NH-66',
        content:
          'Just completed my third overnight sleeper bus journey from Bandra to Calangute. Taking the 9 PM FastTransit Volvo gave us an effortless sleep through the Konkan ghats and we woke up to lush green paddy fields just outside Pernem!',
        topic: 'Routes',
        routeTag: 'Mumbai → Goa',
        travelTips: [
          'Pick lower berth near mid-axle for least sway on ghats',
          'Carry a light shawl as AC gets chilly past midnight',
          'Download offline maps before Chiplun'
        ],
        photoUrl: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=900&q=75',
        likes: ['seed-u-1', 'seed-u-2', 'seed-u-4', 'seed-u-5'],
        comments: [
          {
            _id: 'seed-cmt-1',
            userId: 'seed-u-1',
            userName: 'Priya Deshmukh',
            text: 'Totally agree about mid-axle lower berths on the Konkan highway—makes a huge difference!',
            createdAt: hoursAgo(14)
          },
          {
            _id: 'seed-cmt-2',
            userId: 'seed-u-5',
            userName: 'Karthik Nair',
            text: 'Where did the bus stop for dinner? Was the washroom clean?',
            createdAt: hoursAgo(10)
          }
        ],
        reports: [],
        status: 'published',
        createdAt: hoursAgo(18)
      },
      {
        _id: 'seed-post-2',
        authorId: 'seed-u-6',
        authorName: 'Ananya Sen',
        authorVerified: true,
        title: 'Sunrise over Tiger Hill after our Kolkata to Darjeeling Night Bus',
        content:
          'Reached Siliguri right on schedule at 5 AM and caught the shared jeep up to Darjeeling. Sharing this tip for anyone planning a weekend hill getaway on a budget—booking the SwiftTrans A/C bus saved us a full hotel night.',
        topic: 'Destinations',
        routeTag: 'Kolkata → Darjeeling',
        travelTips: [
          'Book morning return tickets 3 days ahead in peak season',
          'Pack motion-sickness bands for the hill climb',
          'Try hot momos at Keventer’s right after checking in'
        ],
        photoUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=900&q=75',
        likes: ['seed-u-1', 'seed-u-2', 'seed-u-7', 'demo-user-aarav', 'seed-u-4'],
        comments: [
          {
            _id: 'seed-cmt-3',
            userId: 'demo-user-aarav',
            userName: 'Aarav Sharma',
            text: 'Stunning view! Adding Kolkata to Darjeeling to my winter travel list.',
            createdAt: hoursAgo(22)
          }
        ],
        reports: [],
        status: 'published',
        createdAt: hoursAgo(30)
      },
      {
        _id: 'seed-post-3',
        authorId: 'seed-u-2',
        authorName: 'Rohan Kulkarni',
        authorVerified: true,
        title: '5 Essential Checklist Items for First-Time Solo Night Bus Travelers',
        content:
          'After 40+ interstate bus trips across India, here is my go-to checklist: always share the Live Tracking link with family, keep a compact power bank even if charging ports are listed, use a luggage cable lock, and double-check boarding point landmarks 30 minutes before departure.',
        topic: 'Travel Advice',
        routeTag: 'Delhi → Jaipur',
        travelTips: [
          'Share live GPS tracking with family',
          'Keep valuables in a small daypack on your berth',
          'Carry a reusable water bottle & neck pillow'
        ],
        photoUrl: '',
        likes: ['seed-u-1', 'seed-u-5', 'seed-u-7'],
        comments: [
          {
            _id: 'seed-cmt-4',
            userId: 'seed-u-4',
            userName: 'Sneha Patil',
            text: 'Super helpful checklist for solo travelers—thank you for sharing!',
            createdAt: hoursAgo(5)
          }
        ],
        reports: [],
        status: 'published',
        createdAt: hoursAgo(9)
      },
      {
        _id: 'seed-post-4',
        authorId: 'seed-u-9',
        authorName: 'Guest Poster',
        authorVerified: true,
        title: 'Unverified Discount Ticket Links — Click Here Now!!!',
        content:
          'Buy super cheap unofficial tickets on my external site instead of booking directly. Message for instant discount coupons.',
        topic: 'Travel Advice',
        routeTag: '',
        travelTips: [],
        photoUrl: '',
        likes: [],
        comments: [],
        reports: [
          {
            userId: 'seed-u-1',
            userName: 'Priya Deshmukh',
            reason: 'Spam or self-promotion',
            createdAt: hoursAgo(3)
          }
        ],
        status: 'flagged',
        createdAt: hoursAgo(6)
      }
    ];

    this.writeLocalPosts(seeds);
  }
}
