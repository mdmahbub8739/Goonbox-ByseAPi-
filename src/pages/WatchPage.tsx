import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useInView } from 'react-intersection-observer';
import { supabase } from '../lib/supabase';
import { Video } from '../types';
import { toEmbedSrc, fmtViews, timeAgo } from '../lib/utils';
import { triggerBysePermanentBackup, getByseBackupSlot, BackupSlotInfo } from '../lib/byseResolver';
import { calculateRelevanceScore, getCleanCreatorName, interleaveAddictiveFeed } from '../lib/videoAlgo';
import { 
  extractRawCategories, 
  extractRawTags, 
  getRelatedVideosByRawMetadata 
} from '../lib/relatedVideos';
import { 
  recordWatchHistory, 
  recordWatchProgress,
  toggleLikedVideo, 
  isVideoLiked, 
  toggleSavedVideo, 
  isVideoSaved,
  recordCategoryInteraction,
  recordTagInteraction,
  recordActorInteraction,
  recordFilterChoice,
  recordVideoInteraction,
  getViewerTasteProfile,
  getVideoWatchProgress,
  WatchHistoryEntry,
  extractTitleNgrams
} from '../lib/userHistory';
import { getCachedVideos, setCachedVideos } from '../lib/feedCache';
import { eventBuffer } from '../lib/eventBuffer';
import { 
  TimeFilter, 
  DurationFilter, 
  SortByOption, 
  isMatchingTimeAndDuration,
  applyTimeAndDurationFilter,
  getTimeFilterDate 
} from '../lib/filters';
import { useWatchProgressTracker } from '../lib/watchProgressTracker';
import { VideoCard } from '../components/VideoCard';
import { RelatedVideosSection } from '../components/RelatedVideosSection';
import { WatchPageSkeleton } from '../components/WatchPageSkeleton';
import { SuggestedFilterDrawer } from '../components/SuggestedFilterDrawer';
import { VideoDetailsModal } from '../components/VideoDetailsModal';
import { StreamSourcesModal } from '../components/StreamSourcesModal';
import { AmbientVideoGlow } from '../components/AmbientVideoGlow';
import { useAmbientMode } from '../context/AmbientModeContext';
import { 
  ThumbsUp, 
  Share2, 
  BookmarkPlus, 
  Sparkles, 
  Flame, 
  Clock, 
  Tag, 
  User, 
  Folder, 
  Heart,
  SlidersHorizontal,
  Search,
  X,
  RotateCcw,
  Play,
  ArrowUpDown,
  ChevronDown,
  Layers,
  Info,
  SunMedium,
  Server,
  ShieldCheck,
  Radio
} from 'lucide-react';
import clsx from 'clsx';

const INITIAL_VISIBLE_COUNT = 12;
const LOAD_MORE_STEP = 10;

