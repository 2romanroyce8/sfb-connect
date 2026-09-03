"use client";

import { useEffect, type RefObject } from "react";
import Hls from "hls.js";

export function useHlsVideo(videoRef: RefObject<HTMLVideoElement>, src: string) {
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let hls: Hls | null = null;

    if (Hls.isSupported()) {
      hls = new Hls();
      hls.loadSource(src);
      hls.attachMedia(video);
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
    }

    return () => {
      hls?.destroy();
    };
  }, [videoRef, src]);
}
