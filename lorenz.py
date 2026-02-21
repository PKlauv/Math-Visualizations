# --- Imports ---
import numpy as np                              # numerical arrays and fast math
import matplotlib.pyplot as plt                  # 2D/3D plotting framework
import matplotlib.colors as mcolors              # colormap normalization
from mpl_toolkits.mplot3d import Axes3D          # 3D axes projection
from mpl_toolkits.mplot3d.art3d import Line3DCollection  # efficient batched 3D line rendering
from matplotlib.widgets import Button            # clickable UI button on the figure
import webbrowser                                # opens URLs in the default browser
import os                                        # path manipulation (dirname, abspath)
import pathlib                                   # converts file paths to file:// URIs

# --- Lorenz system parameters ---
# These three constants define the Lorenz system of differential equations,
# originally derived from a simplified model of atmospheric convection.
# The classic values below sit squarely in the chaotic regime.
sigma = 10.0    # Prandtl number — ratio of viscosity to thermal conductivity
rho   = 28.0    # Rayleigh number — proportional to the temperature gradient driving convection
beta  = 8.0 / 3.0  # geometric factor — related to the aspect ratio of the convection cell

# --- Initial conditions and time setup ---
dt    = 0.01    # time step for Euler integration
steps = 10000   # total number of integration steps (10000 * 0.01 = 100 time units)
state = np.array([0.1, 0.0, 0.0], dtype=np.float64)  # starting point near the origin

# --- Euler integration ---
# Inlined Euler method instead of scipy.integrate.odeint for performance:
# avoids per-step np.array() allocation and function-call overhead.
# For visualization purposes the small dt keeps the error negligible.
trajectory = np.empty((steps, 3), dtype=np.float64)
for i in range(steps):
    x, y, z  = state[0], state[1], state[2]
    state[0] = x + sigma * (y - x)     * dt      # dx/dt = sigma * (y - x)
    state[1] = y + (x * (rho - z) - y) * dt      # dy/dt = x*(rho - z) - y
    state[2] = z + (x * y - beta * z)  * dt      # dz/dt = x*y - beta*z
    trajectory[i] = state

# --- Chunked polylines for efficient rendering ---
# Instead of 9999 individual two-point segments, we group the trajectory into
# 200 polyline chunks. Line3DCollection depth-sorts every segment each frame,
# so fewer chunks (O(200) vs O(9999)) means significantly faster rendering.
# Chunks must be uniform size to avoid array shape mismatch errors.
n_chunks   = 200
chunk_size = steps // n_chunks   # 50 points per chunk (divides evenly)

chunks = []
for i in range(n_chunks):
    start = i * chunk_size
    end = min(start + chunk_size, steps)
    chunks.append(trajectory[start:end])

# Map each chunk to a normalized time value [0, 1] for coloring
t_colors = np.linspace(0.0, 1.0, n_chunks)

norm = mcolors.Normalize(vmin=0.0, vmax=1.0)
lc   = Line3DCollection(chunks, cmap='inferno', norm=norm, linewidth=0.5)
lc.set_array(t_colors)  # assign time-based color to each chunk

# --- Dark-themed figure setup ---
fig = plt.figure(figsize=(10, 7), facecolor='#0a0a0a')  # near-black background
ax  = fig.add_subplot(111, projection='3d')
ax.set_facecolor('#0a0a0a')

# Make axis panes transparent with subtle dark edges
for axis in [ax.xaxis, ax.yaxis, ax.zaxis]:
    axis.pane.fill = False
    axis.pane.set_edgecolor('#2a2a2a')

ax.add_collection3d(lc)

# --- Axis limits ---
# Line3DCollection does not trigger matplotlib's autoscale, so we must
# set axis limits manually from the trajectory's bounding box.
ax.set_xlim(trajectory[:, 0].min(), trajectory[:, 0].max())
ax.set_ylim(trajectory[:, 1].min(), trajectory[:, 1].max())
ax.set_zlim(trajectory[:, 2].min(), trajectory[:, 2].max())

# --- Colorbar ---
# Maps the 'inferno' colormap to simulation time so the viewer can see
# how the trajectory evolves. Styled to match the dark theme.
cb = fig.colorbar(lc, ax=ax, shrink=0.5, pad=0.1, label='Time')
cb.ax.yaxis.set_tick_params(color='white')
cb.ax.yaxis.label.set_color('white')
plt.setp(plt.getp(cb.ax.axes, 'yticklabels'), color='white')
cb.outline.set_edgecolor('#333333')

# Labels and title
ax.set_title("Lorenz Attractor", color='white', fontsize=14, pad=15)
ax.set_xlabel("X", color='white')
ax.set_ylabel("Y", color='white')
ax.set_zlabel("Z", color='white')
ax.tick_params(axis='both', colors='white')

# --- Scroll-wheel zoom ---
# Adjusts the internal ax._dist camera distance on scroll events.
# Clamped between DIST_MIN (close) and DIST_MAX (far) to prevent
# the camera from inverting or flying too far away.
DIST_MIN, DIST_MAX, ZOOM_SPEED = 3, 50, 1.2

def on_scroll(event):
    if event.inaxes is not ax:
        return
    if event.button == 'up':
        ax._dist = max(DIST_MIN, ax._dist - ZOOM_SPEED)
    elif event.button == 'down':
        ax._dist = min(DIST_MAX, ax._dist + ZOOM_SPEED)
    fig.canvas.draw_idle()

fig.canvas.mpl_connect('scroll_event', on_scroll)

plt.tight_layout()

# --- "Learn More" button ---
# Opens the companion HTML page (lorenz_info.html) in the user's default
# browser. The HTML page covers background, equations, parameters, and
# real-world applications of the Lorenz attractor.
btn_ax = fig.add_axes([0.78, 0.02, 0.18, 0.06])
learn_btn = Button(btn_ax, 'Learn More', color='#1a1a2e', hovercolor='#e25822')
learn_btn.label.set_color('white')
learn_btn.label.set_fontsize(10)
learn_btn.label.set_fontweight('bold')
for spine in btn_ax.spines.values():
    spine.set_edgecolor('#e25822')
    spine.set_linewidth(0.8)

def open_learn_more(event):
    """Resolve lorenz_info.html relative to this script and open as a file:// URI."""
    html_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lorenz_info.html')
    webbrowser.open(pathlib.Path(html_path).as_uri())

learn_btn.on_clicked(open_learn_more)

plt.show()
