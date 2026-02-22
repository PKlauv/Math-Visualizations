# Math Visualizations

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

Interactive math visualizations that run in the browser. Covers chaos theory, topology, and fractals, all on a single page with tab switching and no reloads.

**[View Live](https://pklauv.github.io/Math-Visualizations/)**

## Visualizations

- **Lorenz Attractor**: Animated 3D trajectory of the classic chaotic system. Includes a camera orbit, the differential equations, and the story of how Lorenz stumbled onto chaos in 1963.

- **Mobius Strip**: A one-sided surface you can rotate and explore. Sliders let you change the number of half-twists and the strip width.

- **Klein Bottle**: A surface with no inside or outside, shown as a figure-8 immersion in 3D. Auto-rotates, with an opacity slider to see the self-intersection.

- **Sierpinski Triangle**: Built two ways: recursive subdivision and the chaos game. Watch it animate depth by depth, or see 50,000 random points converge into a fractal.

- **Mandelbrot Set**: Click-to-zoom fractal explorer with adjustable iteration count and multiple color palettes.

## Features

- **Single-page app**: Everything lives on one page with tab switching, no full page reloads
- **Hash routing**: Links like `index.html#lorenz` go directly to a visualization, and back/forward work as expected
- **Lazy loading**: Each visualization only initializes when you first open its tab
- **Pause/resume**: Leaving a tab pauses its animation; coming back resumes it
- **Mobile support**: Responsive layout with a scrollable tab bar on small screens
- **Educational write-ups**: Each page has equations (MathJax), parameter tables, and explanations written in plain language

## Built With

- [Plotly.js](https://plotly.com/javascript/) for 3D plots (Lorenz, Mobius, Klein)
- [MathJax](https://www.mathjax.org/) for LaTeX rendering
- HTML5 Canvas for 2D fractals (Sierpinski, Mandelbrot)
- Vanilla HTML, CSS, and JS. No build tools or frameworks.

## Project Structure

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

## How This Project Evolved

This repo started as a Python primer with a virtual environment and a requirements file. It changed direction when I added a 3D Lorenz attractor using Plotly.js. I spent a while getting the animation smooth, tuning the camera, and writing up the math and history behind it.

From there I added four more visualizations: the Mobius strip, Klein bottle, Sierpinski triangle, and Mandelbrot set. Each one got its own page with a shared nav bar and dark theme. The landing page had a card grid with canvas thumbnails.

The Klein bottle page needed several rounds of fixes to work properly on mobile. Layout and rendering issues kept coming up.

The biggest structural change was consolidating everything into a single-page app. Each visualization became its own JS module with `init/pause/resume` methods, and a tab controller handles routing, lazy loading, and fade transitions. No more full page reloads.

## License

[MIT](./LICENSE)
