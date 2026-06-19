// line · shared cross-dashboard nav. Each dashboard places an empty
// `<span data-lr-nav></span>` in its header; this fills it with consistent
// links and highlights the current page. Styling lives in /shared/theme.css
// (.lr-nav). Kept tiny and dependency-free so every page can include it.
(() => {
  const LINKS = [
    { href: "/dashboard/", label: "Runs", match: /^\/dashboard\// },
    { href: "/spec-dashboard/", label: "Specs", match: /^\/spec-dashboard\// },
    { href: "/impact/index.html", label: "Impact", match: /^\/impact\// },
  ];
  const here = location.pathname;
  for (const slot of document.querySelectorAll("[data-lr-nav]")) {
    const nav = document.createElement("nav");
    nav.className = "lr-nav";
    nav.setAttribute("aria-label", "Dashboards");
    for (const { href, label, match } of LINKS) {
      const a = document.createElement("a");
      a.href = href;
      a.textContent = label;
      if (match.test(here)) a.setAttribute("aria-current", "page");
      nav.appendChild(a);
    }
    slot.replaceChildren(nav);
  }
})();
