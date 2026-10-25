(() => {
  globalThis.__browseShieldOverlayHeuristics = {
    isLikelyOverlay(m) {
      if (!m.viewportWidth || !m.viewportHeight || m.width <= 0 || m.height <= 0) return false;
      if (!["fixed", "absolute"].includes(m.position) || m.display === "none" || m.visibility === "hidden" || m.pointerEvents === "none") return false;
      if (["VIDEO", "AUDIO", "CANVAS"].includes(m.tagName)) return false;
      const ratio = (m.width * m.height) / (m.viewportWidth * m.viewportHeight);
      if (m.id === "dontfoid") return ratio >= 0.3;
      if (ratio < 0.3) return false;
      const parts = m.backgroundColor.match(/rgba?\(([^)]+)\)/i)?.[1]?.split(/[\s,\/]+/).filter(Boolean) ?? [];
      const alpha = parts.length >= 4 ? Number.parseFloat(parts[3]) : 1;
      const transparent = m.backgroundColor.trim().toLowerCase() === "transparent" || (Number.isFinite(alpha) && alpha <= 0.05);
      const invisible = Number.isFinite(m.opacity) && m.opacity <= 0.15;
      const stacked = Number.isFinite(m.zIndex) && m.zIndex >= 1000;
      const viewportCover = ratio >= 0.7;
      return (invisible && (stacked || viewportCover)) || (transparent && (stacked || viewportCover)) || (stacked && viewportCover);
    }
  };
})();
