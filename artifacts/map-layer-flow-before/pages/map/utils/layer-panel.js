const townRegions = require("../../../utils/town-regions");
const {
  prepareProvinceCityHighlightResource,
  buildProvinceCityHighlightPolygons,
  buildProvinceNodeId
} = require("../../../utils/province-city-highlight");
const {
  fetchMapLayerSettings,
  updateMapLayerSettings
} = require("../../../utils/map-layer-settings");
const {
  prefetchUomLayerConfig,
  resolveUseUomOriginalLayerSync
} = require("../../../utils/uom-layer-config");

const MAP_LAYER_EXTRA_CONFIG_DISABLE_CENTER_TARGET_LINK_KEY = "disableCenterTargetLinkDistance";
const MAP_LAYER_EXTRA_CONFIG_ENABLE_PROVINCE_CITY_HIGHLIGHT_KEY = "enableProvinceCityHighlight";
const MAP_LAYER_EXTRA_CONFIG_PLANET_BROADCAST_STRIP_ENABLED_KEY = "planetBroadcastStripEnabled";
const MAP_LAYER_EXTRA_CONFIG_PROVINCE_CITY_HIGHLIGHT_SELECTION_KEY = "provinceCityHighlightSelection";
const MAP_LAYER_EXTRA_CONFIG_BASE_LAYER_TYPE_KEY = "baseLayerType";
const MAP_LAYER_EXTRA_CONFIG_MY_LOCATION_ICON_TYPE_KEY = "myLocationIconType";
const MAP_LAYER_EXTRA_CONFIG_CENTER_PIN_ICON_TYPE_KEY = "centerPinIconType";
const MAP_LAYER_EXTRA_CONFIG_UOM_RENDER_COLOR_KEY = "uomRenderColor";
const UOM3_RENDER_COLOR_STORAGE_KEY = "uom3RenderColor";
const UOM3_DEFAULT_RENDER_COLOR = "default";
const MAP_LAYER_BASE_TYPE_TIANDITU = "tiandituSatellite";
const MY_LOCATION_ICON_TYPES = {
  DEFAULT: "default",
  HIGHLIGHT: "highlight",
  AVATAR: "avatar"
};
const CENTER_PIN_ICON_TYPES = {
  DEFAULT: "default",
  DRONE_1: "drone1",
  DRONE_2: "drone2",
  BAMBOO_1: "bamboo1",
  BAMBOO_2: "bamboo2"
};
const CENTER_PIN_ICON_PATHS = {
  default: "/assets/position.png",
  drone1: "/assets/vip/drone-1.png",
  drone2: "/assets/vip/drone-2.png",
  bamboo1: "/assets/vip/bamboo-copter-1.png",
  bamboo2: "/assets/vip/bamboo-copter-2.png"
};

