const online = require('../online-people');
const images = require('../../../utils/social-images');
const social = require('../../../utils/social');
const { navMetrics } = require('../navigation');
const { loadMeetupFont } = require('../font');
Page({
  data: { items: [], total: 0, loading: false, refreshing: false, hasMore: false, error: '' },
  onLoad() {
    this.setData(navMetrics()); this._version = 0; this._page = 0;
    require('../../../utils/drones').fetchDrones().then(models => {
      this._models = models;
      if (!this._unloaded) this.setData({ items: this.data.items.map(person => this.person(person)) });
    });
  },
  onShow() {
    this._visible = true; loadMeetupFont(); social.start();
    this.refresh();
    clearInterval(this._timer);
    this._timer = setInterval(() => { if (!this.data.loading && this._page <= 1) this.load(true, true); }, 30000);
  },
  onHide() { this._visible = false; this._version++; this._locating = false; clearInterval(this._timer); this.setData({ loading: false, refreshing: false }); },
  onUnload() { this._unloaded = true; this.onHide(); images.dispose(this); },
  onResize() { this.setData(navMetrics()); },
  onBack() { wx.navigateBack({ fail: () => wx.redirectTo({ url: '/packages/flight-meetups/index/index' }) }); },
  onAvatarError: images.onImageError,
  onUserHomepageTap: require('../../../utils/user-homepage').onUserHomepageTap,
  person(person) { return { ...online.decorate(person), aircraftName: (this._models || []).find(model => model.slug === person.aircraftModel)?.name || person.aircraftModel }; },
  async refresh() {
    if (this._locating || this.data.loading) return;
    this._locating = true; const version = this._version;
    this.setData({ refreshing: true });
    // Render the roster immediately; location permission/failure must not block it.
    this.load(true);
    const point = await online.locate();
    if (!this._visible || version !== this._version) return;
    this._locating = false;
    if (point) { this._point = point; this.load(true); }
  },
  async load(reset = false, silent = false) {
    if (!this._visible || (this.data.loading && !reset)) return;
    const request = this._request = (this._request || 0) + 1, version = this._version;
    const page = reset ? 0 : this._page;
    this.setData({ loading: true, error: '' });
    try {
      const result = await online.list(page, 20, this._point);
      if (!this._visible || version !== this._version || request !== this._request) return;
      const rows = (result.items || []).map(person => this.person(person)), previous = reset ? [] : this.data.items;
      const existing = new Set(previous.map(p => p.featureCode));
      this._page = page + 1;
      this.setData({ items: previous.concat(rows.filter(p => !existing.has(p.featureCode))), total: result.total, hasMore: result.hasMore });
    } catch (error) {
      if (this._visible && version === this._version && request === this._request && !silent) this.setData({ error: error.message });
    } finally {
      if (this._visible && version === this._version && request === this._request) this.setData({ loading: false, refreshing: false });
    }
  },
  onMore() { if (this.data.hasMore && !this.data.loading) this.load(); },
  onRetry() { this.load(this._page === 0); }
});
