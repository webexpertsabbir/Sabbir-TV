export interface Channel {
  category: string;
  name: string;
  link: string;
  logo: string;
  cookie: string;
  user_agent: string;
}

export interface PlaybackHistory {
  channelLink: string;
  channelName: string;
  watchedAt: number;
}