const normalizeRenderColor = (value) => {
  const text = `${value || ""}`.trim();
  if (!text || text.toLowerCase() === UOM3_DEFAULT_RENDER_COLOR) {
    return UOM3_DEFAULT_RENDER_COLOR;
  }
  const hex = text.replace(/^#/, "");
  if (/^[0-9a-fA-F]{6}$/.test(hex)) {
    return `#${hex.toUpperCase()}`;
  }
  return UOM3_DEFAULT_RENDER_COLOR;
};

const readStoredRenderColor = () => {
  try {
    return normalizeRenderColor(wx.getStorageSync(UOM3_RENDER_COLOR_STORAGE_KEY));
  } catch (err) {
    return UOM3_DEFAULT_RENDER_COLOR;
  }
};

const writeStoredRenderColor = (value) => {
  const normalized = normalizeRenderColor(value);
  try {
    wx.setStorageSync(UOM3_RENDER_COLOR_STORAGE_KEY, normalized);
  } catch (err) {
    // ignore storage failure
  }
  return normalized;
};

const resolveEventDataset = (event = {}) => {
  const currentTargetDataset = event?.currentTarget?.dataset;
  if (
    currentTargetDataset &&
    typeof currentTargetDataset === "object" &&
    Object.keys(currentTargetDataset).length
  ) {
    return currentTargetDataset;
  }
  const detailDataset = event?.detail?.dataset;
  if (
    detailDataset &&
    typeof detailDataset === "object" &&
    Object.keys(detailDataset).length
  ) {
    return detailDataset;
  }
  return {};
};

function navigateToMemberPage() {
  if (typeof wx.navigateTo !== "function") {
    wx.showToast({ title: "当前版本暂不支持", icon: "none" });
    return;
  }
  wx.navigateTo({ url: "/packages/member/index/index" });
}

function onLayerButtonTap(page) {
  if (typeof page.syncUserMembershipState === "function") {
    page.syncUserMembershipState();
  }
  if (page._layerPanelCloseTimer) {
    clearTimeout(page._layerPanelCloseTimer);
    page._layerPanelCloseTimer = null;
  }
  page.setData({ layerPanelVisible: true, layerPanelClosing: false }, () => {
    scheduleLayerPanelLayoutMeasure(page, 0);
  });
  page.loadMapLayerSettings(false);
}

function onLayerPanelMaskTap(page) {
  closeLayerPanel(page);
}

function onLayerPanelClose(page) {
  closeLayerPanel(page);
}

function closeLayerPanel(page) {
  if (!page.data.layerPanelVisible) {
    return;
  }
  if (page._layerPanelCloseTimer) {
    clearTimeout(page._layerPanelCloseTimer);
    page._layerPanelCloseTimer = null;
  }
  page.setData({ layerPanelClosing: true });
  page._layerPanelCloseTimer = setTimeout(() => {
    page.setData({ layerPanelVisible: false, layerPanelClosing: false });
    page._layerPanelCloseTimer = null;
  }, 220);
}

function onMapLayerSelect(page, event = {}) {
  const type = resolveEventDataset(event).type || "";
  const nextType = type === "satellite" || type === "tianditu" ? type : "standard";
  if ((nextType === "satellite" || nextType === "tianditu") && !page.data.userVip) {
    navigateToMemberPage();
    return;
  }
  const enableSatellite = nextType === "satellite" || nextType === "tianditu";
  page.setData({
    mapLayerType: nextType,
    enableSatellite
  }, () => {
    page.setTiandituSatelliteLayerEnabled(nextType === "tianditu", { force: true });
    page.refreshMyLocationGraphics(page.data.myLocationPoint || page._lastKnownLocation || null);
    page.persistMapLayerSettings();
  });
}

function onAirBoardSwitchChange(page, event = {}) {
  const enabled = !!event?.detail?.value;
  page.setData(
    { airBoardEnabled: enabled, showDashboardPanel: enabled },
    () => {
      page.applyAirBoardToggle(enabled);
      page.persistMapLayerSettings();
    }
  );
}

function onPlanetBroadcastStripSwitchChange(page, event = {}) {
  const enabled = !!event?.detail?.value;
  page.setData(
    { planetBroadcastStripEnabled: enabled },
    () => {
      page.persistMapLayerSettings();
    }
  );
}

function onUsePlanetCenterPointSwitchChange(page, event = {}) {
  const enabled = !!event?.detail?.value;
  applyMyLocationIconType(page, enabled ? MY_LOCATION_ICON_TYPES.HIGHLIGHT : MY_LOCATION_ICON_TYPES.DEFAULT);
}

function onMyLocationIconSelect(page, event = {}) {
  const type = normalizeMyLocationIconType(resolveEventDataset(event).type);
  if (type !== MY_LOCATION_ICON_TYPES.DEFAULT && !page.data.userVip) {
    navigateToMemberPage();
    return;
  }
  applyMyLocationIconType(page, type);
}

function applyMyLocationIconType(page, type) {
  const nextType = normalizeMyLocationIconType(type);
  const enabled = nextType !== MY_LOCATION_ICON_TYPES.DEFAULT;
  page.setData({ myLocationIconType: nextType, usePlanetCenterPoint: enabled }, () => {
    if (nextType === MY_LOCATION_ICON_TYPES.AVATAR && typeof page.ensureMyLocationAvatarIcon === "function") {
      page.ensureMyLocationAvatarIcon({ force: true });
    }
    const finish = () => {
      page.refreshMyLocationGraphics(page.data.myLocationPoint || page._lastKnownLocation || null);
      page.persistMapLayerSettings();
    };
    if (enabled) {
      page.syncMyLocationPoint({ silent: true }).finally(finish);
      return;
    }
    finish();
  });
}

function onCenterPinIconSelect(page, event = {}) {
  const type = normalizeCenterPinIconType(resolveEventDataset(event).type);
  if (type !== CENTER_PIN_ICON_TYPES.DEFAULT && !page.data.userVip) {
    navigateToMemberPage();
    return;
  }
  page.setData(
    {
      centerPinIconType: type,
      centerPinIconPath: resolveCenterPinIconPath(type)
    },
    () => {
      page.persistMapLayerSettings();
    }
  );
}

function onCenterTargetLinkSwitchChange(page, event = {}) {
  const enabled = !!event?.detail?.value;
  page.setData({ centerTargetLinkEnabled: enabled }, () => {
    page.updateCenterPinIndicator();
    page.persistMapLayerSettings();
  });
}

function buildProvinceCityTreeViewData(page, treeNodes = null) {
  const source = treeNodes || page._provinceCityHighlightTree || [];
  const selected = page._regionPendingId || page._provinceCityHighlightSelectedId;
  const expanded = page._provinceCityHighlightExpandedMap || {};
  const rows = [];
  const walk = (nodes, depth) => nodes.forEach(node => {
    const children = node.children || [];
    const isExpanded = expanded[node.id] === true;
    rows.push({ id: node.id, label: node.label, type: node.type, depth,
      selected: node.id === selected, selectable: !!node.filePath || ["county", "town"].includes(node.type), hasChildren: node.hasChildren || children.length > 0,
      expanded: isExpanded, loading: node.loading === true });
    if (isExpanded) walk(children, depth + 1);
  });
  walk(source, 0);
  return rows;
}

function updateProvinceCityTreeData(page, extra = {}) {
  page.setData(
    Object.assign(
      {
        provinceCityTree: buildProvinceCityTreeViewData(page),
        provinceCityHighlightSelectedId: `${page._provinceCityHighlightSelectedId || ""}`
      },
      extra || {}
    ),
    () => {
      return null;
    }
  );
}

function scheduleLayerPanelLayoutMeasure(page, delay = 0) {
  const _ignoredDelay = delay;
  return measureLayerPanelLayout(page);
}

function measureLayerPanelLayout(page) {
  if (!page.data.layerPanelVisible && !page.data.layerPanelBodyMaxHeightPx) return;
  const bodyMaxHeightPx = Number(page.data.layerPanelBodyMaxHeightPx);
  const panelMaxHeightPx = Number(page.data.layerPanelMaxHeightPx);
  if (!Number.isFinite(bodyMaxHeightPx) || bodyMaxHeightPx <= 0 || !Number.isFinite(panelMaxHeightPx) || panelMaxHeightPx <= 0) {
    return;
  }
  if (
    page.data.layerPanelBodyHeightPx === bodyMaxHeightPx &&
    page.data.layerPanelMaxHeightPx === panelMaxHeightPx
  ) {
    return;
  }
  page.setData({
    layerPanelBodyHeightPx: bodyMaxHeightPx,
    layerPanelMaxHeightPx: panelMaxHeightPx
  });
}

function findProvinceCityTreeNodeById(page, nodeId, treeNodes = null) {
  const nodes = treeNodes || page._provinceCityHighlightTree || [];
  for (const node of nodes) {
    if (node.id === nodeId) return node;
    const found = findProvinceCityTreeNodeById(page, nodeId, node.children || []);
    if (found) return found;
  }
  return null;
}

async function loadRegionChildren(page, node) {
  if (!node.regionId || node.remoteLoaded) return;
  if (!node.childRequest) node.childRequest = townRegions.children({ apiBase: page.getApiBase(), token: page.getAuthToken() }, node)
    .then(children => { node.children = townRegions.merge(node.children || [], children); node.remoteLoaded = true; })
    .finally(() => { node.childRequest = null; });
  await node.childRequest;
}

async function restoreRegionPath(page, id) {
  let ancestors;
  if (/^town::[a-f0-9]{32}$/.test(id || "")) {
    ancestors = await townRegions.ancestors({ apiBase: page.getApiBase(), token: page.getAuthToken() }, id);
  } else {
    const province = (page._provinceCityHighlightTree || []).find(p => (p.children || []).some(c => c.id === id));
    if (province) { await loadRegionChildren(page, province); page._provinceCityHighlightExpandedMap[province.id] = true; }
    return;
  }
  let nodes = page._provinceCityHighlightTree;
  for (const ancestor of ancestors) {
    const node = nodes.find(n => n.regionId === ancestor.regionId);
    if (!node || node.id === id) break;
    await loadRegionChildren(page, node);
    page._provinceCityHighlightExpandedMap[node.id] = true;
    nodes = node.children || [];
  }
}

async function expandTownDirectory(page, node) {
  if (node.loading) return;
  if (page._provinceCityHighlightExpandedMap[node.id]) {
    page._provinceCityHighlightExpandedMap[node.id] = false;
    updateProvinceCityTreeData(page); return;
  }
  const loadToken = page._provinceCityHighlightLoadToken;
  node.loading = true; updateProvinceCityTreeData(page);
  try {
    await loadRegionChildren(page, node);
    if (loadToken !== page._provinceCityHighlightLoadToken || !page.data.provinceCityHighlightEnabled) return;
    page._provinceCityHighlightExpandedMap[node.id] = true;
  } catch (e) { wx.showToast({ title: e.message || '镇级目录加载失败', icon: 'none' }); }
  finally { node.loading = false; updateProvinceCityTreeData(page); }
}

function setProvinceCityHighlightPolygons(page, polygons = []) {
  page._provinceCityHighlightPolygons = Array.isArray(polygons) ? polygons.slice() : [];
  page.updateOverlayGraphics();
}

function loadProvinceCityHighlightResource(page, options = {}) {
  const apiBase = page.getApiBase();
  const token = page.getAuthToken();
  if (!apiBase || !token) {
    updateProvinceCityTreeData(page, {
      provinceCityHighlightLoading: false,
      provinceCityHighlightError: "行政区图层暂不可用"
    });
    return Promise.resolve(false);
  }
  const loadToken = page._provinceCityHighlightLoadToken + 1;
  page._provinceCityHighlightLoadToken = loadToken;
  updateProvinceCityTreeData(page, {
    provinceCityHighlightLoading: true,
    provinceCityHighlightError: ""
  });
  return Promise.allSettled([
    prepareProvinceCityHighlightResource({ apiBase, token }),
    townRegions.children({ apiBase, token })
  ]).then(async ([legacy, remote]) => {
      if (page._provinceCityHighlightLoadToken !== loadToken) return false;
      const resource = legacy.status === "fulfilled" ? legacy.value : null;
      const roots = remote.status === "fulfilled" ? remote.value : [];
      page._provinceCityHighlightResource = resource;
      page._provinceCityHighlightTree = townRegions.merge(resource?.tree || [], roots);
      if (!page._provinceCityHighlightTree.length) throw new Error("区域目录加载失败");
      if (remote.status === "rejected" && options.showErrorToast) wx.showToast({ title: "县镇目录暂不可用，请重试", icon: "none" });
      await restoreRegionPath(page, page._provinceCityHighlightSelectedId).catch(e => console.warn("Restore region path failed", e));
      if (page._provinceCityHighlightLoadToken !== loadToken) return false;
      page._provinceCityHighlightPolygonCache = new Map();
      updateProvinceCityTreeData(page, {
        provinceCityHighlightLoading: false,
        provinceCityHighlightError: ""
      });
      const selectedNode = findProvinceCityTreeNodeById(page, page._provinceCityHighlightSelectedId) || (/^town::[a-f0-9]{32}$/.test(page._provinceCityHighlightSelectedId || "") ? { id: page._provinceCityHighlightSelectedId, type: "town" } : null);
      if (selectedNode) {
        return applyProvinceCityHighlightSelection(page, selectedNode.id, {
          showErrorToast: false,
          persist: false
        });
      }
      setProvinceCityHighlightPolygons(page, []);
      return true;
    })
    .catch((err) => {
      if (page._provinceCityHighlightLoadToken !== loadToken) {
        return false;
      }
      console.warn("load province city highlight resource failed", err);
      updateProvinceCityTreeData(page, {
        provinceCityHighlightLoading: false,
        provinceCityHighlightError: "行政区图层加载失败"
      });
      if (options.showErrorToast) {
        wx.showToast({ title: "省市图层加载失败", icon: "none" });
      }
      return false;
    });
}

function syncProvinceCityHighlightLayer(page, enabled, options = {}) {
  if (enabled !== true) {
    page._provinceCityHighlightLoadToken += 1;
    page._regionPendingId = "";
    page.setData({ regionPendingName: "", regionConfirmLoading: false });
    setProvinceCityHighlightPolygons(page, []);
    updateProvinceCityTreeData(page, {
      provinceCityHighlightLoading: false,
      provinceCityHighlightError: ""
    });
    return Promise.resolve(false);
  }
  return loadProvinceCityHighlightResource(page, options);
}

function applyProvinceCityHighlightSelection(page, nodeId, options = {}) {
  const node = findProvinceCityTreeNodeById(page, nodeId) || (/^town::[a-f0-9]{32}$/.test(nodeId) ? { id: nodeId, type: "town" } : null);
  if (!node) {
    return Promise.resolve(false);
  }
  if (!node.filePath && !["county", "town"].includes(node.type)) return expandTownDirectory(page, node);
  if (node.type === "city" && node.provinceName) {
    page._provinceCityHighlightExpandedMap[buildProvinceNodeId(node.provinceName)] = true;
  }
  const cacheKey = `${node.id || ""}`;
  page._regionRequestedId = cacheKey;
  const loadToken = page._provinceCityHighlightLoadToken;
  const selectionToken = (page._regionSelectionToken || 0) + 1;
  page._regionSelectionToken = selectionToken;
  let polygonPromise = options.force === true ? null : page._provinceCityHighlightPolygonCache.get(cacheKey);
  if (!polygonPromise) {
    polygonPromise = ["county", "town"].includes(node.type) ? townRegions.geometry({ apiBase: page.getApiBase(), token: page.getAuthToken() }, node) : buildProvinceCityHighlightPolygons(node.filePath);
    page._provinceCityHighlightPolygonCache.set(cacheKey, polygonPromise);
  }
  return Promise.resolve(polygonPromise)
    .then((polygons) => {
      if (
        page.data.provinceCityHighlightEnabled !== true ||
        page._provinceCityHighlightLoadToken !== loadToken || page._regionSelectionToken !== selectionToken ||
        page._regionRequestedId !== cacheKey
      ) {
        return false;
      }
      page._provinceCityHighlightSelectedId = cacheKey;
      updateProvinceCityTreeData(page);
      setProvinceCityHighlightPolygons(page, polygons);
      if (options.persist !== false) page.persistMapLayerSettings();
      return true;
    })
    .catch((err) => {
      page._provinceCityHighlightPolygonCache.delete(cacheKey);
        console.warn("apply province city highlight selection failed", err);
      if (options.showErrorToast) {
        wx.showToast({ title: "区域高亮加载失败", icon: "none" });
      }
      return false;
    });
}

function onProvinceCityHighlightSwitchChange(page, event = {}) {
  const enabled = !!event?.detail?.value;
  page.setData({ provinceCityHighlightEnabled: enabled }, () => {
    page.persistMapLayerSettings();
    syncProvinceCityHighlightLayer(page, enabled, { showErrorToast: true });
  });
}

function onProvinceCityTreeExpandTap(page, event = {}) {
  const id = `${resolveEventDataset(event).id || ""}`.trim();
  if (!id) return;
  const node = findProvinceCityTreeNodeById(page, id);
  if (node?.regionId) return expandTownDirectory(page, node);
  page._provinceCityHighlightExpandedMap[id] = page._provinceCityHighlightExpandedMap[id] !== true;
  updateProvinceCityTreeData(page);
}

function onProvinceCityTreeSelectTap(page, event = {}) {
  const id = `${resolveEventDataset(event).id || ""}`.trim();
  if (!id || !page.data.provinceCityHighlightEnabled || page.data.regionConfirmLoading) return;
  const node = findProvinceCityTreeNodeById(page, id);
  if (!node) return;
  if (!node.filePath && !["county", "town"].includes(node.type)) return expandTownDirectory(page, node);
  page._regionPendingId = id;
  page.setData({ regionPendingName: node.label });
  updateProvinceCityTreeData(page);
}

async function onRegionConfirmTap(page) {
  const id = page._regionPendingId;
  if (!id || !page.data.provinceCityHighlightEnabled || page.data.regionConfirmLoading) return;
  const token = page._provinceCityHighlightLoadToken;
  page.setData({ regionConfirmLoading: true });
  try { await applyProvinceCityHighlightSelection(page, id, { showErrorToast: true }); }
  finally { if (token === page._provinceCityHighlightLoadToken) page.setData({ regionConfirmLoading: false }); }
}

function onMapElementToggle(page, event = {}) {
  const id = resolveEventDataset(event).id;
  if (!id) return;
  const flagMap = {
    uom: "uomDivisionEnabled",
    dji: "djiNoFlyZoneEnabled",
    tempNoFly: "temporaryNoFlyZoneEnabled",
    service: "merchantMarkersEnabled",
    private: "privateMarkersEnabled",
    group: "groupSharingEnabled",
    platform: "platformCoConstructionEnabled",
    aerial: "aerialPointsEnabled"
  };
  const flagKey = flagMap[id];
  if (!flagKey) return;
  const nextValue = !page.data[flagKey];
  const pinToggle =
    flagKey === "privateMarkersEnabled" ||
    flagKey === "groupSharingEnabled" ||
    flagKey === "platformCoConstructionEnabled";
  const updates = { [flagKey]: nextValue };
  updates.mapElementOptions = page.composeMapElementOptions({
    aerialPointsEnabled: flagKey === "aerialPointsEnabled" ? nextValue : page.data.aerialPointsEnabled,
    uomDivisionEnabled: flagKey === "uomDivisionEnabled" ? nextValue : page.data.uomDivisionEnabled,
    djiNoFlyZoneEnabled: flagKey === "djiNoFlyZoneEnabled" ? nextValue : page.data.djiNoFlyZoneEnabled,
    temporaryNoFlyZoneEnabled:
      flagKey === "temporaryNoFlyZoneEnabled" ? nextValue : page.data.temporaryNoFlyZoneEnabled,
    merchantMarkersEnabled:
      flagKey === "merchantMarkersEnabled" ? nextValue : page.data.merchantMarkersEnabled,
    privateMarkersEnabled: flagKey === "privateMarkersEnabled" ? nextValue : page.data.privateMarkersEnabled,
    groupSharingEnabled: flagKey === "groupSharingEnabled" ? nextValue : page.data.groupSharingEnabled,
    platformCoConstructionEnabled:
      flagKey === "platformCoConstructionEnabled" ? nextValue : page.data.platformCoConstructionEnabled
  });
  page.setData(updates, () => {
    if (flagKey === "uomDivisionEnabled") {
      if (page._uomPlugin && typeof page._uomPlugin.setEnabled === "function") {
        page._uomPlugin.setEnabled(nextValue);
      }
    }
    if (flagKey === "djiNoFlyZoneEnabled") {
      page.applyNoFlyOverlayToggle({
        djiEnabled: nextValue,
        temporaryEnabled: page.data.temporaryNoFlyZoneEnabled
      });
    }
    if (flagKey === "temporaryNoFlyZoneEnabled") {
      page.applyNoFlyOverlayToggle({
        djiEnabled: page.data.djiNoFlyZoneEnabled,
        temporaryEnabled: nextValue
      });
    }
    if (flagKey === "merchantMarkersEnabled") {
      page.applyMerchantMarkersToggle(nextValue);
    }
    if (pinToggle) {
      page.applyPinLayerToggle(nextValue);
    }
    if (flagKey === "aerialPointsEnabled") page.scheduleFetchAerialPoints?.(0, { force: true });
    page.persistMapLayerSettings();
  });
}

function applyNoFlyOverlayToggle(page, options = {}) {
  const djiEnabled = options.djiEnabled !== false;
  const temporaryEnabled = options.temporaryEnabled !== false;
  if (!djiEnabled) {
    page._djiPolygons = [];
    page._djiCircles = [];
    page.setData({
      djiStatus: "已禁用",
      djiStatusExtra: "",
      djiTone: "warn",
      djiColor: ""
    });
  } else {
    page.setData({
      djiStatus: "评估中",
      djiStatusExtra: "",
      djiTone: "neutral",
      djiColor: ""
    });
  }
  page.setDjiLayerEnabled(djiEnabled, { force: djiEnabled });
  if (!temporaryEnabled) {
    page._nfzPolygons = [];
    page._nfzCircles = [];
    page.setData({
      temporaryNoFlyZoneInfo: null,
      temporaryNoFlyText: "已禁用",
      temporaryNoFlyTone: "warn"
    });
  } else {
    page.setData({
      temporaryNoFlyZoneInfo: null,
      temporaryNoFlyText: "评估中",
      temporaryNoFlyTone: "neutral"
    });
  }
  page.setTemporaryNoFlyLayerEnabled(temporaryEnabled, { force: temporaryEnabled });
  page.updateOverlayGraphics();
}

function applyMerchantMarkersToggle(page, enabled) {
  if (enabled === false) {
    require("../../../utils/latest-map-request").cancel(page, "_pendingMarkersFetch");
    page._nearbyMarkersRaw = [];
    page._nearbyMarkers = [];
    page._lastNearbyFetch = null;
    page.syncAllMarkers();
    return;
  }
  page.syncAllMarkers();
  page.scheduleFetchMarkers(0, { force: true });
}

function applyPinLayerToggle(page, forceFetch = false) {
  page.rebuildNearbyPinGraphics();
  if (!page.isPinLayerEnabled()) {
    require("../../../utils/latest-map-request").cancel(page, "_pendingPinsFetch");
    if (page._pinsFetchTimer) {
      clearTimeout(page._pinsFetchTimer);
      page._pinsFetchTimer = null;
    }
    page._lastNearbyPinFetch = null;
    return;
  }
  if (forceFetch && page.isPinLayerEnabled()) {
    page.scheduleFetchPins(0, { force: true });
  }
}

function parseMapLayerExtraBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return fallback;
    if (normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on") {
      return true;
    }
    if (normalized === "false" || normalized === "0" || normalized === "no" || normalized === "off") {
      return false;
    }
  }
  return fallback;
}

