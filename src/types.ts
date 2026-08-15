export interface Video {
  id: string;
  title: string;
  poster: string;
  duration_sec: number;
  total_views: number;
  base_views?: number;
  real_views?: number;
  published_date?: string;
  created_at: string;
  actor: string;
  embed_host: string;
  embed_url: string;
  backup_embed_url?: string;
  categories: string;
  tags: string;
}

export interface CategoryItem {
  name: string;
  poster?: string;
  count?: number;
}

export interface TagItem {
  name: string;
  poster?: string;
  count?: number;
}
