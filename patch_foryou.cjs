const fs = require('fs');
let file = fs.readFileSync('src/pages/ForYouFeed.tsx', 'utf8');

file = file.replace(
  "import { getViewerTasteProfile } from '../lib/userHistory';",
  "import { getViewerTasteProfile } from '../lib/userHistory';\nimport { useOrientation } from '../context/OrientationContext';\nimport { isMatchingOrientation } from '../lib/orientation';"
);

file = file.replace(
  "export function ForYouFeed() {",
  "export function ForYouFeed() {\n  const { orientation } = useOrientation();"
);

file = file.replace(
  "const ranked = await getPersonalizedFeed(forceRefresh);",
  "const ranked = await getPersonalizedFeed(forceRefresh, orientation);"
);

file = file.replace(
  "const rawVideos = prev.map(p => p.video);",
  "const rawVideos = prev.map(p => p.video).filter(v => isMatchingOrientation(v, orientation));"
);

// We need to add orientation to loadFeed dependency array and useEffect dependency array
file = file.replace(
  "  }, []);",
  "  }, [orientation]);"
);

file = file.replace(
  "  }, [loadFeed]);",
  "  }, [loadFeed, orientation]);"
);

fs.writeFileSync('src/pages/ForYouFeed.tsx', file);
