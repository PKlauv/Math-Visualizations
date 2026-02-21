# Lorenz Attractor

Interactive 3D visualization of the Lorenz attractor — the iconic "butterfly" of chaos theory.

## Files

### `lorenz.py`
- Euler integration of the Lorenz ODEs (sigma=10, rho=28, beta=8/3)
- Chunked `Line3DCollection` rendering for smooth 3D performance
- Dark theme with time-based inferno colormap and colorbar
- Scroll-wheel zoom
- "Learn More" button opens the companion HTML page in your default browser

### `lorenz_info.html`
- Static educational page covering the background story, differential equations, parameter meanings, and real-world applications of the Lorenz attractor
- Dark theme with LaTeX equations rendered via MathJax

## Getting Started

Install dependencies:
```bash
pip install numpy matplotlib
```

Run the visualization:
```bash
python lorenz.py
```
