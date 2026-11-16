# সিলেট BRTC বাস সিমুলেটর (Sylhet BRTC Bus Simulator)

A browser-based 2.5D bus-driving game built with vanilla HTML5 Canvas + JavaScript.

Drive a **BRTC double-decker bus** from **SUST** all the way to **Madina Market**, through
recognisable Sylhet streets:

SUST → টিলাগড় (Tilagor) → Mount Adora Hospital → Shwapno → Zindabazar →
Ambarkhana → Bondor Bazar → Madina Market.

- Pick up students at each stop — fare is **৳5** per passenger.
- Dodge rickshaws and CNG auto-rickshaws on the road.
- Animated roads, parallax landmarks, traffic, clouds and a HUD with route progress.

## Controls
- **→ / D** — accelerate (gas)
- **← / A** — brake / reverse
- **Space** — open the bus door and board waiting students
- **H / ↑** — horn
- **P** — pause · **R** — restart

On phones/tablets use the on-screen touch buttons.

## Run locally
Just open `index.html` in a browser, or serve the folder:

```bash
npx serve .
```

## Deploy
Static site — deploy `index.html`, `style.css`, `game.js` to any static host (Vercel, Netlify, GitHub Pages).