function resolveCenterTargetLinkEnabled(page, settings = {}) {
  const extraConfig = settings && typeof settings.extraConfig === "object" ? settings.extraConfig : null;
  const raw = extraConfig ? extraConfig[MAP_LAYER_EXTRA_CONFIG_DISABLE_CENTER_TARGET_LINK_KEY] : undefined;
  if (raw === undefined || raw === null) {
    return true;
  }
  const disabled = parseMapLayerExtraBoolean(raw, false);
  return disabled !== true;
}

function resolveUseUomOriginalLayer(page, settings = {}) {
  void settings;
  const resolved = resolveUseUomOriginalLayerSync(page.data.useUomOriginalLayer === true);
  return resolved === true;
}

function resolveProvinceCityHighlightEnabled(page, settings = {}) {
  const extraConfig = settings && typeof settings.extraConfig === "object" ? settings.extraConfig : null;
  const raw = extraConfig ? extraConfig[MAP_LAYER_EXTRA_CONFIG_ENABLE_PROVINCE_CITY_HIGHLIGHT_KEY] : undefined;
  if (raw === undefined || raw === null) {
    return false;
  }
  return parseMapLayerExtraBoolean(raw, false) === true;
}

function resolvePlanetBroadcastStripEnabled(page, settings = {}) {
  void page;
  const extraConfig = settings && typeof settings.extraConfig === "object" ? settings.extraConfig : null;
  const raw = extraConfig ? extraConfig[MAP_LAYER_EXTRA_CONFIG_PLANET_BROADCAST_STRIP_ENABLED_KEY] : undefined;
  if (raw === undefined || raw === null) {
    return true;
  }
  return parseMapLayerExtraBoolean(raw, true) === true;
}

