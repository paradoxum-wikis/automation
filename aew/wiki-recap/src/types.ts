export interface Post {
    id: number;
    title: string;
    content: string;
    createdAt: string;
    updatedAt: string;
}

export interface Contributor {
    userName: string;
    userId: string;
    avatar: string;
    profileUrl: string;
    userContactPage: string;
    isAdmin: boolean;
    isCurrent: boolean;
    contributions: string;
    latestRevision: string | null;
    contributionsText: string;
    index: number;
}

export interface FeedResponse {
    posts: Post[];
    contributors?: Contributor[];
}