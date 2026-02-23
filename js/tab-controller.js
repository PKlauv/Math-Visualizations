// ==========================================================================
// Tab Controller — SPA tab switching, hash routing, lazy initialization
// Exposes: window.TabController = { switchTab(), getCurrentTab() }
// ==========================================================================

(function () {
    'use strict';

    // --- Lazy-load Plotly.js on demand (~3.5MB saved on initial load) ---
    var PLOTLY_URL = 'https://cdn.plot.ly/plotly-2.35.2.min.js';
    var plotlyPromise = null;
    var PLOTLY_TABS = { lorenz: true, mobius: true, klein: true };

    function ensurePlotly(callback) {
        if (typeof Plotly !== 'undefined') {
            callback();
            return;
        }
        if (!plotlyPromise) {
            plotlyPromise = new Promise(function (resolve, reject) {
                var script = document.createElement('script');
                script.src = PLOTLY_URL;
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }
        plotlyPromise.then(callback).catch(function () {
            console.error('Failed to load Plotly.js');
        });
    }

    // --- Lazy-load Supabase SDK on demand ---
    var SUPABASE_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    var supabaseLoaded = false;

    function ensureSupabase() {
        if (supabaseLoaded || typeof supabase !== 'undefined') return;
        supabaseLoaded = true;
        var script = document.createElement('script');
        script.src = SUPABASE_URL;
        document.head.appendChild(script);
    }

    // Load Supabase when feedback form enters viewport or on idle
    function initSupabaseLazy() {
        var form = document.getElementById('feedback-form');
        if (!form) return;
        if ('IntersectionObserver' in window) {
            var obs = new IntersectionObserver(function (entries) {
                if (entries[0].isIntersecting) {
                    ensureSupabase();
                    obs.disconnect();
                }
            }, { rootMargin: '200px' });
            obs.observe(form);
        } else if ('requestIdleCallback' in window) {
            requestIdleCallback(ensureSupabase);
        } else {
            setTimeout(ensureSupabase, 3000);
        }
    }

    // --- Tab registry: maps tab name to its viz module ---
    var vizModules = {
        lorenz:     function () { return window.VizLorenz; },
        mobius:     function () { return window.VizMobius; },
        klein:      function () { return window.VizKlein; },
        sierpinski: function () { return window.VizSierpinski; },
        mandelbrot: function () { return window.VizMandelbrot; }
    };

    var initializedTabs = {};
    var currentTab = 'home';

    // --- DOM references ---
    var tabContainer = document.getElementById('tab-container');
    var navLinks = document.querySelectorAll('[data-tab]');

    // --- Fade transition timing ---
    var FADE_DURATION = 300; // ms, matches CSS transition

    function getPanel(tabName) {
        return document.getElementById('panel-' + tabName);
    }

    function updateNavActive(tabName) {
        for (var i = 0; i < navLinks.length; i++) {
            var link = navLinks[i];
            var linkTab = link.getAttribute('data-tab');
            if (linkTab === tabName) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
            // Update ARIA for tab-role elements
            if (link.getAttribute('role') === 'tab') {
                link.setAttribute('aria-selected', linkTab === tabName ? 'true' : 'false');
            }
        }
    }

    // --- Initialize a viz tab on first visit ---
    function initTab(tabName) {
        if (initializedTabs[tabName]) return;
        initializedTabs[tabName] = true;

        // Add loading class to viz container
        var plotEl = document.getElementById(tabName + '-plot') || document.getElementById(tabName + '-canvas');
        if (plotEl) plotEl.classList.add('loading');

        function doInit() {
            var getModule = vizModules[tabName];
            if (getModule) {
                var mod = getModule();
                if (mod && mod.init) {
                    mod.init();
                }
            }
            // Remove loading class after init
            if (plotEl) plotEl.classList.remove('loading');
        }

        // Plotly tabs need the library loaded first
        if (PLOTLY_TABS[tabName]) {
            ensurePlotly(doInit);
        } else {
            doInit();
        }

        // MathJax safety net: typeset the panel on first activation
        var panel = getPanel(tabName);
        if (panel && window.MathJax && MathJax.typesetPromise) {
            MathJax.typesetPromise([panel]).catch(function () {});
        }
    }

    function pauseTab(tabName) {
        var getModule = vizModules[tabName];
        if (getModule) {
            var mod = getModule();
            if (mod && mod.pause) mod.pause();
        }
    }

    // --- Resume a previously initialized viz ---
    function resumeTab(tabName) {
        var getModule = vizModules[tabName];
        if (getModule) {
            var mod = getModule();
            if (mod && mod.resume) mod.resume();
        }
    }

    function switchTab(tabName, skipHistory) {
        if (tabName === currentTab) return;

        var oldPanel = getPanel(currentTab);
        var newPanel = getPanel(tabName);
        if (!newPanel) return;

        pauseTab(currentTab);

        if (oldPanel) {
            oldPanel.classList.remove('visible');
        }

        // After fade-out, swap panels
        setTimeout(function () {
            if (oldPanel) {
                oldPanel.classList.remove('active');
                oldPanel.setAttribute('hidden', '');
            }

            newPanel.classList.add('active');
            newPanel.removeAttribute('hidden');

            // Force reflow before adding visible class for transition
            newPanel.offsetHeight; // eslint-disable-line no-unused-expressions

            newPanel.classList.add('visible');
            updateNavActive(tabName);

            var prevTab = currentTab;
            currentTab = tabName;

            // Update URL hash (without triggering hashchange loop)
            if (!skipHistory) {
                history.pushState(null, '', '#' + tabName);
            }

            var scrollBehavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
            window.scrollTo({ top: 0, behavior: scrollBehavior });

            // Init or resume the new viz
            if (tabName !== 'home') {
                if (!initializedTabs[tabName]) {
                    initTab(tabName);
                } else {
                    resumeTab(tabName);
                }
            }

            // Announce tab switch to screen readers
            if (window.VizShared && VizShared.announce) {
                var label = tabName === 'home' ? 'Home' : tabName.charAt(0).toUpperCase() + tabName.slice(1);
                VizShared.announce('Switched to ' + label);
            }
        }, FADE_DURATION);
    }

    function getCurrentTab() {
        return currentTab;
    }

    // --- Event: click on nav links and cards ---
    document.addEventListener('click', function (e) {
        var target = e.target.closest('[data-tab]');
        if (!target) return;

        e.preventDefault();
        var tabName = target.getAttribute('data-tab');
        if (tabName) {
            switchTab(tabName);
        }
    });

    // --- Event: browser back/forward ---
    window.addEventListener('popstate', function () {
        var hash = location.hash.replace('#', '') || 'home';
        switchTab(hash, true);
    });

    // --- Initial load: read hash or default to home ---
    function onLoad() {
        var hash = location.hash.replace('#', '') || 'home';

        var validTabs = ['home', 'lorenz', 'mobius', 'klein', 'sierpinski', 'mandelbrot'];
        if (validTabs.indexOf(hash) === -1) hash = 'home';

        // Set up initial panel (no transition) and hide others
        validTabs.forEach(function (tab) {
            var panel = getPanel(tab);
            if (!panel) return;
            if (tab === hash) {
                panel.classList.add('active');
                panel.classList.add('visible');
                panel.removeAttribute('hidden');
            } else {
                panel.setAttribute('hidden', '');
            }
        });

        updateNavActive(hash);
        currentTab = hash;

        // Init viz if starting on a viz tab
        if (hash !== 'home') {
            initTab(hash);
        }

        // Lazy-load Supabase SDK
        initSupabaseLazy();
    }

    // Run on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', onLoad);
    } else {
        onLoad();
    }

    // Stop animations when the browser tab is hidden to save CPU
    document.addEventListener('visibilitychange', function () {
        if (currentTab === 'home') return;
        if (document.hidden) { pauseTab(currentTab); }
        else { resumeTab(currentTab); }
    });

    // Expose public API for keyboard shortcuts
    window.TabController = {
        switchTab: switchTab,
        getCurrentTab: getCurrentTab
    };

})();