function resolveProvinceCityHighlightSelectionId(page, settings = {}) {
  const extraConfig = settings && typeof settings.extraConfig === "object" ? settings.extraConfig : null;
  const raw = extraConfig ? extraConfig[MAP_LAYER_EXTRA_CONFIG_PROVINCE_CITY_HIGHLIGHT_SELECTION_KEY] : undefined;
  if (typeof raw !== "string") {
    return "";
  }
  return raw.trim();
}

function resolveMapBaseLayerType(page, settings = {}) {
  const extraConfig = settings && typeof settings.extraConfig === "object" ? settings.extraConfig : null;
  const raw = extraConfig ? extraConfig[MAP_LAYER_EXTRA_CONFIG_BASE_LAYER_TYPE_KEY] : undefined;
  if (`${raw || ""}` === MAP_LAYER_BASE_TYPE_TIANDITU) {
    return "tianditu";
  }
  return settings.mapType === "SATELLITE" ? "satellite" : "standard";
}

function normalizeMyLocationIconType(value) {
  const text = `${value || ""}`.trim();
  if (text === MY_LOCATION_ICON_TYPES.HIGHLIGHT || text === MY_LOCATION_ICON_TYPES.AVATAR) {
    return text;
  }
  return MY_LOCATION_ICON_TYPES.DEFAULT;
}

