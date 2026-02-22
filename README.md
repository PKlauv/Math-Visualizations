# Math Phenomena, Visualized

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![CSS3](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/CSS)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Plotly](https://img.shields.io/badge/Plotly.js-3F4F75?logo=plotly&logoColor=white)](https://plotly.com/javascript/)
[![GitHub Pages](https://img.shields.io/badge/Deployed-GitHub%20Pages-blue?logo=github)](https://pages.github.com/)

Interactive math visualizations that run in the browser. Covers chaos theory, topology, and fractals, all on a single page with tab switching and no reloads.

**[View Live](https://pklauv.github.io/Math-Phenomena/)**

---

## :art: Visualizations

- **Lorenz Attractor**: Animated 3D trajectory of the classic chaotic system. Includes a camera orbit, the differential equations, and the story of how Lorenz stumbled onto chaos in 1963.

- **Mobius Strip**: A one-sided surface you can rotate and explore. Sliders let you change the number of half-twists and the strip width.

- **Klein Bottle**: A surface with no inside or outside, shown as a figure-8 immersion in 3D. Auto-rotates, with an opacity slider to see the self-intersection.

- **Sierpinski Triangle**: Built two ways: recursive subdivision and the chaos game. Watch it animate depth by depth, or see 50,000 random points converge into a fractal.

- **Mandelbrot Set**: Click-to-zoom fractal explorer with adjustable iteration count and multiple color palettes.

## :sparkles: Features

- **Single-page app**: Everything lives on one page with tab switching, no full page reloads
- **Hash routing**: Links like `index.html#lorenz` go directly to a visualization, and back/forward work as expected
- **Lazy loading**: Each visualization only initializes when you first open its tab
- **Pause/resume**: Leaving a tab pauses its animation; coming back resumes it
- **Mobile support**: Responsive layout with a scrollable tab bar on small screens
- **Educational write-ups**: Each page has equations (MathJax), parameter tables, and explanations written in plain language
TEST
## :hammer_and_wrench: Built With

| Category | Tech |
|----------|------|
| 3D Plots | [Plotly.js](https://plotly.com/javascript/) (Lorenz, Mobius, Klein) |
| Math Rendering | [MathJax](https://www.mathjax.org/) for LaTeX |
| 2D Fractals | HTML5 Canvas (Sierpinski, Mandelbrot) |
| Backend | [Supabase](https://supabase.com/) for feedback form |
| Core | Vanilla HTML, CSS, and JS. No build tools or frameworks. |

---

## :brain: What I Learned

<details>
<summary><strong>JavaScript</strong></summary>

- **Module pattern (IIFE)** for encapsulating each visualization so nothing leaks into global scope
- **`requestAnimationFrame`** for smooth 60fps animation loops (Lorenz orbit, Sierpinski depth stepping)
- **Web Workers** for off-thread computation so the Mandelbrot renderer doesn't freeze the UI
- **`async/await`** with Supabase for inserting feedback and handling anonymous auth
- **Page Visibility API** to pause animations when the tab is hidden and resume on return
- **Hash-based routing** with `popstate` to make back/forward buttons work in a single-page app
- **Debounced resize handlers** so Plotly relayouts and canvas redraws don't fire on every pixel of a window drag
- **`Float64Array` / typed arrays** for passing pixel data between the main thread and the Mandelbrot worker
- **Canvas 2D API**
  - Direct pixel manipulation with `ImageData`
  - Drawing primitives for Sierpinski triangles
  - DPR scaling so fractals look sharp on retina screens
- **Force reflow trick** (`offsetHeight` read) to restart CSS transitions on tab switches

</details>

<details>
<summary><strong>CSS</strong></summary>

- **CSS custom properties** (`--bg`, `--text`, `--accent`) for consistent dark theming
- **CSS Grid and Flexbox** for page layout, tab bars, and card grids
- **`backdrop-filter: blur()`** for a glassmorphic look on panels and overlays
- **Responsive design** with media queries to collapse the tab bar and stack content on mobile
- **Transitions and transforms** for hover effects, tab fade-ins, and card animations
- **Vendor prefixes** (`-webkit-backdrop-filter`, `-moz-`) for cross-browser support

</details>

<details>
<summary><strong>Math and Algorithms</strong></summary>

- **Lorenz system**: numerically integrating a system of three coupled ODEs with a fixed time step
- **Parametric surfaces**: generating meshes for the Mobius strip and Klein bottle from parametric equations
- **Recursive fractal subdivision**: splitting triangles into smaller triangles for the Sierpinski triangle
- **Chaos game algorithm**: picking random vertices and plotting midpoints to grow a Sierpinski triangle from noise
- **Mandelbrot escape-time iteration**: iterating `z = z^2 + c` and using smooth coloring with the normalized iteration count
- **Complex number arithmetic**: mapping pixel coordinates to the complex plane and zooming into regions

</details>

<details>
<summary><strong>Web Dev and Tooling</strong></summary>

- **Single-page app architecture** without a framework: one HTML shell, JS modules with `init/pause/resume`, and a tab controller
- **Lazy initialization pattern** so each visualization only loads when its tab is first opened
- **GitHub Pages deployment** from the repo root
- **Supabase integration** for a feedback form (database inserts + anonymous auth, no server needed)
- **MathJax** for rendering LaTeX equations inline with the educational write-ups
- **Plotly.js** for interactive 3D surface and scatter plots with custom camera angles

</details>

---

## :open_file_folder: Project Structure

```
index.html                 - SPA shell with all tab panels
css/shared.css             - shared styles, transitions, viz component classes
js/tab-controller.js       - tab switching, hash routing, lazy init
js/viz-lorenz.js           - Lorenz attractor module
js/viz-mobius.js            - Mobius strip module
js/viz-klein.js             - Klein bottle module
js/viz-sierpinski.js        - Sierpinski triangle module
js/viz-mandelbrot.js        - Mandelbrot set module
js/mandelbrot-worker.js     - Web Worker for off-thread Mandelbrot rendering
visualizations/*.html       - standalone pages (kept for backward compat)
```

## :seedling: How This Project Evolved

This repo started as a Python primer with a virtual environment and a requirements file. It changed direction when I added a 3D Lorenz attractor using Plotly.js. I spent a while getting the animation smooth, tuning the camera, and writing up the math and history behind it.

From there I added four more visualizations: the Mobius strip, Klein bottle, Sierpinski triangle, and Mandelbrot set. Each one got its own page with a shared nav bar and dark theme. The landing page had a card grid with canvas thumbnails.

The Klein bottle page needed several rounds of fixes to work properly on mobile. Layout and rendering issues kept coming up.

The biggest structural change was consolidating everything into a single-page app. Each visualization became its own JS module with `init/pause/resume` methods, and a tab controller handles routing, lazy loading, and fade transitions. No more full page reloads.

> What started as a Python primer turned into a deep dive into browser graphics, math, and vanilla JS architecture.

## :page_facing_up: License

[MIT](./LICENSE)
