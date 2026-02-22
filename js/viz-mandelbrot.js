// ==========================================================================
// Mandelbrot Set — extracted module for SPA tab integration
// Exposes: window.VizMandelbrot = { init(), pause(), resume() }
// All DOM IDs are prefixed with "mandelbrot-"
// ==========================================================================

window.VizMandelbrot = (function () {
    'use strict';

    var initialized = false;
    var active = false;

    // Canvas setup
    var canvas, ctx;
    var dpr = 1;
    var W = 800, H = 600;

    // DOM references
    var hudPhase, hudFill, hudDetail, hudCoords, caption;
    var iterSlider, iterVal, colorSelect;
    var btnZoomOut, btnReset;

    // View state
    var centerX = -0.5;
    var centerY = 0.0;
    var zoom = 200;
    var maxIter = 200;

    var DEFAULT_CX = -0.5;
    var DEFAULT_CY = 0.0;
    var DEFAULT_ZOOM = 200;

    // Color palettes
    function infernoColor(t) {
        var r, g, b;
        if (t < 0.25) {
            var s = t / 0.25;
            r = Math.floor(10 + 68 * s); g = Math.floor(7 + 5 * s); b = Math.floor(46 + 72 * s);
        } else if (t < 0.5) {
            var s = (t - 0.25) / 0.25;
            r = Math.floor(78 + 90 * s); g = Math.floor(12 + 46 * s); b = Math.floor(118 - 35 * s);
        } else if (t < 0.75) {
            var s = (t - 0.5) / 0.25;
            r = Math.floor(168 + 58 * s); g = Math.floor(58 + 74 * s); b = Math.floor(83 - 69 * s);
        } else {
            var s = (t - 0.75) / 0.25;
            r = Math.floor(226 + 26 * s); g = Math.floor(132 + 122 * s); b = Math.floor(14 + 238 * s);
        }
        return [r, g, b];
    }

    function goldColor(t) {
        return [Math.floor(30 + 170 * t), Math.floor(10 + 152 * t), Math.floor(5 + 101 * t)];
    }
    function oceanColor(t) {
        return [Math.floor(5 + 40 * t), Math.floor(20 + 130 * t), Math.floor(60 + 195 * t)];
    }
    function grayscaleColor(t) {
        var v = Math.floor(255 * t); return [v, v, v];
    }

    var palettes = {
        inferno: infernoColor, gold: goldColor,
        ocean: oceanColor, grayscale: grayscaleColor
    };
    var currentPalette = 'inferno';

    // Rendering state
    var rendering = false;
    var renderRow = 0;
    var imageData = null;

    function startRender() {
        if (!active) return;
        rendering = true;
        renderRow = 0;
        imageData = ctx.createImageData(W * dpr, H * dpr);
        hudPhase.textContent = 'RENDERING';
        hudFill.style.width = '0%';
        requestAnimationFrame(renderBatch);
    }

    function renderBatch() {
        if (!rendering || !active) return;

        var colorFn = palettes[currentPalette];
        var data = imageData.data;
        var batchSize = Math.ceil(H * dpr / 20);
        var endRow = Math.min(renderRow + batchSize, H * dpr);

        for (var py = renderRow; py < endRow; py++) {
            for (var px = 0; px < W * dpr; px++) {
                var x0 = centerX + (px / dpr - W / 2) / zoom;
                var y0 = centerY + (py / dpr - H / 2) / zoom;
                var x = 0, y = 0, iter = 0, xx = 0, yy = 0;

                while (xx + yy <= 4 && iter < maxIter) {
                    y = 2 * x * y + y0;
                    x = xx - yy + x0;
                    xx = x * x; yy = y * y;
                    iter++;
                }

                var idx = (py * W * dpr + px) * 4;
                if (iter === maxIter) {
                    data[idx] = 0; data[idx + 1] = 0; data[idx + 2] = 0;
                } else {
                    var log2 = Math.log(2);
                    var nu = Math.log(Math.log(Math.sqrt(xx + yy)) / log2) / log2;
                    var smoothIter = iter + 1 - nu;
                    var t = smoothIter / maxIter;
                    t = Math.max(0, Math.min(1, t));
                    t = (t * 8) % 1;
                    var color = colorFn(t);
                    data[idx] = color[0]; data[idx + 1] = color[1]; data[idx + 2] = color[2];
                }
                data[idx + 3] = 255;
            }
        }

        renderRow = endRow;
        var progress = renderRow / (H * dpr);
        hudFill.style.width = (progress * 100).toFixed(1) + '%';
        hudDetail.textContent = Math.round(progress * 100) + '% rendered';

        if (renderRow >= H * dpr) {
            ctx.putImageData(imageData, 0, 0);
            rendering = false;
            hudPhase.textContent = 'COMPLETE';
            hudFill.style.width = '100%';
            hudDetail.textContent = maxIter + ' max iterations';
            updateCoordsHUD();
        } else {
            ctx.putImageData(imageData, 0, 0);
            requestAnimationFrame(renderBatch);
        }
    }

    function updateCoordsHUD() {
        hudCoords.textContent = 'Re: ' + centerX.toFixed(6) + '  Im: ' + centerY.toFixed(6) + '  Zoom: ' + zoom.toFixed(0) + 'x';
    }

    // --- Public interface ---

    function init() {
        if (initialized) return;
        initialized = true;
        active = true;

        canvas      = document.getElementById('mandelbrot-canvas');
        ctx         = canvas.getContext('2d');
        hudPhase    = document.getElementById('mandelbrot-hud-phase');
        hudFill     = document.getElementById('mandelbrot-hud-progress-fill');
        hudDetail   = document.getElementById('mandelbrot-hud-detail');
        hudCoords   = document.getElementById('mandelbrot-hud-coords');
        caption     = document.getElementById('mandelbrot-caption');
        iterSlider  = document.getElementById('mandelbrot-iter-slider');
        iterVal     = document.getElementById('mandelbrot-iter-val');
        colorSelect = document.getElementById('mandelbrot-color-select');
        btnZoomOut  = document.getElementById('mandelbrot-btn-zoom-out');
        btnReset    = document.getElementById('mandelbrot-btn-reset');

        dpr = window.devicePixelRatio || 1;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        canvas.style.width = W + 'px';
        canvas.style.height = H + 'px';
        ctx.scale(dpr, dpr);

        // Click to zoom
        canvas.addEventListener('click', function (e) {
            var rect = canvas.getBoundingClientRect();
            var scaleX = W / rect.width;
            var scaleY = H / rect.height;
            var px = (e.clientX - rect.left) * scaleX;
            var py = (e.clientY - rect.top) * scaleY;
            centerX = centerX + (px - W / 2) / zoom;
            centerY = centerY + (py - H / 2) / zoom;
            zoom *= 2;
            startRender();
        });

        // Right-click to zoom out
        canvas.addEventListener('contextmenu', function (e) {
            e.preventDefault();
            zoom = Math.max(50, zoom / 2);
            startRender();
        });

        // Mouse move: show coordinates
        canvas.addEventListener('mousemove', function (e) {
            if (rendering) return;
            var rect = canvas.getBoundingClientRect();
            var scaleX = W / rect.width;
            var scaleY = H / rect.height;
            var px = (e.clientX - rect.left) * scaleX;
            var py = (e.clientY - rect.top) * scaleY;
            var re = centerX + (px - W / 2) / zoom;
            var im = centerY + (py - H / 2) / zoom;
            hudCoords.textContent = 'Re: ' + re.toFixed(6) + '  Im: ' + im.toFixed(6) + '  Zoom: ' + zoom.toFixed(0) + 'x';
        });

        btnZoomOut.addEventListener('click', function () {
            zoom = Math.max(50, zoom / 2);
            startRender();
        });

        btnReset.addEventListener('click', function () {
            centerX = DEFAULT_CX; centerY = DEFAULT_CY; zoom = DEFAULT_ZOOM;
            startRender();
        });

        iterSlider.addEventListener('input', function () {
            maxIter = parseInt(this.value);
            iterVal.textContent = maxIter;
            startRender();
        });

        colorSelect.addEventListener('change', function () {
            currentPalette = this.value;
            startRender();
        });

        startRender();
    }

    function pause() {
        active = false;
        rendering = false;
    }

    function resume() {
        if (!initialized) return init();
        active = true;
        // Re-render current view
        startRender();
    }

    return { init: init, pause: pause, resume: resume };
})();
