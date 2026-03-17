const SCROLL_BAR_SIZE = 8;
const BOUNDARY_SPACING = 3;
const IDLE_HIDE_DELAY = 800;

const getNormalizedScrollTop = (scrollTop, clientHeight, scrollHeight) => {
  const availableSpace = clientHeight - BOUNDARY_SPACING * 2;
  const maxScroll = Math.max(0, scrollHeight - clientHeight);
  return Math.max(0, Math.min(maxScroll, scrollTop));
};

const getThumbPosition = (scrollTop, clientHeight, scrollHeight) => {
  const totalContainerHeight = clientHeight + BOUNDARY_SPACING * 2;
  const scrollableSpace = Math.max(1, scrollHeight - clientHeight);
  const thumbRatio = clientHeight / scrollableSpace;
  const minThumbHeight = 30;
  const actualThumbHeight = Math.max(minThumbHeight, thumbRatio * clientHeight);
  const maxThumbPosition = totalContainerHeight - actualThumbHeight - BOUNDARY_SPACING * 2;
  const normalizedPosition = (scrollTop / scrollableSpace) * maxThumbPosition;
  return { thumbHeight: actualThumbHeight, position: normalizedPosition };
};

const mapThumbToScroll = (thumbY, thumbHeight, containerHeight) => {
  const totalTrackHeight = containerHeight + BOUNDARY_SPACING * 2;
  const scrollableSpace = Math.max(1, totalTrackHeight - thumbHeight - BOUNDARY_SPACING * 2);
  const usableThumbRange = scrollableSpace - thumbHeight;
  const ratio = Math.max(0, Math.min(1, (thumbY - BOUNDARY_SPACING) / usableThumbRange));
  return ratio * (totalTrackHeight - containerHeight);
};

export default class VScroll extends HTMLElement {
  static observedAttributes = ['hidden'];

  connectedCallback() {
    this.render();
    this.bindEvents();
    this.setupObservers();
    this.adjustScrollbar();
  }

  disconnectedCallback() {
    this.resizeObserver?.disconnect();
    clearTimeout(this.scrollTimeout);
    clearTimeout(this.hideScrollbarTimeout);
    if (this.container && this.scrollHandler) {
      this.container.removeEventListener('scroll', this.scrollHandler);
    }
    if (this.container && this.wheelHandler) {
      this.container.removeEventListener('wheel', this.wheelHandler, { passive: true });
    }
    const track = this.shadowRoot?.querySelector('.track');
    if (track) {
      track.removeEventListener('mouseenter', this.trackEnterHandler);
      track.removeEventListener('mouseleave', this.trackLeaveHandler);
    }
    document.removeEventListener('pointermove', this.pointerMoveHandler, true);
    document.removeEventListener('pointerup', this.pointerUpHandler, true);
  }

  attributeChangedCallback() {
    if (this.isAdjacentConnected()) {
      this.requestAdjustment();
    }
  }

  isAdjacentConnected() {
    const parent = this.parentNode;
    while (parent && parent !== document.body) {
      if (parent.shadowRoot || parent instanceof VScroll) break;
      parent = parent.parentNode;
    }
    return !!parent;
  }

  requestAdjustment() {
    clearTimeout(this.adjustTimeout);
    this.adjustTimeout = setTimeout(() => this.adjustScrollbar(), 16);
  }