function normalizeCenterPinIconType(value) {
  const text = `${value || ""}`.trim();
  return CENTER_PIN_ICON_PATHS[text] ? text : CENTER_PIN_ICON_TYPES.DEFAULT;
}

function resolveMyLocationIconType(page, settings = {}) {
  const extraConfig = settings && typeof settings.extraConfig === "object" ? settings.extraConfig : null;
  const raw = extraConfig ? extraConfig[MAP_LAYER_EXTRA_CONFIG_MY_LOCATION_ICON_TYPE_KEY] : undefined;
  const type = normalizeMyLocationIconType(raw);
  const resolved = type !== MY_LOCATION_ICON_TYPES.DEFAULT
    ? type
    : settings.useDefaultCenterPoint === false
    ? MY_LOCATION_ICON_TYPES.HIGHLIGHT
    : MY_LOCATION_ICON_TYPES.DEFAULT;
  return resolved !== MY_LOCATION_ICON_TYPES.DEFAULT && !page.data.userVip
    ? MY_LOCATION_ICON_TYPES.DEFAULT
    : resolved;
}

function resolveCenterPinIconType(page, settings = {}) {
  const extraConfig = settings && typeof settings.extraConfig === "object" ? settings.extraConfig : null;
  const resolved = normalizeCenterPinIconType(extraConfig ? extraConfig[MAP_LAYER_EXTRA_CONFIG_CENTER_PIN_ICON_TYPE_KEY] : "");
  return resolved !== CENTER_PIN_ICON_TYPES.DEFAULT && !page.data.userVip
    ? CENTER_PIN_ICON_TYPES.DEFAULT
    : resolved;
}

function resolveCenterPinIconPath(type) {
  return CENTER_PIN_ICON_PATHS[normalizeCenterPinIconType(type)] || CENTER_PIN_ICON_PATHS.default;
}

function resolveUomRenderColor(page, settings = {}) {
  void page;
  const extraConfig = settings && typeof settings.extraConfig === "object" ? settings.extraConfig : null;
  const raw = extraConfig ? extraConfig[MAP_LAYER_EXTRA_CONFIG_UOM_RENDER_COLOR_KEY] : undefined;
  if (raw === undefined || raw === null || raw === "") {
    return readStoredRenderColor();
  }
  return normalizeRenderColor(raw);
}

function onUomColorSelect(page, event = {}) {
  if (page.data.useUomOriginalLayer === true) {
    wx.showToast({ title: "当前使用UOM原始图层，颜色设置不可用", icon: "none" });
    return;
  }
  const requiresVip = `${resolveEventDataset(event).requiresVip || ""}` === "true";
  if (requiresVip && !page.data.userVip) {
    navigateToMemberPage();
    return;
  }
  const color = normalizeRenderColor(resolveEventDataset(event).color);
  if (color === page.data.uomRenderColor) return;
  writeStoredRenderColor(color);
  page.setData({ uomRenderColor: color }, () => {
    if (page._uomPlugin && typeof page._uomPlugin.setRenderColor === "function") {
      page._uomPlugin.setRenderColor(color);
    }
    page.persistMapLayerSettings();
  });
}

// Store an opt-out: legacy automatically persisted enabled=false must not disable the new default.
function resolveAerialPointsEnabled(settings = {}) {
  return !parseMapLayerExtraBoolean(settings.extraConfig?.aerialPointsDisabled, false);
}

function buildMapLayerExtraConfigPayload(page) {
  const existing =
    page._mapLayerSettings && typeof page._mapLayerSettings.extraConfig === "object"
      ? page._mapLayerSettings.extraConfig
      : null;
  const extraConfig = existing ? Object.assign({}, existing) : {};
  delete extraConfig.aerialPointsEnabled;
  extraConfig.aerialPointsDisabled = page.data.aerialPointsEnabled === false ? "true" : "false";
  delete extraConfig.useUomOriginalLayer;
  extraConfig[MAP_LAYER_EXTRA_CONFIG_DISABLE_CENTER_TARGET_LINK_KEY] =
    page.data.centerTargetLinkEnabled === false ? "true" : "false";
  extraConfig[MAP_LAYER_EXTRA_CONFIG_ENABLE_PROVINCE_CITY_HIGHLIGHT_KEY] =
    page.data.provinceCityHighlightEnabled === true ? "true" : "false";
  extraConfig[MAP_LAYER_EXTRA_CONFIG_PLANET_BROADCAST_STRIP_ENABLED_KEY] =
    page.data.planetBroadcastStripEnabled === false ? "false" : "true";
  const selectedId =
    `${page._provinceCityHighlightSelectedId || page.data.provinceCityHighlightSelectedId || ""}`.trim();
  const myLocationIconType =
    normalizeMyLocationIconType(page.data.myLocationIconType) !== MY_LOCATION_ICON_TYPES.DEFAULT ||
      page.data.usePlanetCenterPoint !== true
      ? normalizeMyLocationIconType(page.data.myLocationIconType)
      : MY_LOCATION_ICON_TYPES.HIGHLIGHT;
  extraConfig[MAP_LAYER_EXTRA_CONFIG_PROVINCE_CITY_HIGHLIGHT_SELECTION_KEY] = selectedId || null;
  extraConfig[MAP_LAYER_EXTRA_CONFIG_BASE_LAYER_TYPE_KEY] =
    page.data.mapLayerType === "tianditu" ? MAP_LAYER_BASE_TYPE_TIANDITU : null;
  extraConfig[MAP_LAYER_EXTRA_CONFIG_MY_LOCATION_ICON_TYPE_KEY] = myLocationIconType;
  extraConfig[MAP_LAYER_EXTRA_CONFIG_CENTER_PIN_ICON_TYPE_KEY] =
    normalizeCenterPinIconType(page.data.centerPinIconType);
  extraConfig[MAP_LAYER_EXTRA_CONFIG_UOM_RENDER_COLOR_KEY] =
    normalizeRenderColor(page.data.uomRenderColor) === UOM3_DEFAULT_RENDER_COLOR
      ? null
      : normalizeRenderColor(page.data.uomRenderColor);
  return extraConfig;
}

function buildMapLayerSettingsPayload(page) {
  const extraConfig = buildMapLayerExtraConfigPayload(page);
  return {
    mapType: page.data.mapLayerType === "satellite" || page.data.mapLayerType === "tianditu" ? "SATELLITE" : "STANDARD",
    airspaceBoardEnabled: !!page.data.airBoardEnabled,
    uomDivisionEnabled: !!page.data.uomDivisionEnabled,
    djiNoFlyZoneEnabled: !!page.data.djiNoFlyZoneEnabled,
    temporaryNoFlyZoneEnabled: !!page.data.temporaryNoFlyZoneEnabled,
    merchantMarkersEnabled: !!page.data.merchantMarkersEnabled,
    privateMarkersEnabled: !!page.data.privateMarkersEnabled,
    groupSharingEnabled: !!page.data.groupSharingEnabled,
    platformCoConstructionEnabled: !!page.data.platformCoConstructionEnabled,
    useDefaultCenterPoint: extraConfig[MAP_LAYER_EXTRA_CONFIG_MY_LOCATION_ICON_TYPE_KEY] === MY_LOCATION_ICON_TYPES.DEFAULT,
    aircraftModel: page.data.selectedDrone || "",
    extraConfig
  };
}

