import './style.css'
import p5 from 'p5'
import GUI, { type Controller } from 'lil-gui'

new p5((s: p5) => {
  const DOT_RADIUS = 2
  const HANDLE_RADIUS = 14
  const ORBIT_CENTER_DIAMOND_SIZE = 10
  const MAX_ORBITS = 5

  interface Point { x: number; y: number }

  interface OrbitConfig {
    speed: number
    radius: number
    pickIndex: number
  }

  const params = {
    points: 3,
    chaos: 0,
    seed: 1,
    numberOfOrbits: 1,
    swapLines: false,
    canvasRotationSpeed: 0,
  }

  const orbitConfigs: OrbitConfig[] = Array.from({ length: MAX_ORBITS }, () => ({
    speed: 0.01,
    radius: 150,
    pickIndex: 0,
  }))

  let pts: Point[]
  let dragging = -1
  let canvasAngleDeg = 0
  const orbitAngles = new Array<number>(MAX_ORBITS).fill(0)
  const orbitCenters = new Array<number>(MAX_ORBITS).fill(0)
  let orbitFolderList: GUI[] = []
  const orbitPickCtrls: (Controller | undefined)[] = new Array(MAX_ORBITS).fill(undefined)
  let lastOrbitCount = 0

  function maxOrbitIndex() {
    return Math.max(0, pts.length - 2)
  }

  function pickRandomOrbitIndex() {
    const m = maxOrbitIndex()
    return m <= 0 ? 0 : Math.floor(Math.random() * (m + 1))
  }

  function syncOrbitPickSliders() {
    const m = maxOrbitIndex()
    for (let i = 0; i < params.numberOfOrbits; i++) {
      orbitConfigs[i].pickIndex = Math.min(orbitConfigs[i].pickIndex, m)
      orbitPickCtrls[i]?.max(m).updateDisplay()
    }
  }

  function centerIndexForSatellite(satelliteIdx: number, orbitIndex: number) {
    const candidates: number[] = []
    for (let i = 0; i < pts.length; i++) if (i !== satelliteIdx) candidates.push(i)
    return candidates[orbitIndex % candidates.length]
  }

  function radiusAndAngleFromSatellite(satelliteIdx: number, center: number) {
    const dx = pts[satelliteIdx].x - pts[center].x
    const dy = pts[satelliteIdx].y - pts[center].y
    return { radius: Math.hypot(dx, dy), angle: Math.atan2(dy, dx) }
  }

  function initOrbitK(k: number) {
    if (k >= params.numberOfOrbits || k >= pts.length) return
    const cfg = orbitConfigs[k]
    orbitCenters[k] = centerIndexForSatellite(k, cfg.pickIndex)
    orbitAngles[k] = radiusAndAngleFromSatellite(k, orbitCenters[k]).angle
  }

  function initAllOrbits() {
    for (let k = 0; k < MAX_ORBITS; k++) initOrbitK(k)
  }

  function rebuildOrbitFolders(gui: GUI) {
    for (const f of orbitFolderList) f.destroy()
    orbitFolderList = []
    orbitPickCtrls.fill(undefined)

    for (let i = 0; i < params.numberOfOrbits; i++) {
      const folder = gui.addFolder(`Orbit ${i + 1}`)
      orbitFolderList.push(folder)
      const cfg = orbitConfigs[i]
      const idx = i
      folder.add(cfg, 'speed', -0.05, 0.05, 0.001).name('Orbit Speed')
      folder.add(cfg, 'radius', 10, 3000, 1).name('Orbit Radius')
      orbitPickCtrls[i] = folder.add(cfg, 'pickIndex', 0, maxOrbitIndex(), 1).name('Orbit index').onChange(() => {
        initOrbitK(idx)
      })
    }
  }

  function canvasPivot() {
    return s.createVector(s.width / 2, s.height / 2)
  }

  function worldToScreen(wx: number, wy: number, pivot: p5.Vector) {
    const v = s.createVector(wx - pivot.x, wy - pivot.y)
    v.rotate(-s.radians(canvasAngleDeg))
    return { x: pivot.x + v.x, y: pivot.y + v.y }
  }

  function screenToWorld(sx: number, sy: number, pivot: p5.Vector) {
    const v = s.createVector(sx - pivot.x, sy - pivot.y)
    v.rotate(s.radians(canvasAngleDeg))
    return { x: pivot.x + v.x, y: pivot.y + v.y }
  }

  function drawOrbitCenterDiamond(x: number, y: number) {
    s.push()
    s.translate(x, y)
    s.rotate(Math.PI / 4)
    s.rectMode(s.CENTER)
    s.noFill()
    s.stroke(255)
    s.strokeWeight(0.5)
    s.square(0, 0, ORBIT_CENTER_DIAMOND_SIZE)
    s.pop()
  }

  // Mulberry32 — compact seeded PRNG, returns values in [0, 1)
  function mulberry32(seed: number) {
    return () => {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
      return ((t ^ t >>> 14) >>> 0) / 4294967296
    }
  }

  function randomPt(): Point {
    const margin = 100
    return {
      x: margin + Math.random() * (s.width - margin * 2),
      y: margin + Math.random() * (s.height - margin * 2),
    }
  }

  function circumcircle(a: Point, b: Point, c: Point): { x: number; y: number; r: number } | null {
    const ax = a.x, ay = a.y
    const bx = b.x, by = b.y
    const cx = c.x, cy = c.y
    const D = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by))
    if (Math.abs(D) < 1e-10) return null
    const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / D
    const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / D
    const r = Math.hypot(ax - ux, ay - uy)
    return { x: ux, y: uy, r }
  }

  function circleGroups(n: number): [number, number, number][] {
    const rand = mulberry32(params.seed)
    const indices = Array.from({ length: n }, (_, i) => i)
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]]
    }
    return Array.from({ length: n - 2 }, (_, i) => {
      const triple: [number, number, number] = [indices[i], indices[i + 1], indices[i + 2]]
      return triple.map(idx =>
        rand() < params.chaos ? Math.floor(rand() * n) : idx
      ) as [number, number, number]
    })
  }

  s.setup = () => {
    s.createCanvas(s.windowWidth, s.windowHeight)
    pts = Array.from({ length: params.points }, randomPt)

    for (let i = 0; i < params.numberOfOrbits; i++) {
      orbitConfigs[i].pickIndex = pickRandomOrbitIndex()
    }
    lastOrbitCount = params.numberOfOrbits
    initAllOrbits()

    const gui = new GUI()
    gui.add(params, 'points', 3, 36, 1).name('Amount of points').onChange((n: number) => {
      while (pts.length < n) pts.push(randomPt())
      pts.length = n
      syncOrbitPickSliders()
      initAllOrbits()
    })
    gui.add(params, 'chaos', 0, 1, 0.01).name('Chaos')
    gui.add(params, 'seed', 1, 999, 1).name('Circle Seed')
    gui.add(params, 'swapLines').name('Swap lines')
    gui.add(params, 'canvasRotationSpeed', -0.5, 0.5, 0.01).name('System Speed')
    gui.add(params, 'numberOfOrbits', 0, MAX_ORBITS, 1).name('Number of orbits').onChange((v: number) => {
      if (v > lastOrbitCount) {
        for (let i = lastOrbitCount; i < v; i++) orbitConfigs[i].pickIndex = pickRandomOrbitIndex()
      }
      lastOrbitCount = v
      rebuildOrbitFolders(gui)
      initAllOrbits()
      syncOrbitPickSliders()
    })

    rebuildOrbitFolders(gui)
    syncOrbitPickSliders()
  }

  s.draw = () => {
    s.background(0)

    canvasAngleDeg += params.canvasRotationSpeed

    const nOrb = Math.min(params.numberOfOrbits, MAX_ORBITS)
    for (let k = 0; k < nOrb; k++) {
      if (k >= pts.length) break
      const cfg = orbitConfigs[k]
      orbitAngles[k] += cfg.speed
      const cidx = orbitCenters[k]
      pts[k].x = pts[cidx].x + Math.cos(orbitAngles[k]) * cfg.radius
      pts[k].y = pts[cidx].y + Math.sin(orbitAngles[k]) * cfg.radius
    }

    const groups = circleGroups(pts.length)
    const pivot = canvasPivot()

    const scrOrbitCenter: ({ x: number; y: number } | null)[] = new Array(nOrb).fill(null)
    for (let k = 0; k < nOrb; k++) {
      if (k >= pts.length) continue
      const cidx = orbitCenters[k]
      scrOrbitCenter[k] = worldToScreen(pts[cidx].x, pts[cidx].y, pivot)
    }

    const orbitLineW = params.swapLines ? 0.5 : 1.5
    const circumLineW = params.swapLines ? 1.5 : 0.5

    s.noFill()
    s.stroke(255)
    s.strokeWeight(orbitLineW)
    for (let k = 0; k < nOrb; k++) {
      if (k >= pts.length) continue
      const cfg = orbitConfigs[k]
      const scr = scrOrbitCenter[k]
      if (cfg.radius >= 1 && scr) s.ellipse(scr.x, scr.y, cfg.radius * 2, cfg.radius * 2)
    }

    s.strokeWeight(circumLineW)
    for (const [i, j, k] of groups) {
      const cc = circumcircle(pts[i], pts[j], pts[k])
      if (cc && cc.r >= 0.5) {
        const o = worldToScreen(cc.x, cc.y, pivot)
        const maxR = Math.hypot(s.width, s.height) * 20
        if (cc.r < maxR) {
          s.ellipse(o.x, o.y, cc.r * 2, cc.r * 2)
        } else {
          // Radius too large to tessellate cleanly — draw the tangent line instead
          const dx = s.width / 2 - o.x, dy = s.height / 2 - o.y
          const dist = Math.hypot(dx, dy)
          if (dist > 0) {
            const nx = dx / dist, ny = dy / dist
            const px = o.x + nx * cc.r, py = o.y + ny * cc.r
            const len = Math.max(s.width, s.height)
            s.line(px - ny * len, py + nx * len, px + ny * len, py - nx * len)
          }
        }
      }
    }

    s.noFill()
    s.stroke(255)
    s.strokeWeight(1)

    const count = new Array(pts.length).fill(0)
    for (const group of groups) for (const idx of group) count[idx]++
    const sharedCount = count.filter(c => c > 1).length

    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]
      const shared = count[i] > 1
      const scr = worldToScreen(p.x, p.y, pivot)

      s.fill(255)
      s.noStroke()
      s.ellipse(scr.x, scr.y, DOT_RADIUS * 2, DOT_RADIUS * 2)

      s.noFill()
      if (shared) s.stroke(220, 50, 50); else s.stroke(255)
      s.strokeWeight(1)
      s.ellipse(scr.x, scr.y, HANDLE_RADIUS * 2, HANDLE_RADIUS * 2)
    }

    const diamondAtCenter = new Set<number>()
    for (let k = 0; k < nOrb; k++) {
      if (k >= pts.length) continue
      const cidx = orbitCenters[k]
      const scr = scrOrbitCenter[k]
      if (scr && !diamondAtCenter.has(cidx)) {
        diamondAtCenter.add(cidx)
        drawOrbitCenterDiamond(scr.x, scr.y)
      }
    }

    s.fill(255)
    s.noStroke()
    s.textSize(12)
    s.text(`shared points: ${sharedCount}`, 12, 20)
  }

  s.mousePressed = () => {
    const pv = canvasPivot()
    const { x: mx, y: my } = screenToWorld(s.mouseX, s.mouseY, pv)
    for (let i = pts.length - 1; i >= 0; i--) {
      const d = Math.hypot(mx - pts[i].x, my - pts[i].y)
      if (d <= HANDLE_RADIUS) { dragging = i; break }
    }
  }

  s.mouseDragged = () => {
    if (dragging >= 0) {
      const pv = canvasPivot()
      const { x, y } = screenToWorld(s.mouseX, s.mouseY, pv)
      pts[dragging].x = x
      pts[dragging].y = y
    }
  }

  s.mouseReleased = () => { dragging = -1 }

  s.windowResized = () => {
    s.resizeCanvas(s.windowWidth, s.windowHeight)
  }
})
