(function () {
  // Public R2 domain base for all image assets.
  // Supports either:
  // - https://<public-domain>.r2.dev
  // - https://<public-domain>.r2.dev/images
  window.INREN_ASSET_BASE = window.INREN_ASSET_BASE || "https://pub-c58cbb9b5fbc44bb8be16a02a06946f2.r2.dev";

  const ABSOLUTE_RE = /^(?:[a-z]+:)?\/\//i;
  const SKIP_RE = /^(?:data:|blob:|mailto:|tel:|javascript:|#)/i;
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

   const ensurePerformanceHints = () => {
     const base = normalizeBase(window.INREN_ASSET_BASE);
     if (!base) {
       return;
     }

     let origin = "";
     try {
       origin = new URL(base).origin;
     } catch (_error) {
       return;
     }

     if (!origin) {
       return;
     }

     const existing = document.head.querySelector(`link[rel="preconnect"][href="${origin}"]`);
     if (existing) {
       return;
     }

     const link = document.createElement("link");
     link.rel = "preconnect";
     link.href = origin;
     link.crossOrigin = "anonymous";
     document.head.appendChild(link);
   };

  const encodePath = (pathValue) => {
    const [rawPath, suffix = ""] = String(pathValue).split(/([?#].*)/, 2);
    const cleaned = rawPath.replace(/^\.?\//, "");
    const encoded = cleaned
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");
    return encoded + suffix;
  };

  const stripLeadingImages = (pathValue) => pathValue.replace(/^\.?\/?images\//i, "");

  const resolveAssetUrl = (input) => {
    if (!input) {
      return input;
    }

    const value = String(input).trim();
    if (!value || ABSOLUTE_RE.test(value) || SKIP_RE.test(value)) {
      return input;
    }

    if (!/^\.?\/?images\//i.test(value)) {
      return input;
    }

    const base = normalizeBase(window.INREN_ASSET_BASE);
    if (!base) {
      return input;
    }

    const normalizedValue = /^\.?\/?images\//i.test(value)
      ? stripLeadingImages(value)
      : value;

    const baseHasImagesSuffix = /\/images$/i.test(base);
    const prefix = baseHasImagesSuffix ? base : base + "/images";
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
        const rewritten = resolveAssetUrl(bits[0]);
        return [rewritten].concat(bits.slice(1)).join(" ");
      })
      .join(", ");
  };

  const rewriteInlineStyleUrls = (styleText) => {
    if (!styleText || styleText.indexOf("url(") === -1) {
      return styleText;
    }

    return styleText.replace(/url\((['"]?)([^'")]+)\1\)/gi, (all, quote, url) => {
      const next = resolveAssetUrl(url);
      if (next === url) {
        return all;
      }
      return "url(\"" + next + "\")";
    });
  };

  const bindImageFallback = (img) => {
    if (!img || img.tagName !== "IMG") {
      return;
    }

    if (img.dataset.inrenFallbackBound === "1") {
      return;
    }

    const activateFallback = () => {
      if (img.dataset.inrenFallbackApplied === "1") {
        return;
      }

      const current = img.currentSrc || img.getAttribute("src") || "";
      if (current.indexOf("data:image/svg+xml") === 0) {
        return;

       if (!img.hasAttribute("decoding")) {
         img.decoding = "async";
       }
       if (!img.hasAttribute("loading")) {
         img.loading = "lazy";
       }
       if (!img.hasAttribute("fetchpriority")) {
         img.setAttribute("fetchpriority", "low");
       }

      }

      img.dataset.inrenFallbackApplied = "1";
      img.classList.add("inren-image-fallback");
      img.setAttribute("data-image-status", "fallback");
      img.removeAttribute("srcset");
      img.setAttribute("src", FALLBACK_DATA_URL);
    };

    img.dataset.inrenFallbackBound = "1";
    img.addEventListener("error", activateFallback);

    if (img.complete && img.naturalWidth === 0 && img.getAttribute("src")) {
      activateFallback();
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

    bindImageFallback(el);

    if (el.hasAttribute("srcset")) {
      const srcset = el.getAttribute("srcset");
      const next = rewriteSrcset(srcset);
      if (next && next !== srcset) {
        el.setAttribute("srcset", next);
      }
    }

    if (el.hasAttribute("style")) {

     const deferBackgroundImage = (el) => {
       if (!el || el.nodeType !== 1) {
         return;
       }

       if (!el.classList || !el.classList.contains("gallery-image")) {
         return;
       }

       if (el.dataset.inrenBgBound === "1") {
         return;
       }

       el.dataset.inrenBgBound = "1";

       const bg = getComputedStyle(el).backgroundImage;
       if (!bg || bg === "none") {
         return;
       }

       if (!bgObserver) {
         return;
       }

       el.dataset.inrenDeferredBg = bg;
       el.style.backgroundImage = "none";
       bgObserver.observe(el);
     };
      const styleValue = el.getAttribute("style");
      const nextStyle = rewriteInlineStyleUrls(styleValue);
      if (nextStyle && nextStyle !== styleValue) {
        el.setAttribute("style", nextStyle);
      }
    }
  };

  const applyToTree = (root) => {
    const scope = root || document;
    applyToElement(scope);
     deferBackgroundImage(scope);

    if (!scope.querySelectorAll) {
      return;
    }

    const candidates = scope.querySelectorAll("[src], [srcset], [style]");
    candidates.forEach(applyToElement);

     const bgCandidates = scope.querySelectorAll(".gallery-image");
     bgCandidates.forEach(deferBackgroundImage);
  };

  const rewriteProductData = () => {
    const data = window.INREN_PRODUCTS;
    if (!data || typeof data !== "object") {
      return;
    }

    const walk = (node) => {
      if (Array.isArray(node)) {
        for (let i = 0; i < node.length; i += 1) {
          const value = node[i];
          if (typeof value === "string") {
            node[i] = resolveAssetUrl(value);
          } else if (value && typeof value === "object") {
            walk(value);
          }
        }
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

  window.inrenResolveAssetUrl = resolveAssetUrl;
  window.inrenApplyAssetBase = function (root) {
    rewriteProductData();
    applyToTree(root || document);
  };

  const boot = function () {
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

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
