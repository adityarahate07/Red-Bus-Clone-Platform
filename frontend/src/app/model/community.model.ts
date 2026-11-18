export type CommunityTopic = 'Routes' | 'Destinations' | 'Travel Advice';

export interface CommunityComment {
  _id?: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: string;
}

export interface CommunityReport {
  userId: string;
  userName?: string;
  reason: string;
  createdAt: string;
}

export interface CommunityPost {
  _id: string;
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
  likes: string[];
  comments: CommunityComment[];
  reports: CommunityReport[];
  status: 'published' | 'flagged' | 'hidden';
  createdAt: string;
}

export interface UserCommunityActivity {
  posts: CommunityPost[];
  commentsCount: number;
  likesReceived: number;
}
