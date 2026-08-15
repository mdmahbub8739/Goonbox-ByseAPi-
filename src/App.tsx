/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { OrientationProvider } from './context/OrientationContext';
import { FeedFilterProvider } from './context/FeedFilterContext';
import { AmbientModeProvider } from './context/AmbientModeContext';
import { TopBar } from './components/TopBar';
import { BottomNav } from './components/BottomNav';
import { HomeFeed } from './pages/HomeFeed';
import { ForYouFeed } from './pages/ForYouFeed';
import { NewestFeed } from './pages/NewestFeed';
import { TrendingFeed } from './pages/TrendingFeed';
import { CategoriesPage } from './pages/CategoriesPage';
import { SearchFeed } from './pages/SearchFeed';
import { WatchPage } from './pages/WatchPage';
import { HistoryPage } from './pages/HistoryPage';
import { ScrollToTopButton } from './components/ScrollToTopButton';

export default function App() {
  return (
    <AmbientModeProvider>
      <OrientationProvider>
        <Router>
          <FeedFilterProvider>
            <TopBar />
            <main className="pb-[52px]">
              <Routes>
                <Route path="/" element={<ForYouFeed />} />
                <Route path="/home" element={<HomeFeed />} />
                <Route path="/latest" element={<NewestFeed />} />
                <Route path="/newest" element={<NewestFeed />} />
                <Route path="/foryou" element={<ForYouFeed />} />
                <Route path="/trending" element={<TrendingFeed />} />
                <Route path="/categories" element={<CategoriesPage />} />
                <Route path="/search" element={<SearchFeed />} />
                <Route path="/watch/:id" element={<WatchPage />} />
                <Route path="/history" element={<HistoryPage />} />
              </Routes>
            </main>
            <ScrollToTopButton />
            <BottomNav />
          </FeedFilterProvider>
        </Router>
      </OrientationProvider>
    </AmbientModeProvider>
  );
}
