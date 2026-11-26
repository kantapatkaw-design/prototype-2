// Create background canvas (MakeCode Arcade screen is 160x120)
let bg = image.create(160, 120)
scene.setBackgroundImage(bg)

// Closed-loop track waypoints
let trackX = [30, 130, 140, 130, 95, 80, 55, 25, 20]
let trackY = [24, 24, 42, 95, 100, 72, 98, 92, 45]
let roadWidth = 22

// Pre-render the static track image so it runs smoothly at 60fps
let trackImg = image.create(160, 120)
drawTrack(trackImg)

// Car state (starts on top straight facing right)
let x = 45
let y = 24
let vx = 0
let vy = 0
let angle = 0

// Store tire skid marks
let skidX: number[] = []
let skidY: number[] = []

game.onUpdate(function () {
    let dt = game.eventContext().deltaTime

    // Controls: Up = Gas, Down = Brake/Reverse, Left/Right = Steer, A = Drift
    let throttle = controller.up.isPressed() ? 1 : 0
    let brake = controller.down.isPressed() ? 1 : 0
    let steer = (controller.right.isPressed() ? 1 : 0) - (controller.left.isPressed() ? 1 : 0)
    let drift = controller.A.isPressed()

    // Check if car is on asphalt (11), white line (1), or red curb (2)
    let px = Math.clamp(0, 159, Math.round(x))
    let py = Math.clamp(0, 119, Math.round(y))
    let pixelColor = trackImg.getPixel(px, py)
    let onRoad = (pixelColor == 11 || pixelColor == 1 || pixelColor == 2)

    // Forward and sideways unit vectors
    let fx = Math.cos(angle)
    let fy = Math.sin(angle)
    let rx = -fy
    let ry = fx

    // Split velocity into forward speed and sideways drift speed
    let forward = vx * fx + vy * fy
    let sideways = vx * rx + vy * ry

    // Engine & Brake (grass slows the car down)
    let surfaceDrag = onRoad ? 0.98 : 0.91
    forward += (throttle * 145 - brake * 170) * dt
    forward *= surfaceDrag

    // Sideways grip (Hold A to drift, or slide on grass)
    let grip = !onRoad ? 2.8 : (drift ? 1.5 : 8.5)
    sideways -= sideways * Math.min(1, grip * dt)

    // Recombine and move car
    vx = fx * forward + rx * sideways
    vy = fy * forward + ry * sideways
    x += vx * dt
    y += vy * dt

    // Keep inside screen borders
    x = Math.clamp(6, 154, x)
    y = Math.clamp(6, 114, y)

    // Steering (only turns when moving; reverses when backing up)
    let speed = Math.sqrt(vx * vx + vy * vy)
    if (speed > 5) {
        let dir = forward >= 0 ? 1 : -1
        let turnFactor = Math.min(1, speed / 35)
        angle += steer * 3.8 * turnFactor * dir * dt
    }

    // Record tire skid marks when sliding sideways
    if (Math.abs(sideways) > 15 && speed > 20) {
        skidX.push(x - fx * 5)
        skidY.push(y - fy * 5)
        if (skidX.length > 80) {
            skidX.shift()
            skidY.shift()
        }
    }

    // --- RENDER FRAME ---
    // 1. Copy pre-drawn track onto background
    bg.drawImage(trackImg, 0, 0)

    // 2. Draw tire skid marks
    for (let i = 0; i < skidX.length; i++) {
        bg.setPixel(Math.round(skidX[i]), Math.round(skidY[i]), 15)
    }

    // 3. Draw educational physics vectors (Green = Nose, Yellow = Momentum)
    bg.drawLine(x, y, x + fx * 14, y + fy * 14, 7)
    bg.drawLine(x, y, x + vx * 0.18, y + vy * 0.18, 5)

    // 4. Draw rotating car
    drawCar(bg, x, y, angle)

    // 5. Minimal Speed & Drift HUD (Top-Left)
    let kmh = Math.round(speed * 1.4)
    bg.fillRect(2, 2, 54, 12, 15)
    bg.print(kmh + " km/h", 4, 4, 1)
    if (Math.abs(sideways) > 15 && speed > 20) {
        bg.print("DRIFT", 60, 4, 5)
    }
})

function drawTrack(img: Image) {
    img.fill(7) // Green grass

    // Draw red curbs and dark gray asphalt along waypoints
    for (let i = 0; i < trackX.length; i++) {
        let next = (i + 1) % trackX.length
        drawThickLine(img, trackX[i], trackY[i], trackX[next], trackY[next], roadWidth + 4, 2)
    }
    for (let i = 0; i < trackX.length; i++) {
        let next = (i + 1) % trackX.length
        drawThickLine(img, trackX[i], trackY[i], trackX[next], trackY[next], roadWidth, 11)
    }

    // White Start / Finish line
    img.fillRect(58, 14, 2, 21, 1)
}

function drawThickLine(img: Image, x0: number, y0: number, x1: number, y1: number, width: number, color: number) {
    let r = Math.floor(width / 2)
    let steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))
    for (let s = 0; s <= steps; s++) {
        let t = steps == 0 ? 0 : s / steps
        let cx = Math.round(x0 + (x1 - x0) * t)
        let cy = Math.round(y0 + (y1 - y0) * t)
        img.fillCircle(cx, cy, r, color)
    }
}

function drawCar(img: Image, cx: number, cy: number, a: number) {
    let fx = Math.cos(a)
    let fy = Math.sin(a)
    let rx = -fy
    let ry = fx

    // 4 corners of the car (length 12, width 6)
    let flx = cx + fx * 6 - rx * 3, fly = cy + fy * 6 - ry * 3
    let frx = cx + fx * 6 + rx * 3, fry = cy + fy * 6 + ry * 3
    let brx = cx - fx * 6 + rx * 3, bry = cy - fy * 6 + ry * 3
    let blx = cx - fx * 6 - rx * 3, bly = cy - fy * 6 - ry * 3

    // White & red racing body
    img.fillTriangle(flx, fly, frx, fry, brx, bry, 1)
    img.fillTriangle(flx, fly, brx, bry, blx, bly, 1)
    // Red nose
    img.fillCircle(cx + fx * 3, cy + fy * 3, 2, 2)
}