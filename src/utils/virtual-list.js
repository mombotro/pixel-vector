/**
 * Virtual Scrolling List
 * Only renders visible items in large lists for better performance
 */

export class VirtualList {
    constructor(container, options = {}) {
        this.container = container;
        this.items = [];
        this.itemHeight = options.itemHeight || 40; // Default item height
        this.overscan = options.overscan || 3; // Extra items to render above/below viewport
        this.renderItem = options.renderItem || (() => document.createElement('div'));
        this.onItemClick = options.onItemClick || (() => {});

        this.visibleStart = 0;
        this.visibleEnd = 0;
        this.scrollTop = 0;

        this.viewport = null;
        this.content = null;
        this.spacer = null;

        this.init();
    }

    init() {
        // Clear container
        this.container.innerHTML = '';
        this.container.style.position = 'relative';
        this.container.style.overflow = 'auto';

        // Create viewport
        this.viewport = document.createElement('div');
        this.viewport.style.position = 'relative';
        this.viewport.style.width = '100%';

        // Create spacer to maintain scroll height
        this.spacer = document.createElement('div');
        this.spacer.style.width = '1px';
        this.spacer.style.position = 'absolute';
        this.spacer.style.top = '0';
        this.spacer.style.left = '0';
        this.spacer.style.pointerEvents = 'none';

        // Create content container
        this.content = document.createElement('div');
        this.content.style.position = 'relative';
        this.content.style.width = '100%';

        this.viewport.appendChild(this.spacer);
        this.viewport.appendChild(this.content);
        this.container.appendChild(this.viewport);

        // Add scroll listener
        this.container.addEventListener('scroll', () => {
            this.handleScroll();
        });
    }

    setItems(items) {
        this.items = items;
        this.updateVirtualList();
    }

    handleScroll() {
        this.scrollTop = this.container.scrollTop;
        this.updateVirtualList();
    }

    updateVirtualList() {
        if (this.items.length === 0) {
            this.content.innerHTML = '';
            this.spacer.style.height = '0px';
            return;
        }

        // Calculate total height
        const totalHeight = this.items.length * this.itemHeight;
        this.spacer.style.height = `${totalHeight}px`;

        // Calculate visible range
        const viewportHeight = this.container.clientHeight;
        const start = Math.floor(this.scrollTop / this.itemHeight);
        const end = Math.ceil((this.scrollTop + viewportHeight) / this.itemHeight);

        // Add overscan
        this.visibleStart = Math.max(0, start - this.overscan);
        this.visibleEnd = Math.min(this.items.length, end + this.overscan);

        // Render visible items
        this.renderVisibleItems();
    }

    renderVisibleItems() {
        this.content.innerHTML = '';

        // Position content at the right offset
        const offsetY = this.visibleStart * this.itemHeight;
        this.content.style.transform = `translateY(${offsetY}px)`;

        // Render items in visible range
        for (let i = this.visibleStart; i < this.visibleEnd; i++) {
            const itemElement = this.renderItem(this.items[i], i);
            itemElement.style.height = `${this.itemHeight}px`;
            itemElement.style.position = 'relative';

            // Add click handler
            itemElement.addEventListener('click', (e) => {
                this.onItemClick(this.items[i], i, e);
            });

            this.content.appendChild(itemElement);
        }
    }

    scrollToIndex(index) {
        const scrollPos = index * this.itemHeight;
        this.container.scrollTop = scrollPos;
        this.handleScroll();
    }

    refresh() {
        this.updateVirtualList();
    }

    destroy() {
        this.container.removeEventListener('scroll', this.handleScroll);
        this.container.innerHTML = '';
    }

    // Get currently visible item indices
    getVisibleRange() {
        return {
            start: this.visibleStart,
            end: this.visibleEnd
        };
    }

    // Update a single item without full re-render
    updateItem(index) {
        if (index >= this.visibleStart && index < this.visibleEnd) {
            this.renderVisibleItems();
        }
    }
}

/**
 * Adaptive Virtual List
 * Automatically enables virtual scrolling only when item count exceeds threshold
 */
export class AdaptiveVirtualList {
    constructor(container, options = {}) {
        this.container = container;
        this.threshold = options.threshold || 50; // Enable virtual scrolling above this count
        this.renderItem = options.renderItem;
        this.onItemClick = options.onItemClick;
        this.itemHeight = options.itemHeight || 40;
        this.overscan = options.overscan || 3;

        this.items = [];
        this.virtualList = null;
        this.isVirtual = false;
    }

    setItems(items) {
        this.items = items;

        // Decide whether to use virtual scrolling
        const shouldUseVirtual = items.length > this.threshold;

        if (shouldUseVirtual && !this.isVirtual) {
            // Switch to virtual mode
            this.enableVirtualMode();
        } else if (!shouldUseVirtual && this.isVirtual) {
            // Switch to normal mode
            this.disableVirtualMode();
        }

        // Update list
        if (this.isVirtual) {
            this.virtualList.setItems(items);
        } else {
            this.renderAllItems();
        }
    }

    enableVirtualMode() {
        this.virtualList = new VirtualList(this.container, {
            itemHeight: this.itemHeight,
            overscan: this.overscan,
            renderItem: this.renderItem,
            onItemClick: this.onItemClick
        });
        this.isVirtual = true;
        console.log('📊 Virtual scrolling enabled');
    }

    disableVirtualMode() {
        if (this.virtualList) {
            this.virtualList.destroy();
            this.virtualList = null;
        }
        this.isVirtual = false;
    }

    renderAllItems() {
        this.container.innerHTML = '';
        this.container.style.overflow = 'auto';
        this.container.style.position = 'relative';

        this.items.forEach((item, index) => {
            const element = this.renderItem(item, index);
            element.addEventListener('click', (e) => {
                this.onItemClick(item, index, e);
            });
            this.container.appendChild(element);
        });
    }

    scrollToIndex(index) {
        if (this.isVirtual) {
            this.virtualList.scrollToIndex(index);
        } else {
            const children = this.container.children;
            if (children[index]) {
                children[index].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    }

    refresh() {
        if (this.isVirtual) {
            this.virtualList.refresh();
        }
    }

    destroy() {
        if (this.virtualList) {
            this.virtualList.destroy();
        }
    }
}
