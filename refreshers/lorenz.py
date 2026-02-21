import numpy as np
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D

# Lorenz system parameters
sigma = 10.0
rho   = 28.0
beta  = 8.0 / 3.0

def lorenz(state, dt):
    x, y, z = state
    dx = sigma * (y - x)
    dy = x * (rho - z) - y
    dz = x * y - beta * z
    return np.array([x + dx * dt,
                     y + dy * dt,
                     z + dz * dt])

# Initial conditions and time setup
dt    = 0.01
steps = 10000
state = np.array([0.1, 0.0, 0.0])

# Integrate using simple Euler method
trajectory = np.empty((steps, 3))
for i in range(steps):
    state = lorenz(state, dt)
    trajectory[i] = state

# Plot
fig = plt.figure(figsize=(10, 7))
ax  = fig.add_subplot(111, projection='3d')
ax.plot(*trajectory.T, lw=0.5, alpha=0.8)
ax.set_title("Lorenz Attractor")
ax.set_xlabel("X")
ax.set_ylabel("Y")
ax.set_zlabel("Z")
plt.tight_layout()
plt.show()
