// ==========================================================================
// Klein Bottle — extracted module for SPA tab integration
// Exposes: window.VizKlein = { init(), pause(), resume() }
// All DOM IDs are prefixed with "klein-"
// ==========================================================================

window.VizKlein = (function () {
    'use strict';

    var initialized = false;
    var active = false;

    // --- Parameters ---
    var RES = 30;
    var DEFAULT_OPACITY = 1.0;
    var ORBIT_SPEED_PER_SEC = 0.003 * 60;  // per-second orbit speed (was per-frame)
    var FRAME_INTERVAL = 1000 / 30;        // target ~30fps
    var RESUME_DELAY = 5000;

    // DOM references
    var plotDiv, hudPhase, hudDetail;
    var btnPause, btnReset;
    var opacitySlider, opacityVal;

    // State
    var rotating = true;
    var manualPause = false;
    var orbitAngle = 0;
    var resumeTimer = null;
    var currentOpacity = DEFAULT_OPACITY;
    var hudFrameCount = 0;
    var HUD_UPDATE_INTERVAL = 6;
    var glSceneRef = null;
    var lastFrameTime = 0;

    var DEFAULT_EYE = { x: 1.6, y: 1.6, z: 0.8 };
    var ORBIT_RADIUS = Math.sqrt(DEFAULT_EYE.x * DEFAULT_EYE.x + DEFAULT_EYE.y * DEFAULT_EYE.y);

    var kleinColorscale = [
        [0,   'rgb(10,5,40)'],
        [0.3, 'rgb(80,20,100)'],
        [0.6, 'rgb(160,80,60)'],
        [1,   'rgb(200,162,106)']
    ];

    function computeSurface() {
        var xData = [], yData = [], zData = [];
        var PI = Math.PI;

        for (var i = 0; i <= RES; i++) {
            var u = (i / RES) * 2 * PI;
            var xRow = [], yRow = [], zRow = [];
            var cosU = Math.cos(u), sinU = Math.sin(u);

            for (var j = 0; j <= RES; j++) {
                var v = (j / RES) * 2 * PI;
                var cosV = Math.cos(v), sinV = Math.sin(v);
                var r = 4 * (1 - cosU / 2);
                var x, y, z;

                if (u < PI) {
                    x = 6 * cosU * (1 + sinU) + r * cosU * cosV;
                    y = 16 * sinU + r * sinU * cosV;
                } else {
                    x = 6 * cosU * (1 + sinU) - r * cosV;
                    y = 16 * sinU;
                }
                z = r * sinV;

                xRow.push(x); yRow.push(y); zRow.push(z);
            }
            xData.push(xRow); yData.push(yRow); zData.push(zRow);
        }
        return { x: xData, y: yData, z: zData };
    }

    function updateHUD() {
        if (rotating) {
            if (hudPhase.textContent !== 'ROTATING') hudPhase.textContent = 'ROTATING';
            hudPhase.classList.remove('paused');
            var degrees = Math.round((orbitAngle % (2 * Math.PI)) / (2 * Math.PI) * 360);
            hudDetail.textContent = degrees + '\u00B0';
        } else {
            if (hudPhase.textContent !== 'PAUSED') hudPhase.textContent = 'PAUSED';
            hudPhase.classList.add('paused');
            var pauseText = manualPause ? 'Paused' : 'Drag to explore';
            if (hudDetail.textContent !== pauseText) hudDetail.textContent = pauseText;
        }
    }

    function orbitCameraEye(angle) {
        return {
            x: ORBIT_RADIUS * Math.cos(angle),
            y: ORBIT_RADIUS * Math.sin(angle),
            z: DEFAULT_EYE.z
        };
    }

    function tick(timestamp) {
        if (!active) return;

        // Throttle to ~30fps
        if (timestamp - lastFrameTime < FRAME_INTERVAL) {
            requestAnimationFrame(tick);
            return;
        }
        var deltaTime = (lastFrameTime === 0) ? FRAME_INTERVAL / 1000 : (timestamp - lastFrameTime) / 1000;
        lastFrameTime = timestamp;

        hudFrameCount++;
        if (hudFrameCount >= HUD_UPDATE_INTERVAL) {
            hudFrameCount = 0;
            updateHUD();
        }

        if (rotating) {
            orbitAngle += ORBIT_SPEED_PER_SEC * deltaTime;
            var eye = orbitCameraEye(orbitAngle);
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

        requestAnimationFrame(tick);
    }

    function interactionPause() {
        if (manualPause) return;
        rotating = false;
        btnPause.textContent = '\u25B6';
        clearTimeout(resumeTimer);
        resumeTimer = setTimeout(function () {
            if (!manualPause) {
                rotating = true;
                btnPause.textContent = '\u23F8';
            }
        }, RESUME_DELAY);
    }

    // --- Public interface ---

    function init() {
        if (initialized) return;
        initialized = true;
        active = true;

        plotDiv        = document.getElementById('klein-plot');
        hudPhase       = document.getElementById('klein-hud-phase');
        hudDetail      = document.getElementById('klein-hud-detail');
        btnPause       = document.getElementById('klein-btn-pause');
        btnReset       = document.getElementById('klein-btn-reset');
        opacitySlider  = document.getElementById('klein-opacity-slider');
        opacityVal     = document.getElementById('klein-opacity-val');

        var surface = computeSurface();

        var trace = {
            type: 'surface',
            x: surface.x, y: surface.y, z: surface.z,
            colorscale: kleinColorscale,
            showscale: false, opacity: DEFAULT_OPACITY, hoverinfo: 'skip',
            lighting: { ambient: 0.6, diffuse: 0.6, specular: 0.2, roughness: 0.5 },
            lightposition: { x: 100, y: 200, z: 300 }
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
                camera: { eye: { x: DEFAULT_EYE.x, y: DEFAULT_EYE.y, z: DEFAULT_EYE.z } },
                dragmode: 'orbit'
            },
            margin: { l: 0, r: 0, t: 0, b: 0 },
            showlegend: false
        };

        var config = { responsive: true, displayModeBar: false, scrollZoom: false };

        Plotly.newPlot(plotDiv, [trace], layout, config);

        // Grab the WebGL scene reference immediately to avoid relayout fallback
        var s = plotDiv._fullLayout && plotDiv._fullLayout.scene &&
                plotDiv._fullLayout.scene._scene;
        if (s && s.setCamera) glSceneRef = s;

        orbitAngle = Math.atan2(DEFAULT_EYE.y, DEFAULT_EYE.x);

        plotDiv.addEventListener('mousedown', interactionPause);
        plotDiv.addEventListener('touchstart', interactionPause);

        btnPause.addEventListener('click', function () {
            if (rotating) {
                rotating = false; manualPause = true;
                clearTimeout(resumeTimer);
                btnPause.textContent = '\u25B6';
            } else {
                rotating = true; manualPause = false;
                clearTimeout(resumeTimer);
                btnPause.textContent = '\u23F8';
            }
            updateHUD();
        });

        btnReset.addEventListener('click', function () {
            orbitAngle = Math.atan2(DEFAULT_EYE.y, DEFAULT_EYE.x);
            rotating = true; manualPause = false;
            clearTimeout(resumeTimer);
            btnPause.textContent = '\u23F8';
            glSceneRef = null;
            Plotly.relayout(plotDiv, {
                'scene.camera.eye': { x: DEFAULT_EYE.x, y: DEFAULT_EYE.y, z: DEFAULT_EYE.z }
            });
            updateHUD();
        });

        var opacityRafPending = false;
        opacitySlider.addEventListener('input', function () {
            currentOpacity = parseFloat(this.value);
            opacityVal.textContent = currentOpacity.toFixed(2);
            if (!opacityRafPending) {
                opacityRafPending = true;
                requestAnimationFrame(function () {
                    Plotly.restyle(plotDiv, { opacity: currentOpacity }, 0);
                    opacityRafPending = false;
                });
            }
        });

        requestAnimationFrame(tick);
    }

    function pause() {
        active = false;
        clearTimeout(resumeTimer);
    }

    function resume() {
        if (!initialized) return init();
        active = true;
        lastFrameTime = 0;
        requestAnimationFrame(function () {
            Plotly.Plots.resize(plotDiv);
            requestAnimationFrame(tick);
        });
    }

    return { init: init, pause: pause, resume: resume };
})();
