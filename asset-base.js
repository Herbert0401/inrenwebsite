(function () {
  window.INREN_ASSET_BASE = window.INREN_ASSET_BASE || "https://pub-c58cbb9b5fbc44bb8be16a02a06946f2.r2.dev";

  const ABSOLUTE_RE = /^(?:[a-z]+:)?\/\//i;
  const SKIP_RE = /^(?:data:|blob:|mailto:|tel:|javascript:|#)/i;
  const IMG_RE = /^\.?\/?images\//i;

  const FALLBACK_DATA_URL = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 900'>"
      + "<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>"
      + "<stop offset='0%' stop-color='#07110d'/><stop offset='100%' stop-color='#12241b'/>"
      + "</linearGradient></defs>"
      + "<rect width='1200' height='900' fill='url(#g)'/>"
      + "<rect x='120' y='120' width='960' height='660' fill='none' stroke='#2d5847' stroke-width='6' stroke-dasharray='14 12'/>"
      + "<text x='50%' y='49%' text-anchor='middle' fill='#5a9970' font-size='42' font-family='Arial, sans-serif' letter-spacing='2'>IMAGE UNAVAILABLE</text>"
      + "<text x='50%' y='56%' text-anchor='middle' fill='#3c6f56' font-size='24' font-family='Arial, sans-serif'>R2 object missing or temporarily unreachable</text>"
      + "</svg>"
  );

  const normalizeBase = (base) => String(base || "").trim().replace(/\/+$/, "");

  const encodePath = (pathValue) => {
    const [rawPath, suffix = ""] = String(pathValue).split(/([?#].*)/, 2);
    const cleaned = rawPath.replace(/^\.?\//, "");
    const encoded = cleaned
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");
    return encoded + suffix;
  };

  const resolveAssetUrl = (input) => {
    if (!input) {
      return input;
    }

    const value = String(input).trim();
    if (!value || ABSOLUTE_RE.test(value) || SKIP_RE.test(value)) {
      return input;
    }

    if (!IMG_RE.test(value)) {
      return input;
    }

    const base = normalizeBase(window.INREN_ASSET_BASE);
    if (!base) {
      return input;
    }

    const normalizedValue = value.replace(IMG_RE, "");
    const prefix = /\/images$/i.test(base) ? base : base + "/images";
    return prefix + "/" + encodePath(normalizedValue);
  };

  const rewriteSrcset = (srcset) => {
    if (!srcset) {
      return srcset;
    }

    return srcset
      .split(",")
      .map((part) => {
        const trimmed = part.trim();
        if (!trimmed) {
          return trimmed;
        }
        const bits = trimmed.split(/\s+/);
        return [resolveAssetUrl(bits[0])].concat(bits.slice(1)).join(" ");
      })
      .join(", ");
  };

  const rewriteInlineStyleUrls = (styleText) => {
    if (!styleText || styleText.indexOf("url(") === -1) {
      return styleText;
    }

    return styleText.replace(/url\((['"]?)([^'")]+)\1\)/gi, (all, quote, url) => {
      const next = resolveAssetUrl(url);
      return next === url ? all : `url("${next}")`;
    });
  };

  const bindImageBehavior = (img) => {
    if (!img || img.tagName !== "IMG") {
      return;
    }

    if (!img.hasAttribute("loading")) {
      img.loading = "lazy";
    }
    if (!img.hasAttribute("decoding")) {
      img.decoding = "async";
    }

    if (img.dataset.inrenFallbackBound === "1") {
      return;
    }

    const onError = () => {
      if (img.dataset.inrenFallbackApplied === "1") {
        return;
      }

      const current = img.currentSrc || img.getAttribute("src") || "";
      if (current.indexOf("data:image/svg+xml") === 0) {
        return;
      }

      img.dataset.inrenFallbackApplied = "1";
      img.classList.add("inren-image-fallback");
      img.setAttribute("data-image-status", "fallback");
      img.removeAttribute("srcset");
      img.setAttribute("src", FALLBACK_DATA_URL);
    };

    img.dataset.inrenFallbackBound = "1";
    img.addEventListener("error", onError);

    if (img.complete && img.naturalWidth === 0 && img.getAttribute("src")) {
      onError();
    }
  };

  const applyToElement = (el) => {
    if (!el || el.nodeType !== 1) {
      return;
    }

    if (el.hasAttribute("src")) {
      const src = el.getAttribute("src");
      const next = resolveAssetUrl(src);
      if (next && next !== src) {
        el.setAttribute("src", next);
      }
    }

    if (el.hasAttribute("srcset")) {
      const srcset = el.getAttribute("srcset");
      const next = rewriteSrcset(srcset);
      if (next && next !== srcset) {
        el.setAttribute("srcset", next);
      }
    }

    if (el.hasAttribute("style")) {
      const styleValue = el.getAttribute("style");
      const nextStyle = rewriteInlineStyleUrls(styleValue);
      if (nextStyle && nextStyle !== styleValue) {
        el.setAttribute("style", nextStyle);
      }
    }

    bindImageBehavior(el);
  };

  const applyToTree = (root) => {
    const scope = root || document;
    applyToElement(scope);

    if (!scope.querySelectorAll) {
      return;
    }

    const candidates = scope.querySelectorAll("[src], [srcset], [style]");
    candidates.forEach(applyToElement);
  };

  const rewriteProductData = () => {
    const data = window.INREN_PRODUCTS;
    if (!data || typeof data !== "object") {
      return;
    }

    const walk = (node) => {
      if (Array.isArray(node)) {
        node.forEach((item, idx) => {
          if (typeof item === "string") {
            node[idx] = resolveAssetUrl(item);
          } else if (item && typeof item === "object") {
            walk(item);
          }
        });
        return;
      }

      Object.keys(node).forEach((key) => {
        const value = node[key];
        if (typeof value === "string") {
          node[key] = resolveAssetUrl(value);
        } else if (value && typeof value === "object") {
          walk(value);
        }
      });
    };

    walk(data);
  };

  const ensurePerformanceHints = () => {
    const base = normalizeBase(window.INREN_ASSET_BASE);
    if (!base) {
      return;
    }

    try {
      const origin = new URL(base).origin;
      const selector = `link[rel=\"preconnect\"][href=\"${origin}\"]`;
      if (document.head.querySelector(selector)) {
        return;
      }

      const link = document.createElement("link");
      link.rel = "preconnect";
      link.href = origin;
      link.crossOrigin = "anonymous";
      document.head.appendChild(link);
    } catch (_error) {
      // Ignore invalid URLs; local paths still work.
    }
  };

  window.inrenResolveAssetUrl = resolveAssetUrl;
  window.inrenApplyAssetBase = function (root) {
    rewriteProductData();
    applyToTree(root || document);
  };

  const boot = () => {
    ensurePerformanceHints();
    rewriteProductData();
    applyToTree(document);

    const observer = new MutationObserver((records) => {
      records.forEach((record) => {
        record.addedNodes.forEach((node) => {
          applyToTree(node);
        });
      });
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
