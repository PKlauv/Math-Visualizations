// ==========================================================================
// Sierpinski Triangle — extracted module for SPA tab integration
// Exposes: window.VizSierpinski = { init(), pause(), resume(), togglePause(), reset(), skip(), adjustSlider() }
// All DOM IDs are prefixed with "sierpinski-"
// ==========================================================================

window.VizSierpinski = (function () {
    'use strict';

    var initialized = false;
    var active = false;

    // DOM references
    var canvas, ctx, captionDiv, hudPhase, hudFill, hudDetail;
    var btnPause, btnSkip, btnReset;
    var depthSlider, depthVal, methodSelect;

    // Canvas setup
    var CSS_W = 800;
    var CSS_H = 700;
    var dpr = 1;

    // Colors — read from CSS variables
    var BG_COLOR     = '#101010';
    var ACCENT_COLOR = '#c8a26a';

    // Triangle vertices
    var PADDING = 40;
    var triW, triH, vA, vB, vC;

    // Animation state
    var targetDepth = 7;
    var method = 'recursive';
    var paused = false;
    var animId = null;

    // Recursive state
    var currentDepth = 0;
    var frameCount = 0;
    var FRAMES_PER_DEPTH = 90;
    var animDone = false;

    // Chaos game state
    var chaosPoints = [];
    var CHAOS_TOTAL = 50000;
    var CHAOS_BATCH = 100;
    var chaosX = 0, chaosY = 0;
    var chaosBuffer = null, chaosCtx = null;

    // Precomputed triangles
    var removedByLevel = [];

    function readThemeColors() {
        var style = getComputedStyle(document.documentElement);
        BG_COLOR = style.getPropertyValue('--bg').trim() || '#101010';
        ACCENT_COLOR = style.getPropertyValue('--accent').trim() || '#c8a26a';
    }

    function computeVertices() {
        triW = CSS_W - 2 * PADDING;
        triH = triW * (Math.sqrt(3) / 2);
        if (triH > CSS_H - 2 * PADDING) {
            triH = CSS_H - 2 * PADDING;
            triW = triH / (Math.sqrt(3) / 2);
        }
        var cx = CSS_W / 2;
        var topY = (CSS_H - triH) / 2;
        vA = { x: cx, y: topY };
        vB = { x: cx - triW / 2, y: topY + triH };
        vC = { x: cx + triW / 2, y: topY + triH };
    }

    function setupCanvas() {
        dpr = window.devicePixelRatio || 1;
        canvas.width = CSS_W * dpr;
        canvas.height = CSS_H * dpr;
        canvas.style.width = '100%';
        canvas.style.maxWidth = CSS_W + 'px';
        canvas.style.height = '560px';
        canvas.setAttribute('width', CSS_W * dpr);
        canvas.setAttribute('height', CSS_H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function computeRemovedTriangles(ax, ay, bx, by, ccx, ccy, depth, maxDepth) {
        if (depth >= maxDepth) return;
        var abx = (ax + bx) / 2, aby = (ay + by) / 2;
        var bcx = (bx + ccx) / 2, bcy = (by + ccy) / 2;
        var acx = (ax + ccx) / 2, acy = (ay + ccy) / 2;
        if (!removedByLevel[depth + 1]) removedByLevel[depth + 1] = [];
        removedByLevel[depth + 1].push({ax: abx, ay: aby, bx: bcx, by: bcy, cx: acx, cy: acy});
        computeRemovedTriangles(ax, ay, abx, aby, acx, acy, depth + 1, maxDepth);
        computeRemovedTriangles(abx, aby, bx, by, bcx, bcy, depth + 1, maxDepth);
        computeRemovedTriangles(acx, acy, bcx, bcy, ccx, ccy, depth + 1, maxDepth);
    }

    function precompute() {
        removedByLevel = [];
        computeRemovedTriangles(vA.x, vA.y, vB.x, vB.y, vC.x, vC.y, 0, targetDepth);
    }

    function clearCanvas() {
        ctx.fillStyle = BG_COLOR;
        ctx.fillRect(0, 0, CSS_W, CSS_H);
    }

    function fillTriangle(ax, ay, bx, by, ccx, ccy, color) {
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.lineTo(ccx, ccy);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
    }

    function drawBaseTriangle() {
        fillTriangle(vA.x, vA.y, vB.x, vB.y, vC.x, vC.y, ACCENT_COLOR);
    }

    function drawRemovedUpTo(depth) {
        ctx.fillStyle = BG_COLOR;
        ctx.beginPath();
        for (var d = 1; d <= depth; d++) {
            if (!removedByLevel[d]) continue;
            var tris = removedByLevel[d];
            for (var i = 0; i < tris.length; i++) {
                var t = tris[i];
                ctx.moveTo(t.ax, t.ay);
                ctx.lineTo(t.bx, t.by);
                ctx.lineTo(t.cx, t.cy);
                ctx.closePath();
            }
        }
        ctx.fill();
    }

    function setCaption(text) {
        VizShared.fadeCaption(captionDiv, text);
    }

    function updateHUD() {
        if (paused) {
            if (hudPhase.textContent !== 'PAUSED') hudPhase.textContent = 'PAUSED';
            hudPhase.classList.add('paused');
            if (hudDetail.textContent !== 'Paused') hudDetail.textContent = 'Paused';
            return;
        }
        hudPhase.classList.remove('paused');
        if (method === 'recursive') {
            if (animDone) {
                if (hudPhase.textContent !== 'COMPLETE') hudPhase.textContent = 'COMPLETE';
                hudFill.style.transform = 'scaleX(1)';
                hudDetail.textContent = Math.pow(3, targetDepth).toLocaleString() + ' triangles at depth ' + targetDepth;
            } else {
                if (hudPhase.textContent !== 'BUILDING') hudPhase.textContent = 'BUILDING';
                var progress = targetDepth > 0 ? (currentDepth / targetDepth) : 1;
                hudFill.style.transform = 'scaleX(' + progress + ')';
                hudDetail.textContent = 'Depth ' + currentDepth + ' / ' + targetDepth;
            }
        } else {
            if (animDone) {
                if (hudPhase.textContent !== 'COMPLETE') hudPhase.textContent = 'COMPLETE';
                hudFill.style.transform = 'scaleX(1)';
                hudDetail.textContent = CHAOS_TOTAL.toLocaleString() + ' points plotted';
            } else {
                if (hudPhase.textContent !== 'PLOTTING') hudPhase.textContent = 'PLOTTING';
                var progress = chaosPoints.length / CHAOS_TOTAL;
                hudFill.style.transform = 'scaleX(' + progress + ')';
                hudDetail.textContent = chaosPoints.length.toLocaleString() + ' / ' + CHAOS_TOTAL.toLocaleString() + ' points';
            }
        }
    }

    var recursiveCaptions = [
        { at: 0, text: 'A single filled triangle, the starting point' },
        { at: 1, text: 'Remove the middle quarter, leaving three copies' },
        { at: 2, text: 'Each copy gets the same treatment. Nine triangles remain' },
        { at: 3, text: 'The pattern repeats at every scale' },
        { at: 5, text: 'Self-similarity emerges. Zoom into any corner and see the whole' },
        { at: 7, text: 'The fractal takes shape. Dimension 1.585' }
    ];

    function getRecursiveCaption(depth) {
        var text = '';
        for (var i = recursiveCaptions.length - 1; i >= 0; i--) {
            if (depth >= recursiveCaptions[i].at) { text = recursiveCaptions[i].text; break; }
        }
        return text;
    }

    function tickRecursive() {
        if (!active) return;
        if (paused) { updateHUD(); animId = requestAnimationFrame(tickRecursive); return; }

        frameCount++;
        if (!animDone) {
            if (frameCount >= FRAMES_PER_DEPTH) {
                frameCount = 0;
                if (currentDepth < targetDepth) {
                    currentDepth++;
                    clearCanvas(); drawBaseTriangle(); drawRemovedUpTo(currentDepth);
                    setCaption(getRecursiveCaption(currentDepth));
                } else {
                    animDone = true;
                    setCaption('Complete! Adjust depth or switch to the chaos game');
                }
            }
        }
        updateHUD();
        animId = requestAnimationFrame(tickRecursive);
    }

    function startRecursive() {
        method = 'recursive';
        currentDepth = 0; frameCount = 0; animDone = false;
        paused = false; btnPause.textContent = '\u23F8';
        btnPause.setAttribute('aria-label', 'Pause animation');

        precompute(); clearCanvas(); drawBaseTriangle();
        setCaption(getRecursiveCaption(0)); updateHUD();

        if (targetDepth === 0) {
            animDone = true;
            setCaption('Depth 0: just the base triangle');
        }
        if (animId) cancelAnimationFrame(animId);
        animId = requestAnimationFrame(tickRecursive);
    }

    function initChaos() {
        chaosPoints = [];
        var r1 = Math.random(), r2 = Math.random();
        if (r1 + r2 > 1) { r1 = 1 - r1; r2 = 1 - r2; }
        chaosX = vA.x + r1 * (vB.x - vA.x) + r2 * (vC.x - vA.x);
        chaosY = vA.y + r1 * (vB.y - vA.y) + r2 * (vC.y - vA.y);
    }

    function setupChaosBuffer() {
        chaosBuffer = document.createElement('canvas');
        chaosBuffer.width = CSS_W * dpr;
        chaosBuffer.height = CSS_H * dpr;
        chaosCtx = chaosBuffer.getContext('2d');
        chaosCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        chaosCtx.fillStyle = BG_COLOR;
        chaosCtx.fillRect(0, 0, CSS_W, CSS_H);
    }

    function tickChaos() {
        if (!active) return;
        if (paused) { updateHUD(); animId = requestAnimationFrame(tickChaos); return; }

        if (!animDone) {
            var vertices = [vA, vB, vC];
            var count = Math.min(CHAOS_BATCH, CHAOS_TOTAL - chaosPoints.length);

            chaosCtx.fillStyle = ACCENT_COLOR;
            for (var i = 0; i < count; i++) {
                var v = vertices[Math.floor(Math.random() * 3)];
                chaosX = (chaosX + v.x) / 2;
                chaosY = (chaosY + v.y) / 2;
                chaosPoints.push({x: chaosX, y: chaosY});
                chaosCtx.fillRect(chaosX - 0.5, chaosY - 0.5, 1, 1);
            }

            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.drawImage(chaosBuffer, 0, 0);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            if (chaosPoints.length >= CHAOS_TOTAL) {
                animDone = true;
                setCaption('Complete! 50,000 random steps reveal a fractal pattern');
            } else if (chaosPoints.length < 500) {
                setCaption('Random points begin to cluster...');
            } else if (chaosPoints.length < 5000) {
                setCaption('The triangle emerges from apparent randomness');
            } else if (chaosPoints.length < 20000) {
                setCaption('Thousands of points. The fractal structure is unmistakable');
            }
        }
        updateHUD();
        animId = requestAnimationFrame(tickChaos);
    }

    function startChaos() {
        method = 'chaos';
        animDone = false; paused = false; btnPause.textContent = '\u23F8';
        btnPause.setAttribute('aria-label', 'Pause animation');

        initChaos(); setupChaosBuffer(); clearCanvas();
        setCaption('Starting the chaos game...'); updateHUD();

        if (animId) cancelAnimationFrame(animId);
        animId = requestAnimationFrame(tickChaos);
    }

    function skipToEnd() {
        if (animDone) return;
        if (paused) {
            paused = false;
            btnPause.textContent = '\u23F8';
            btnPause.setAttribute('aria-label', 'Pause animation');
        }

        if (method === 'recursive') {
            currentDepth = targetDepth; animDone = true;
            clearCanvas(); drawBaseTriangle(); drawRemovedUpTo(currentDepth);
            setCaption('Complete! Adjust depth or switch to the chaos game');
        } else {
            var vertices = [vA, vB, vC];
            var remaining = CHAOS_TOTAL - chaosPoints.length;
            chaosCtx.fillStyle = ACCENT_COLOR;
            for (var i = 0; i < remaining; i++) {
                var v = vertices[Math.floor(Math.random() * 3)];
                chaosX = (chaosX + v.x) / 2;
                chaosY = (chaosY + v.y) / 2;
                chaosPoints.push({x: chaosX, y: chaosY});
                chaosCtx.fillRect(chaosX - 0.5, chaosY - 0.5, 1, 1);
            }
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.drawImage(chaosBuffer, 0, 0);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            animDone = true;
            setCaption('Complete! 50,000 random steps reveal a fractal pattern');
        }
        updateHUD();
    }

    function resetAnimation() {
        if (animId) cancelAnimationFrame(animId);
        readThemeColors();
        if (method === 'recursive') { startRecursive(); } else { startChaos(); }
    }

    // --- Public interface ---

    function init() {
        if (initialized) return;
        initialized = true;
        active = true;

        canvas       = document.getElementById('sierpinski-canvas');
        ctx          = canvas.getContext('2d');
        if (!ctx) {
            console.warn('VizSierpinski: canvas context unavailable');
            return;
        }
        captionDiv   = document.getElementById('sierpinski-caption');
        hudPhase     = document.getElementById('sierpinski-hud-phase');
        hudFill      = document.getElementById('sierpinski-hud-progress-fill');
        hudDetail    = document.getElementById('sierpinski-hud-detail');
        btnPause     = document.getElementById('sierpinski-btn-pause');
        btnSkip      = document.getElementById('sierpinski-btn-skip');
        btnReset     = document.getElementById('sierpinski-btn-reset');
        depthSlider  = document.getElementById('sierpinski-depth-slider');
        depthVal     = document.getElementById('sierpinski-depth-val');
        methodSelect = document.getElementById('sierpinski-method-select');

        readThemeColors();
        computeVertices();
        setupCanvas();

        btnPause.addEventListener('click', function () {
            togglePause();
        });

        btnSkip.addEventListener('click', function () { skipToEnd(); });
        btnReset.addEventListener('click', function () { resetAnimation(); });

        depthSlider.addEventListener('input', function () {
            targetDepth = parseInt(this.value, 10);
            depthVal.textContent = targetDepth;
            depthSlider.setAttribute('aria-valuenow', targetDepth);
            if (method === 'recursive') {
                if (animId) cancelAnimationFrame(animId);
                startRecursive();
            }
        });

        methodSelect.addEventListener('change', function () {
            if (animId) cancelAnimationFrame(animId);
            if (this.value === 'recursive') { startRecursive(); } else { startChaos(); }
        });

        var resizeTimer = null;
        window.addEventListener('resize', function () {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function () {
                var newDpr = window.devicePixelRatio || 1;
                if (newDpr !== dpr) {
                    setupCanvas();
                    if (method === 'recursive') {
                        precompute(); clearCanvas(); drawBaseTriangle(); drawRemovedUpTo(currentDepth);
                    } else if (chaosBuffer) {
                        ctx.setTransform(1, 0, 0, 1, 0, 0);
                        ctx.drawImage(chaosBuffer, 0, 0);
                        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                    }
                }
            }, 200);
        });

        // Theme change: re-read colors and redraw
        document.addEventListener('themechange', function () {
            if (!initialized) return;
            readThemeColors();
            if (method === 'recursive') {
                clearCanvas(); drawBaseTriangle(); drawRemovedUpTo(currentDepth);
            } else {
                // For chaos, we need to redraw from the buffer with new BG
                if (chaosBuffer) {
                    clearCanvas();
                    // Redraw chaos buffer onto main canvas
                    ctx.setTransform(1, 0, 0, 1, 0, 0);
                    ctx.drawImage(chaosBuffer, 0, 0);
                    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                }
            }
        });

        startRecursive();
    }

    function togglePause() {
        if (animDone) return;
        if (paused) {
            paused = false;
            btnPause.textContent = '\u23F8';
            btnPause.setAttribute('aria-label', 'Pause animation');
            VizShared.announce('Resumed');
        } else {
            paused = true;
            btnPause.textContent = '\u25B6';
            btnPause.setAttribute('aria-label', 'Resume animation');
            VizShared.announce('Paused');
        }
        updateHUD();
    }

    function adjustSlider(direction) {
        var newVal = parseInt(depthSlider.value, 10) + direction;
        newVal = Math.max(parseInt(depthSlider.min), Math.min(parseInt(depthSlider.max), newVal));
        depthSlider.value = newVal;
        targetDepth = newVal;
        depthVal.textContent = targetDepth;
        depthSlider.setAttribute('aria-valuenow', targetDepth);
        if (method === 'recursive') {
            if (animId) cancelAnimationFrame(animId);
            startRecursive();
        }
    }

    function pause() {
        active = false;
        if (animId) { cancelAnimationFrame(animId); animId = null; }
    }

    function resume() {
        if (!initialized) return init();
        active = true;
        if (animId) cancelAnimationFrame(animId);
        if (method === 'recursive') {
            animId = requestAnimationFrame(tickRecursive);
        } else {
            animId = requestAnimationFrame(tickChaos);
        }
    }

    return {
        init: init,
        pause: pause,
        resume: resume,
        togglePause: togglePause,
        reset: resetAnimation,
        skip: skipToEnd,
        adjustSlider: adjustSlider
    };
})();