function composeMapElementOptionsResolved(flags = {}) {
  const state = Object.assign(
    {
      uomDivisionEnabled: true,
      djiNoFlyZoneEnabled: true,
      temporaryNoFlyZoneEnabled: true,
      merchantMarkersEnabled: true,
      privateMarkersEnabled: false,
      groupSharingEnabled: false,
      platformCoConstructionEnabled: true
    },
    flags
  );
  return [
    { id: "uom", label: "uom划分", enabled: !!state.uomDivisionEnabled },
    { id: "dji", label: "大疆划分", enabled: !!state.djiNoFlyZoneEnabled },
    { id: "tempNoFly", label: "临时禁飞区", enabled: !!state.temporaryNoFlyZoneEnabled },
    { id: "service", label: "商户服务", enabled: !!state.merchantMarkersEnabled },
    { id: "private", label: "私有标记", enabled: !!state.privateMarkersEnabled },
    { id: "group", label: "小组共享", enabled: !!state.groupSharingEnabled },
    { id: "platform", label: "平台共建", enabled: !!state.platformCoConstructionEnabled },
    { id: "aerial", label: "航拍点", enabled: !!state.aerialPointsEnabled }
  ];
}

function composeMapElementOptions(flags = {}) {
  const state = Object.assign(
    {
      uomDivisionEnabled: false,
      djiNoFlyZoneEnabled: true,
      temporaryNoFlyZoneEnabled: true,
      merchantMarkersEnabled: true,
      privateMarkersEnabled: false,
      groupSharingEnabled: false,
      platformCoConstructionEnabled: true
    },
    flags
  );
  const djiEnabled = !!state.djiNoFlyZoneEnabled;
  const tempEnabled = !!state.temporaryNoFlyZoneEnabled;
  return [
    { id: "uom", label: "uom划分", enabled: false, disabled: true },
    { id: "dji", label: "大疆划分", enabled: djiEnabled },
    { id: "tempNoFly", label: "临时禁飞区", enabled: tempEnabled },
    { id: "service", label: "商户服务", enabled: !!state.merchantMarkersEnabled },
    { id: "private", label: "私有标记", enabled: !!state.privateMarkersEnabled },
    { id: "group", label: "小组共享", enabled: !!state.groupSharingEnabled },
    { id: "platform", label: "平台共建", enabled: !!state.platformCoConstructionEnabled },
    { id: "aerial", label: "航拍点", enabled: !!state.aerialPointsEnabled }
  ];
}

function applyLayerSettings(page, settings = {}, options = {}) {
  const resolvedMapType = page.resolveMapBaseLayerType(settings);
  const mapType =
    (resolvedMapType === "satellite" || resolvedMapType === "tianditu") && !page.data.userVip
      ? "standard"
      : resolvedMapType;
  const airspace = settings.airspaceBoardEnabled !== false;
  const uom = settings.uomDivisionEnabled !== false;
  const dji = settings.djiNoFlyZoneEnabled !== false;
  const temporary = settings.temporaryNoFlyZoneEnabled !== undefined
    ? settings.temporaryNoFlyZoneEnabled !== false
    : page.data.temporaryNoFlyZoneEnabled !== false;
  const merchant = settings.merchantMarkersEnabled !== false;
  const privateMarkers = settings.privateMarkersEnabled !== false;
  const groupSharing = settings.groupSharingEnabled !== false;
  const platformCoConstruction = settings.platformCoConstructionEnabled !== false;
  const aerialPointsEnabled = resolveAerialPointsEnabled(settings);
  const centerTargetLinkEnabled = page.resolveCenterTargetLinkEnabled(settings);
  const useUomOriginalLayer = page.resolveUseUomOriginalLayer(settings);
  const provinceCityHighlightEnabled = page.resolveProvinceCityHighlightEnabled(settings);
  const planetBroadcastStripEnabled = page.resolvePlanetBroadcastStripEnabled(settings);
  const provinceCityHighlightSelectionId = page.resolveProvinceCityHighlightSelectionId(settings);
  const myLocationIconType = page.resolveMyLocationIconType(settings);
  const centerPinIconType = page.resolveCenterPinIconType(settings);
  const usePlanetCenterPoint = myLocationIconType !== MY_LOCATION_ICON_TYPES.DEFAULT;
  const mapElementOptions = page.composeMapElementOptions({
    aerialPointsEnabled,
    uomDivisionEnabled: uom,
    djiNoFlyZoneEnabled: dji,
    temporaryNoFlyZoneEnabled: temporary,
    merchantMarkersEnabled: merchant,
    privateMarkersEnabled: privateMarkers,
    groupSharingEnabled: groupSharing,
    platformCoConstructionEnabled: platformCoConstruction
  });
  page.setData(
    {
      mapLayerType: mapType,
      enableSatellite: mapType === "satellite" || mapType === "tianditu",
      airBoardEnabled: airspace,
      showDashboardPanel: airspace,
      planetBroadcastStripEnabled,
      uomDivisionEnabled: uom,
      djiNoFlyZoneEnabled: dji,
      temporaryNoFlyZoneEnabled: temporary,
      merchantMarkersEnabled: merchant,
      privateMarkersEnabled: privateMarkers,
      groupSharingEnabled: groupSharing,
      platformCoConstructionEnabled: platformCoConstruction,
      aerialPointsEnabled,
      myLocationIconType,
      usePlanetCenterPoint,
      centerPinIconType,
      centerPinIconPath: page.resolveCenterPinIconPath(centerPinIconType),
      centerTargetLinkEnabled,
      useUomOriginalLayer,
      provinceCityHighlightEnabled,
      provinceCityHighlightSelectedId: provinceCityHighlightSelectionId,
      myLocationModeResolved: true,
      mapElementOptions
    },
    () => {
      page._provinceCityHighlightSelectedId = provinceCityHighlightSelectionId;
      if (myLocationIconType === MY_LOCATION_ICON_TYPES.AVATAR && typeof page.ensureMyLocationAvatarIcon === "function") {
        page.ensureMyLocationAvatarIcon({ force: true });
      }
      const afterLocationReady = () => {
        page.refreshMyLocationGraphics(page.data.myLocationPoint || page._lastKnownLocation || null);
        page.applyAirBoardToggle(airspace);
        page.ensureUomPluginReady({
          center: page._centerOverride || page.data.center,
          region: page._lastRegion || null,
          scale: page.data.scale
        });
        page.setTiandituSatelliteLayerEnabled(mapType === "tianditu", { force: true });
        page.applyNoFlyOverlayToggle({ djiEnabled: dji, temporaryEnabled: temporary });
        page.applyMerchantMarkersToggle(merchant);
        page.applyPinLayerToggle(true);
        page.scheduleFetchAerialPoints?.();
        page.syncProvinceCityHighlightLayer(provinceCityHighlightEnabled, { showErrorToast: false });
        if (typeof options.onApplied === "function") {
          options.onApplied();
        }
      };
      if (usePlanetCenterPoint) {
        const fallbackPoint =
          page.data.myLocationPoint ||
          page._lastKnownLocation ||
          page.resolveCachedMapLocationPoint();
        if (
          Number.isFinite(Number(fallbackPoint?.latitude)) &&
          Number.isFinite(Number(fallbackPoint?.longitude))
        ) {
          page._lastKnownLocation = {
            latitude: Number(fallbackPoint.latitude),
            longitude: Number(fallbackPoint.longitude)
          };
          page.setMyLocationControlPoint(page._lastKnownLocation, { syncCenter: false });
          afterLocationReady();
          if (page._skipNextApplyLayerInitialSync) {
            page._skipNextApplyLayerInitialSync = false;
            return;
          }
        } else if (page._skipNextApplyLayerInitialSync) {
          page._skipNextApplyLayerInitialSync = false;
          afterLocationReady();
          return;
        }
        page.syncMyLocationPoint({ silent: true, syncCenter: false }).finally(() => {
          if (
            !Number.isFinite(Number(fallbackPoint?.latitude)) ||
            !Number.isFinite(Number(fallbackPoint?.longitude))
          ) {
            afterLocationReady();
          }
        });
        return;
      }
      afterLocationReady();
      page.bootstrapInitialNativeLocationCenter();
    }
  );
}

