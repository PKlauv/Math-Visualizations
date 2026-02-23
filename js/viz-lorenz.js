// ==========================================================================
// Lorenz Attractor — extracted module for SPA tab integration
// Exposes: window.VizLorenz = { init(), pause(), resume(), togglePause(), reset(), skip() }
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
    var hudFrameCount = 0;

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
        VizShared.fadeCaption(captionDiv, text);
    }

    function updateHUD() {
        if (paused) {
            if (hudPhase.textContent !== 'PAUSED') hudPhase.textContent = 'PAUSED';
            hudPhase.classList.add('paused');
            if (manualPause) {
                if (hudDetail.textContent !== 'Paused') hudDetail.textContent = 'Paused';
            } else {
                var elapsed = Date.now() - pauseStart;
                var remaining = Math.max(0, Math.ceil((VizShared.RESUME_DELAY - elapsed) / 1000));
                hudDetail.textContent = 'Resuming in ' + remaining + 's\u2026';
            }
            return;
        }
        hudPhase.classList.remove('paused');
        if (phase === 'draw') {
            if (hudPhase.textContent !== 'DRAWING') hudPhase.textContent = 'DRAWING';
            var count = Math.min(drawnPoints, STEPS);
            hudDetail.textContent = count.toLocaleString() + ' / ' + STEPS.toLocaleString() + ' points';
            hudFill.style.transform = 'scaleX(' + (count / STEPS) + ')';
        } else if (phase === 'orbit') {
            var degrees = Math.round((frame / ORBIT_FRAMES) * 360);
            if (hudPhase.textContent !== 'ORBITING') hudPhase.textContent = 'ORBITING';
            hudFill.style.transform = 'scaleX(' + (frame / ORBIT_FRAMES) + ')';
            hudDetail.textContent = degrees + '\u00B0 / 360\u00B0';
        } else {
            if (hudPhase.textContent !== 'COMPLETE') hudPhase.textContent = 'COMPLETE';
            hudFill.style.transform = 'scaleX(1)';
            if (hudDetail.textContent !== 'Press reset to replay') hudDetail.textContent = 'Press reset to replay';
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
        VizShared.fadeCaption(captionDiv, 'Drag to look around, or hit reset to run it again');
        // Memory cleanup: trajectory data is already in the Plotly trace, free the JS arrays
        allX = null; allY = null; allZ = null; allC = null;
    }

    function transitionToDone() {
        phase = 'done';
        frame = ORBIT_FRAMES;
        VizShared.fadeCaption(captionDiv, 'Press reset to replay');
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
        btnPause.setAttribute('aria-label', 'Pause animation');

        // Recompute trajectory if it was freed after draw phase
        if (!allX) computeTrajectory();

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

        hudFrameCount++;
        if (hudFrameCount >= VizShared.HUD_UPDATE_INTERVAL) {
            hudFrameCount = 0;
            updateHUD();
        }

        if (paused) { requestAnimationFrame(tick); return; }

        if (phase === 'draw') {
            var prevDrawn = drawnPoints;
            var target = Math.min(STEPS, drawnPoints + DRAW_BATCH);
            drawnPoints = target;
            var tipIdx = drawnPoints - 1;

            Plotly.extendTraces(plotDiv, {
                x: [allX.slice(prevDrawn, drawnPoints)],
                y: [allY.slice(prevDrawn, drawnPoints)],
                z: [allZ.slice(prevDrawn, drawnPoints)],
                'line.color': [allC.slice(prevDrawn, drawnPoints)]
            }, [0]);
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
        btnPause.setAttribute('aria-label', 'Resume animation');
        clearTimeout(resumeTimer);
        resumeTimer = setTimeout(function () {
            if (!manualPause) {
                paused = false;
                btnPause.textContent = '\u23F8';
                btnPause.setAttribute('aria-label', 'Pause animation');
            }
        }, VizShared.RESUME_DELAY);
    }

    // --- Public interface ---

    function init() {
        if (initialized) return;
        initialized = true;
        active = true;

        if (typeof Plotly === 'undefined') {
            console.warn('VizLorenz: Plotly not loaded');
            return;
        }

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

        var layout = VizShared.plotlyBaseLayout({
            camera: { eye: { x: 1.8, y: 1.8, z: 1.6 } }
        });

        Plotly.newPlot(plotDiv, [trace, leadingPoint], layout, VizShared.PLOTLY_CONFIG);
        VizShared.fixPlotlyScroll(plotDiv);

        phase = 'draw';
        frame = 0;
        drawnPoints = 1;
        orbitAngle = 0;

        plotDiv.addEventListener('mousedown', interactionPause);
        plotDiv.addEventListener('touchstart', interactionPause);

        btnPause.addEventListener('click', function () {
            togglePause();
        });

        btnSkip.addEventListener('click', function () {
            skip();
        });

        btnReset.addEventListener('click', function () {
            resetToStart();
        });

        // Theme change listener
        document.addEventListener('themechange', function () {
            if (initialized && plotDiv) {
                VizShared.relayoutPlotlyTheme(plotDiv);
            }
        });

        requestAnimationFrame(tick);
    }

    function togglePause() {
        if (phase === 'done') return;
        if (paused) {
            paused = false; manualPause = false;
            clearTimeout(resumeTimer);
            btnPause.textContent = '\u23F8';
            btnPause.setAttribute('aria-label', 'Pause animation');
            VizShared.announce('Resumed');
        } else {
            paused = true; manualPause = true;
            clearTimeout(resumeTimer);
            btnPause.textContent = '\u25B6';
            btnPause.setAttribute('aria-label', 'Resume animation');
            VizShared.announce('Paused');
        }
    }

    function skip() {
        if (phase === 'done') return;
        if (paused) {
            paused = false; manualPause = false;
            clearTimeout(resumeTimer);
            btnPause.textContent = '\u23F8';
            btnPause.setAttribute('aria-label', 'Pause animation');
        }
        if (phase === 'draw') {
            drawnPoints = STEPS;
            if (allX) {
                Plotly.restyle(plotDiv, {
                    x: [allX], y: [allY], z: [allZ], 'line.color': [allC]
                }, 0);
            }
            transitionToOrbit();
        } else if (phase === 'orbit') {
            transitionToDone();
        }
    }

    function pause() {
        active = false;
        clearTimeout(resumeTimer);
    }

    function resume() {
        if (!initialized) return init();
        active = true;
        requestAnimationFrame(function () {
            Plotly.Plots.resize(plotDiv);
            requestAnimationFrame(tick);
        });
    }

    return {
        init: init,
        pause: pause,
        resume: resume,
        togglePause: togglePause,
        reset: resetToStart,
        skip: skip
    };
})();
