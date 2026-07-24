/**
 * Procedural 16x16 pixel textures, Minecraft style.
 *
 * The blocky charm comes almost entirely from low-res textures sampled with
 * NEAREST filtering -- flat colours never read as Minecraft. Everything here is
 * drawn on a canvas at load, so there are no external assets.
 */
import * as THREE from 'three'

const S = 16

// deterministic per-texture noise so a reload looks identical
function rng(seed: number) {
  let x = seed >>> 0
  return () => {
    x ^= x << 13; x >>>= 0
    x ^= x >> 17
    x ^= x << 5; x >>>= 0
    return x / 4294967296
  }
}

function shade(hex: string, amt: number) {
  const c = new THREE.Color(hex)
  const hsl = { h: 0, s: 0, l: 0 }
  c.getHSL(hsl)
  c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + amt)))
  return `#${c.getHexString()}`
}

type Painter = (ctx: CanvasRenderingContext2D, r: () => number) => void

function make(seed: number, paint: Painter): THREE.CanvasTexture {
  const cv = document.createElement('canvas')
  cv.width = cv.height = S
  const ctx = cv.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  paint(ctx, rng(seed))
  const tex = new THREE.CanvasTexture(cv)
  tex.magFilter = THREE.NearestFilter
  tex.minFilter = THREE.NearestMipmapNearestFilter
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

/** speckled base: the workhorse for stone / concrete / wool */
const speckle = (base: string, spread = 0.06): Painter => (ctx, r) => {
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      ctx.fillStyle = shade(base, (r() - 0.5) * spread * 2)
      ctx.fillRect(x, y, 1, 1)
    }
  }
}

/** horizontal planks with dark seams and grain streaks */
const planks = (base: string): Painter => (ctx, r) => {
  for (let y = 0; y < S; y++) {
    const band = Math.floor(y / 4)
    const tone = (band % 2 === 0 ? 0.012 : -0.012)
    for (let x = 0; x < S; x++) {
      ctx.fillStyle = shade(base, tone + (r() - 0.5) * 0.05)
      ctx.fillRect(x, y, 1, 1)
    }
    if (y % 4 === 3) {                       // seam between planks
      ctx.fillStyle = shade(base, -0.16)
      ctx.fillRect(0, y, S, 1)
    }
  }
  for (let i = 0; i < 5; i++) {              // grain
    const y = Math.floor(r() * S)
    const x = Math.floor(r() * (S - 5))
    ctx.fillStyle = shade(base, -0.08)
    ctx.fillRect(x, y, 3 + Math.floor(r() * 4), 1)
  }
}

/** vertical wood, for legs and frames */
const woodGrain = (base: string): Painter => (ctx, r) => {
  for (let x = 0; x < S; x++) {
    const tone = (x % 5 === 0 ? -0.07 : 0) + (r() - 0.5) * 0.04
    for (let y = 0; y < S; y++) {
      ctx.fillStyle = shade(base, tone + (r() - 0.5) * 0.03)
      ctx.fillRect(x, y, 1, 1)
    }
  }
}

/** brushed metal: fine vertical streaks */
const metal = (base: string): Painter => (ctx, r) => {
  for (let x = 0; x < S; x++) {
    const tone = (r() - 0.5) * 0.09
    for (let y = 0; y < S; y++) {
      ctx.fillStyle = shade(base, tone + (r() - 0.5) * 0.02)
      ctx.fillRect(x, y, 1, 1)
    }
  }
}

/** tiles with grout lines -- kitchen/bathroom walls */
const tiles = (base: string): Painter => (ctx, r) => {
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const grout = x % 8 === 0 || y % 8 === 0
      ctx.fillStyle = grout ? shade(base, -0.12) : shade(base, (r() - 0.5) * 0.03)
      ctx.fillRect(x, y, 1, 1)
    }
  }
}

/** glass: a light frame plus a diagonal glint */
const glass: Painter = (ctx) => {
  ctx.fillStyle = 'rgba(180,220,240,0.55)'
  ctx.fillRect(0, 0, S, S)
  ctx.fillStyle = 'rgba(255,255,255,0.75)'
  ctx.fillRect(0, 0, S, 1); ctx.fillRect(0, S - 1, S, 1)
  ctx.fillRect(0, 0, 1, S); ctx.fillRect(S - 1, 0, 1, S)
  ctx.fillStyle = 'rgba(255,255,255,0.45)'
  for (let i = 2; i < 9; i++) ctx.fillRect(i, 12 - i, 2, 1)
}