export function WatchPage() {
  const { id } = useParams<{ id: string }>();
  const [video, setVideo] = useState<Video | null>(null);
  const [candidatePool, setCandidatePool] = useState<Video[]>([]);
  const [visibleCount, setVisibleCount] = useState<number>(INITIAL_VISIBLE_COUNT);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const { ambientMode, toggleAmbientMode } = useAmbientMode();

  // Active Tab state: 'related' (Raw Tags & Categories Match) vs 'suggested' (Personalized / Algorithmic)
  const [activeTab, setActiveTab] = useState<'related' | 'suggested'>('related');

  // Resume Watch History State
  const [resumeEntry, setResumeEntry] = useState<WatchHistoryEntry | null>(null);
  const [isResumeDismissed, setIsResumeDismissed] = useState(false);
  const [customEmbedUrl, setCustomEmbedUrl] = useState<string | null>(null);

  // Stream Server Slots (Server 1: Primary Clicked vs Server 2: Byse Permanent Backup)
  const [selectedServer, setSelectedServer] = useState<'primary' | 'byse'>('primary');
  const [byseSlot, setByseSlot] = useState<BackupSlotInfo | null>(() => id ? getByseBackupSlot(id) : null);

  // Sync Byse backup slot updates for this specific content ID
  useEffect(() => {
    if (!id) return;
    setByseSlot(getByseBackupSlot(id));
    const handleSlotUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<BackupSlotInfo>;
      if (customEvent.detail && String(customEvent.detail.videoId) === String(id)) {
        setByseSlot(customEvent.detail);
      }
    };
    window.addEventListener('byse_backup_slot_updated', handleSlotUpdate);
    return () => window.removeEventListener('byse_backup_slot_updated', handleSlotUpdate);
  }, [id]);

  // Suggested for You Filters & Search State
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [durationFilter, setDurationFilter] = useState<DurationFilter>('all');
  const [sortBy, setSortBy] = useState<SortByOption>('relevance');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isSourcesModalOpen, setIsSourcesModalOpen] = useState(false);

  // Real-time lightweight watch progress & completion percentage tracker
  useWatchProgressTracker(video);

  const watchRecordedRef = useRef<string | null>(null);

  const { ref: loadMoreRef, inView } = useInView({
    rootMargin: '300px',
  });

  // Reset filters helper
  const handleResetFilters = () => {
    setTimeFilter('all');
    setDurationFilter('all');
    setSortBy('relevance');
    setSelectedCategory('');
    setSelectedTag('');
    setSearchQuery('');
    setVisibleCount(INITIAL_VISIBLE_COUNT);
  };

  // Count of active filters
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (timeFilter !== 'all') count++;
    if (durationFilter !== 'all') count++;
    if (sortBy !== 'relevance') count++;
    if (selectedCategory) count++;
    if (selectedTag) count++;
    if (searchQuery.trim()) count++;
    return count;
  }, [timeFilter, durationFilter, sortBy, selectedCategory, selectedTag, searchQuery]);

  useEffect(() => {
    if (!id) return;
    
    async function fetchVideoAndRecommendations() {
      setIsLoading(true);
      handleResetFilters();
      setCustomEmbedUrl(null);
      window.scrollTo(0, 0);

      // Check liked and saved state
      setIsLiked(isVideoLiked(id));
      setIsSaved(isVideoSaved(id));

      // Check previous watch history for resume playback
      const savedProgress = getVideoWatchProgress(id);
      if (savedProgress && savedProgress.progressSec && savedProgress.progressSec > 10 && !savedProgress.isCompleted) {
        setResumeEntry(savedProgress);
        setIsResumeDismissed(false);
      } else {
        setResumeEntry(null);
        setIsResumeDismissed(true);
      }

      // 1. Fetch current playing video
      const { data: v, error } = await supabase.from('videos').select('*').eq('id', id).single();
      if (error || !v) {
        setVideo(null);
        setIsLoading(false);
        return;
      }
      const currentVideo = v as Video;
      setVideo(currentVideo);

      if (currentVideo.backup_embed_url) {
        setByseSlot({
          videoId: String(currentVideo.id),
          filecode: '',
          embedUrl: currentVideo.backup_embed_url,
          domain: '',
          status: 'ready',
          title: currentVideo.title || 'Video',
          updatedAt: Date.now(),
        });
      }

      // Record to viewer history immediately with duration for taste profile learning
      if (watchRecordedRef.current !== String(currentVideo.id)) {
        recordWatchHistory(currentVideo, savedProgress?.progressSec || 0, currentVideo.duration_sec);
        eventBuffer.recordView(currentVideo.id);
        watchRecordedRef.current = String(currentVideo.id);
      }

      try {
        // Zero-Pressure DB Caching: Check fast memory cache before querying database
        const cachedCandidates = getCachedVideos('global_candidate_pool');
        if (cachedCandidates && cachedCandidates.length > 30) {
          setCandidatePool(cachedCandidates.filter(c => String(c.id) !== String(currentVideo.id)));
        }

        // Pull lightning-fast blocks using Indexed Primary Keys, Views, and Targeted Raw Metadata Matches
        const fetchPromises: PromiseLike<any>[] = [];

        // Batch 1: High-Engagement Viral Magnets
        fetchPromises.push(
          supabase
            .from('videos')
            .select('*')
            .neq('id', currentVideo.id)
            .order('total_views', { ascending: false })
            .limit(40)
        );

        // Batch 2: Fresh Discoveries (instant PK index access)
        fetchPromises.push(
          supabase
            .from('videos')
            .select('*')
            .neq('id', currentVideo.id)
            .order('id', { ascending: false })
            .limit(60)
        );

        // Batch 3: Targeted Exact Raw Tags & Raw Categories Matches
        const rawCats = extractRawCategories(currentVideo.categories);
        const rawTags = extractRawTags(currentVideo.tags);
        const matchConditions: string[] = [];
        
        for (const cat of rawCats.slice(0, 3)) {
          const cleanCat = cat.replace(/[^a-zA-Z0-9 ]/g, '').trim();
          if (cleanCat.length >= 2) matchConditions.push(`categories.ilike.%${cleanCat}%`);
        }
        for (const tag of rawTags.slice(0, 4)) {
          const cleanTag = tag.replace(/[^a-zA-Z0-9 ]/g, '').trim();
          if (cleanTag.length >= 2) matchConditions.push(`tags.ilike.%${cleanTag}%`);
        }
        if (currentVideo.actor && currentVideo.actor !== 'N/A' && currentVideo.actor.toLowerCase() !== 'unknown') {
          const cleanActor = currentVideo.actor.replace(/[^a-zA-Z0-9 ]/g, '').trim();
          if (cleanActor.length >= 2) matchConditions.push(`actor.ilike.%${cleanActor}%`);
        }

        if (matchConditions.length > 0) {
          fetchPromises.push(
            supabase
              .from('videos')
              .select('*')
              .neq('id', currentVideo.id)
              .or(matchConditions.join(','))
              .order('total_views', { ascending: false })
              .limit(80)
          );
        }

        // Batch 4: Stochastic Explorers
        const randOffset1 = Math.floor(Math.random() * 10000);
        fetchPromises.push(
          supabase
            .from('videos')
            .select('*')
            .neq('id', currentVideo.id)
            .order('id', { ascending: false })
            .range(randOffset1, randOffset1 + 40)
        );

        const results = await Promise.all(fetchPromises);
        
        // Merge and deduplicate candidates locally in milliseconds
        const map = new Map<string, Video>();
        for (const res of results) {
          if (res.data && Array.isArray(res.data)) {
            for (const item of res.data as Video[]) {
              if (String(item.id) !== String(currentVideo.id) && !map.has(String(item.id))) {
                map.set(String(item.id), item);
              }
            }
          }
        }

        const candidateList = Array.from(map.values());
        setCachedVideos('global_candidate_pool', candidateList);
        setCandidatePool(candidateList);
      } catch (err) {
        console.error('Error fetching algorithmic recommendations:', err);
      }

      setIsLoading(false);

      // Asynchronously trigger Byse permanent backup upload in background for this specific content ID
      // (The primary player remains on the clicked embed URL, while Byse populates the backup slot)
      if (currentVideo.embed_url) {
        triggerBysePermanentBackup(currentVideo).catch(err => {
          console.warn('[Byse] Background backup trigger notice:', err);
        });
      }
    }

    fetchVideoAndRecommendations();
  }, [id]);

  // Real-time active watch duration & completion tracking
  useEffect(() => {
    if (!video) return;
    let elapsed = 0;
    const interval = setInterval(() => {
      elapsed += 5;
      recordWatchProgress(video, elapsed, video.duration_sec);
    }, 5000);

    return () => {
      clearInterval(interval);
      if (elapsed > 0) {
        recordWatchProgress(video, elapsed, video.duration_sec);
      }
    };
  }, [video]);

  // Dynamically fetch matching candidates from Supabase when duration/time/category filter is applied
  useEffect(() => {
    if (!video || (durationFilter === 'all' && timeFilter === 'all' && !selectedCategory && !selectedTag && !searchQuery)) return;

    let isMounted = true;
    async function fetchFilteredCandidates() {
      try {
        let q = supabase.from('videos').select('*').neq('id', video!.id);
        q = applyTimeAndDurationFilter(q, timeFilter, durationFilter);

        if (selectedCategory) {
          const catTrimmed = selectedCategory.replace(/[^a-zA-Z0-9 ]/g, '').trim();
          q = q.or(`categories.ilike.%${catTrimmed}%,tags.ilike.%${catTrimmed}%`);
        }
        if (selectedTag) {
          const tagTrimmed = selectedTag.replace(/[^a-zA-Z0-9 ]/g, '').trim();
          q = q.or(`tags.ilike.%${tagTrimmed}%,categories.ilike.%${tagTrimmed}%`);
        }
        if (searchQuery.trim()) {
          const clean = searchQuery.trim().replace(/[^a-zA-Z0-9 ]/g, '');
          q = q.or(`title.ilike.%${clean}%,actor.ilike.%${clean}%,tags.ilike.%${clean}%,categories.ilike.%${clean}%`);
        }

        q = q.order('id', { ascending: false });

        q = q.limit(40);
        const { data } = await q;
        if (isMounted && data && Array.isArray(data)) {
          setCandidatePool(prev => {
            const map = new Map<string, Video>();
            for (const item of prev) {
              map.set(String(item.id), item);
            }
            for (const item of data as Video[]) {
              if (String(item.id) !== String(video!.id) && !map.has(String(item.id))) {
                map.set(String(item.id), item);
              }
            }
            return Array.from(map.values());
          });
        }
      } catch (err) {
        console.error('Error fetching filtered candidates:', err);
      }
    }

    fetchFilteredCandidates();
    return () => {
      isMounted = false;
    };
  }, [video, durationFilter, timeFilter, selectedCategory, selectedTag, searchQuery, sortBy]);

  // Extract available categories & tags from current video
  const availableCategories = useMemo(() => {
    if (!video?.categories) return [];
    return video.categories
      .split(/[,/|;]+/)
      .map(c => c.trim())
      .filter(c => c && c.toLowerCase() !== 'n/a');
  }, [video]);

  const availableTags = useMemo(() => {
    if (!video?.tags) return [];
    return video.tags
      .split(/[,/|;]+/)
      .map(t => t.replace(/^#/, '').trim())
      .filter(t => t && t.toLowerCase() !== 'n/a' && t.toLowerCase() !== 'video');
  }, [video]);

  // Comprehensive Filter & Sort Pipeline using Upgraded Multi-Vector Profile
  const filteredVideos = useMemo(() => {
    if (!video || candidatePool.length === 0) return [];

    let list = [...candidatePool];

    // 1. Search Query Filter across all database fields (title, tags, categories, actor, embed_host)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(v => {
        const titleMatch = (v.title || '').toLowerCase().includes(q);
        const catMatch = (v.categories || '').toLowerCase().includes(q);
        const tagMatch = (v.tags || '').toLowerCase().includes(q);
        const actorMatch = (v.actor || '').toLowerCase().includes(q);
        const hostMatch = (v.embed_host || '').toLowerCase().includes(q);
        return titleMatch || catMatch || tagMatch || actorMatch || hostMatch;
      });
    }

    // 2. Selected Category Filter
    if (selectedCategory) {
      const targetCat = selectedCategory.toLowerCase();
      list = list.filter(v => (v.categories || '').toLowerCase().includes(targetCat));
    }

    // 3. Selected Tag Filter
    if (selectedTag) {
      const targetTag = selectedTag.toLowerCase();
      list = list.filter(v => (v.tags || '').toLowerCase().includes(targetTag));
    }

    // 4. Time & Duration Filter
    if (timeFilter !== 'all' || durationFilter !== 'all') {
      list = list.filter(v => isMatchingTimeAndDuration(v, timeFilter, durationFilter));
    }

    // 5. Sorting with Addictive Dopamine Interleaving & Stochastic Multi-Vector Scoring
    if (sortBy === 'relevance') {
      const profile = getViewerTasteProfile();
      list = interleaveAddictiveFeed(list, profile, video);
    } else if (sortBy === 'views') {
      list.sort((a, b) => {
        const vA = (a.total_views || 0) + (a.base_views || 0) + (a.real_views || 0);
        const vB = (b.total_views || 0) + (b.base_views || 0) + (b.real_views || 0);
        return vB - vA;
      });
    } else if (sortBy === 'trending') {
      list.sort((a, b) => (b.real_views || 0) - (a.real_views || 0));
    } else if (sortBy === 'newest') {
      list.sort((a, b) => {
        const dateA = new Date(a.published_date || a.created_at || 0).getTime();
        const dateB = new Date(b.published_date || b.created_at || 0).getTime();
        if (dateB !== dateA) return dateB - dateA;
        return Number(b.id) - Number(a.id);
      });
    }

    return list;
  }, [video, candidatePool, searchQuery, selectedCategory, selectedTag, timeFilter, durationFilter, sortBy]);

  // Handle infinite scroll load more
  useEffect(() => {
    if (inView && !isLoading && visibleCount < filteredVideos.length) {
      setIsLoadingMore(true);
      const timer = setTimeout(() => {
        setVisibleCount(prev => prev + LOAD_MORE_STEP);
        setIsLoadingMore(false);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [inView, isLoading, visibleCount, filteredVideos.length]);

  if (isLoading) {
    return <WatchPageSkeleton />;
  }

  if (!video) {
    return (
      <div className="pt-[48px] text-center py-20 text-[#aaaaaa] text-[15px]">
        Video not found.
      </div>
    );
  }

  const embedUrl = toEmbedSrc(video.embed_url);
  const rawViews = (video.total_views || ((video.base_views || 0) + (video.real_views || 0)));
  const views = fmtViews(rawViews);
  const ago = timeAgo(video.published_date || video.created_at);
  const channel = getCleanCreatorName(video);

  const handleLike = () => {
    if (!video) return;
    const newState = toggleLikedVideo(video.id, video);
    setIsLiked(newState);
  };

  const handleSave = () => {
    if (!video) return;
    const newState = toggleSavedVideo(video.id, video);
    setIsSaved(newState);
  };

  const handleShare = async () => {
    if (!video) return;
    recordVideoInteraction('share', video);
    if (navigator.share) {
      try {
        await navigator.share({
          title: video.title,
          url: window.location.href,
        });
      } catch {
        // Ignored
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
    }
  };

  const handleResumePlayback = () => {
    if (!resumeEntry || !resumeEntry.progressSec) return;
    const startSec = Math.floor(resumeEntry.progressSec);
    const base = toEmbedSrc(video?.embed_url);
    const delimiter = base.includes('?') ? '&' : '?';
    setCustomEmbedUrl(`${base}${delimiter}start=${startSec}#t=${startSec}`);
    setIsResumeDismissed(true);
  };

  const handleStartOver = () => {
    setCustomEmbedUrl(toEmbedSrc(video?.embed_url));
    setIsResumeDismissed(true);
  };

  const primaryEmbedSrc = toEmbedSrc(video?.embed_url);
  const byseEmbedSrc = byseSlot?.embedUrl 
    ? toEmbedSrc(byseSlot.embedUrl) 
    : (video?.backup_embed_url ? toEmbedSrc(video.backup_embed_url) : `https://${ACTIVE_BYSE_DOMAIN}/e/${video?.id}`);
  const activeEmbedUrl = customEmbedUrl || (selectedServer === 'byse' && byseEmbedSrc ? byseEmbedSrc : primaryEmbedSrc);
  const displayedVideos = filteredVideos.slice(0, visibleCount);

  return (
    <div className="pt-[48px] relative min-h-screen">
      {/* Sticky Video Player Container with Ambient Mode Glow */}
      <div className="sticky top-[48px] z-30 w-full relative">
        <AmbientVideoGlow posterUrl={video.poster} />
        <div className="w-full aspect-video bg-black shadow-[0_8px_30px_rgba(0,0,0,0.8)] relative z-10 overflow-hidden">
          <iframe 
            src={activeEmbedUrl} 
            title={video.title} 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
            allowFullScreen
            className="w-full h-full border-none"
          />
        </div>
      </div>

      {/* Resume Playback Prompt Banner */}
      {resumeEntry && !isResumeDismissed && resumeEntry.progressSec && resumeEntry.progressSec > 10 && (
        <div className="mx-3 mt-2.5 p-2.5 rounded-xl bg-[#1a1a22] border border-[#ff0033]/35 shadow-lg flex items-center justify-between gap-2 text-[12.5px] animate-fadeIn">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-[#ff0033]/20 text-[#ff0033] flex items-center justify-center shrink-0">
              <RotateCcw className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-white text-[12px]">Resume video? </span>
              <span className="text-[#a1a1aa] text-[11.5px] truncate">
                Left off at {Math.floor(resumeEntry.progressSec / 60)}:{String(Math.floor(resumeEntry.progressSec % 60)).padStart(2, '0')} ({Math.round((resumeEntry.completionRate || 0) * 100)}%)
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleResumePlayback}
              className="px-3 py-1 rounded-lg bg-[#ff0033] hover:bg-red-600 active:scale-95 text-white font-bold text-[11.5px] shadow-sm transition-all flex items-center gap-1"
            >
              <Play className="w-3 h-3 fill-current" />
              Resume
            </button>
            <button
              onClick={handleStartOver}
              className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-[#ccc] text-[11px] font-medium transition-all"
            >
              Start Over
            </button>
            <button
              onClick={() => setIsResumeDismissed(true)}
              className="p-1 text-[#888] hover:text-white"
              aria-label="Dismiss resume prompt"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
      
      <div className="max-w-7xl mx-auto px-2 sm:px-4 py-2.5">
        {/* Video Title */}
        <h1 className="text-[15px] sm:text-[16px] font-bold leading-snug mb-1 text-[#f1f1f1]">
          {video.title}
        </h1>
        
        {/* View Count and Date */}
        <div className="text-[11.5px] text-[#aaaaaa] mb-2 flex items-center gap-1.5 flex-wrap">
          <span>{views}</span>
          <span>•</span>
          <span>{ago}</span>
          {video.duration_sec ? (
            <>
              <span>•</span>
              <span className="text-[#cccccc]">{Math.floor(video.duration_sec / 60)} min</span>
            </>
          ) : null}
        </div>

        {/* Channel Info & Subscribe & Collapsed Actions Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-2 border-b border-white/[0.08]">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-full bg-[#ff0033] flex items-center justify-center font-bold text-[12px] text-white shrink-0 shadow-sm">
              {channel.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-[#f1f1f1] truncate">
                {channel}
              </div>
            </div>
            <button 
              onClick={() => setIsSubscribed(!isSubscribed)}
              className={`text-[11.5px] font-semibold px-3 py-1 rounded-full transition-colors ml-1 ${
                isSubscribed 
                  ? 'bg-[#272727] text-[#aaaaaa] hover:bg-[#333]' 
                  : 'bg-[#f1f1f1] text-[#0f0f0f] active:bg-[#d9d9d9]'
              }`}
            >
              {isSubscribed ? 'Subscribed' : 'Subscribe'}
            </button>
          </div>

          {/* Action Buttons Row */}
          <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar">
            <button 
              id="watch-like-btn"
              onClick={handleLike}
              className={clsx(
                "h-[32px] px-3 rounded-full flex items-center gap-1.5 text-[11.5px] font-semibold shrink-0 transition-all active:scale-95",
                isLiked 
                  ? 'bg-[#ff0033] text-white shadow-sm shadow-[#ff0033]/30' 
                  : 'bg-white/[0.06] hover:bg-white/[0.1] text-[#f1f1f1]'
              )}
            >
              <Heart className={clsx("w-3.5 h-3.5", isLiked ? "fill-white" : "")} />
              <span>{isLiked ? 'Liked' : 'Like'}</span>
            </button>
            
            {/* Ambient Lighting Toggle Button */}
            <button 
              id="watch-ambient-toggle-btn"
              onClick={toggleAmbientMode}
              className={clsx(
                "h-[32px] px-3 rounded-full flex items-center gap-1.5 text-[11.5px] font-semibold shrink-0 active:scale-95 transition-all",
                ambientMode 
                  ? 'bg-[#ff0033]/20 text-[#ff4d79] border border-[#ff0033]/40 shadow-sm shadow-[#ff0033]/25' 
                  : 'bg-white/[0.06] hover:bg-white/[0.1] text-[#a1a1aa]'
              )}
              title="Toggle Ambient Glow Effect"
            >
              <SunMedium className={clsx("w-3.5 h-3.5", ambientMode ? "text-[#ff3366] animate-pulse" : "text-[#71717a]")} />
              <span>Ambient {ambientMode ? 'On' : 'Off'}</span>
            </button>

            <button 
              id="watch-share-btn"
              onClick={handleShare}
              className="h-[32px] bg-white/[0.06] hover:bg-white/[0.1] px-3 rounded-full flex items-center gap-1.5 text-[11.5px] font-semibold shrink-0 active:scale-95 text-[#f1f1f1] transition-all"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share</span>
            </button>
            
            <button 
              id="watch-save-btn"
              onClick={handleSave}
              className={clsx(
                "h-[32px] px-3 rounded-full flex items-center gap-1.5 text-[11.5px] font-semibold shrink-0 active:scale-95 transition-all",
                isSaved 
                  ? 'bg-white/30 text-white' 
                  : 'bg-white/[0.06] hover:bg-white/[0.1] text-[#f1f1f1]'
              )}
            >
              <BookmarkPlus className="w-3.5 h-3.5" />
              <span>{isSaved ? 'Saved' : 'Save'}</span>
            </button>

            {/* Collapsed Description Pill */}
            <button 
              id="expand-description-modal-trigger"
              onClick={() => setIsDetailsModalOpen(true)}
              className="h-[32px] bg-white/[0.06] hover:bg-white/[0.1] px-3 rounded-full flex items-center gap-1 text-[11.5px] font-semibold text-[#a1a1aa] hover:text-white shrink-0 active:scale-95 transition-all"
              role="button"
              aria-expanded={isDetailsModalOpen}
            >
              <Layers className="w-3.5 h-3.5 text-[#ff0033]" />
              <span>Details</span>
              <ChevronDown className="w-3 h-3 text-[#71717a]" />
            </button>
          </div>
        </div>

        {/* Embedded Stream Server Slots (Primary vs Byse Backup) */}
        <div className="flex items-center justify-between gap-1.5 mb-2.5 py-1 px-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-[11.5px] flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex items-center gap-1 text-[#a1a1aa] font-medium mr-0.5 text-[11px]">
              <Server className="w-3.5 h-3.5 text-[#ff0033]" />
              <span>Source:</span>
            </div>

            {/* Slot 1: Primary Stream (The embed URL user just clicked) */}
            <button
              id="stream-slot-primary"
              onClick={() => {
                setSelectedServer('primary');
                setCustomEmbedUrl(null);
              }}
              className={clsx(
                "h-[26px] px-2.5 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1.5 select-none active:scale-95",
                selectedServer === 'primary'
                  ? "bg-white text-black font-bold shadow-sm"
                  : "bg-white/[0.05] text-[#9ca3af] hover:text-white hover:bg-white/[0.08]"
              )}
            >
              <Play className="w-2.5 h-2.5 fill-current" />
              <span>Primary</span>
            </button>

            {/* Slot 2: Byse Permanent Backup Slot */}
            <button
              id="stream-slot-byse"
              onClick={() => {
                setSelectedServer('byse');
                setCustomEmbedUrl(null);
              }}
              className={clsx(
                "h-[26px] px-2.5 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1.5 select-none active:scale-95",
                selectedServer === 'byse'
                  ? "bg-[#ff0033] text-white shadow-sm"
                  : "bg-white/[0.05] text-[#9ca3af] hover:text-white hover:bg-white/[0.08]"
              )}
              title="Switch to Byse Backup Server (bysewihe.com)"
            >
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span>Byse Backup</span>
              <span className="text-[9.5px] px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 rounded-md font-extrabold">Ready</span>
            </button>
          </div>

          {/* Dedicated Sources Modal Trigger Button */}
          <button
            id="open-sources-modal-btn"
            onClick={() => setIsSourcesModalOpen(true)}
            className="h-[26px] px-2.5 rounded-lg text-[11px] font-bold text-[#ff7777] hover:text-white bg-[#ff0033]/10 hover:bg-[#ff0033]/25 border border-[#ff0033]/30 transition-all flex items-center gap-1.5 shrink-0 active:scale-95 ml-auto"
            title="Open all stream sources & mirrors modal"
          >
            <Radio className="w-3 h-3 text-[#ff0033]" />
            <span>Sources List</span>
          </button>
        </div>

        {/* Quick Tag / Actor Pill if present */}
        {video.actor && video.actor !== 'N/A' && (
          <div className="flex items-center gap-1.5 mb-2 overflow-x-auto hide-scrollbar">
            <span className="text-[11px] text-[#71717a] font-medium shrink-0">Model:</span>
            <button 
              onClick={() => {
                setSelectedTag('');
                setSelectedCategory('');
                setSearchQuery(video.actor || '');
              }}
              className="text-[11px] text-purple-300 hover:text-white font-semibold px-2 py-0.5 rounded-md bg-purple-500/15 border border-purple-500/30 truncate cursor-pointer transition-all active:scale-95 flex items-center gap-1"
              title={`Filter by ${video.actor}`}
            >
              <User className="w-2.5 h-2.5 text-purple-400" />
              <span>{video.actor}</span>
            </button>
          </div>
        )}

        {/* Clean, intuitive Tab Bar below video */}
        <div className="flex items-center gap-2 mb-3 border-b border-white/[0.06] pb-2">
          <button
            id="tab-related-videos"
            onClick={() => setActiveTab('related')}
            className={clsx(
              "py-1.5 px-4 rounded-full text-[12.5px] font-semibold transition-all select-none",
              activeTab === 'related'
                ? "bg-white text-black shadow-sm"
                : "text-[#8e8e93] hover:text-white hover:bg-white/[0.04]"
            )}
          >
            Related
          </button>

          <button
            id="tab-suggested-videos"
            onClick={() => setActiveTab('suggested')}
            className={clsx(
              "py-1.5 px-4 rounded-full text-[12.5px] font-semibold transition-all select-none",
              activeTab === 'suggested'
                ? "bg-white text-black shadow-sm"
                : "text-[#8e8e93] hover:text-white hover:bg-white/[0.04]"
            )}
          >
            Suggested
          </button>
        </div>

        {/* Tab 1: Related Videos (Raw Tags & Categories Match) */}
        {activeTab === 'related' && (
          <RelatedVideosSection
            currentVideo={video}
            candidatePool={candidatePool}
            onSelectCategory={(cat) => {
              setSelectedCategory(cat);
              if (cat) recordCategoryInteraction(cat);
            }}
            onSelectTag={(tag) => {
              setSelectedTag(tag);
              if (tag) recordTagInteraction(tag);
            }}
          />
        )}

        {/* Tab 2: Suggested for You (Algorithmic / AI Recommendation) */}
        {activeTab === 'suggested' && (
          <div>
            <div className="mt-1 mb-2">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#ff0033] animate-pulse" />
                  <div>
                    <h2 className="text-[14px] font-bold text-white leading-tight">
                      Suggested for You
                    </h2>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Advanced Filter Drawer Trigger Button */}
                  <button
                    id="open-suggested-filter-drawer-btn"
                    onClick={() => setIsFilterDrawerOpen(true)}
                    className={clsx(
                      "h-[28px] flex items-center gap-1 px-2.5 rounded-lg text-[11px] font-bold transition-all border active:scale-95",
                      activeFiltersCount > 0
                        ? "bg-[#ff0033] text-white border-[#ff0033] shadow-sm shadow-[#ff0033]/30"
                        : "bg-[#18181c] hover:bg-[#222228] text-[#ccc] border-white/10"
                    )}
                  >
                    <SlidersHorizontal className="w-3 h-3" />
                    <span>Filter</span>
                    {activeFiltersCount > 0 && (
                      <span className="bg-black/30 text-white text-[9px] font-bold px-1 rounded-full ml-0.5">
                        {activeFiltersCount}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* Active Filters Pill Bar */}
              {activeFiltersCount > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap mb-2 py-1.5 px-2 bg-[#141418] rounded-xl border border-white/5 text-[11px]">
                  <span className="text-[#888] font-semibold">Active:</span>

                  {searchQuery && (
                    <span className="inline-flex items-center gap-1 bg-[#222] text-white px-2 py-0.5 rounded-md font-medium">
                      Search: "{searchQuery}"
                      <button onClick={() => setSearchQuery('')} className="hover:text-[#ff0033] p-0.5" aria-label="Remove search filter">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}

                  {selectedCategory && (
                    <span className="inline-flex items-center gap-1 bg-[#ff0033]/20 text-[#ff7777] border border-[#ff0033]/30 px-2 py-0.5 rounded-md font-medium">
                      📁 {selectedCategory}
                      <button onClick={() => setSelectedCategory('')} className="hover:text-white p-0.5" aria-label="Remove category filter">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}

                  {selectedTag && (
                    <span className="inline-flex items-center gap-1 bg-[#3ea6ff]/20 text-[#70baff] border border-[#3ea6ff]/30 px-2 py-0.5 rounded-md font-medium">
                      #{selectedTag}
                      <button onClick={() => setSelectedTag('')} className="hover:text-white p-0.5" aria-label="Remove tag filter">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}

                  {timeFilter !== 'all' && (
                    <span className="inline-flex items-center gap-1 bg-[#222] text-[#ccc] px-2 py-0.5 rounded-md font-medium">
                      🕒 {timeFilter}
                      <button onClick={() => setTimeFilter('all')} className="hover:text-[#ff0033] p-0.5" aria-label="Remove time filter">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}

                  {durationFilter !== 'all' && (
                    <span className="inline-flex items-center gap-1 bg-[#222] text-[#ccc] px-2 py-0.5 rounded-md font-medium">
                      ⏳ {durationFilter}
                      <button onClick={() => setDurationFilter('all')} className="hover:text-[#ff0033] p-0.5" aria-label="Remove duration filter">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}

                  {sortBy !== 'relevance' && (
                    <span className="inline-flex items-center gap-1 bg-[#222] text-[#ccc] px-2 py-0.5 rounded-md font-medium">
                      ⚡ {sortBy}
                      <button onClick={() => setSortBy('relevance')} className="hover:text-[#ff0033] p-0.5" aria-label="Remove sort filter">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}

                  <button
                    id="reset-active-filters-btn"
                    onClick={handleResetFilters}
                    className="ml-auto text-[10.5px] text-[#ff7777] hover:underline flex items-center gap-1 font-semibold px-1 py-0.5"
                  >
                    <RotateCcw className="w-3 h-3" /> Reset All
                  </button>
                </div>
              )}

              {/* Quick Filter Chips Carousel */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 mb-1.5 hide-scrollbar">
                {/* 1. All Suggested */}
                <button
                  id="chip-all-suggested"
                  onClick={() => {
                    setSelectedCategory('');
                    setSelectedTag('');
                    setSortBy('relevance');
                    setVisibleCount(INITIAL_VISIBLE_COUNT);
                  }}
                  className={clsx(
                    "h-[30px] px-2.5 rounded-lg text-[11.5px] font-semibold whitespace-nowrap transition-all flex items-center gap-1 shrink-0 border active:scale-95",
                    !selectedCategory && !selectedTag && sortBy === 'relevance'
                      ? "bg-white text-black border-white shadow-sm font-bold"
                      : "bg-[#18181c] text-[#ccc] border-white/5 hover:bg-[#222228]"
                  )}
                >
                  <Sparkles className="w-3 h-3 text-[#ff0033]" />
                  <span>All Suggested</span>
                </button>

                {/* 2. Most Viewed Chip */}
                <button
                  id="chip-most-viewed"
                  onClick={() => {
                    setSortBy(sortBy === 'views' ? 'relevance' : 'views');
                    recordFilterChoice('sort', sortBy === 'views' ? 'relevance' : 'views');
                    setVisibleCount(INITIAL_VISIBLE_COUNT);
                  }}
                  className={clsx(
                    "h-[30px] px-2.5 rounded-lg text-[11.5px] font-semibold whitespace-nowrap transition-all flex items-center gap-1 shrink-0 border active:scale-95",
                    sortBy === 'views'
                      ? "bg-white text-black border-white font-bold shadow-sm"
                      : "bg-[#18181c] text-[#ccc] border-white/5 hover:bg-[#222228]"
                  )}
                >
                  <Flame className="w-3 h-3 text-[#ff0033]" />
                  <span>Most Viewed</span>
                </button>

                {/* 3. Newest Uploads Chip */}
                <button
                  id="chip-newest-uploads"
                  onClick={() => {
                    setSortBy(sortBy === 'newest' ? 'relevance' : 'newest');
                    recordFilterChoice('sort', sortBy === 'newest' ? 'relevance' : 'newest');
                    setVisibleCount(INITIAL_VISIBLE_COUNT);
                  }}
                  className={clsx(
                    "h-[30px] px-2.5 rounded-lg text-[11.5px] font-semibold whitespace-nowrap transition-all flex items-center gap-1 shrink-0 border active:scale-95",
                    sortBy === 'newest'
                      ? "bg-white text-black border-white font-bold shadow-sm"
                      : "bg-[#18181c] text-[#ccc] border-white/5 hover:bg-[#222228]"
                  )}
                >
                  <Clock className="w-3 h-3 text-[#ff0033]" />
                  <span>Newest</span>
                </button>

                {/* 4. Common Categories Chips */}
                {availableCategories.map(cat => (
                  <button
                    key={`chip-cat-${cat}`}
                    id={`chip-cat-${cat.replace(/\s+/g, '-').toLowerCase()}`}
                    onClick={() => {
                      const next = selectedCategory.toLowerCase() === cat.toLowerCase() ? '' : cat;
                      setSelectedCategory(next);
                      if (next) recordCategoryInteraction(next);
                      setVisibleCount(INITIAL_VISIBLE_COUNT);
                    }}
                    className={clsx(
                      "h-[30px] px-2.5 rounded-lg text-[11.5px] font-semibold whitespace-nowrap transition-all flex items-center gap-1 shrink-0 border active:scale-95",
                      selectedCategory.toLowerCase() === cat.toLowerCase()
                        ? "bg-[#ff0033] text-white border-[#ff0033] font-bold shadow-sm shadow-[#ff0033]/20"
                        : "bg-[#18181c] text-[#ccc] border-white/5 hover:bg-[#222228]"
                    )}
                  >
                    <Folder className="w-3 h-3 text-[#888]" />
                    <span>{cat}</span>
                  </button>
                ))}

                {/* 5. Common Tags Chips */}
                {availableTags.map(tag => (
                  <button
                    key={`chip-tag-${tag}`}
                    id={`chip-tag-${tag.replace(/\s+/g, '-').toLowerCase()}`}
                    onClick={() => {
                      const next = selectedTag.toLowerCase() === tag.toLowerCase() ? '' : tag;
                      setSelectedTag(next);
                      if (next) recordTagInteraction(next);
                      setVisibleCount(INITIAL_VISIBLE_COUNT);
                    }}
                    className={clsx(
                      "h-[30px] px-2.5 rounded-lg text-[11.5px] font-semibold whitespace-nowrap transition-all flex items-center gap-1 shrink-0 border active:scale-95",
                      selectedTag.toLowerCase() === tag.toLowerCase()
                        ? "bg-[#ff0033] text-white border-[#ff0033] font-bold shadow-sm shadow-[#ff0033]/20"
                        : "bg-[#18181c] text-[#ccc] border-white/5 hover:bg-[#222228]"
                    )}
                  >
                    <Tag className="w-3 h-3 text-[#888]" />
                    <span>#{tag}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Algorithmic Recommendations Feed (Responsive Grid) */}
            <div>
              {displayedVideos.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                  {displayedVideos.map((r, idx) => (
                    <div key={`${r.id}-${idx}`} className="relative">
                      <VideoCard video={r} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 px-4 bg-[#181818] border border-white/5 rounded-2xl my-4 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto text-[#ff0000]">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-semibold text-white">No suggested videos matching your filters</p>
                  <p className="text-xs text-[#888888] max-w-xs mx-auto">
                    Try clearing active tags, categories, duration, time filters, or search terms to discover more related videos.
                  </p>
                  <button
                    onClick={handleResetFilters}
                    className="inline-flex items-center gap-1.5 bg-[#ff0000] hover:bg-[#e60000] text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-md shadow-[#ff0000]/20"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset All Filters</span>
                  </button>
                </div>
              )}
            </div>

            {/* Infinite Scroll Trigger & Load More (WITHOUT remaining video count) */}
            {visibleCount < filteredVideos.length && (
              <div ref={loadMoreRef} className="py-6 flex justify-center">
                {isLoadingMore ? (
                  <div className="w-6 h-6 border-2 border-[#ff0000] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <button
                    onClick={() => setVisibleCount(prev => prev + LOAD_MORE_STEP)}
                    className="bg-[#272727] hover:bg-[#333] active:bg-[#3a3a3a] text-[#f1f1f1] text-[13px] font-medium px-5 py-2 rounded-full transition-colors"
                  >
                    Show More Videos
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Expandable/Collapsible Description & Metadata Modal */}
      {video && (
        <VideoDetailsModal
          isOpen={isDetailsModalOpen}
          onClose={() => setIsDetailsModalOpen(false)}
          video={video}
          views={views}
          ago={ago}
          channel={channel}
          selectedCategory={selectedCategory}
          onSelectCategory={(cat) => {
            setSelectedCategory(cat);
            if (cat) recordCategoryInteraction(cat);
            setVisibleCount(INITIAL_VISIBLE_COUNT);
          }}
          selectedTag={selectedTag}
          onSelectTag={(tag) => {
            setSelectedTag(tag);
            if (tag) recordTagInteraction(tag);
            setVisibleCount(INITIAL_VISIBLE_COUNT);
          }}
          selectedActor={searchQuery}
          onSelectActor={(actor) => {
            setSearchQuery(actor);
            if (actor) recordActorInteraction(actor);
            setVisibleCount(INITIAL_VISIBLE_COUNT);
          }}
        />
      )}

      {/* Stream Sources & Mirrors Dedicated Modal */}
      {video && (
        <StreamSourcesModal
          isOpen={isSourcesModalOpen}
          onClose={() => setIsSourcesModalOpen(false)}
          video={video}
          selectedServer={selectedServer}
          onSelectServer={(server) => {
            setSelectedServer(server);
            setCustomEmbedUrl(null);
          }}
          byseSlot={byseSlot}
        />
      )}

      {/* Advanced Suggested Filter Drawer */}
      <SuggestedFilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        timeFilter={timeFilter}
        setTimeFilter={(t) => {
          setTimeFilter(t);
          recordFilterChoice('time', t);
        }}
        durationFilter={durationFilter}
        setDurationFilter={(d) => {
          setDurationFilter(d);
          recordFilterChoice('duration', d);
        }}
        sortBy={sortBy}
        setSortBy={(s) => {
          setSortBy(s);
          recordFilterChoice('sort', s);
        }}
        selectedCategory={selectedCategory}
        setSelectedCategory={(c) => {
          setSelectedCategory(c);
          if (c) recordCategoryInteraction(c);
        }}
        selectedTag={selectedTag}
        setSelectedTag={(t) => {
          setSelectedTag(t);
          if (t) recordTagInteraction(t);
        }}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        availableCategories={availableCategories}
        availableTags={availableTags}
        onReset={handleResetFilters}
        activeCount={activeFiltersCount}
      />
    </div>
  );
}

