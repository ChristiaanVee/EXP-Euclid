import './style.css'
import p5 from 'p5'

new p5((s: p5) => {
  s.setup = () => {
    s.createCanvas(s.windowWidth, s.windowHeight)
    s.noFill()
    s.stroke(255)
  }

  s.draw = () => {
    s.background(0)
    s.ellipse(s.width / 2, s.height / 2, 200, 200)
  }

  s.windowResized = () => {
    s.resizeCanvas(s.windowWidth, s.windowHeight)
  }
})
