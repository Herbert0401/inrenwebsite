(function () {
  // Public R2 domain base for all image assets.
  // Supports either:
  // - https://<public-domain>.r2.dev
  // - https://<public-domain>.r2.dev/images
  window.INREN_ASSET_BASE = window.INREN_ASSET_BASE || "https://pub-c58cbb9b5fbc44bb8be16a02a06946f2.r2.dev";

  const ABSOLUTE_RE = /^(?:[a-z]+:)?\/\//i;
  const SKIP_RE = /^(?:data:|blob:|mailto:|tel:|javascript:|#)/i;

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
