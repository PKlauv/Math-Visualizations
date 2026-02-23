// ==========================================================================
// Mobius Strip — extracted module for SPA tab integration
// Exposes: window.VizMobius = { init(), pause(), resume(), togglePause(), reset(), skip(), adjustSlider() }
// All DOM IDs are prefixed with "mobius-"
// ==========================================================================

window.VizMobius = (function () {
    'use strict';

    var initialized = false;
    var active = false;

    // --- Surface parameters ---
    var U_STEPS = 80;
    var V_STEPS = 20;
    var TWO_PI = 2 * Math.PI;

    var nTwists = 1;
    var halfWidth = 0.4;

    var colorscale = [
        [0, 'rgb(30,10,60)'],
        [0.5, 'rgb(120,60,20)'],
        [1, 'rgb(200,162,106)']
    ];

    // DOM references
    var plotDiv, captionDiv, hudPhase, hudFill, hudDetail;
    var btnPause, btnSkip, btnReset;
    var twistSlider, widthSlider, twistVal, widthVal;

    // Animation state
    var DRAW_FRAMES = 60;
    var ORBIT_FRAMES = 200;
    var phase, frame, orbitAngle;

    var ORBIT_RADIUS = 1.2;
    var ORBIT_Z_BASE = 2.0;
    var ORBIT_Z_AMP  = 0.2;
    var ORBIT_RX     = 1.2;
    var ORBIT_RY     = 1.0;

    var paused = false;
    var manualPause = false;
    var resumeTimer = null;
    var pauseStart = 0;
    var hudFrameCount = 0;

    // Direct WebGL scene reference for fast camera updates (avoids Plotly.relayout)
    var glSceneRef = null;

    // Pre-computed surface frames for the DRAW phase
    var drawFrameCache = [];

    var captions = [
        { at: 0.00, text: 'Building the strip from the first cross-section...' },
        { at: 0.20, text: 'The surface curves through 3D space as u sweeps around' },
        { at: 0.45, text: 'Halfway around. The cross-section has rotated 90\u00B0' },
        { at: 0.70, text: 'Almost closed. Notice how "top" connects to "bottom"' },
        { at: 0.95, text: 'The half-twist is complete. One side, one edge' },
        { at: 1.00, text: '' }
    ];

    function computeSurface(twists, W, uMax) {
        var uSteps = Math.max(2, Math.round((uMax / TWO_PI) * U_STEPS));
        var xData = [], yData = [], zData = [];

        for (var i = 0; i <= uSteps; i++) {
            var u = (i / U_STEPS) * TWO_PI;
            if (u > uMax) u = uMax;
            var xRow = [], yRow = [], zRow = [];
            for (var j = 0; j <= V_STEPS; j++) {
                var v = -W + (2 * W * j) / V_STEPS;
                var cosHalf = Math.cos(twists * u / 2);
                var sinHalf = Math.sin(twists * u / 2);
                var r = 1 + v * cosHalf;
                xRow.push(r * Math.cos(u));
                yRow.push(r * Math.sin(u));
                zRow.push(v * sinHalf);
            }
            xData.push(xRow); yData.push(yRow); zData.push(zRow);
        }
        return { x: xData, y: yData, z: zData };
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
            var sliceCount = Math.round((frame / DRAW_FRAMES) * U_STEPS);
            sliceCount = Math.min(sliceCount, U_STEPS);
            hudDetail.textContent = sliceCount + ' / ' + U_STEPS + ' slices';
            hudFill.style.transform = 'scaleX(' + (frame / DRAW_FRAMES) + ')';
        } else if (phase === 'orbit') {
            var degrees = Math.round((frame / ORBIT_FRAMES) * 360);
            if (hudPhase.textContent !== 'ORBITING') hudPhase.textContent = 'ORBITING';
            hudFill.style.transform = 'scaleX(' + (frame / ORBIT_FRAMES) + ')';
            hudDetail.textContent = degrees + '\u00B0 / 360\u00B0';
        } else {
            if (hudPhase.textContent !== 'COMPLETE') hudPhase.textContent = 'COMPLETE';
            hudFill.style.transform = 'scaleX(1)';
            if (hudDetail.textContent !== 'Adjust sliders or reset to replay') hudDetail.textContent = 'Adjust sliders or reset to replay';
        }
    }

    function drawCameraEye(angle, progress) {
        var z = 2.8 - 0.6 * progress;
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

    function setCamera(eye) {
        if (!glSceneRef) {
            var s = plotDiv._fullLayout && plotDiv._fullLayout.scene &&
                    plotDiv._fullLayout.scene._scene;
            if (s && s.setCamera) glSceneRef = s;
        }
        if (glSceneRef) {
            glSceneRef.setCamera({
                eye: eye,
                center: { x: 0, y: 0, z: 0 },
                up: { x: 0, y: 0, z: 1 }
            });
        } else {
            Plotly.relayout(plotDiv, { 'scene.camera.eye': eye });
        }
    }

    function precomputeDrawFrames() {
        drawFrameCache = new Array(DRAW_FRAMES + 1);
        for (var f = 0; f <= DRAW_FRAMES; f++) {
            var progress = Math.min(f / DRAW_FRAMES, 1.0);
            var uMax = progress * TWO_PI;
            if (uMax < 0.01) uMax = 0.01;
            drawFrameCache[f] = computeSurface(nTwists, halfWidth, uMax);
        }
    }

    function transitionToOrbit() {
        phase = 'orbit'; frame = 0;
        VizShared.fadeCaption(captionDiv, 'Drag to look around, or adjust sliders to explore');
        // Memory cleanup: draw phase frames no longer needed
        drawFrameCache = [];
    }

    function transitionToDone() {
        phase = 'done'; frame = ORBIT_FRAMES;
        VizShared.fadeCaption(captionDiv, 'Adjust sliders to explore, or press reset to replay');
    }

    function resetToStart() {
        phase = 'draw'; frame = 0; orbitAngle = 0;
        paused = false; manualPause = false;
        clearTimeout(resumeTimer);
        btnPause.textContent = '\u23F8';
        btnPause.setAttribute('aria-label', 'Pause animation');

        precomputeDrawFrames();
        var initial = drawFrameCache[0];
        Plotly.restyle(plotDiv, { x: [initial.x], y: [initial.y], z: [initial.z] }, 0);
        setCamera(drawCameraEye(0, 0));
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
            frame++;
            var progress = Math.min(frame / DRAW_FRAMES, 1.0);

            // Update surface from pre-computed cache; skip alternate frames
            if (frame % 2 === 0 || frame >= DRAW_FRAMES) {
                var partial = drawFrameCache[Math.min(frame, DRAW_FRAMES)];
                Plotly.restyle(plotDiv, { x: [partial.x], y: [partial.y], z: [partial.z] }, 0);
            }

            orbitAngle += 0.008;
            setCamera(drawCameraEye(orbitAngle, progress));
            updateCaption(progress);

            if (frame >= DRAW_FRAMES) {
                transitionToOrbit();
            }
        } else if (phase === 'orbit') {
            frame++;
            orbitAngle += (2 * Math.PI) / ORBIT_FRAMES;
            setCamera(orbitCameraEye(orbitAngle));
            if (frame >= ORBIT_FRAMES) {
                transitionToDone();
            }
        }

        requestAnimationFrame(tick);
    }

    function interactionPause() {
        if (phase === 'done') return;
        paused = true; manualPause = false;
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

    function onSliderChange() {
        nTwists = parseInt(twistSlider.value, 10);
        halfWidth = parseFloat(widthSlider.value);
        twistVal.textContent = nTwists;
        widthVal.textContent = halfWidth.toFixed(2);
        twistSlider.setAttribute('aria-valuenow', nTwists);
        widthSlider.setAttribute('aria-valuenow', halfWidth);

        var full = computeSurface(nTwists, halfWidth, TWO_PI);
        Plotly.restyle(plotDiv, { x: [full.x], y: [full.y], z: [full.z] }, 0);

        phase = 'done'; frame = ORBIT_FRAMES;
        paused = false; manualPause = false;
        clearTimeout(resumeTimer);
        btnPause.textContent = '\u23F8';
        btnPause.setAttribute('aria-label', 'Pause animation');

        var label = nTwists === 1 ? 'half-twist' : 'half-twists';
        VizShared.fadeCaption(captionDiv, nTwists + ' ' + label + ', width ' + halfWidth.toFixed(2) + '. Drag to explore');
        updateHUD();
    }

    // --- Public interface ---

    function init() {
        if (initialized) return;
        initialized = true;
        active = true;

        if (typeof Plotly === 'undefined') {
            console.warn('VizMobius: Plotly not loaded');
            return;
        }

        plotDiv     = document.getElementById('mobius-plot');
        captionDiv  = document.getElementById('mobius-caption');
        hudPhase    = document.getElementById('mobius-hud-phase');
        hudFill     = document.getElementById('mobius-hud-progress-fill');
        hudDetail   = document.getElementById('mobius-hud-detail');
        btnPause    = document.getElementById('mobius-btn-pause');
        btnSkip     = document.getElementById('mobius-btn-skip');
        btnReset    = document.getElementById('mobius-btn-reset');
        twistSlider = document.getElementById('mobius-twist-slider');
        widthSlider = document.getElementById('mobius-width-slider');
        twistVal    = document.getElementById('mobius-twist-val');
        widthVal    = document.getElementById('mobius-width-val');

        var fullSurface = computeSurface(nTwists, halfWidth, TWO_PI);

        var trace = {
            x: [[fullSurface.x[0][0]]],
            y: [[fullSurface.y[0][0]]],
            z: [[fullSurface.z[0][0]]],
            type: 'surface', colorscale: colorscale,
            showscale: false, opacity: 0.92, hoverinfo: 'skip',
            lighting: { ambient: 0.6, diffuse: 0.5, specular: 0.2, roughness: 0.5 },
            lightposition: { x: 100, y: 200, z: 300 }
        };

        var layout = VizShared.plotlyBaseLayout({
            camera: { eye: { x: 0.8, y: 0.8, z: 2.2 } }
        });

        Plotly.newPlot(plotDiv, [trace], layout, VizShared.PLOTLY_CONFIG);
        VizShared.fixPlotlyScroll(plotDiv);

        phase = 'draw'; frame = 0; orbitAngle = 0;
        precomputeDrawFrames();

        plotDiv.addEventListener('mousedown', interactionPause);
        plotDiv.addEventListener('touchstart', interactionPause);

        btnPause.addEventListener('click', function () {
            togglePause();
        });

        btnSkip.addEventListener('click', function () {
            skip();
        });

        btnReset.addEventListener('click', function () { resetToStart(); });

        twistSlider.addEventListener('input', onSliderChange);
        widthSlider.addEventListener('input', onSliderChange);

        // Theme change listener
        document.addEventListener('themechange', function () {
            if (initialized && plotDiv) {
                glSceneRef = null;
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
            var full = computeSurface(nTwists, halfWidth, TWO_PI);
            Plotly.restyle(plotDiv, { x: [full.x], y: [full.y], z: [full.z] }, 0);
            transitionToOrbit();
        } else if (phase === 'orbit') {
            transitionToDone();
        }
    }

    function adjustSlider(direction) {
        // Adjust the twist slider as the primary slider
        var newVal = parseInt(twistSlider.value, 10) + direction;
        newVal = Math.max(parseInt(twistSlider.min), Math.min(parseInt(twistSlider.max), newVal));
        twistSlider.value = newVal;
        onSliderChange();
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
        skip: skip,
        adjustSlider: adjustSlider
    };
})();