function applyLayerSettingsResolved(page, settings = {}, options = {}) {
  const resolvedMapType = page.resolveMapBaseLayerType(settings);
  const mapType =
    (resolvedMapType === "satellite" || resolvedMapType === "tianditu") && !page.data.userVip
      ? "standard"
      : resolvedMapType;
  const airspace = settings.airspaceBoardEnabled !== false;
  const uom = settings.uomDivisionEnabled !== false;
  const dji = settings.djiNoFlyZoneEnabled !== false;
  const temporary = settings.temporaryNoFlyZoneEnabled !== undefined
    ? settings.temporaryNoFlyZoneEnabled !== false
    : page.data.temporaryNoFlyZoneEnabled !== false;
  const merchant = settings.merchantMarkersEnabled !== false;
  const privateMarkers = settings.privateMarkersEnabled !== false;
  const groupSharing = settings.groupSharingEnabled !== false;
  const platformCoConstruction = settings.platformCoConstructionEnabled !== false;
  const aerialPointsEnabled = resolveAerialPointsEnabled(settings);
  const centerTargetLinkEnabled = page.resolveCenterTargetLinkEnabled(settings);
  const useUomOriginalLayer = page.resolveUseUomOriginalLayer(settings);
  const provinceCityHighlightEnabled = page.resolveProvinceCityHighlightEnabled(settings);
  const planetBroadcastStripEnabled = page.resolvePlanetBroadcastStripEnabled(settings);
  const provinceCityHighlightSelectionId = page.resolveProvinceCityHighlightSelectionId(settings);
  const myLocationIconType = page.resolveMyLocationIconType(settings);
  const centerPinIconType = page.resolveCenterPinIconType(settings);
  const uomRenderColor = page.resolveUomRenderColor(settings);
  const usePlanetCenterPoint = myLocationIconType !== MY_LOCATION_ICON_TYPES.DEFAULT;
  const mapElementOptions = page.composeMapElementOptions({
    aerialPointsEnabled,
    uomDivisionEnabled: uom,
    djiNoFlyZoneEnabled: dji,
    temporaryNoFlyZoneEnabled: temporary,
    merchantMarkersEnabled: merchant,
    privateMarkersEnabled: privateMarkers,
    groupSharingEnabled: groupSharing,
    platformCoConstructionEnabled: platformCoConstruction
  });
  page.setData(
    {
      mapLayerType: mapType,
      enableSatellite: mapType === "satellite" || mapType === "tianditu",
      airBoardEnabled: airspace,
      showDashboardPanel: airspace,
      planetBroadcastStripEnabled,
      uomDivisionEnabled: uom,
      djiNoFlyZoneEnabled: dji,
      temporaryNoFlyZoneEnabled: temporary,
      merchantMarkersEnabled: merchant,
      privateMarkersEnabled: privateMarkers,
      groupSharingEnabled: groupSharing,
      platformCoConstructionEnabled: platformCoConstruction,
      aerialPointsEnabled,
      myLocationIconType,
      usePlanetCenterPoint,
      centerPinIconType,
      centerPinIconPath: page.resolveCenterPinIconPath(centerPinIconType),
      centerTargetLinkEnabled,
      useUomOriginalLayer,
      provinceCityHighlightEnabled,
      provinceCityHighlightSelectedId: provinceCityHighlightSelectionId,
      uomRenderColor,
      myLocationModeResolved: true,
      mapElementOptions
    },
    () => {
      writeStoredRenderColor(uomRenderColor);
      page._provinceCityHighlightSelectedId = provinceCityHighlightSelectionId;
      if (myLocationIconType === MY_LOCATION_ICON_TYPES.AVATAR && typeof page.ensureMyLocationAvatarIcon === "function") {
        page.ensureMyLocationAvatarIcon({ force: true });
      }
      const afterLocationReady = () => {
        page.refreshMyLocationGraphics(page.data.myLocationPoint || page._lastKnownLocation || null);
        page.applyAirBoardToggle(airspace);
        page.ensureUomPluginReady({
          center: page._centerOverride || page.data.center,
          region: page._lastRegion || null,
          scale: page.data.scale
        });
        if (page._uomPlugin && typeof page._uomPlugin.setRenderColor === "function") {
          page._uomPlugin.setRenderColor(uomRenderColor);
        }
        page.setTiandituSatelliteLayerEnabled(mapType === "tianditu", { force: true });
        page.applyNoFlyOverlayToggle({ djiEnabled: dji, temporaryEnabled: temporary });
        page.applyMerchantMarkersToggle(merchant);
        page.applyPinLayerToggle(true);
        page.scheduleFetchAerialPoints?.();
        page.syncProvinceCityHighlightLayer(provinceCityHighlightEnabled, { showErrorToast: false });
        if (typeof options.onApplied === "function") {
          options.onApplied();
        }
      };
      if (usePlanetCenterPoint) {
        const fallbackPoint =
          page.data.myLocationPoint ||
          page._lastKnownLocation ||
          page.resolveCachedMapLocationPoint();
        if (
          Number.isFinite(Number(fallbackPoint?.latitude)) &&
          Number.isFinite(Number(fallbackPoint?.longitude))
        ) {
          page._lastKnownLocation = {
            latitude: Number(fallbackPoint.latitude),
            longitude: Number(fallbackPoint.longitude)
          };
          page.setMyLocationControlPoint(page._lastKnownLocation, { syncCenter: false });
          afterLocationReady();
          if (page._skipNextApplyLayerInitialSync) {
            page._skipNextApplyLayerInitialSync = false;
            return;
          }
        } else if (page._skipNextApplyLayerInitialSync) {
          page._skipNextApplyLayerInitialSync = false;
          afterLocationReady();
          return;
        }
        page.syncMyLocationPoint({ silent: true, syncCenter: false }).finally(() => {
          if (
            !Number.isFinite(Number(fallbackPoint?.latitude)) ||
            !Number.isFinite(Number(fallbackPoint?.longitude))
          ) {
            afterLocationReady();
          }
        });
        return;
      }
      afterLocationReady();
      page.bootstrapInitialNativeLocationCenter();
    }
  );
}

