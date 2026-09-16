import { useCallback, useRef, useState } from 'react';

// How close to the true bottom (in px) counts as "already there" — a little
// slack so the cue doesn't flicker on rubber-band bounce or rounding.
const BOTTOM_SLACK = 24;

/**
 * Drives the "there's more below" scroll cue (see ScrollCue.jsx).
 *
 * Per NN/G's "Illusion of Completeness" research, users stop scrolling when
 * the visible viewport looks like a complete, self-contained screen — this
 * hook tracks whether the content actually overflows the viewport and
 * whether the user has already scrolled to the real bottom, so the cue only
 * shows exactly when it's useful (content is cut off) and hides once there
 * genuinely is nothing more.
 *
 * Wire the three returned handlers onto a ScrollView:
 *   <ScrollView onScroll={onScroll} scrollEventThrottle={16}
 *     onContentSizeChange={onContentSizeChange} onLayout={onLayout}>
 * then render <ScrollCue visible={showCue} /> as a sibling, absolutely
 * positioned at the bottom of the screen (outside the ScrollView).
 */
export function useScrollCue() {
  const [showCue, setShowCue] = useState(false);
  const contentHeight = useRef(0);
  const layoutHeight = useRef(0);
  const scrollY = useRef(0);

  const recompute = useCallback(() => {
    const overflows = contentHeight.current > layoutHeight.current + 4;
    const atBottom = scrollY.current + layoutHeight.current >= contentHeight.current - BOTTOM_SLACK;
    setShowCue(overflows && !atBottom);
  }, []);

  const onScroll = useCallback((e) => {
    scrollY.current = e.nativeEvent.contentOffset.y;
    recompute();
  }, [recompute]);

  const onContentSizeChange = useCallback((_w, h) => {
    contentHeight.current = h;
    recompute();
  }, [recompute]);

  const onLayout = useCallback((e) => {
    layoutHeight.current = e.nativeEvent.layout.height;
    recompute();
  }, [recompute]);

  return { onScroll, onContentSizeChange, onLayout, showCue };
}

export default useScrollCue;
