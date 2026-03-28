import './style.css'
import p5 from 'p5'

new p5((s: p5) => {
  const DOT_RADIUS = 4
  const HANDLE_RADIUS = 14

  interface Point { x: number; y: number }

  let pts: Point[]
  let dragging = -1

  function randomPts(): Point[] {
    const margin = 100
    return [0, 1, 2].map(() => ({
      x: margin + Math.random() * (s.width - margin * 2),
      y: margin + Math.random() * (s.height - margin * 2),
    }))
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

  s.setup = () => {
    s.createCanvas(s.windowWidth, s.windowHeight)
    pts = randomPts()
  }

  s.draw = () => {
    s.background(0)
    s.noFill()
    s.stroke(255)
    s.strokeWeight(1)

    const cc = circumcircle(pts[0], pts[1], pts[2])
    if (cc) s.ellipse(cc.x, cc.y, cc.r * 2, cc.r * 2)

    for (const p of pts) {
      // Solid dot
      s.fill(255)
      s.noStroke()
      s.ellipse(p.x, p.y, DOT_RADIUS * 2, DOT_RADIUS * 2)

      // Outlined handle
      s.noFill()
      s.stroke(255)
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