function loadMapLayerSettings(page, force = false) {
  if (page.data.mapLayerSettingsLoading) return;
  if (page._mapLayerSettingsLoaded && !force) return;
  const apiBase = page.getApiBase();
  const token = page.getAuthToken();
  if (!apiBase || !token) {
    if (!page.data.myLocationModeResolved) {
      page.setData({ myLocationModeResolved: true });
    }
    return;
  }
  const revision = page._mapLayerSettingsRevision || 0;
  page.setData({ mapLayerSettingsLoading: true });
  fetchMapLayerSettings({
    apiBase,
    token
  })
    .then((settings) => {
      if (page._mapLayerSettingsSaving || revision !== (page._mapLayerSettingsRevision || 0)) return;
      if (settings) {
        page._mapLayerSettings = settings;
        applyLayerSettingsResolved(page, settings, {
          onApplied: () => {
            const aircraftModel = page.normalizeAircraftModel(settings.aircraftModel);
            if (aircraftModel) {
              const applied = page.applyAircraftModelSetting(aircraftModel, { persist: false });
              if (!applied) {
                page._pendingAircraftModel = aircraftModel;
              } else {
                page._pendingAircraftModel = "";
              }
            } else if (!page._mapLayerAircraftModelWritten) {
              page._mapLayerAircraftModelWritten = true;
              if (page.data.selectedDrone) {
                page.persistMapLayerSettings();
              }
            }
          }
        });
        page._mapLayerSettingsLoaded = true;
        page.scheduleAddMiniAppPopupCheck("map-layer-settings");
      }
    })
    .catch((err) => {
      console.warn("Failed to load map layer settings", err);
    })
    .finally(() => {
      page.setData({
        mapLayerSettingsLoading: false,
        myLocationModeResolved: true
      });
    });
}

function loadUomLayerConfig(page, force = false) {
  if (page._uomLayerConfigPromise) return page._uomLayerConfigPromise;
  const apiBase = page.getApiBase();
  const token = page.getAuthToken();
  if (!apiBase || !token) {
    return Promise.resolve(null);
  }
  const previousUseOriginalLayer = page.data.useUomOriginalLayer === true;
  const previousToken = `${page._uomLayerToken || ""}`;
  const refreshUomPlugin = () => {
    const viewportOptions = {
      center: page._centerOverride || page.data.center,
      region: page._lastRegion || null,
      scale: page.data.scale
    };
    page.ensureUomPluginReady(viewportOptions);
    if (page._uomPlugin && typeof page._uomPlugin.handleRegionChange === "function") {
      page._uomPlugin.handleRegionChange(Object.assign({}, viewportOptions, { force: true }));
    }
  };
  const promise = prefetchUomLayerConfig({
    apiBase,
    token,
    forceRefresh: force === true
  })
    .then((config) => {
      const nextUseOriginalLayer = config?.useUomOriginalLayer === true;
      const nextToken = `${config?.token || ""}`;
      page._uomLayerToken = nextToken;
      if (nextUseOriginalLayer !== previousUseOriginalLayer) {
        return new Promise((resolve) => {
          page.setData({ useUomOriginalLayer: nextUseOriginalLayer }, resolve);
        }).then(() => {
          refreshUomPlugin();
          return config;
        });
      }
      if (nextToken !== previousToken) {
        refreshUomPlugin();
      }
      return config;
    })
    .catch((err) => {
      console.warn("Failed to load UOM layer config", err);
      return null;
    })
    .finally(() => {
      if (page._uomLayerConfigPromise === promise) {
        page._uomLayerConfigPromise = null;
      }
    });
  page._uomLayerConfigPromise = promise;
  return promise;
}

function bootstrapMapLayerSettings(page, force = false) {
  if (page._mapLayerSettingsInitPromise) return page._mapLayerSettingsInitPromise;
  const apiBase = page.getApiBase();
  const token = page.getAuthToken();
  if (apiBase && token) {
    loadMapLayerSettings(page, force);
    return Promise.resolve();
  }
  const promise = page.ensureProfileAuthenticated();
  if (!promise || typeof promise.then !== "function") {
    return Promise.resolve();
  }
  page._mapLayerSettingsInitPromise = promise
    .then(() => {
      loadMapLayerSettings(page, force);
    })
    .catch((err) => {
      console.warn("bootstrap map layer settings failed", err);
    })
    .finally(() => {
      page._mapLayerSettingsInitPromise = null;
    });
  return page._mapLayerSettingsInitPromise;
}

function persistMapLayerSettings(page) {
  const apiBase = page.getApiBase();
  const token = page.getAuthToken();
  if (!apiBase || !token) return;
  const payload = page.buildMapLayerSettingsPayload();
  const revision = page._mapLayerSettingsRevision = (page._mapLayerSettingsRevision || 0) + 1;
  page._mapLayerSettingsSaving = (page._mapLayerSettingsSaving || 0) + 1;
  page._mapLayerSettings = Object.assign({}, page._mapLayerSettings, payload);
  // Serialize writes so a slower earlier toggle cannot overwrite the last choice.
  const job = (page._mapLayerSettingsSaveQueue || Promise.resolve())
    .then(() => updateMapLayerSettings(payload, { apiBase, token }))
    .then(settings => {
      if (revision === page._mapLayerSettingsRevision) {
        page._mapLayerSettings = Object.assign({}, payload, settings);
      }
    })
    .catch(err => console.warn("Failed to update map layer settings", err))
    .finally(() => { page._mapLayerSettingsSaving -= 1; });
  page._mapLayerSettingsSaveQueue = job;
  return job;
}

module.exports = {
  onLayerButtonTap,
  onLayerPanelMaskTap,
  onLayerPanelClose,
  closeLayerPanel,
  onMapLayerSelect,
  onAirBoardSwitchChange,
  onUsePlanetCenterPointSwitchChange,
  onMyLocationIconSelect,
  onCenterPinIconSelect,
  onCenterTargetLinkSwitchChange,
  onUomColorSelect,
  buildProvinceCityTreeViewData,
  updateProvinceCityTreeData,
  scheduleLayerPanelLayoutMeasure,
  measureLayerPanelLayout,
  findProvinceCityTreeNodeById,
  setProvinceCityHighlightPolygons,
  loadProvinceCityHighlightResource,
  syncProvinceCityHighlightLayer,
  applyProvinceCityHighlightSelection,
  onProvinceCityHighlightSwitchChange,
  onPlanetBroadcastStripSwitchChange,
  onProvinceCityTreeExpandTap,
  onProvinceCityTreeSelectTap,
  onRegionConfirmTap,
  onMapElementToggle,
  applyNoFlyOverlayToggle,
  applyMerchantMarkersToggle,
  applyPinLayerToggle,
  parseMapLayerExtraBoolean,
  resolveAerialPointsEnabled,
  resolveCenterTargetLinkEnabled,
  resolveUseUomOriginalLayer,
  resolveProvinceCityHighlightEnabled,
  resolvePlanetBroadcastStripEnabled,
  resolveProvinceCityHighlightSelectionId,
  resolveMapBaseLayerType,
  normalizeMyLocationIconType,
  normalizeCenterPinIconType,
  resolveMyLocationIconType,
  resolveCenterPinIconType,
  resolveCenterPinIconPath,
  resolveUomRenderColor,
  buildMapLayerExtraConfigPayload,
  buildMapLayerSettingsPayload,
  composeMapElementOptions: composeMapElementOptionsResolved,
  applyLayerSettings: applyLayerSettingsResolved,
  loadUomLayerConfig,
  loadMapLayerSettings,
  bootstrapMapLayerSettings,
  persistMapLayerSettings
};
