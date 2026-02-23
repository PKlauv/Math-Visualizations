// ==========================================================================
// Shared Visualization Utilities
// Constants, Plotly helpers, theme management, accessibility, keyboard shortcuts
// ==========================================================================

window.VizShared = (function () {
    'use strict';

    // ======================================================================
    // Step 1: Shared constants & helpers
    // ======================================================================

    var RESUME_DELAY = 5000;
    var HUD_UPDATE_INTERVAL = 6;
    var PLOTLY_CONFIG = { responsive: true, displayModeBar: false, scrollZoom: false };

    // --- Theme colors (reads CSS custom properties) ---

    function getThemeColors() {
        var style = getComputedStyle(document.documentElement);
        return {
            bg: style.getPropertyValue('--plotly-bg').trim() || '#101010',
            grid: style.getPropertyValue('--plotly-grid').trim() || '#1a1a1a',
            zeroline: style.getPropertyValue('--plotly-zeroline').trim() || '#222'
        };
    }

    // --- Plotly helpers ---

    function plotlyAxisStyle() {
        var c = getThemeColors();
        return {
            title: '', showticklabels: false,
            showgrid: true, gridcolor: c.grid,
            zerolinecolor: c.zeroline, backgroundcolor: c.bg,
            showspikes: false
        };
    }

    function plotlyBaseLayout(sceneOverrides) {
        var c = getThemeColors();
        var ax = plotlyAxisStyle();
        var layout = {
            paper_bgcolor: c.bg, plot_bgcolor: c.bg,
            scene: {
                bgcolor: c.bg,
                xaxis: ax, yaxis: ax, zaxis: ax,
                dragmode: 'orbit'
            },
            margin: { l: 0, r: 0, t: 0, b: 0 },
            showlegend: false
        };
        if (sceneOverrides) {
            for (var key in sceneOverrides) {
                if (sceneOverrides.hasOwnProperty(key)) {
                    layout.scene[key] = sceneOverrides[key];
                }
            }
        }
        return layout;
    }

    function fixPlotlyScroll(plotDiv) {
        plotDiv.addEventListener('wheel', function (e) {
            e.stopImmediatePropagation();
        }, { capture: true, passive: true });
    }

    // --- Caption fade helper ---

    function fadeCaption(captionDiv, text) {
        if (captionDiv.textContent !== text) {
            captionDiv.style.opacity = '0';
            setTimeout(function () {
                captionDiv.textContent = text;
                captionDiv.style.opacity = '1';
            }, 300);
        }
    }

    // ======================================================================
    // Step 2: Theme toggle
    // ======================================================================

    function initThemeToggle() {
        var toggle = document.getElementById('theme-toggle');
        if (!toggle) return;

        var stored = localStorage.getItem('theme');
        var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        var theme = stored || (prefersDark ? 'dark' : 'light');
        applyTheme(theme);

        toggle.addEventListener('click', function () {
            var current = document.documentElement.getAttribute('data-theme') || 'dark';
            var next = current === 'dark' ? 'light' : 'dark';
            applyTheme(next);
            localStorage.setItem('theme', next);
        });
    }

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        var toggle = document.getElementById('theme-toggle');
        if (toggle) {
            // Sun for dark mode (click to go light), moon for light mode (click to go dark)
            toggle.textContent = theme === 'dark' ? '\u2600' : '\u263E';
            toggle.setAttribute('aria-label',
                theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
        }
        var meta = document.querySelector('meta[name="theme-color"]');
        if (meta) {
            meta.setAttribute('content', theme === 'dark' ? '#101010' : '#f5f3ef');
        }
        document.dispatchEvent(new CustomEvent('themechange', { detail: { theme: theme } }));
    }

    // Relayout all active Plotly plots with updated theme colors
    function relayoutPlotlyTheme(plotDiv) {
        if (!plotDiv || typeof Plotly === 'undefined') return;
        var c = getThemeColors();
        var ax = plotlyAxisStyle();
        Plotly.relayout(plotDiv, {
            paper_bgcolor: c.bg, plot_bgcolor: c.bg,
            'scene.bgcolor': c.bg,
            'scene.xaxis': ax, 'scene.yaxis': ax, 'scene.zaxis': ax
        });
    }

    // ======================================================================
    // Step 3: Accessibility — screen reader announcer
    // ======================================================================

    var announcer = null;

    function announce(text) {
        if (!announcer) {
            announcer = document.getElementById('sr-announcer');
        }
        if (announcer) {
            announcer.textContent = '';
            setTimeout(function () { announcer.textContent = text; }, 50);
        }
    }

    // ======================================================================
    // Step 4: Keyboard shortcuts
    // ======================================================================

    var helpOverlay = null;

    function getActiveModule(tabName) {
        var modules = {
            lorenz: window.VizLorenz,
            mobius: window.VizMobius,
            klein: window.VizKlein,
            sierpinski: window.VizSierpinski,
            mandelbrot: window.VizMandelbrot
        };
        return modules[tabName] || null;
    }

    function toggleHelp() {
        if (!helpOverlay) return;
        var visible = helpOverlay.classList.toggle('visible');
        announce(visible ? 'Keyboard shortcuts opened' : 'Keyboard shortcuts closed');
    }

    function initKeyboardShortcuts() {
        helpOverlay = document.getElementById('keyboard-help');

        document.addEventListener('keydown', function (e) {
            var tag = e.target.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

            var key = e.key;

            // ? — toggle help overlay
            if (key === '?') {
                e.preventDefault();
                toggleHelp();
                return;
            }

            // Escape — close help overlay
            if (key === 'Escape') {
                if (helpOverlay && helpOverlay.classList.contains('visible')) {
                    helpOverlay.classList.remove('visible');
                    announce('Keyboard shortcuts closed');
                }
                return;
            }

            // Number keys 0-5 — switch tabs
            if (key >= '0' && key <= '5') {
                e.preventDefault();
                var tabs = ['home', 'lorenz', 'mobius', 'klein', 'sierpinski', 'mandelbrot'];
                var idx = parseInt(key);
                if (idx < tabs.length && window.TabController) {
                    window.TabController.switchTab(tabs[idx]);
                    announce('Switched to ' + tabs[idx]);
                }
                return;
            }

            // Remaining shortcuts only on viz tabs
            var currentTab = window.TabController && window.TabController.getCurrentTab();
            if (!currentTab || currentTab === 'home') return;

            var mod = getActiveModule(currentTab);
            if (!mod) return;

            // Space — toggle pause
            if (key === ' ') {
                e.preventDefault();
                if (mod.togglePause) {
                    mod.togglePause();
                }
                return;
            }

            // R — reset
            if (key === 'r' || key === 'R') {
                e.preventDefault();
                if (mod.reset) {
                    mod.reset();
                    announce('Reset visualization');
                }
                return;
            }

            // S — skip
            if (key === 's' || key === 'S') {
                e.preventDefault();
                if (mod.skip) {
                    mod.skip();
                    announce('Skipped to next phase');
                }
                return;
            }

            // Left/Right — adjust primary slider
            if (key === 'ArrowLeft' || key === 'ArrowRight') {
                if (mod.adjustSlider) {
                    e.preventDefault();
                    mod.adjustSlider(key === 'ArrowRight' ? 1 : -1);
                }
                return;
            }
        });
    }

    // ======================================================================
    // Initialize on DOM ready
    // ======================================================================

    function onReady(fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn);
        } else {
            fn();
        }
    }

    // ======================================================================
    // Step 5: Scroll-triggered section reveal
    // ======================================================================

    function initScrollReveal() {
        var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (prefersReduced) {
            // Make all sections visible immediately
            var sections = document.querySelectorAll('.section');
            for (var i = 0; i < sections.length; i++) {
                sections[i].classList.add('revealed');
            }
            return;
        }

        if (!('IntersectionObserver' in window)) {
            var sections = document.querySelectorAll('.section');
            for (var i = 0; i < sections.length; i++) {
                sections[i].classList.add('revealed');
            }
            return;
        }

        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('revealed');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });

        var sections = document.querySelectorAll('.section');
        for (var i = 0; i < sections.length; i++) {
            observer.observe(sections[i]);
        }
    }

    onReady(function () {
        initThemeToggle();
        initKeyboardShortcuts();
        initScrollReveal();
        var kbdBtn = document.getElementById('kbd-shortcut-btn');
        if (kbdBtn) kbdBtn.addEventListener('click', toggleHelp);
    });

    return {
        RESUME_DELAY: RESUME_DELAY,
        HUD_UPDATE_INTERVAL: HUD_UPDATE_INTERVAL,
        PLOTLY_CONFIG: PLOTLY_CONFIG,
        plotlyAxisStyle: plotlyAxisStyle,
        plotlyBaseLayout: plotlyBaseLayout,
        fixPlotlyScroll: fixPlotlyScroll,
        fadeCaption: fadeCaption,
        getThemeColors: getThemeColors,
        relayoutPlotlyTheme: relayoutPlotlyTheme,
        announce: announce,
        toggleHelp: toggleHelp
    };
})();
