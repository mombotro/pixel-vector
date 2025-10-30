/**
 * Azirona Vexel Edit - Main Entry Point
 *
 * This is the entry point for the application.
 * It initializes the editor and sets up UI event handlers.
 */

import { VectorEditor } from './core/Editor.js';

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎨 Azirona Vexel Edit - Initializing...');
    window.editor = new VectorEditor();
    console.log('✅ Editor initialized');

    // Tab switching functionality
    const tabs = document.querySelectorAll('.tab');
    console.log('Found tabs:', tabs.length);
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            console.log('Tab clicked:', tab.dataset.tab);
            const tabName = tab.dataset.tab;

            // Remove active from all tabs and tab contents
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));

            // Add active to clicked tab and corresponding content
            tab.classList.add('active');
            const targetContent = document.getElementById(`tab-${tabName}`);
            console.log('Target content:', targetContent);
            if (targetContent) {
                targetContent.classList.add('active');
            }
        });
    });

    // Help modal functionality
    const helpBtn = document.getElementById('helpBtn');
    const helpModal = document.getElementById('helpModal');
    const helpClose = document.getElementById('helpClose');

    if (helpBtn) {
        helpBtn.addEventListener('click', () => {
            helpModal.classList.add('show');
        });
    }

    if (helpClose) {
        helpClose.addEventListener('click', () => {
            helpModal.classList.remove('show');
        });
    }

    if (helpModal) {
        helpModal.addEventListener('click', (e) => {
            if (e.target === helpModal) {
                helpModal.classList.remove('show');
            }
        });
    }

    // Dropdown menu functionality
    const dropdowns = document.querySelectorAll('.dropdown');
    console.log('Found dropdowns:', dropdowns.length);
    dropdowns.forEach(dropdown => {
        const btn = dropdown.querySelector('.dropdown-btn');
        if (btn) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                console.log('Dropdown clicked');
                // Close other dropdowns
                dropdowns.forEach(d => {
                    if (d !== dropdown) d.classList.remove('open');
                });
                // Toggle this dropdown
                dropdown.classList.toggle('open');
            });
        }
    });

    // Close dropdowns when clicking outside
    document.addEventListener('click', () => {
        dropdowns.forEach(d => d.classList.remove('open'));
    });

    // Wire up menu buttons to existing functions
    const menuItems = {
        'menu-save': () => window.editor.save(),
        'menu-load': () => window.editor.load(),
        'menu-save-palette': () => window.editor.savePalette(),
        'menu-load-palette': () => window.editor.loadPalette(),
        'menu-export-png': () => window.editor.showExportDialog('png'),
        'menu-export-jpg': () => window.editor.showExportDialog('jpg'),
        'menu-export-gif': () => window.editor.showGIFDialog(),
        'menu-export-spritesheet': () => window.editor.showSpritesheetDialog(),
        'menu-clear': () => window.editor.clear(),
        'menu-undo': () => window.editor.undo(),
        'menu-redo': () => window.editor.redo(),
        'menu-copy': () => window.editor.copyShape(),
        'menu-paste': () => window.editor.pasteShape(),
        'menu-delete': () => window.editor.deleteShape()
    };

    Object.keys(menuItems).forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', () => {
                menuItems[id]();
                dropdowns.forEach(d => d.classList.remove('open'));
            });
        }
    });

    // View menu functionality
    const viewState = {
        leftPanel: true,
        colorPalette: true,
        shapesPanel: true,
        previewPanel: true,
        timelinePanel: true
    };

    const toggleView = (panelId, selector, label) => {
        const panel = document.querySelector(selector);
        const btn = document.getElementById(panelId);
        if (!panel || !btn) return;

        const isVisible = panel.style.display !== 'none';
        panel.style.display = isVisible ? 'none' : '';

        // Update button text
        btn.textContent = isVisible ? `✗ ${label}` : `✓ ${label}`;
    };

    // View toggle buttons
    document.getElementById('view-left-panel')?.addEventListener('click', () => {
        toggleView('view-left-panel', '.left-panel', 'Left Toolbar');
    });

    document.getElementById('view-color-palette')?.addEventListener('click', () => {
        toggleView('view-color-palette', '.panel-box:has(#colorPalette)', 'Color Palette');
    });

    document.getElementById('view-shapes-panel')?.addEventListener('click', () => {
        toggleView('view-shapes-panel', '.panel-box:has(.tabs)', 'Shapes/History');
    });

    document.getElementById('view-preview-panel')?.addEventListener('click', () => {
        toggleView('view-preview-panel', '.preview-panel', 'Preview');
    });

    document.getElementById('view-timeline-panel')?.addEventListener('click', () => {
        toggleView('view-timeline-panel', '.timeline-panel', 'Timeline');
    });

    // Toggle Grid
    document.getElementById('view-toggle-grid')?.addEventListener('click', () => {
        window.editor.showGrid = !window.editor.showGrid;
        const toggleGrid = document.getElementById('toggle-grid');
        if (toggleGrid) {
            toggleGrid.textContent = window.editor.showGrid ? 'Hide Grid' : 'Show Grid';
        }
        window.editor.render();
    });

    // Toggle Outline
    document.getElementById('view-toggle-outline')?.addEventListener('click', () => {
        // Toggle outline for all selected shapes
        if (window.editor.selectedShapes.length > 0) {
            const newOutlineState = !window.editor.selectedShapes[0].outline;
            window.editor.selectedShapes.forEach(shape => {
                shape.outline = newOutlineState;
            });
            window.editor.render();
        } else if (window.editor.selectedShape) {
            window.editor.selectedShape.outline = !window.editor.selectedShape.outline;
            window.editor.render();
        }
    });

    // Zen mode - hide all panels
    document.getElementById('view-zen-mode')?.addEventListener('click', () => {
        const allHidden = document.querySelector('.left-panel').style.display === 'none';

        if (allHidden) {
            // Restore all panels
            document.querySelector('.left-panel').style.display = '';
            document.querySelector('.panel-box:has(#colorPalette)').style.display = '';
            document.querySelector('.panel-box:has(.tabs)').style.display = '';
            document.querySelector('.preview-panel').style.display = '';
            document.querySelector('.timeline-panel').style.display = '';

            document.getElementById('view-left-panel').textContent = '✓ Left Toolbar';
            document.getElementById('view-color-palette').textContent = '✓ Color Palette';
            document.getElementById('view-shapes-panel').textContent = '✓ Shapes/History';
            document.getElementById('view-preview-panel').textContent = '✓ Preview';
            document.getElementById('view-timeline-panel').textContent = '✓ Timeline';

            viewState.leftPanel = true;
            viewState.colorPalette = true;
            viewState.shapesPanel = true;
            viewState.previewPanel = true;
            viewState.timelinePanel = true;
        } else {
            // Hide all panels
            document.querySelector('.left-panel').style.display = 'none';
            document.querySelector('.panel-box:has(#colorPalette)').style.display = 'none';
            document.querySelector('.panel-box:has(.tabs)').style.display = 'none';
            document.querySelector('.preview-panel').style.display = 'none';
            document.querySelector('.timeline-panel').style.display = 'none';

            document.getElementById('view-left-panel').textContent = '✗ Left Toolbar';
            document.getElementById('view-color-palette').textContent = '✗ Color Palette';
            document.getElementById('view-shapes-panel').textContent = '✗ Shapes/History';
            document.getElementById('view-preview-panel').textContent = '✗ Preview';
            document.getElementById('view-timeline-panel').textContent = '✗ Timeline';

            viewState.leftPanel = false;
            viewState.colorPalette = false;
            viewState.shapesPanel = false;
            viewState.previewPanel = false;
            viewState.timelinePanel = false;
        }
    });

    // Canvas Ratio
    const updateRatioUI = () => {
        ['1-1', '16-9', '4-3', '3-2'].forEach(ratio => {
            const btn = document.getElementById(`canvas-ratio-${ratio}`);
            if (btn) {
                const currentRatio = window.editor.aspectRatio.replace(':', '-');
                btn.textContent = ratio === currentRatio ? `● ${ratio.replace('-', ':')} ${ratio === '1-1' ? '(Square)' : ''}` : ratio.replace('-', ':');
            }
        });
    };

    document.getElementById('canvas-ratio-1-1')?.addEventListener('click', () => {
        window.editor.aspectRatio = '1:1';
        window.editor.updateCanvasDimensions();
        updateRatioUI();
    });

    document.getElementById('canvas-ratio-16-9')?.addEventListener('click', () => {
        window.editor.aspectRatio = '16:9';
        window.editor.updateCanvasDimensions();
        updateRatioUI();
    });

    document.getElementById('canvas-ratio-4-3')?.addEventListener('click', () => {
        window.editor.aspectRatio = '4:3';
        window.editor.updateCanvasDimensions();
        updateRatioUI();
    });

    document.getElementById('canvas-ratio-3-2')?.addEventListener('click', () => {
        window.editor.aspectRatio = '3:2';
        window.editor.updateCanvasDimensions();
        updateRatioUI();
    });

    // Canvas Orientation
    const updateOrientationUI = () => {
        const landscapeBtn = document.getElementById('canvas-orientation-landscape');
        const portraitBtn = document.getElementById('canvas-orientation-portrait');
        if (landscapeBtn) landscapeBtn.textContent = window.editor.orientation === 'landscape' ? '● Landscape' : 'Landscape';
        if (portraitBtn) portraitBtn.textContent = window.editor.orientation === 'portrait' ? '● Portrait' : 'Portrait';
    };

    document.getElementById('canvas-orientation-landscape')?.addEventListener('click', () => {
        window.editor.orientation = 'landscape';
        window.editor.updateCanvasDimensions();
        updateOrientationUI();
    });

    document.getElementById('canvas-orientation-portrait')?.addEventListener('click', () => {
        window.editor.orientation = 'portrait';
        window.editor.updateCanvasDimensions();
        updateOrientationUI();
    });

    // Grid Size
    const updateGridUI = () => {
        ['off', '8', '16', '32', '64'].forEach(size => {
            const btn = document.getElementById(`canvas-grid-${size}`);
            if (btn) {
                const currentGrid = size === 'off' ? 0 : parseInt(size);
                const isActive = window.editor.gridCells === currentGrid;
                btn.textContent = isActive ? `● ${size === 'off' ? 'Off' : size + '×' + size}` : (size === 'off' ? 'Off' : size + '×' + size);
            }
        });
    };

    document.getElementById('canvas-grid-off')?.addEventListener('click', () => {
        window.editor.gridCells = 0;
        window.editor.updateDitherScaleForGrid();
        window.editor.render();
        updateGridUI();
    });

    document.getElementById('canvas-grid-8')?.addEventListener('click', () => {
        window.editor.gridCells = 8;
        window.editor.updateDitherScaleForGrid();
        window.editor.render();
        updateGridUI();
    });

    document.getElementById('canvas-grid-16')?.addEventListener('click', () => {
        window.editor.gridCells = 16;
        window.editor.updateDitherScaleForGrid();
        window.editor.render();
        updateGridUI();
    });

    document.getElementById('canvas-grid-32')?.addEventListener('click', () => {
        window.editor.gridCells = 32;
        window.editor.updateDitherScaleForGrid();
        window.editor.render();
        updateGridUI();
    });

    document.getElementById('canvas-grid-64')?.addEventListener('click', () => {
        window.editor.gridCells = 64;
        window.editor.updateDitherScaleForGrid();
        window.editor.render();
        updateGridUI();
    });

    // Initialize UI
    updateRatioUI();
    updateOrientationUI();
    updateGridUI();

    // Preview mode buttons
    document.getElementById('preview-actual')?.addEventListener('click', function() {
        document.getElementById('preview-actual').classList.add('active');
        document.getElementById('preview-repeat').classList.remove('active');
        window.editor.previewMode = 'actual';
        window.editor.updatePreview();
    });

    document.getElementById('preview-repeat')?.addEventListener('click', function() {
        document.getElementById('preview-repeat').classList.add('active');
        document.getElementById('preview-actual').classList.remove('active');
        window.editor.previewMode = 'repeat';
        window.editor.updatePreview();
    });

    // Close all dropdowns when clicking outside
    document.addEventListener('click', () => {
        dropdowns.forEach(d => d.classList.remove('open'));
    });
});
