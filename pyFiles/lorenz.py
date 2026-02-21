import numpy as np
import matplotlib.pyplot as plt
import matplotlib.colors as mcolors
from mpl_toolkits.mplot3d import Axes3D
from mpl_toolkits.mplot3d.art3d import Line3DCollection

# Lorenz system parameters
sigma = 10.0
rho   = 28.0
beta  = 8.0 / 3.0

# Initial conditions and time setup
dt    = 0.01
steps = 10000
state = np.array([0.1, 0.0, 0.0], dtype=np.float64)

# Integrate using inlined Euler — avoids per-step np.array() allocation
trajectory = np.empty((steps, 3), dtype=np.float64)
for i in range(steps):
    x, y, z  = state[0], state[1], state[2]
    state[0] = x + sigma * (y - x)     * dt
    state[1] = y + (x * (rho - z) - y) * dt
    state[2] = z + (x * y - beta * z)  * dt
    trajectory[i] = state

# Build 200 chunked polylines instead of 9999 two-point segments.
# Line3DCollection accepts (M, 3) polylines — depth-sort drops from O(9999) to O(200).
# Chunks must have uniform size to avoid array shape mismatch errors.
n_chunks   = 200
chunk_size = steps // n_chunks   # 50 (divides evenly)

chunks = []
for i in range(n_chunks):
    start = i * chunk_size
    end = min(start + chunk_size, steps)
    chunks.append(trajectory[start:end])

t_colors = np.linspace(0.0, 1.0, n_chunks)

norm = mcolors.Normalize(vmin=0.0, vmax=1.0)
lc   = Line3DCollection(chunks, cmap='inferno', norm=norm, linewidth=0.5)
lc.set_array(t_colors)

# Figure with dark background
fig = plt.figure(figsize=(10, 7), facecolor='#0a0a0a')
ax  = fig.add_subplot(111, projection='3d')
ax.set_facecolor('#0a0a0a')

for axis in [ax.xaxis, ax.yaxis, ax.zaxis]:
    axis.pane.fill = False
    axis.pane.set_edgecolor('#2a2a2a')

ax.add_collection3d(lc)

# Line3DCollection does not trigger autoscale — set limits manually
ax.set_xlim(trajectory[:, 0].min(), trajectory[:, 0].max())
ax.set_ylim(trajectory[:, 1].min(), trajectory[:, 1].max())
ax.set_zlim(trajectory[:, 2].min(), trajectory[:, 2].max())

# Colorbar
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

# Scroll-wheel zoom
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
plt.show()