/** water: banded blue with ripples */
const water: Painter = (ctx, r) => {
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const wv = Math.sin((x + y * 0.6) * 0.9) * 0.04
      ctx.fillStyle = shade('#3d80c4', wv + (r() - 0.5) * 0.03)
      ctx.fillRect(x, y, 1, 1)
    }
  }
}

/** fabric / wool: soft cross weave */
const wool = (base: string): Painter => (ctx, r) => {
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const weave = ((x + y) % 4 === 0) ? -0.035 : ((x - y) % 4 === 0 ? 0.03 : 0)
      ctx.fillStyle = shade(base, weave + (r() - 0.5) * 0.03)
      ctx.fillRect(x, y, 1, 1)
    }
  }
}

const cache = new Map<string, THREE.CanvasTexture>()
function tex(key: string, seed: number, paint: Painter) {
  let t = cache.get(key)
  if (!t) { t = make(seed, paint); cache.set(key, t) }
  return t
}

/** Texture for a given palette colour. Keyed on the colour string used in blocks.ts. */
export function textureFor(color: string): THREE.CanvasTexture {
  switch (color) {
    case '#b8894f': return tex('oak', 11, planks('#b8894f'))
    case '#9a7040': return tex('oakD', 12, woodGrain('#9a7040'))
    case '#cda06a': return tex('oakL', 13, planks('#cda06a'))
    case '#6b4f31': return tex('spruce', 14, planks('#6b4f31'))
    case '#9a9a95': return tex('stone', 21, speckle('#9a9a95', 0.09))
    case '#7c7c78': return tex('stoneD', 22, speckle('#7c7c78', 0.09))
    case '#d7d9dc': return tex('iron', 31, metal('#d7d9dc'))
    case '#a9adb2': return tex('ironD', 32, metal('#a9adb2'))
    case '#eceff2': return tex('white', 41, tiles('#eceff2'))
    case '#33383d': return tex('dark', 42, metal('#33383d'))
    case '#8fc7dd': return tex('glass', 51, glass)
    case '#3d80c4': return tex('water', 52, water)
    case '#e0b552': return tex('gold', 61, metal('#e0b552'))
    case '#a8422f': return tex('red', 71, wool('#a8422f'))
    case '#5d8b48': return tex('green', 72, wool('#5d8b48'))
    case '#d8d3c8': return tex('wool', 73, wool('#d8d3c8'))
    default: return tex('gen-' + color, color.length * 7 + 3, speckle(color, 0.05))
  }
}

// --- room surfaces ---------------------------------------------------------
export const FLOOR = () => tex('floor', 101, planks('#c8a27a'))
export const WALL = () => tex('wall', 102, speckle('#e6e0d4', 0.035))
export const WALL_LOWER = () => tex('wallLower', 103, tiles('#dfe6ea'))
export const RUG = () => tex('rug', 104, wool('#9c6b5c'))
export const CEILING = () => tex('ceil', 105, speckle('#f2efe8', 0.02))

// --- player skin -----------------------------------------------------------
export const SKIN = () => tex('skin', 201, speckle('#c68642', 0.03))
export const SHIRT = () => tex('shirt', 202, wool('#3f6fc4'))
export const PANTS = () => tex('pants', 203, wool('#2f3d5c'))
export const HAIR = () => tex('hair', 204, speckle('#3a2a1c', 0.05))

/** Shared lambert material per colour, textured. */
const matCache = new Map<string, THREE.MeshLambertMaterial>()
export function blockMaterial(color: string) {
  let m = matCache.get(color)
  if (!m) {
    const t = textureFor(color)
    const transparent = color === '#8fc7dd'
    m = new THREE.MeshLambertMaterial({
      map: t, color: 0xffffff, transparent, opacity: transparent ? 0.72 : 1,
    })
    matCache.set(color, m)
  }
  return m
}

const surfCache = new Map<string, THREE.MeshLambertMaterial>()
export function surfaceMaterial(key: string, t: THREE.CanvasTexture, repeat = 1) {
  let m = surfCache.get(key)
  if (!m) {
    const c = t.clone()
    c.needsUpdate = true
    c.wrapS = c.wrapT = THREE.RepeatWrapping
    c.repeat.set(repeat, repeat)
    c.magFilter = THREE.NearestFilter
    m = new THREE.MeshLambertMaterial({ map: c })
    surfCache.set(key, m)
  }
  return m
}
