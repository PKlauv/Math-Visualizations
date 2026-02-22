// ==========================================================================
// Tab Controller — SPA tab switching, hash routing, lazy initialization
// ==========================================================================

(function () {
    'use strict';

    // --- Tab registry: maps tab name to its viz module ---
    var vizModules = {
        lorenz:     function () { return window.VizLorenz; },
        mobius:     function () { return window.VizMobius; },
        klein:      function () { return window.VizKlein; },
        sierpinski: function () { return window.VizSierpinski; },
        mandelbrot: function () { return window.VizMandelbrot; }
    };

    // Track which tabs have been initialized
    var initializedTabs = {};
    var currentTab = 'home';

    // --- DOM references ---
    var tabContainer = document.getElementById('tab-container');
    var navLinks = document.querySelectorAll('[data-tab]');

    // --- Fade transition timing ---
    var FADE_DURATION = 300; // ms, matches CSS transition

    // --- Get panel element for a tab ---
    function getPanel(tabName) {
        return document.getElementById('panel-' + tabName);
    }

    // --- Update nav link active states ---
    function updateNavActive(tabName) {
        for (var i = 0; i < navLinks.length; i++) {
            var link = navLinks[i];
            if (link.getAttribute('data-tab') === tabName) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        }
    }

    // --- Initialize a viz tab on first visit ---
    function initTab(tabName) {
        if (initializedTabs[tabName]) return;
        initializedTabs[tabName] = true;

        var getModule = vizModules[tabName];
        if (getModule) {
            var mod = getModule();
            if (mod && mod.init) {
                mod.init();
            }
        }

        // MathJax safety net: typeset the panel on first activation
        var panel = getPanel(tabName);
        if (panel && window.MathJax && MathJax.typesetPromise) {
            MathJax.typesetPromise([panel]).catch(function () {});
        }
    }

    // --- Pause the current viz ---
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

    // --- Switch to a tab ---
    function switchTab(tabName, skipHistory) {
        if (tabName === currentTab) return;

        var oldPanel = getPanel(currentTab);
        var newPanel = getPanel(tabName);
        if (!newPanel) return;

        // Pause old viz
        pauseTab(currentTab);

        // Fade out old panel
        if (oldPanel) {
            oldPanel.classList.remove('visible');
        }

        // After fade-out, swap panels
        setTimeout(function () {
            // Hide old panel
            if (oldPanel) {
                oldPanel.classList.remove('active');
            }

            // Show new panel
            newPanel.classList.add('active');

            // Force reflow before adding visible class for transition
            newPanel.offsetHeight; // eslint-disable-line no-unused-expressions

            // Fade in new panel
            newPanel.classList.add('visible');

            // Update nav
            updateNavActive(tabName);

            // Update current tab
            var prevTab = currentTab;
            currentTab = tabName;

            // Update URL hash (without triggering hashchange loop)
            if (!skipHistory) {
                history.pushState(null, '', '#' + tabName);
            }

            // Scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });

            // Init or resume the new viz
            if (tabName !== 'home') {
                if (!initializedTabs[tabName]) {
                    initTab(tabName);
                } else {
                    resumeTab(tabName);
                }
            }
        }, FADE_DURATION);
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

        // Validate hash
        var validTabs = ['home', 'lorenz', 'mobius', 'klein', 'sierpinski', 'mandelbrot'];
        if (validTabs.indexOf(hash) === -1) hash = 'home';

        // Set up initial panel (no transition)
        var panel = getPanel(hash);
        if (panel) {
            panel.classList.add('active');
            panel.classList.add('visible');
        }

        updateNavActive(hash);
        currentTab = hash;

        // Init viz if starting on a viz tab
        if (hash !== 'home') {
            initTab(hash);
        }
    }

    // Run on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', onLoad);
    } else {
        onLoad();
    }

})();
