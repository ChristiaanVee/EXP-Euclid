import './style.css'
import p5 from 'p5'
import GUI from 'lil-gui'

new p5((s: p5) => {
  const DOT_RADIUS = 2
  const HANDLE_RADIUS = 14

  interface Point { x: number; y: number }

  const params = { points: 3, chaos: 0, seed: 1 }
  let pts: Point[]
  let dragging = -1

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

  // Sliding window of consecutive triples, then Watts-Strogatz rewire:
  // each point in a circle is independently replaced with a random point
  // with probability = chaos. Same seed always yields the same rewiring.
  function circleGroups(n: number): [number, number, number][] {
    const rand = mulberry32(params.seed)
    return Array.from({ length: n - 2 }, (_, i) => {
      const triple: [number, number, number] = [i, i + 1, i + 2]
      return triple.map(idx =>
        rand() < params.chaos ? Math.floor(rand() * n) : idx
      ) as [number, number, number]
    })
  }

  s.setup = () => {
    s.createCanvas(s.windowWidth, s.windowHeight)
    pts = Array.from({ length: params.points }, randomPt)

    const gui = new GUI()
    gui.add(params, 'points', 3, 36, 1).name('Amount of points').onChange((n: number) => {
      while (pts.length < n) pts.push(randomPt())
      pts.length = n
    })
    gui.add(params, 'chaos', 0, 1, 0.01).name('Chaos')
    gui.add(params, 'seed', 1, 999, 1).name('Seed')
  }

  s.draw = () => {
    s.background(0)
    s.noFill()
    s.stroke(255)
    s.strokeWeight(1)

    const groups = circleGroups(pts.length)

    for (const [i, j, k] of groups) {
      const cc = circumcircle(pts[i], pts[j], pts[k])
      if (cc) s.ellipse(cc.x, cc.y, cc.r * 2, cc.r * 2)
    }

    const count = new Array(pts.length).fill(0)
    for (const group of groups) for (const idx of group) count[idx]++
    const sharedCount = count.filter(c => c > 1).length

    s.fill(255)
    s.noStroke()
    s.textSize(12)
    s.text(`shared points: ${sharedCount}`, 12, 20)

    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]
      const shared = count[i] > 1

      s.fill(255)
      s.noStroke()
      s.ellipse(p.x, p.y, DOT_RADIUS * 2, DOT_RADIUS * 2)

      s.noFill()
      if (shared) s.stroke(220, 50, 50); else s.stroke(255)
      s.strokeWeight(1)
      s.ellipse(p.x, p.y, HANDLE_RADIUS * 2, HANDLE_RADIUS * 2)
    }
  }

  s.mousePressed = () => {
    for (let i = pts.length - 1; i >= 0; i--) {
      const d = Math.hypot(s.mouseX - pts[i].x, s.mouseY - pts[i].y)
      if (d <= HANDLE_RADIUS) { dragging = i; break }
    }
  }

  s.mouseDragged = () => {
    if (dragging >= 0) {
      pts[dragging].x = s.mouseX
      pts[dragging].y = s.mouseY
    }
  }

  s.mouseReleased = () => { dragging = -1 }

  s.windowResized = () => {
    s.resizeCanvas(s.windowWidth, s.windowHeight)
  }
})
