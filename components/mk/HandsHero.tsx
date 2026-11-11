"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { LOGO_MARK } from "@/lib/brand";

const SHEET = "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20261030_025250_100df7b8-31fd-4614-aa4a-c1b7d5b6b273.png&w=1600&q=85";
const clamp = (n: number) => Math.min(1, Math.max(0, n));
function smooth(start: number, end: number, n: number) {
  const x = clamp((n - start) / (end - start));
  return x * x * (3 - 2 * x);
}
function hash(x: number, y: number) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

export default function HandsHero() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const output = canvas?.getContext("2d");
    if (!canvas || !output) return;
    const element = canvas;
    const context = output;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const fields = [document.createElement("canvas"), document.createElement("canvas")];
    const [first, second] = fields.map((field) => field.getContext("2d", { willReadFrequently: true }));
    if (!first || !second) return;
    const samples = [first, second];
    const sheet = new Image();
    let frame = 0;
    let observer: ResizeObserver | undefined;
    let onMotionChange: (() => void) | undefined;

    sheet.crossOrigin = "anonymous";
    sheet.onload = () => {
      const tiles = [0.06, 0.55].map((y) => [0, 0.53].map((x) => {
        const tile = document.createElement("canvas");
        tile.width = 420;
        tile.height = Math.round(420 * (0.4 * sheet.height) / (0.47 * sheet.width));
        const tileContext = tile.getContext("2d");
        if (tileContext) {
          tileContext.imageSmoothingQuality = "high";
          tileContext.drawImage(sheet, x * sheet.width, y * sheet.height, 0.47 * sheet.width, 0.4 * sheet.height, 0, 0, tile.width, tile.height);
        }
        return tile;
      }));
      let width = 1, height = 1, step = 5, rowStep = 10.25, cols = 1, rows = 1, dpr = 1;
      let seeds = new Float32Array(0);
      let fade = new Float32Array(0);
      const started = performance.now();

      function render(seconds: number) {
        const t = seconds % 20;
        const phase = Math.PI * t / 10;
        const portrait = height > width;
        const handWidth = width * (portrait ? 0.66 : 0.53);
        const handHeight = handWidth * tiles[0][0].height / tiles[0][0].width;
        const centerY = height * (portrait ? 0.66 : 0.57);
        const pixels = samples.map((field, pose) => {
          field.setTransform(1, 0, 0, 1, 0, 0);
          field.fillStyle = "#fff";
          field.fillRect(0, 0, cols, rows);
          tiles[pose].forEach((tile, side) => {
            const direction = side === 0 ? 1 : -1;
            const a = phase + side * Math.PI;
            const reach = (0.035 * Math.sin(a) + 0.012 * Math.sin(2 * phase + 1.3 + side * Math.PI)) * width;
            const scale = 1 + 0.07 * Math.sin(a + 0.9);
            const pivot = side * width;
            field.save();
            field.scale(cols / width, rows / height);
            field.translate(pivot, centerY);
            field.rotate(direction * 0.045 * Math.sin(a + 2.1));
            field.scale(scale, scale);
            field.translate(-pivot, -centerY);
            const x = side === 0 ? reach - width * 0.045 : width - handWidth + width * 0.045 - reach;
            field.drawImage(tile, x, centerY - handHeight / 2, handWidth, handHeight);
            field.restore();
          });
          return field.getImageData(0, 0, cols, rows).data;
        });
        const leftMix = smooth(6.2, 7.8, t) * (1 - smooth(14.6, 16.2, t));
        const rightMix = smooth(2.4, 4, t) * (1 - smooth(10.4, 12, t));
        const tick = Math.floor(t * 7);
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        context.clearRect(0, 0, width, height);
        context.fillStyle = "#0d0d0d";
        context.beginPath();
        for (let row = 0; row < rows; row++) {
          const shift = hash(row, tick) > 0.965 ? Math.round((hash(tick, row) - 0.5) * 8) : 0;
          for (let col = 0; col < cols; col++) {
            const index = row * cols + col;
            const seed = seeds[index];
            const mix = col < cols / 2 ? leftMix : rightMix;
            const sample = row * cols + Math.max(0, Math.min(cols - 1, col - shift));
            let value = clamp((0.84 - pixels[seed < mix ? 1 : 0][sample * 4] / 255) / 0.42);
            if (!value) continue;
            value *= fade[index] * (0.86 + 0.14 * Math.sin(t * 3.2 + seed * 40));
            const distance = Math.abs(seed - mix);
            if (mix > 0.001 && mix < 0.999 && distance < 0.12) {
              value *= distance / 0.12 * (hash(col + tick, row) <= 0.4 ? 0.3 : 1);
            }
            const level = value >= 0.87 ? 1 : value >= 0.65 ? 0.78 : value >= 0.39 ? 0.52 : value >= 0.13 ? 0.38 : 0;
            if (!level) continue;
            const x = (col + 0.5) * step;
            const y = (row + 0.5) * rowStep;
            const radius = step * 0.46 * level;
            context.moveTo(x + radius, y);
            context.arc(x, y, radius, 0, Math.PI * 2);
          }
        }
        context.fill();
      }

      function resize() {
        width = Math.max(1, element.clientWidth);
        height = Math.max(1, element.clientHeight);
        dpr = Math.min(2, window.devicePixelRatio || 1);
        element.width = Math.round(width * dpr);
        element.height = Math.round(height * dpr);
        step = Math.max(5, width / 205);
        rowStep = step * 2.05;
        cols = Math.ceil(width / step);
        rows = Math.ceil(height / rowStep);
        fields.forEach((field) => { field.width = cols; field.height = rows; });
        seeds = new Float32Array(cols * rows);
        fade = new Float32Array(cols * rows);
        const portrait = height > width;
        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cols; col++) {
            const index = row * cols + col;
            seeds[index] = 0.55 * hash(col, row) + 0.45 * hash(row * 3.1, 7.7);
            const x = Math.abs((col + 0.5) / cols - 0.5);
            const y = ((row + 0.5) * rowStep / height - (portrait ? 0.33 : 0.385)) / 0.085;
            fade[index] = smooth(0.035, 0.11, x) * smooth(0.85, 1.25, Math.hypot(x / (portrait ? 0.44 : 0.2), y));
          }
        }
        render(0);
      }

      function animate(now: number) {
        render((now - started) / 1000);
        frame = requestAnimationFrame(animate);
      }
      onMotionChange = () => {
        cancelAnimationFrame(frame);
        if (motion.matches) render(0);
        else frame = requestAnimationFrame(animate);
      };
      observer = new ResizeObserver(resize);
      observer.observe(element);
      resize();
      onMotionChange();
      motion.addEventListener("change", onMotionChange);
    };
    sheet.src = SHEET;

    return () => {
      sheet.onload = null;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      if (onMotionChange) motion.removeEventListener("change", onMotionChange);
    };
  }, []);

  return (
    <section id="hero" className="relative isolate h-[100svh] min-h-[660px] overflow-hidden bg-[#f7f7f5] font-sans text-[#111]">
      <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" />
      <nav aria-label="Homepage" className="relative z-10 mx-auto flex max-w-4xl items-center justify-between gap-6 px-[18px] pt-[22px] text-[13.5px] md:justify-center md:gap-9 md:pt-9">
        <Link href="/" className="inline-flex shrink-0 items-center gap-2 text-[15px] font-semibold">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_MARK} alt="" width={24} height={24} className="mix-blend-multiply" />
          SFB Connect
        </Link>
        <div className="hidden items-center gap-7 text-[#3a3a3a] md:flex">
          <Link href="/platform">Platform</Link>
          <Link href="/#demo">Demo</Link>
          <Link href="/services">Services</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/resources">Resources</Link>
        </div>
        <Link href="/login" className="shrink-0 rounded-full bg-[#111] px-5 py-2.5 font-medium text-white">Sign in</Link>
      </nav>

      <div className="absolute left-1/2 top-[20%] z-10 w-[min(92%,720px)] -translate-x-1/2 text-center md:top-[24.5%]">
        <h1 className="text-[clamp(38px,3.75vw,68px)] font-medium leading-[1.04] tracking-[-0.035em]">
          <span className="block text-[#6b6b6b]">Your agency.</span>
          Your brand.
        </h1>
        <p className="mx-auto mt-5 max-w-[340px] text-[clamp(13px,1.02vw,15.5px)] leading-[1.4] text-[#595959]">Build interactive AI demos, close deals, and deliver under your own brand.</p>
        <div className="group relative isolate mt-[clamp(34px,3.6vw,52px)] inline-block">
          <span aria-hidden="true" className="absolute inset-x-[10%] -bottom-1.5 -z-10 h-4 rounded-full bg-[linear-gradient(90deg,#ffcf5a,#7dffa8,#5ad7ff,#9b7bff,#ff6fd8,#ffb36b)] opacity-85 blur-[9px] transition-all duration-300 group-hover:-bottom-2 group-hover:opacity-100 motion-reduce:transition-none" />
          <Link href="/signup" className="inline-block rounded-full bg-[#111] px-5 py-[11px] text-[13.5px] font-medium text-white">Start your agency</Link>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-[clamp(28px,6vh,64px)] z-10 flex flex-wrap justify-center gap-x-[clamp(24px,4vw,60px)] gap-y-3 px-5 text-sm font-medium text-[#595959]">
        <Link href="/platform">Platform</Link>
        <Link href="/#demo">Interactive demo</Link>
        <Link href="/book">Book a walkthrough</Link>
        <Link href="/pricing">Pricing</Link>
      </div>
    </section>
  );
}