  render() {
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        :host {
          display: block;
          position: relative;
          overflow: hidden;
          height: 100%;
          --scroll-thumb-bg: #c0c4cc;
          --scroll-thumb-hover: #909399;
          --scroll-thumb-active: #64666c;
          --scroll-track-bg: rgba(0,0,0,0.06);
          --scroll-size: 8px;
          --scroll-size-hover: 14px;
        }
        .container {
          position: relative;
          height: 100%;
          overflow: auto;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .container::-webkit-scrollbar {
          width: 0;
          height: 0;
        }
        .track {
          position: absolute;
          top: 0;
          right: 0;
          width: var(--scroll-size);
          height: 100%;
          background: var(--scroll-track-bg);
          border-radius: 4px;
          pointer-events: auto;
          z-index: 1;
          transition: width 0.2s ease, opacity 0.25s ease;
          opacity: 1;
        }
        .track.idle {
          opacity: 0;
        }
        .track:hover,
        .track:not(.idle) {
          opacity: 1;
        }
        .track:hover {
          width: var(--scroll-size-hover);
        }
        .track [part="bar"] {
          position: absolute;
          right: 2px;
          width: calc(var(--scroll-size) - 4px);
          min-height: 30px;
          background: var(--scroll-thumb-bg);
          border-radius: 4px;
          cursor: ns-resize;
          pointer-events: auto;
          transition: width 0.2s ease, background 0.15s ease, right 0.2s ease;
        }
        .track:hover [part="bar"] {
          width: calc(var(--scroll-size-hover) - 4px);
          right: 3px;
        }
        .track:hover [part="bar"] {
          background: var(--scroll-thumb-hover);
        }
        :host.dragging .track [part="bar"] {
          background: var(--scroll-thumb-active);
          cursor: grabbing;
        }
        ::slotted(*) {
          box-sizing: border-box;
          margin-bottom: 1rem;
        }
      </style>
      <div part="track" class="track">
        <div part="bar"></div>
      </div>
      <div class="container"><slot></slot></div>
    `;
  }

  showScrollbar() {
    const track = this.shadowRoot?.querySelector('.track');
    if (track) track.classList.remove('idle');
    clearTimeout(this.hideScrollbarTimeout);
    this.hideScrollbarTimeout = null;
  }

  scheduleHideScrollbar() {
    clearTimeout(this.hideScrollbarTimeout);
    this.hideScrollbarTimeout = setTimeout(() => {
      const track = this.shadowRoot?.querySelector('.track');
      if (track) track.classList.add('idle');
      this.hideScrollbarTimeout = null;
    }, IDLE_HIDE_DELAY);
  }

  bindEvents() {
    const bar = this.shadowRoot?.querySelector('[part="bar"]');
    const track = this.shadowRoot?.querySelector('.track');
    if (!bar) return;

    this.trackEnterHandler = () => this.showScrollbar();
    this.trackLeaveHandler = () => this.scheduleHideScrollbar();
    track?.addEventListener('mouseenter', this.trackEnterHandler);
    track?.addEventListener('mouseleave', this.trackLeaveHandler);

    const onPointerDown = (e) => {
      e.preventDefault();
      this.showScrollbar();
      this.classList.add('dragging');
      this.isDragging = true;
      this.dragStartY = e.clientY;
      this.dragStartScroll = this.container.scrollTop;
      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';
      bar.setPointerCapture?.(e.pointerId);
      document.addEventListener('pointermove', this.pointerMoveHandler, { capture: true });
      document.addEventListener('pointerup', this.pointerUpHandler, { capture: true });
    };

    this.pointerMoveHandler = (e) => {
      if (!this.isDragging) return;
      const { clientHeight, scrollHeight } = this.container;
      const scrollable = Math.max(0, scrollHeight - clientHeight);
      if (scrollable <= 0) return;
      const deltaY = e.clientY - this.dragStartY;
      const ratio = scrollable / clientHeight;
      const scrollDelta = deltaY * ratio;
      let newScrollTop = this.dragStartScroll + scrollDelta;
      newScrollTop = Math.max(0, Math.min(scrollable, newScrollTop));
      this.container.scrollTop = newScrollTop;
    };

    this.pointerUpHandler = () => {
      this.isDragging = false;
      this.classList.remove('dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('pointermove', this.pointerMoveHandler, true);
      document.removeEventListener('pointerup', this.pointerUpHandler, true);
      this.scheduleHideScrollbar();
    };

    bar.addEventListener('pointerdown', onPointerDown);
  }

  setupObservers() {
    this.resizeObserver = new ResizeObserver(() => {
      this.adjustScrollbar();
    });

    const container = this.container;
    if (container) {
      this.resizeObserver.observe(container);
      this.scrollHandler = () => {
        this.showScrollbar();
        this.adjustScrollbar();
        this.scheduleHideScrollbar();
      };
      this.wheelHandler = () => {
        this.showScrollbar();
        this.scheduleHideScrollbar();
      };
      container.addEventListener('scroll', this.scrollHandler, { passive: true });
      container.addEventListener('wheel', this.wheelHandler, { passive: true });
    }

    this.scheduleHideScrollbar();
  }

  get container() {
    return this.shadowRoot?.querySelector('.container');
  }

  get scrollBar() {
    return this.shadowRoot?.querySelector('[part="bar"]');
  }

  adjustScrollbar() {
    if (!this.container || !this.scrollBar) return;

    const { clientHeight, scrollHeight, scrollTop } = this.container;
    const { thumbHeight, position } = getThumbPosition(scrollTop, clientHeight, scrollHeight);
    const trackHeight = this.scrollBar.parentElement?.offsetHeight || 0;

    Object.assign(this.scrollBar.style, {
      height: `${thumbHeight}px`,
      top: `${position + BOUNDARY_SPACING}px`
    });

    const normalizedTop = getNormalizedScrollTop(scrollTop, clientHeight, scrollHeight);
    clearTimeout(this.scrollTimeout);
    this.scrollTimeout = setTimeout(() => {
      this.container.scrollTop = normalizedTop;
    }, 50);
  }
}

customElements.define('v-scroll', VScroll);
