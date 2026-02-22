// ==========================================================================
// Lorenz Attractor — extracted module for SPA tab integration
// Exposes: window.VizLorenz = { init(), pause(), resume() }
// All DOM IDs are prefixed with "lorenz-"
// ==========================================================================

window.VizLorenz = (function () {
    'use strict';

    var initialized = false;
    var active = false;

    // --- Lorenz system parameters (identical to lorenz.py) ---
    var SIGMA = 10.0;
    var RHO   = 28.0;
    var BETA  = 8.0 / 3.0;
    var DT    = 0.01;
    var STEPS = 10000;

    // Pre-computed trajectory
    var allX, allY, allZ, allC;

    // --- DOM references (set in init) ---
    var plotDiv, captionDiv, hudPhase, hudFill, hudDetail;
    var btnPause, btnSkip, btnReset;

    // --- Animation state ---
    var DRAW_BATCH   = 20;
    var ORBIT_FRAMES = 600;

    var phase, frame, drawnPoints, orbitAngle;

    var ORBIT_RADIUS = 2.0;
    var ORBIT_Z_BASE = 0.7;
    var ORBIT_Z_AMP  = 0.3;
    var DRAW_Z_START = 1.6;
    var DRAW_Z_END   = 0.7;
    var ORBIT_RX     = 2.2;
    var ORBIT_RY     = 1.6;

    var paused = false;
    var manualPause = false;
    var resumeTimer = null;
    var pauseStart = 0;
    var RESUME_DELAY = 5000;

    // Inferno colorscale
    var inferno = [
        [0.00, 'rgb(0,0,4)'],      [0.05, 'rgb(10,7,46)'],
        [0.10, 'rgb(31,12,87)'],    [0.15, 'rgb(55,12,110)'],
        [0.20, 'rgb(78,10,118)'],   [0.25, 'rgb(101,10,119)'],
        [0.30, 'rgb(124,13,113)'],  [0.35, 'rgb(147,22,100)'],
        [0.40, 'rgb(168,39,83)'],   [0.45, 'rgb(187,58,64)'],
        [0.50, 'rgb(203,80,45)'],   [0.55, 'rgb(216,105,27)'],
        [0.60, 'rgb(226,132,14)'],  [0.65, 'rgb(233,161,9)'],
        [0.70, 'rgb(237,190,18)'],  [0.75, 'rgb(237,218,48)'],
        [0.80, 'rgb(233,241,89)'],  [0.85, 'rgb(236,252,132)'],
        [0.90, 'rgb(245,254,176)'], [0.95, 'rgb(252,254,215)'],
        [1.00, 'rgb(252,255,252)']
    ];

    // --- Educational captions ---
    var captions = [
        { at: 0.00, text: 'Starts from almost nothing \u002D just 0.1 off zero' },
        { at: 0.15, text: 'First spiral forms around one of the fixed points' },
        { at: 0.35, text: 'Jumps to the other side \u002D this is where it gets chaotic' },
        { at: 0.58, text: 'Keeps switching lobes, never tracing the same path twice' },
        { at: 0.82, text: 'The full butterfly \u002D same equations every time, never the same path' },
        { at: 1.00, text: '' }
    ];

    function computeTrajectory() {
        var xs = new Float64Array(STEPS);
        var ys = new Float64Array(STEPS);
        var zs = new Float64Array(STEPS);
        var x = 0.1, y = 0.0, z = 0.0;

        for (var i = 0; i < STEPS; i++) {
            var dx = SIGMA * (y - x)     * DT;
            var dy = (x * (RHO - z) - y) * DT;
            var dz = (x * y - BETA * z)  * DT;
            x += dx; y += dy; z += dz;
            xs[i] = x; ys[i] = y; zs[i] = z;
        }

        var colors = new Float64Array(STEPS);
        for (var i = 0; i < STEPS; i++) colors[i] = i / (STEPS - 1);

        allX = Array.from(xs);
        allY = Array.from(ys);
        allZ = Array.from(zs);
        allC = Array.from(colors);
    }

    function updateCaption(progress) {
        var text = '';
        for (var i = captions.length - 1; i >= 0; i--) {
            if (progress >= captions[i].at) { text = captions[i].text; break; }
        }
        if (captionDiv.textContent !== text) {
            captionDiv.style.opacity = '0';
            setTimeout(function () {
                captionDiv.textContent = text;
                captionDiv.style.opacity = '1';
            }, 300);
        }
    }

    function updateHUD() {
        if (paused) {
            hudPhase.textContent = 'PAUSED';
            hudPhase.classList.add('paused');
            if (manualPause) {
                hudDetail.textContent = 'Paused';
            } else {
                var elapsed = Date.now() - pauseStart;
                var remaining = Math.max(0, Math.ceil((RESUME_DELAY - elapsed) / 1000));
                hudDetail.textContent = 'Resuming in ' + remaining + 's\u2026';
            }
            return;
        }
        hudPhase.classList.remove('paused');
        if (phase === 'draw') {
            hudPhase.textContent = 'DRAWING';
            var count = Math.min(drawnPoints, STEPS);
            hudDetail.textContent = count.toLocaleString() + ' / ' + STEPS.toLocaleString() + ' points';
            hudFill.style.width = ((count / STEPS) * 100).toFixed(1) + '%';
        } else if (phase === 'orbit') {
            var degrees = Math.round((frame / ORBIT_FRAMES) * 360);
            hudPhase.textContent = 'ORBITING';
            hudFill.style.width = ((frame / ORBIT_FRAMES) * 100).toFixed(1) + '%';
            hudDetail.textContent = degrees + '\u00B0 / 360\u00B0';
        } else {
            hudPhase.textContent = 'COMPLETE';
            hudFill.style.width = '100%';
            hudDetail.textContent = 'Press reset to replay';
        }
    }

    function drawCameraEye(angle, progress) {
        var z = DRAW_Z_START + (DRAW_Z_END - DRAW_Z_START) * progress;
        return {
            x: ORBIT_RADIUS * Math.cos(angle),
            y: ORBIT_RADIUS * Math.sin(angle),
            z: z
        };
    }

    function orbitCameraEye(angle) {
        return {
            x: ORBIT_RX * Math.cos(angle),
            y: ORBIT_RY * Math.sin(angle),
            z: ORBIT_Z_BASE + ORBIT_Z_AMP * Math.sin(angle * 2)
        };
    }

    function transitionToOrbit() {
        phase = 'orbit';
        frame = 0;
        Plotly.restyle(plotDiv, { 'marker.opacity': [0] }, 1);
        captionDiv.style.opacity = '0';
        setTimeout(function () {
            captionDiv.textContent = 'Drag to look around, or hit reset to run it again';
            captionDiv.style.opacity = '1';
        }, 300);
    }

    function transitionToDone() {
        phase = 'done';
        frame = ORBIT_FRAMES;
        captionDiv.style.opacity = '0';
        setTimeout(function () {
            captionDiv.textContent = 'Press reset to replay';
            captionDiv.style.opacity = '1';
        }, 300);
    }

    function resetToStart() {
        phase = 'draw';
        frame = 0;
        drawnPoints = 1;
        orbitAngle = 0;
        paused = false;
        manualPause = false;
        clearTimeout(resumeTimer);
        btnPause.textContent = '\u23F8';

        Plotly.restyle(plotDiv, {
            x: [[allX[0]]], y: [[allY[0]]], z: [[allZ[0]]],
            'line.color': [[allC[0]]]
        }, 0);
        Plotly.restyle(plotDiv, {
            x: [[allX[0]]], y: [[allY[0]]], z: [[allZ[0]]],
            'marker.opacity': [1]
        }, 1);
        Plotly.relayout(plotDiv, {
            'scene.camera.eye': drawCameraEye(0, 0)
        });
    }

    function tick() {
        if (!active) return;
        updateHUD();

        if (paused) { requestAnimationFrame(tick); return; }

        if (phase === 'draw') {
            var target = Math.min(STEPS, drawnPoints + DRAW_BATCH);
            drawnPoints = target;
            var tipIdx = drawnPoints - 1;

            Plotly.restyle(plotDiv, {
                x: [allX.slice(0, drawnPoints)],
                y: [allY.slice(0, drawnPoints)],
                z: [allZ.slice(0, drawnPoints)],
                'line.color': [allC.slice(0, drawnPoints)]
            }, 0);
            Plotly.restyle(plotDiv, {
                x: [[allX[tipIdx]]], y: [[allY[tipIdx]]], z: [[allZ[tipIdx]]],
                'marker.opacity': [1]
            }, 1);

            orbitAngle += 0.003;
            var progress = drawnPoints / STEPS;
            Plotly.relayout(plotDiv, {
                'scene.camera.eye': drawCameraEye(orbitAngle, progress)
            });
            updateCaption(progress);

            if (drawnPoints >= STEPS) {
                transitionToOrbit();
            }
        } else if (phase === 'orbit') {
            frame++;
            orbitAngle += (2 * Math.PI) / ORBIT_FRAMES;
            Plotly.relayout(plotDiv, {
                'scene.camera.eye': orbitCameraEye(orbitAngle)
            });
            if (frame >= ORBIT_FRAMES) {
                transitionToDone();
            }
        }

        requestAnimationFrame(tick);
    }

    function interactionPause() {
        if (phase === 'done') return;
        paused = true;
        manualPause = false;
        pauseStart = Date.now();
        btnPause.textContent = '\u25B6';
        clearTimeout(resumeTimer);
        resumeTimer = setTimeout(function () {
            if (!manualPause) {
                paused = false;
                btnPause.textContent = '\u23F8';
            }
        }, RESUME_DELAY);
    }

    // --- Public interface ---

    function init() {
        if (initialized) return;
        initialized = true;
        active = true;

        computeTrajectory();

        plotDiv    = document.getElementById('lorenz-plot');
        captionDiv = document.getElementById('lorenz-caption');
        hudPhase   = document.getElementById('lorenz-hud-phase');
        hudFill    = document.getElementById('lorenz-hud-progress-fill');
        hudDetail  = document.getElementById('lorenz-hud-detail');
        btnPause   = document.getElementById('lorenz-btn-pause');
        btnSkip    = document.getElementById('lorenz-btn-skip');
        btnReset   = document.getElementById('lorenz-btn-reset');

        // Trace 0: trajectory line
        var trace = {
            x: [allX[0]], y: [allY[0]], z: [allZ[0]],
            mode: 'lines', type: 'scatter3d',
            line: {
                color: [allC[0]], colorscale: inferno,
                width: 3, cmin: 0, cmax: 1
            },
            hoverinfo: 'skip'
        };

        // Trace 1: leading point
        var leadingPoint = {
            x: [allX[0]], y: [allY[0]], z: [allZ[0]],
            mode: 'markers', type: 'scatter3d',
            marker: { size: 4, color: '#ffe0b2', opacity: 1 },
            hoverinfo: 'skip'
        };

        var axStyle = {
            title: '', showticklabels: false,
            showgrid: true, gridcolor: '#1a1a1a',
            zerolinecolor: '#222', backgroundcolor: '#101010',
            showspikes: false
        };

        var layout = {
            paper_bgcolor: '#101010', plot_bgcolor: '#101010',
            scene: {
                bgcolor: '#101010',
                xaxis: axStyle, yaxis: axStyle, zaxis: axStyle,
                camera: { eye: { x: 1.8, y: 1.8, z: 1.6 } },
                dragmode: 'orbit'
            },
            margin: { l: 0, r: 0, t: 0, b: 0 },
            showlegend: false
        };

        var config = { responsive: true, displayModeBar: false, scrollZoom: false };

        Plotly.newPlot(plotDiv, [trace, leadingPoint], layout, config);

        // Init animation state
        phase = 'draw';
        frame = 0;
        drawnPoints = 1;
        orbitAngle = 0;

        // Event listeners
        plotDiv.addEventListener('mousedown', interactionPause);
        plotDiv.addEventListener('touchstart', interactionPause);

        btnPause.addEventListener('click', function () {
            if (phase === 'done') return;
            if (paused) {
                paused = false; manualPause = false;
                clearTimeout(resumeTimer);
                btnPause.textContent = '\u23F8';
            } else {
                paused = true; manualPause = true;
                clearTimeout(resumeTimer);
                btnPause.textContent = '\u25B6';
            }
        });

        btnSkip.addEventListener('click', function () {
            if (phase === 'done') return;
            if (paused) {
                paused = false; manualPause = false;
                clearTimeout(resumeTimer);
                btnPause.textContent = '\u23F8';
            }
            if (phase === 'draw') {
                drawnPoints = STEPS;
                Plotly.restyle(plotDiv, {
                    x: [allX], y: [allY], z: [allZ], 'line.color': [allC]
                }, 0);
                transitionToOrbit();
            } else if (phase === 'orbit') {
                transitionToDone();
            }
        });

        btnReset.addEventListener('click', function () {
            resetToStart();
        });

        requestAnimationFrame(tick);
    }

    function pause() {
        active = false;
    }

    function resume() {
        if (!initialized) return init();
        active = true;
        requestAnimationFrame(function () {
            Plotly.Plots.resize(plotDiv);
            requestAnimationFrame(tick);
        });
    }

    return { init: init, pause: pause, resume: resume };
})();
