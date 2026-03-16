import scrollStyles from './themes/default.css?inline';

const SCROLL_BAR_SIZE = 8;
const BOUNDARY_SPACING = 3;

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
    this.contentResizeObserver?.disconnect();
    clearTimeout(this.scrollTimeout);
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
          ${scrollStyles}
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

  bindEvents() {
    const bar = this.shadowRoot?.querySelector('[part="bar"]');
    if (!bar) return;

    const onPointerDown = (e) => {
      e.preventDefault();
      this.classList.add('dragging');
      this.isDragging = true;
      const trackRect = this.getBoundingClientRect();
      this.dragStartY = e.clientY;
      this.dragStartScroll = this.container.scrollTop;
      document.addEventListener('pointermove', this.pointerMoveHandler, { capture: true });
      document.addEventListener('pointerup', this.pointerUpHandler, { capture: true });
    };

    this.pointerMoveHandler = (e) => {
      if (!this.isDragging) return;
      const deltaY = e.clientY - this.dragStartY;
      const newScrollTop = this.dragStartScroll + deltaY;
      this.container.scrollTop = newScrollTop;
    };

    this.pointerUpHandler = () => {
      this.isDragging = false;
      this.classList.remove('dragging');
      document.removeEventListener('pointermove', this.pointerMoveHandler, true);
      document.removeEventListener('pointerup', this.pointerUpHandler, true);
    };

    bar.setPointerCapture = (e) => {
      e.target.setPointerCapture(e.pointerId);
    };

    bar.addEventListener('pointerdown', onPointerDown);
  }

  setupObservers() {
    const content = this.querySelector(':scope > *') || this;

    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        this.contentHeight = entry.contentRect.height;
        this.adjustScrollbar();
      }
    });

    this.contentResizeObserver = new ResizeObserver(() => this.requestAdjustment());

    [this.container].forEach(el => el && this.resizeObserver.observe(el));
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
